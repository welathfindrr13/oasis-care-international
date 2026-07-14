import { Injectable } from "@nestjs/common";
import {
  PrismaService,
  Visit,
  VisitTask,
  Prisma,
  VisitStatus,
  MedicationStatus,
  CareLog,
  CareLogCategory,
} from "@oasis/db";
import { VISIT_TASK_OUTCOME_PREFIX } from "./visit.constants";
import { assertTenantOwnershipForSensitiveWrite } from "../common/tenant/tenant-ownership";
import {
  VISIT_COMPLETION_PROOF_VERSION,
  VisitCompletionProofKeyring,
  visitCompletionRecordProofPayload,
  visitCompletionRequestProofPayload,
} from "./visit-completion-proof-keyring";

export type CompleteVisitConflictReason =
  | "CANCELLED"
  | "COMPLETED_DETAILS"
  | "NOT_STARTED";

export type CompleteVisitAtomicResult =
  | { status: "COMPLETED" | "IDEMPOTENT"; visit: Visit }
  | {
      status:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "ACCESS_UNAVAILABLE"
        | "EVIDENCE_REQUIRED";
    }
  | { status: "CONFLICT"; reason: CompleteVisitConflictReason };

export type CompleteVisitAtomicInput = {
  visitId: string;
  organizationId: string;
  expectedCarerId: string;
  completionNote: string | null;
  actor: {
    authSubject: string;
    identityProvider: string;
    membershipId: string;
    role: string;
    surface: string;
  };
};

export type StartVisitAtomicResult =
  | { status: "STARTED" | "IDEMPOTENT"; visit: Visit }
  | {
      status: "NOT_FOUND" | "FORBIDDEN" | "ACCESS_UNAVAILABLE" | "CONFLICT";
    };

export type UpdateVisitScheduleAtomicResult =
  | { status: "UPDATED"; visit: Visit }
  | { status: "NOT_FOUND" | "OVERLAP" | "TERMINAL" };

type FrontlineWriteActor = {
  authSubject: string;
  identityProvider: string;
  membershipId: string;
};

export type GuidedTaskWriteAtomicResult =
  | { status: "UPDATED"; task: VisitTask }
  | {
      status: "NOT_FOUND" | "FORBIDDEN" | "ACCESS_UNAVAILABLE" | "TERMINAL";
    };

export type GuidedCareLogWriteAtomicResult =
  | { status: "CREATED"; careLog: CareLog }
  | {
      status: "NOT_FOUND" | "FORBIDDEN" | "ACCESS_UNAVAILABLE" | "TERMINAL";
    };

export type DeleteVisitAtomicResult =
  | { status: "DELETED"; visit: Visit }
  | { status: "NOT_FOUND" | "NOT_SCHEDULED" };

