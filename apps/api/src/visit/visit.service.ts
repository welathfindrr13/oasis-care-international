import { Injectable, HttpStatus, Logger, Inject } from "@nestjs/common";
import { VisitRepository } from "./visit.repository";
import { CreateVisitInput } from "./dto/create-visit.input";
import { UpdateVisitInput } from "./dto/update-visit.input";
import { VisitFilterArgs } from "./dto/visit-filter.args";
import {
  CareLog,
  CareLogCategory,
  Visit,
  VisitTask,
  VisitStatus,
} from "@oasis/db";
import { ClsService } from "nestjs-cls";
import { BaseHttpException } from "../common/errors/base-http.exception";
import { ErrorCode } from "../common/errors/error-codes";
import { Counter } from "prom-client";
import { CareLogService } from "../care-log/care-log.service";
import { RecordVisitTaskOutcomeInput } from "./dto/record-visit-task-outcome.input";
import { SubmitVisitCareNoteInput } from "./dto/submit-visit-care-note.input";
import { CompleteVisitInput } from "./dto/complete-visit.input";
import { CreateCareLogInput } from "../care-log/dto/create-care-log.input";
import { VisitTaskOutcome } from "./dto/visit.dto";
import { VISIT_TASK_OUTCOME_PREFIX } from "./visit.constants";
import {
  type CanonicalCapabilityActor,
  hasCanonicalActorCapability,
} from "../auth/access-capability";
import { ACCESS_UNAVAILABLE_MESSAGE } from "../auth/access-context.service";

@Injectable()
export class VisitService {
  private readonly logger = new Logger(VisitService.name);

  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly cls: ClsService,
    private readonly careLogService: CareLogService,
    @Inject("visit_overlap_total") private readonly overlapCounter: Counter,
    @Inject("visits_created_total") private readonly createCounter: Counter,
  ) {}

  async createVisit(
    data: CreateVisitInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Visit> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get("requestId");
    this.logger.log(`Creating visit for carer ${data.carerId}`, { requestId });

    const scheduledStart = new Date(data.scheduledStart);
    const scheduledEnd = new Date(data.scheduledEnd);
    const created = await this.visitRepository.createIfAssignable(
      {
        organization: { connect: { id: orgId } },
        carer: { connect: { id: data.carerId } },
        client: { connect: { id: data.clientId } },
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: data.status || VisitStatus.SCHEDULED,
        notes: data.notes,
      },
      {
        organizationId: orgId,
        carerId: data.carerId,
        clientId: data.clientId,
        scheduledStart,
        scheduledEnd,
      },
    );
    if (created.status === "INVALID_TENANT_RESOURCE") {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        "Carer and client must belong to your organization",
        HttpStatus.FORBIDDEN,
      );
    }

    if (created.status === "OVERLAP") {
      this.logger.warn(`Overlapping visit found for carer ${data.carerId}`, {
        requestId,
      });
      this.overlapCounter.inc();
      throw new BaseHttpException(
        ErrorCode.VISIT_OVERLAP,
        "Carer already has a visit scheduled during this time period",
        HttpStatus.CONFLICT,
      );
    }

    const visit = created.visit;

    // Create initial tasks if provided
    if (data.tasks && data.tasks.length > 0) {
      for (const task of data.tasks) {
        await this.visitRepository.createTask(visit.id, {
          task_name: task.taskName,
          description: task.description,
        });
      }

      // Refetch visit with tasks
      return this.visitRepository.findById(visit.id, orgId) as Promise<Visit>;
    }

    this.createCounter.inc();
    this.logger.log(`Visit ${visit.id} created successfully`, { requestId });
    return visit;
  }

  async updateVisit(
    id: string,
    data: UpdateVisitInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Visit> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get("requestId");
    const unsafeFields = ["actualStart", "actualEnd", "status", "notes"].filter(
      (field) => Object.prototype.hasOwnProperty.call(data, field),
    );
    if (unsafeFields.length > 0) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        "Visit oversight can only change scheduled start and end times",
        HttpStatus.BAD_REQUEST,
      );
    }
    const visit = await this.visitRepository.findById(id, orgId);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // Check permissions
    this.checkVisitAccess(visit, userId, userRole, "update");

    const scheduledStart = data.scheduledStart
      ? new Date(data.scheduledStart)
      : null;
    const scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : null;
    const effectiveStart = scheduledStart || visit.scheduled_start;
    const effectiveEnd = scheduledEnd || visit.scheduled_end;
    if (
      Number.isNaN(effectiveStart.getTime()) ||
      Number.isNaN(effectiveEnd.getTime()) ||
      effectiveStart >= effectiveEnd
    ) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        "Scheduled start must be before scheduled end",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.visitRepository.updateScheduleAtomically({
      visitId: id,
      organizationId: orgId,
      expectedCarerId: visit.carer_id,
      scheduledStart,
      scheduledEnd,
    });
    if (result.status === "UPDATED") {
      this.logger.log(`Updated visit schedule ${id}`, { requestId });
      return result.visit;
    }
    if (result.status === "OVERLAP") {
      throw new BaseHttpException(
        ErrorCode.VISIT_OVERLAP,
        "Carer already has a visit scheduled during this time period",
        HttpStatus.CONFLICT,
      );
    }
    if (result.status === "TERMINAL") {
      throw new BaseHttpException(
        ErrorCode.VISIT_COMPLETION_CONFLICT,
        "Completed or cancelled visits cannot be rescheduled",
        HttpStatus.CONFLICT,
      );
    }
    throw new BaseHttpException(
      ErrorCode.VISIT_NOT_FOUND,
      "Visit not found",
      HttpStatus.NOT_FOUND,
    );
  }

  async findVisitById(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Visit> {
    const orgId = await this.requireOrganizationId(organizationId);
    const visit = await this.visitRepository.findById(id, orgId);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    this.checkVisitAccess(visit, userId, userRole, "read");
    return visit;
  }

  async findVisits(
    filter: VisitFilterArgs,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<{ items: Visit[]; total: number }> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get("requestId");
    const where: any = {};

    // Apply additional filters
    if (filter.carerId) where.carer_id = filter.carerId;
    if (filter.clientId) where.client_id = filter.clientId;
    if (filter.status) where.status = filter.status;

    if (filter.scheduledStartFrom || filter.scheduledStartTo) {
      where.scheduled_start = {};
      if (filter.scheduledStartFrom) {
        where.scheduled_start.gte = new Date(filter.scheduledStartFrom);
      }
      if (filter.scheduledStartTo) {
        where.scheduled_start.lte = new Date(filter.scheduledStartTo);
      }
    }

    // Enforce role scoping last so request filters cannot override ownership constraints.
    if (userRole === "carer") {
      where.carer_id = userId;
    } else if (userRole === "client") {
      where.client_id = userId;
    }

    this.logger.log(`Finding visits with filter`, { requestId, where });

    return this.visitRepository.findMany(
      {
        where,
        skip: filter.skip,
        take: filter.take || 20,
        orderBy: { scheduled_start: "desc" },
      },
      orgId,
    );
  }

  async deleteVisit(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<Visit> {
    const orgId = await this.requireOrganizationId(organizationId);
    const visit = await this.visitRepository.findById(id, orgId);

    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    this.checkVisitAccess(visit, userId, userRole, "delete");

    const requestId = this.cls.get("requestId");
    this.logger.log(`Soft deleting visit ${id}`, { requestId });

    return this.visitRepository.delete(id, orgId);
  }

  async completeTask(
    taskId: string,
    notes: string | undefined,
    userId: string,
    userRole: string,
    organizationId?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<VisitTask> {
    this.assertFrontlineExecution(accessContext, userId, userRole, organizationId);
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get("requestId");
    const task = await this.visitRepository.findTaskById(taskId, orgId);

    if (!task) {
      throw new BaseHttpException(
        ErrorCode.TASK_NOT_FOUND,
        "Task not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // Get the visit to check permissions
    const visit = await this.visitRepository.findById(task.visit_id, orgId);
    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    this.checkVisitAccess(visit, userId, userRole, "update");

    this.logger.log(`Completing task ${taskId}`, { requestId });

    return this.visitRepository.updateTask(
      taskId,
      {
        is_completed: true,
        completed_at: new Date(),
        notes: notes || task.notes,
      },
      orgId,
    );
  }

  async startVisit(
    visitId: string,
    userId: string,
    userRole: string,
    organizationId?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<Visit> {
    this.assertFrontlineExecution(accessContext, userId, userRole, organizationId);
    const orgId = await this.requireOrganizationId(organizationId);
    const membershipId = this.requireRuntimeMembership(accessContext);
    const identityProvider = this.requireClerkIdentityProvider(accessContext);
    const result = await this.visitRepository.startAtomically({
      visitId,
      organizationId: orgId,
      expectedCarerId: userId,
      actor: {
        authSubject: accessContext!.authSubject,
        identityProvider,
        membershipId,
      },
    });
    if (result.status === "STARTED" || result.status === "IDEMPOTENT") {
      return result.visit;
    }
    if (result.status === "NOT_FOUND") {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }
    if (result.status === "ACCESS_UNAVAILABLE") {
      this.denyRuntimeAccess();
    }
    if (result.status === "FORBIDDEN") {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        "You can only access your own visits",
        HttpStatus.FORBIDDEN,
      );
    }
    if (result.status === "CONFLICT") {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        "Only scheduled or in-progress visits can be started",
        HttpStatus.BAD_REQUEST,
      );
    }
    throw new BaseHttpException(
      ErrorCode.INTERNAL_ERROR,
      "Visit start returned an unexpected result",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async recordVisitTaskOutcome(
    input: RecordVisitTaskOutcomeInput,
    userId: string,
    userRole: string,
    organizationId?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<VisitTask> {
    this.assertFrontlineExecution(accessContext, userId, userRole, organizationId);
    const orgId = await this.requireOrganizationId(organizationId);
    const task = await this.visitRepository.findTaskById(input.taskId, orgId);
    if (!task) {
      throw new BaseHttpException(
        ErrorCode.TASK_NOT_FOUND,
        "Task not found",
        HttpStatus.NOT_FOUND,
      );
    }

    const visit = await this.visitRepository.findById(task.visit_id, orgId);
    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    this.checkVisitAccess(visit, userId, userRole, "update");

    const recordedAt = new Date();
    const noteText = this.toNonEmpty(input.notes);
    const outcomeMetadata: Record<string, string> = {
      outcome: input.outcome,
      recordedAt: recordedAt.toISOString(),
      recordedBy: userId,
    };
    if (noteText) {
      outcomeMetadata.note = noteText;
    }

    const metadataLine = `${VISIT_TASK_OUTCOME_PREFIX}${JSON.stringify(outcomeMetadata)}`;
    const mergedNotes = this.mergeTaskNotes(task.notes, noteText, metadataLine);

    return this.visitRepository.updateTask(
      task.id,
      {
        is_completed: input.outcome === VisitTaskOutcome.DONE,
        completed_at:
          input.outcome === VisitTaskOutcome.DONE ? recordedAt : null,
        notes: mergedNotes,
      },
      orgId,
    );
  }

  async submitVisitCareNote(
    input: SubmitVisitCareNoteInput,
    userId: string,
    userRole: string,
    organizationId?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<CareLog> {
    this.assertFrontlineExecution(accessContext, userId, userRole, organizationId);
    const orgId = await this.requireOrganizationId(organizationId);
    const visit = await this.visitRepository.findById(input.visitId, orgId);
    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }

    this.checkVisitAccess(visit, userId, userRole, "update");

    const createInput: CreateCareLogInput = {
      clientId: visit.client_id,
      carerId: visit.carer_id,
      visitId: visit.id,
      occurredAt: input.occurredAt || new Date().toISOString(),
      category: input.category,
      notes: input.notes,
      escalated: input.escalated,
      escalatedTo: input.escalatedTo,
      source: "visit_workflow",
    };

    return this.careLogService.createCareLog(
      createInput,
      userId,
      userRole,
      orgId,
      accessContext,
    );
  }

  async completeVisit(
    input: CompleteVisitInput,
    userId: string,
    userRole: string,
    organizationId?: string,
    accessContext?: CanonicalCapabilityActor,
  ): Promise<Visit> {
    this.assertFrontlineExecution(accessContext, userId, userRole, organizationId);
    const orgId = await this.requireOrganizationId(organizationId);
    const membershipId = this.requireRuntimeMembership(accessContext);
    const identityProvider = this.requireClerkIdentityProvider(accessContext);
    const visitNote = this.toNonEmpty(input.notes);
    const result = await this.visitRepository.completeAtomically({
      visitId: input.visitId,
      organizationId: orgId,
      expectedCarerId: userId,
      completionNote: visitNote,
      actor: {
        authSubject: accessContext!.authSubject,
        identityProvider,
        membershipId,
        role: accessContext!.effectiveRole || userRole,
        surface: accessContext!.surface,
      },
    });

    if (result.status === "COMPLETED" || result.status === "IDEMPOTENT") {
      return result.visit;
    }
    if (result.status === "NOT_FOUND") {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        "Visit not found",
        HttpStatus.NOT_FOUND,
      );
    }
    if (result.status === "FORBIDDEN") {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        "You can only access your own visits",
        HttpStatus.FORBIDDEN,
      );
    }
    if (result.status === "ACCESS_UNAVAILABLE") {
      this.denyRuntimeAccess();
    }
    if (result.status === "EVIDENCE_REQUIRED") {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        "Complete visit requires task outcome, care log, medication outcome, or visit note",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (result.status !== "CONFLICT") {
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        "Visit completion returned an unexpected result",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const message =
      result.reason === "CANCELLED"
        ? "Cancelled visits cannot be completed"
        : result.reason === "NOT_STARTED"
          ? "Visit must be started before it can be completed"
          : "Visit is already completed with different completion details";
    throw new BaseHttpException(
      ErrorCode.VISIT_COMPLETION_CONFLICT,
      message,
      HttpStatus.CONFLICT,
    );
  }

  private checkVisitAccess(
    visit: Visit & { carer?: any; client?: any },
    userId: string,
    userRole: string,
    action: "read" | "update" | "delete",
  ): void {
    if (userRole === "admin") {
      return; // Admin has full access
    }

    if (userRole === "carer") {
      if (visit.carer_id !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          "You can only access your own visits",
          HttpStatus.FORBIDDEN,
        );
      }
    } else if (userRole === "client") {
      if (visit.client_id !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          "You can only view your own visits",
          HttpStatus.FORBIDDEN,
        );
      }
      if (action !== "read") {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_READ_ONLY,
          "Clients have read-only access to visits",
          HttpStatus.FORBIDDEN,
        );
      }
    } else {
      throw new BaseHttpException(
        ErrorCode.INVALID_ROLE,
        "Invalid user role",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertFrontlineExecution(
    accessContext: CanonicalCapabilityActor | undefined,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): void {
    if (
      organizationId &&
      hasCanonicalActorCapability(accessContext, "FRONTLINE_VISIT_EXECUTE", {
        organizationId,
        userId,
        userRole,
      })
    ) {
      return;
    }
    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_ROLE_REQUIRED,
      "Only the assigned Carer can record visit care",
      HttpStatus.FORBIDDEN,
    );
  }

  private requireRuntimeMembership(
    accessContext: CanonicalCapabilityActor | undefined,
  ): string {
    const membershipId = accessContext?.membershipId?.trim();
    if (!membershipId) this.denyRuntimeAccess();
    return membershipId;
  }

  private denyRuntimeAccess(): never {
    throw new BaseHttpException(
      ErrorCode.FORBIDDEN,
      ACCESS_UNAVAILABLE_MESSAGE,
      HttpStatus.FORBIDDEN,
    );
  }

  private async requireOrganizationId(
    organizationId?: string,
  ): Promise<string> {
    const orgId = (organizationId || "").trim();
    if (orgId) {
      return orgId;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      "Organization context is required for this request",
      HttpStatus.FORBIDDEN,
    );
  }

  private toNonEmpty(value?: string | null): string | null {
    const trimmed = (value || "").trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requireClerkIdentityProvider(
    accessContext?: CanonicalCapabilityActor,
  ): "clerk" {
    if (accessContext?.identityProvider !== "clerk") {
      this.denyRuntimeAccess();
    }
    return "clerk";
  }

  private mergeTaskNotes(
    existingNotes: string | null | undefined,
    newFreeTextNote: string | null,
    metadataLine: string,
  ): string {
    const priorNotes = (existingNotes || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && !line.startsWith(VISIT_TASK_OUTCOME_PREFIX),
      );

    if (newFreeTextNote) {
      priorNotes.push(newFreeTextNote);
    }

    priorNotes.push(metadataLine);
    return priorNotes.join("\n");
  }
}