@Injectable()
export class VisitRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completionProofKeyring: VisitCompletionProofKeyring,
  ) {}

  async create(data: Prisma.VisitCreateInput): Promise<Visit> {
    assertTenantOwnershipForSensitiveWrite("Visit", data as any);
    return this.prisma.visit.create({
      data,
      include: {
        carer: true,
        client: true,
        tasks: true,
      },
    });
  }

  async createIfAssignable(
    data: Prisma.VisitCreateInput,
    input: {
      organizationId: string;
      carerId: string;
      clientId: string;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
  ): Promise<
    | { status: "CREATED"; visit: Visit }
    | { status: "INVALID_TENANT_RESOURCE" }
    | { status: "OVERLAP" }
  > {
    assertTenantOwnershipForSensitiveWrite("Visit", data as any);
    return (this.prisma as any).$transaction(
      async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.carerIdentityLockKey(input.organizationId, input.carerId)}, 0))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.assignmentLockKey(input.organizationId, input.carerId)}, 0))`;
        const [carer, client] = await Promise.all([
          tx.carer.findFirst({
            where: {
              id: input.carerId,
              organization_id: input.organizationId,
              is_active: true,
              deleted_at: null,
              organization_memberships: {
                some: {
                  organization_id: input.organizationId,
                  identity_provider: this.identityProvider(),
                  auth_subject: { not: "" },
                  role: { in: ["carer", "staff"] },
                  status: "ACTIVE",
                  revoked_at: null,
                },
              },
            },
            select: { id: true },
          }),
          tx.client.findFirst({
            where: {
              id: input.clientId,
              organization_id: input.organizationId,
              deleted_at: null,
            },
            select: { id: true },
          }),
        ]);
        if (!carer || !client) return { status: "INVALID_TENANT_RESOURCE" };
        const overlap = await tx.visit.findFirst({
          where: {
            organization_id: input.organizationId,
            carer_id: input.carerId,
            deleted_at: null,
            status: { not: VisitStatus.CANCELLED },
            scheduled_start: { lt: input.scheduledEnd },
            scheduled_end: { gt: input.scheduledStart },
          },
          select: { id: true },
        });
        if (overlap) return { status: "OVERLAP" };
        const visit = await tx.visit.create({
          data,
          include: { carer: true, client: true, tasks: true },
        });
        return { status: "CREATED", visit };
      },
      // READ COMMITTED is intentional: after waiting on the lifecycle locks,
      // validation must observe a deactivation that committed while we waited.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findById(id: string, organizationId: string): Promise<Visit | null> {
    return this.prisma.visit.findFirst({
      where: this.prisma.whereNotDeleted({
        id,
        organization_id: organizationId,
      }),
      include: {
        carer: true,
        client: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    });
  }

  async findMany(
    args: {
      where?: Prisma.VisitWhereInput;
      skip?: number;
      take?: number;
      orderBy?: Prisma.VisitOrderByWithRelationInput;
    },
    organizationId: string,
  ): Promise<{ items: Visit[]; total: number }> {
    const where = this.prisma.whereNotDeleted({
      ...args.where,
      organization_id: organizationId,
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy || { scheduled_start: "desc" },
        include: {
          carer: true,
          client: true,
          tasks: {
            where: { deleted_at: null },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    return { items, total };
  }

  async updateScheduleAtomically(input: {
    visitId: string;
    organizationId: string;
    expectedCarerId: string;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
  }): Promise<UpdateVisitScheduleAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        await this.lockCarerLifecycle(
          tx,
          input.organizationId,
          input.expectedCarerId,
        );
        const visit = await this.lockVisit(
          tx,
          input.visitId,
          input.organizationId,
        );
        if (!visit || visit.carer_id !== input.expectedCarerId) {
          return { status: "NOT_FOUND" } as const;
        }
        if (
          visit.status === VisitStatus.COMPLETED ||
          visit.status === VisitStatus.CANCELLED
        ) {
          return { status: "TERMINAL" } as const;
        }

        const scheduledStart = input.scheduledStart || visit.scheduled_start;
        const scheduledEnd = input.scheduledEnd || visit.scheduled_end;
        const overlap = await tx.visit.findFirst({
          where: {
            organization_id: input.organizationId,
            carer_id: visit.carer_id,
            id: { not: visit.id },
            deleted_at: null,
            status: { not: VisitStatus.CANCELLED },
            scheduled_start: { lt: scheduledEnd },
            scheduled_end: { gt: scheduledStart },
          },
          select: { id: true },
        });
        if (overlap) return { status: "OVERLAP" } as const;

        const updated = await tx.visit.update({
          where: { id: visit.id },
          data: {
            ...(input.scheduledStart
              ? { scheduled_start: input.scheduledStart }
              : {}),
            ...(input.scheduledEnd
              ? { scheduled_end: input.scheduledEnd }
              : {}),
          },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });
        return { status: "UPDATED", visit: updated } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async startAtomically(input: {
    visitId: string;
    organizationId: string;
    expectedCarerId: string;
    actor: {
      authSubject: string;
      identityProvider: string;
      membershipId: string;
    };
  }): Promise<StartVisitAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const active = await this.lockAndValidateCarerAccess(tx, {
          organizationId: input.organizationId,
          carerId: input.expectedCarerId,
          membershipId: input.actor.membershipId,
          authSubject: input.actor.authSubject,
          identityProvider: input.actor.identityProvider,
        });
        if (!active) return { status: "ACCESS_UNAVAILABLE" } as const;

        const visit = await this.lockVisit(
          tx,
          input.visitId,
          input.organizationId,
        );
        if (!visit) return { status: "NOT_FOUND" } as const;
        if (visit.carer_id !== input.expectedCarerId) {
          return { status: "FORBIDDEN" } as const;
        }
        if (
          visit.status === VisitStatus.COMPLETED ||
          visit.status === VisitStatus.CANCELLED
        ) {
          return { status: "CONFLICT" } as const;
        }
        if (visit.status === VisitStatus.IN_PROGRESS) {
          return { status: "IDEMPOTENT", visit } as const;
        }

        const updated = await tx.visit.update({
          where: { id: visit.id },
          data: {
            status: VisitStatus.IN_PROGRESS,
            actual_start: visit.actual_start || new Date(),
          },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });
        return { status: "STARTED", visit: updated } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async completeAtomically(
    input: CompleteVisitAtomicInput,
  ): Promise<CompleteVisitAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const active = await this.lockAndValidateCarerAccess(tx, {
          organizationId: input.organizationId,
          carerId: input.expectedCarerId,
          membershipId: input.actor.membershipId,
          authSubject: input.actor.authSubject,
          identityProvider: input.actor.identityProvider,
        });
        if (!active) return { status: "ACCESS_UNAVAILABLE" } as const;

        const visit = await this.lockVisit(
          tx,
          input.visitId,
          input.organizationId,
        );
        if (!visit) return { status: "NOT_FOUND" } as const;
        if (visit.carer_id !== input.expectedCarerId) {
          return { status: "FORBIDDEN" } as const;
        }
        if (visit.status === VisitStatus.CANCELLED) {
          return { status: "CONFLICT", reason: "CANCELLED" } as const;
        }

        if (visit.status === VisitStatus.COMPLETED) {
          const completionAudit = await tx.auditLog.findFirst({
            where: {
              organization_id: input.organizationId,
              resource_type: "Visit",
              resource_id: visit.id,
              action: "VISIT_COMPLETED",
            },
            orderBy: { timestamp: "desc" },
            select: {
              organization_id: true,
              user_id: true,
              resource_type: true,
              resource_id: true,
              new_values: true,
            },
          });
          const completionMetadata = this.completionMetadata(
            completionAudit?.new_values,
          );
          const proofMatches = Boolean(
            completionMetadata &&
            completionAudit?.organization_id === input.organizationId &&
            completionAudit.user_id === input.actor.authSubject &&
            completionAudit.resource_type === "Visit" &&
            completionAudit.resource_id === input.visitId &&
            completionMetadata.membershipId === input.actor.membershipId &&
            completionMetadata.actorRole === input.actor.role &&
            completionMetadata.actorSurface === input.actor.surface &&
            visit.actual_end?.toISOString() ===
              completionMetadata.auditedActualEnd &&
            this.completionProofKeyring.verify(
              completionMetadata.keyId,
              "request",
              this.completionRequestPayload(input),
              completionMetadata.requestFingerprint,
            ) &&
            this.completionProofKeyring.verify(
              completionMetadata.keyId,
              "record",
              this.completionRecordPayload(
                input,
                visit.notes,
                visit.actual_end,
              ),
              completionMetadata.recordFingerprint,
            ),
          );
          if (!proofMatches) {
            return {
              status: "CONFLICT",
              reason: "COMPLETED_DETAILS",
            } as const;
          }

          await this.createCompletionAudit(tx, {
            action: "VISIT_COMPLETION_IDEMPOTENT",
            input,
            previousStatus: visit.status,
            previousActualEnd: visit.actual_end,
            effectiveActualEnd: visit.actual_end,
            notesAppended: false,
            persistedNotes: visit.notes,
          });
          return { status: "IDEMPOTENT", visit } as const;
        }

        if (visit.status !== VisitStatus.IN_PROGRESS) {
          return { status: "CONFLICT", reason: "NOT_STARTED" } as const;
        }

        const [taskOutcomeCount, careLogCount, medicationOutcomeCount] =
          await Promise.all([
            tx.visitTask.count({
              where: {
                visit_id: visit.id,
                deleted_at: null,
                notes: { contains: VISIT_TASK_OUTCOME_PREFIX },
              },
            }),
            tx.careLog.count({
              where: {
                visit_id: visit.id,
                organization_id: input.organizationId,
                deleted_at: null,
              },
            }),
            tx.medicationAdministration.count({
              where: {
                visit_id: visit.id,
                deleted_at: null,
                status: { not: MedicationStatus.SCHEDULED },
              },
            }),
          ]);
        const hasCompletionEvidence = Boolean(
          input.completionNote ||
          this.nonEmpty(visit.notes) ||
          taskOutcomeCount > 0 ||
          careLogCount > 0 ||
          medicationOutcomeCount > 0,
        );
        if (!hasCompletionEvidence) {
          return { status: "EVIDENCE_REQUIRED" } as const;
        }

        const recordedAt = new Date();
        const effectiveActualEnd = visit.actual_end || recordedAt;
        const notes = input.completionNote
          ? this.appendCompletionNote(visit.notes, input.completionNote)
          : visit.notes;
        const updated = await tx.visit.update({
          where: { id: visit.id },
          data: {
            status: VisitStatus.COMPLETED,
            actual_end: effectiveActualEnd,
            ...(input.completionNote ? { notes } : {}),
          },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });

        await this.createCompletionAudit(tx, {
          action: "VISIT_COMPLETED",
          input,
          previousStatus: visit.status,
          previousActualEnd: visit.actual_end,
          effectiveActualEnd,
          notesAppended: Boolean(input.completionNote),
          persistedNotes: notes,
          timestamp: recordedAt,
        });

        return { status: "COMPLETED", visit: updated } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async deleteAtomically(input: {
    visitId: string;
    organizationId: string;
    actorAuthSubject: string;
  }): Promise<DeleteVisitAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const visit = await this.lockVisit(
          tx,
          input.visitId,
          input.organizationId,
        );
        if (!visit) return { status: "NOT_FOUND" } as const;
        if (visit.status !== VisitStatus.SCHEDULED) {
          return { status: "NOT_SCHEDULED" } as const;
        }

        const deletedAt = new Date();
        const deleted = await tx.visit.update({
          where: { id: visit.id },
          data: { deleted_at: deletedAt },
          include: {
            carer: true,
            client: true,
            tasks: { where: { deleted_at: null } },
          },
        });
        await tx.auditLog.create({
          data: {
            organization_id: input.organizationId,
            user_id: input.actorAuthSubject,
            action: "VISIT_DELETED",
            resource_type: "Visit",
            resource_id: visit.id,
            old_values: {
              status: visit.status,
              deleted: false,
            },
            new_values: {
              status: visit.status,
              deleted: true,
              deletedAt: deletedAt.toISOString(),
            },
            timestamp: deletedAt,
          },
        });
        return { status: "DELETED", visit: deleted } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async writeGuidedTaskAtomically(input: {
    taskId: string;
    organizationId: string;
    expectedCarerId: string;
    actor: FrontlineWriteActor;
    write:
      | { kind: "COMPLETE"; notes: string | null }
      | {
          kind: "OUTCOME";
          outcome: string;
          completed: boolean;
          notes: string | null;
        };
  }): Promise<GuidedTaskWriteAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const active = await this.lockAndValidateCarerAccess(tx, {
          organizationId: input.organizationId,
          carerId: input.expectedCarerId,
          membershipId: input.actor.membershipId,
          authSubject: input.actor.authSubject,
          identityProvider: input.actor.identityProvider,
        });
        if (!active) return { status: "ACCESS_UNAVAILABLE" } as const;

        const taskReference = await tx.visitTask.findFirst({
          where: {
            id: input.taskId,
            deleted_at: null,
            visit: {
              organization_id: input.organizationId,
              deleted_at: null,
            },
          },
          select: { visit_id: true },
        });
        if (!taskReference) return { status: "NOT_FOUND" } as const;

        const visit = await this.lockVisit(
          tx,
          taskReference.visit_id,
          input.organizationId,
        );
        if (!visit) return { status: "NOT_FOUND" } as const;
        if (visit.carer_id !== input.expectedCarerId) {
          return { status: "FORBIDDEN" } as const;
        }
        if (
          visit.client.organization_id !== input.organizationId ||
          visit.client.deleted_at
        ) {
          return { status: "NOT_FOUND" } as const;
        }
        if (this.isTerminalVisit(visit.status)) {
          return { status: "TERMINAL" } as const;
        }

        const task = await tx.visitTask.findFirst({
          where: {
            id: input.taskId,
            visit_id: visit.id,
            deleted_at: null,
          },
        });
        if (!task) return { status: "NOT_FOUND" } as const;

        const recordedAt = new Date();
        const data: Prisma.VisitTaskUpdateInput =
          input.write.kind === "COMPLETE"
            ? {
                is_completed: true,
                completed_at: recordedAt,
                notes: input.write.notes || task.notes,
              }
            : {
                is_completed: input.write.completed,
                completed_at: input.write.completed ? recordedAt : null,
                notes: this.guidedOutcomeNotes(task.notes, input.write.notes, {
                  outcome: input.write.outcome,
                  recordedAt: recordedAt.toISOString(),
                  recordedBy: input.expectedCarerId,
                }),
              };
        const updated = await tx.visitTask.update({
          where: { id: task.id },
          data,
        });
        return { status: "UPDATED", task: updated } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async createGuidedCareLogAtomically(input: {
    visitId: string;
    organizationId: string;
    expectedCarerId: string;
    actor: FrontlineWriteActor;
    occurredAt: Date;
    category: CareLogCategory;
    notes: string;
    escalated?: boolean;
    escalatedTo?: string;
  }): Promise<GuidedCareLogWriteAtomicResult> {
    return (this.prisma as any).$transaction(
      async (tx: Prisma.TransactionClient) => {
        const active = await this.lockAndValidateCarerAccess(tx, {
          organizationId: input.organizationId,
          carerId: input.expectedCarerId,
          membershipId: input.actor.membershipId,
          authSubject: input.actor.authSubject,
          identityProvider: input.actor.identityProvider,
        });
        if (!active) return { status: "ACCESS_UNAVAILABLE" } as const;

        const visit = await this.lockVisit(
          tx,
          input.visitId,
          input.organizationId,
        );
        if (!visit) return { status: "NOT_FOUND" } as const;
        if (visit.carer_id !== input.expectedCarerId) {
          return { status: "FORBIDDEN" } as const;
        }
        if (
          visit.client.organization_id !== input.organizationId ||
          visit.client.deleted_at
        ) {
          return { status: "NOT_FOUND" } as const;
        }
        if (this.isTerminalVisit(visit.status)) {
          return { status: "TERMINAL" } as const;
        }

        const careLog = await tx.careLog.create({
          data: {
            organization_id: input.organizationId,
            visit_id: visit.id,
            client_id: visit.client_id,
            carer_id: visit.carer_id,
            occurred_at: input.occurredAt,
            category: input.category,
            notes: input.notes,
            escalated: input.escalated ?? false,
            escalated_to: input.escalatedTo,
            source: "visit_workflow",
          },
        });
        return { status: "CREATED", careLog } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findOverlappingVisits(
    carerId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    organizationId: string,
    excludeVisitId?: string,
  ): Promise<Visit[]> {
    const where: Prisma.VisitWhereInput = {
      organization_id: organizationId,
      carer_id: carerId,
      deleted_at: null,
      status: { not: VisitStatus.CANCELLED },
      AND: [
        {
          scheduled_start: { lt: scheduledEnd },
        },
        {
          scheduled_end: { gt: scheduledStart },
        },
      ],
    };

    if (excludeVisitId) {
      where.id = { not: excludeVisitId };
    }

    return this.prisma.visit.findMany({ where });
  }

  async createTask(
    visitId: string,
    data: Omit<Prisma.VisitTaskCreateInput, "visit">,
  ): Promise<VisitTask> {
    return this.prisma.visitTask.create({
      data: {
        ...data,
        visit: { connect: { id: visitId } },
      },
    });
  }

  async updateTask(
    taskId: string,
    data: Prisma.VisitTaskUpdateInput,
    organizationId: string,
  ): Promise<VisitTask> {
    const updated = await this.prisma.visitTask.updateMany({
      where: {
        id: taskId,
        deleted_at: null,
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      data,
    });
    if (updated.count === 0) {
      throw new Error("Task not found in organization");
    }
    return this.findTaskById(taskId, organizationId) as Promise<VisitTask>;
  }

  async findTaskById(
    taskId: string,
    organizationId: string,
  ): Promise<VisitTask | null> {
    return this.prisma.visitTask.findFirst({
      where: this.prisma.whereNotDeleted({
        id: taskId,
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      }),
    });
  }

  async countTaskOutcomeEntriesForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.visitTask.count({
      where: {
        visit_id: visitId,
        deleted_at: null,
        notes: { contains: VISIT_TASK_OUTCOME_PREFIX },
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
    });
  }

  async countCareLogsForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.careLog.count({
      where: this.prisma.whereNotDeleted({
        visit_id: visitId,
        organization_id: organizationId,
      }),
    });
  }

  async countMedicationOutcomesForVisit(
    visitId: string,
    organizationId: string,
  ): Promise<number> {
    return this.prisma.medicationAdministration.count({
      where: {
        visit_id: visitId,
        deleted_at: null,
        status: { not: MedicationStatus.SCHEDULED },
        visit: {
          organization_id: organizationId,
          deleted_at: null,
        },
      },
    });
  }

  async findCarerInOrganization(
    carerId: string,
    organizationId: string,
  ): Promise<boolean> {
    const carer = await (this.prisma as any).carer.findFirst({
      where: this.prisma.whereNotDeleted({
        id: carerId,
        organization_id: organizationId,
        is_active: true,
        organization_memberships: {
          some: {
            organization_id: organizationId,
            identity_provider: this.identityProvider(),
            auth_subject: { not: "" },
            role: { in: ["carer", "staff"] },
            status: "ACTIVE",
            revoked_at: null,
          },
        },
      }),
      select: { id: true },
    });
    return !!carer;
  }

  private identityProvider(): string {
    return String(process.env.AUTH_IDENTITY_PROVIDER || "clerk")
      .trim()
      .toLowerCase();
  }

  private assignmentLockKey(organizationId: string, carerId: string): string {
    return `carer-assignment:${organizationId}:${carerId}`;
  }

  private carerIdentityLockKey(
    organizationId: string,
    carerId: string,
  ): string {
    return `carer-identity:${organizationId}:${carerId}`;
  }

  private membershipLockKey(membershipId: string): string {
    return `carer-membership:${membershipId}`;
  }

  private async lockCarerLifecycle(
    tx: Prisma.TransactionClient,
    organizationId: string,
    carerId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.carerIdentityLockKey(organizationId, carerId)}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.assignmentLockKey(organizationId, carerId)}, 0))`;
  }

  private async lockAndValidateCarerAccess(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      carerId: string;
      membershipId: string;
      authSubject: string;
      identityProvider: string;
    },
  ): Promise<boolean> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.membershipLockKey(input.membershipId)}, 0))`;
    await this.lockCarerLifecycle(tx, input.organizationId, input.carerId);
    const membership = await tx.organizationMembership.findFirst({
      where: {
        id: input.membershipId,
        organization_id: input.organizationId,
        identity_provider: input.identityProvider,
        auth_subject: input.authSubject,
        carer_id: input.carerId,
        role: { in: ["carer", "staff"] },
        status: "ACTIVE",
        revoked_at: null,
        carer: {
          organization_id: input.organizationId,
          is_active: true,
          deleted_at: null,
        },
      } as any,
      select: { id: true },
    });
    return Boolean(membership);
  }

  private async lockVisit(
    tx: Prisma.TransactionClient,
    visitId: string,
    organizationId: string,
  ) {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM visit
      WHERE id = ${visitId}
        AND organization_id = ${organizationId}
        AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (lockedRows.length === 0) return null;
    return tx.visit.findFirst({
      where: {
        id: visitId,
        organization_id: organizationId,
        deleted_at: null,
      },
      include: {
        carer: true,
        client: true,
        tasks: { where: { deleted_at: null } },
      },
    });
  }

  private nonEmpty(value: string | null | undefined): string | null {
    const normalized = (value || "").trim();
    return normalized || null;
  }

  private isTerminalVisit(status: VisitStatus): boolean {
    return status === VisitStatus.COMPLETED || status === VisitStatus.CANCELLED;
  }

  private guidedOutcomeNotes(
    existingNotes: string | null,
    newFreeTextNote: string | null,
    metadata: {
      outcome: string;
      recordedAt: string;
      recordedBy: string;
    },
  ): string {
    const notes = (existingNotes || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && !line.startsWith(VISIT_TASK_OUTCOME_PREFIX),
      );
    if (newFreeTextNote) notes.push(newFreeTextNote);
    notes.push(`${VISIT_TASK_OUTCOME_PREFIX}${JSON.stringify(metadata)}`);
    return notes.join("\n");
  }

  private appendCompletionNote(
    current: string | null,
    completionNote: string,
  ): string {
    return current ? `${current}\n${completionNote}` : completionNote;
  }

  private completionMetadata(value: Prisma.JsonValue | null | undefined): {
    auditedActualEnd: string;
    keyId: string;
    membershipId: string;
    actorRole: string;
    actorSurface: string;
    requestFingerprint: string;
    recordFingerprint: string;
  } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const metadata = value as Prisma.JsonObject;
    if (
      metadata.completionFingerprintVersion !==
        VISIT_COMPLETION_PROOF_VERSION ||
      !this.isCanonicalInstant(metadata.actualEnd) ||
      !this.isProofKeyId(metadata.completionProofKeyId) ||
      !this.isBoundIdentifier(metadata.membershipId) ||
      !this.isBoundIdentifier(metadata.actorRole) ||
      !this.isBoundIdentifier(metadata.actorSurface) ||
      !this.isFingerprint(metadata.completionRequestFingerprint) ||
      !this.isFingerprint(metadata.completionRecordFingerprint)
    ) {
      return null;
    }
    return {
      auditedActualEnd: metadata.actualEnd,
      keyId: metadata.completionProofKeyId,
      membershipId: metadata.membershipId,
      actorRole: metadata.actorRole,
      actorSurface: metadata.actorSurface,
      requestFingerprint: metadata.completionRequestFingerprint as string,
      recordFingerprint: metadata.completionRecordFingerprint as string,
    };
  }

  private completionProofContext(input: CompleteVisitAtomicInput) {
    return {
      organizationId: input.organizationId,
      visitId: input.visitId,
      expectedCarerId: input.expectedCarerId,
      authSubject: input.actor.authSubject,
      identityProvider: input.actor.identityProvider,
      membershipId: input.actor.membershipId,
      actorRole: input.actor.role,
      actorSurface: input.actor.surface,
    };
  }

  private completionRequestPayload(input: CompleteVisitAtomicInput) {
    return visitCompletionRequestProofPayload({
      context: this.completionProofContext(input),
      completionNote: input.completionNote,
    });
  }

  private completionRecordPayload(
    input: CompleteVisitAtomicInput,
    notes: string | null,
    actualEnd: Date | null,
  ) {
    return visitCompletionRecordProofPayload({
      context: this.completionProofContext(input),
      notes,
      actualEnd: actualEnd?.toISOString() ?? null,
    });
  }

  private isFingerprint(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  }

  private isCanonicalInstant(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  }

  private isProofKeyId(value: unknown): value is string {
    return (
      typeof value === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
    );
  }

  private isBoundIdentifier(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private async createCompletionAudit(
    tx: Prisma.TransactionClient,
    options: {
      action: "VISIT_COMPLETED" | "VISIT_COMPLETION_IDEMPOTENT";
      input: CompleteVisitAtomicInput;
      previousStatus: VisitStatus;
      previousActualEnd: Date | null;
      effectiveActualEnd: Date | null;
      notesAppended: boolean;
      persistedNotes: string | null;
      timestamp?: Date;
    },
  ): Promise<void> {
    const requestProof = this.completionProofKeyring.sign(
      "request",
      this.completionRequestPayload(options.input),
    );
    const recordProof = this.completionProofKeyring.sign(
      "record",
      this.completionRecordPayload(
        options.input,
        options.persistedNotes,
        options.effectiveActualEnd,
      ),
    );
    if (requestProof.keyId !== recordProof.keyId) {
      throw new Error(
        "Visit completion proof key changed during audit creation",
      );
    }
    await tx.auditLog.create({
      data: {
        organization_id: options.input.organizationId,
        user_id: options.input.actor.authSubject,
        action: options.action,
        resource_type: "Visit",
        resource_id: options.input.visitId,
        old_values: {
          status: options.previousStatus,
          actualEnd: options.previousActualEnd?.toISOString() ?? null,
        },
        new_values: {
          status: VisitStatus.COMPLETED,
          actualEnd: options.effectiveActualEnd?.toISOString() ?? null,
          membershipId: options.input.actor.membershipId,
          actorRole: options.input.actor.role,
          actorSurface: options.input.actor.surface,
          notesAppended: options.notesAppended,
          completionFingerprintVersion: VISIT_COMPLETION_PROOF_VERSION,
          completionProofKeyId: requestProof.keyId,
          completionRequestFingerprint: requestProof.fingerprint,
          completionRecordFingerprint: recordProof.fingerprint,
        },
        timestamp: options.timestamp || new Date(),
      },
    });
  }

  async findClientInOrganization(
    clientId: string,
    organizationId: string,
  ): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: clientId,
        organization_id: organizationId,
      }),
      select: { id: true },
    });
    return !!client;
  }
}
