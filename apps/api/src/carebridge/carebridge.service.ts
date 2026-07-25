import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  ConcernEventType,
  ConcernStatus,
  FamilyPulseSentiment,
  Prisma,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  assertMedicationEmarEnabled,
  containsMedicationEmarContent,
  isMedicationEmarEnabled,
} from '../common/features/medication-emar';
import { sanitizeAuditMetadata } from '../common/audit/audit-metadata.policy';
import { CarebridgeRepository } from './carebridge.repository';
import { CarebridgeAccessService } from './access/carebridge-access.service';
import {
  RaiseConcernInput,
  SubmitFamilyPulseInput,
  UpdateCarebridgePolicyInput,
  UpdateConcernStatusInput,
} from './dto/carebridge.dto';

interface ViewerContext {
  role: string;
  userId?: string;
  organizationId?: string;
  email?: string;
  authSubject?: string;
}

interface FamilyAccessLookup {
  organizationId: string;
  authSubject: string;
}

interface CreateCarebridgeAuditOptions {
  organizationId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  newValues: unknown;
}

@Injectable()
export class CarebridgeService {
  constructor(
    private readonly repository: CarebridgeRepository,
    private readonly prisma: PrismaService,
    private readonly accessService: CarebridgeAccessService,
  ) {}

  async createCareRoom(clientId: string, actorUserId: string, actorRole: string, organizationId: string) {
    this.assertStaffRole(actorRole);
    const inOrg = await this.repository.ensureClientInOrganization(clientId, organizationId);
    if (!inOrg) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You can only create CareBridge rooms for clients in your organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const existing = typeof (this.repository as any).findRoomByClientId === 'function'
      ? await (this.repository as any).findRoomByClientId(clientId, organizationId)
      : null;
    if (existing) {
      return this.mapCareRoom(existing);
    }

    const room = await this.prisma.$transaction(async (tx) => {
      const created = await this.repository.createCareRoom({
        organization_id: organizationId,
        client_id: clientId,
      }, tx);
      await this.repository.ensurePolicyForRoom(
        created.id,
        organizationId,
        clientId,
        tx,
      );
      await this.createAudit(tx, {
        organizationId: created.organization_id,
        actorId: actorUserId,
        action: 'CAREBRIDGE_ROOM_CREATED',
        resourceType: 'CareRoom',
        resourceId: created.id,
        newValues: { clientId },
      });
      return created;
    });
    return this.mapCareRoom({
      ...room,
      policies: room.policies ?? [],
    });
  }

  async updatePolicy(input: UpdateCarebridgePolicyInput, actorUserId: string, actorRole: string, organizationId: string) {
    this.assertStaffRole(actorRole);
    if (input.showMedicationSupportDefault === true) {
      assertMedicationEmarEnabled();
    }
    const room = await this.repository.findRoomByIdForOrganization(input.careRoomId, organizationId);
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'CareBridge room could not be found for your organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const policy = await this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.updatePolicy(input.careRoomId, {
        show_visit_times_default: input.showVisitTimesDefault ?? undefined,
        show_task_summary_default: input.showTaskSummaryDefault ?? undefined,
        show_medication_support_default: isMedicationEmarEnabled()
          ? input.showMedicationSupportDefault ?? undefined
          : false,
        require_approval_for_all_content: input.requireApprovalForAllContent ?? undefined,
      }, tx);

      await this.createAudit(tx, {
        organizationId: room.organization_id,
        actorId: actorUserId,
        action: 'CAREBRIDGE_POLICY_UPDATED',
        resourceType: 'CareBridgePolicy',
        resourceId: updated.id,
        newValues: { careRoomId: input.careRoomId },
      });
      return updated;
    });

    return this.mapPolicy(policy);
  }

  async listCareRooms(viewer: ViewerContext) {
    this.assertStaffRole(viewer.role);
    if (!viewer.organizationId) {
      return [];
    }

    const rooms = await this.repository.listRoomsForOrganization(viewer.organizationId);
    return rooms.map((room: any) => this.mapCareRoom(room));
  }

  async getCareRoom(id: string, viewer: ViewerContext) {
    this.assertStaffRole(viewer.role);
    const room = await this.repository.findRoomByIdForOrganization(
      id,
      viewer.organizationId || '',
    );

    if (!room) {
      throw this.familyRoomForbidden();
    }

    return this.mapCareRoom(room);
  }

  async listVerifiedVisitStories(careRoomId: string, viewer: ViewerContext) {
    this.assertStaffRole(viewer.role);
    await this.getCareRoom(careRoomId, viewer);
    const stories = await this.repository.listVerifiedVisitStoriesByRoomId(careRoomId);
    return stories
      .filter((story: any) => !this.isExcludedMedicationStory(story))
      .map((story: any) => this.mapStory(story));
  }

  async listFamilyCareRooms(viewer: ViewerContext) {
    const lookup = this.requireFamilyAccessLookup(viewer);
    const rooms = await this.repository.listRoomsForFamilyAccess(lookup);
    const authorizedRooms = [];
    for (const room of rooms) {
      const membership = this.findFamilyMembership(room.memberships, lookup);
      if (!membership) continue;
      const authority = this.familyLaunchAuthority(membership);
      if (!authority.canViewApprovedUpdates && !authority.canRaiseConcerns) continue;
      authorizedRooms.push(this.mapFamilyCareRoom(room, membership));
    }
    return authorizedRooms;
  }

  async getFamilyCareRoom(id: string, viewer: ViewerContext) {
    const access = await this.findFamilyRoomAccess(
      id,
      this.requireFamilyAccessLookup(viewer),
    );
    if (!access) throw this.familyRoomForbidden();
    const authority = this.familyLaunchAuthority(access.membership);
    if (!authority.canViewApprovedUpdates && !authority.canRaiseConcerns) {
      throw this.familyRoomForbidden();
    }
    return this.mapFamilyCareRoom(access.room, access.membership);
  }

  async listFamilyVerifiedVisitStories(careRoomId: string, viewer: ViewerContext) {
    await this.requireScopedFamilyRoomAccess(careRoomId, viewer, [
      AccessGrantScope.VIEW_UPDATES,
      AccessGrantScope.VIEW_TASK_SUMMARY,
    ]);
    const stories = await this.repository.listFamilySafePublishedStoriesByRoomId(
      careRoomId,
    );
    return stories
      .filter((story: any) => !this.isExcludedMedicationStory(story))
      .map((story: any) => ({
      title: story.family_safe_title,
      body: story.family_safe_body,
      publishedAt: story.published_at,
      }));
  }

  async listVerifiedVisitStoryApprovalQueue(viewer: ViewerContext, careRoomId?: string) {
    this.assertStaffRole(viewer.role);
    const organizationId = this.requireOrganizationId(viewer.organizationId);

    if (careRoomId) {
      const room = await this.repository.findRoomByIdForOrganization(careRoomId, organizationId);
      if (!room) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'You can only review approval queue items for care rooms in your organisation.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const stories = await this.repository.listVerifiedVisitStoryApprovalQueue(organizationId, careRoomId);
    return stories
      .filter((story: any) => !this.isExcludedMedicationStory(story))
      .map((story: any) => this.mapStory(story));
  }

  async listConcernInbox(viewer: ViewerContext, status?: ConcernStatus) {
    this.assertStaffRole(viewer.role);
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    const concerns = await this.repository.listConcernsForOrganization(organizationId, status);
    return concerns.map((concern: any) => this.mapConcern(concern));
  }

  async generateVerifiedVisitStory(visitId: string, actorUserId: string, organizationId: string) {
    const visit = await this.repository.findVisitForStory(visitId, organizationId);
    if (!visit) {
      throw new BaseHttpException(
        ErrorCode.VISIT_NOT_FOUND,
        'Visit could not be found for your organisation.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (visit.status !== 'COMPLETED') {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Only completed visits can become family updates.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const room = typeof (this.repository as any).findRoomByClientId === 'function'
      ? await (this.repository as any).findRoomByClientId(visit.client_id, organizationId)
      : { id: `room-${visit.client_id}`, organization_id: organizationId, client_id: visit.client_id };
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Create a CareBridge room before generating a verified visit story.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const storyTasks = visit.tasks.filter(
      (task) => isMedicationEmarEnabled() || !containsMedicationEmarContent(task.task_name),
    );
    const completedTasks = storyTasks.filter((task) => task.is_completed);
    const pendingTasks = storyTasks.filter((task) => !task.is_completed);
    const safeVisitNotes = containsMedicationEmarContent(visit.notes) ? null : visit.notes;
    const draftTitle = completedTasks.length > 0
      ? `Visit recorded for ${visit.client.full_name}`
      : 'Visit recorded';
    const draftBody = [
      `The visit was marked as ${String(visit.status).toLowerCase()}.`,
      completedTasks.length > 0
        ? `Completed tasks: ${completedTasks.map((task) => task.task_name).join(', ')}.`
        : 'No completed tasks were recorded.',
      pendingTasks.length > 0
        ? `Follow-up tasks: ${pendingTasks.map((task) => task.task_name).join(', ')}.`
        : null,
      safeVisitNotes ? `Care update: ${safeVisitNotes}` : null,
    ].filter(Boolean).join(' ');
    const familySafeBody = [
      'The scheduled care visit was completed.',
      completedTasks.length === 1
        ? 'One care task was recorded as completed.'
        : `${completedTasks.length} care tasks were recorded as completed.`,
      pendingTasks.length > 0
        ? `${pendingTasks.length} care ${pendingTasks.length === 1 ? 'task needs' : 'tasks need'} follow-up.`
        : 'No care tasks need follow-up.',
    ].join(' ');

    const sourceRefs = [
      { type: 'Visit', id: visit.id },
      ...storyTasks.map((task) => ({ type: 'VisitTask', id: task.id })),
    ];

    const story = await this.prisma.$transaction(async (tx) => {
      const created = await this.repository.createVerifiedVisitStory({
        organization_id: organizationId,
        care_room_id: room.id,
        client_id: visit.client_id,
        visit_id: visit.id,
        status: 'DRAFT' as any,
        draft_title: draftTitle,
        draft_body: draftBody,
        family_safe_version: 1,
        family_safe_title: 'Care visit update',
        family_safe_body: familySafeBody,
        source_refs: sourceRefs,
      }, tx);

      await this.createAudit(tx, {
        organizationId: created.organization_id,
        actorId: actorUserId,
        action: 'CAREBRIDGE_VISIT_STORY_DRAFTED',
        resourceType: 'VerifiedVisitStory',
        resourceId: created.id,
        newValues: {
          visitId,
          careRoomId: room.id,
        },
      });
      return created;
    });

    return this.mapStory(story);
  }

  async publishVerifiedVisitStory(storyId: string, actorUserId: string, organizationId: string) {
    const approvalActorUserId = this.requireActorUserId(
      actorUserId,
      'Publishing verified visit stories requires an authenticated staff actor.',
    );
    const story = await this.repository.findVerifiedVisitStoryById(storyId, organizationId);
    if (!story) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit story could not be found for your organisation.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (this.isExcludedMedicationStory(story)) {
      assertMedicationEmarEnabled();
    }
    if (story.status !== 'DRAFT') {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Only draft verified visit stories can be published.',
        HttpStatus.CONFLICT,
      );
    }

    const refs = Array.isArray(story.source_refs) ? story.source_refs : [];
    if (refs.length === 0) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit stories must include source references before publication.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      story.family_safe_version !== 1 ||
      !String(story.family_safe_title || '').trim() ||
      !String(story.family_safe_body || '').trim()
    ) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit stories require family-safe content before publication.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const familySafeTitle = story.family_safe_title as string;
    const familySafeBody = story.family_safe_body as string;
    if (story.visit?.status !== 'COMPLETED' || story.visit.deleted_at) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Only completed visits can be published as family updates.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const published = await this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.publishVerifiedVisitStory(
        storyId,
        familySafeTitle,
        familySafeBody,
        approvalActorUserId,
        tx,
      );
      if (!updated) {
        throw new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'Verified visit story state changed before publication.',
          HttpStatus.CONFLICT,
        );
      }
      await this.createAudit(tx, {
        organizationId: story.organization_id,
        actorId: approvalActorUserId,
        action: 'CAREBRIDGE_VISIT_STORY_PUBLISHED',
        resourceType: 'VerifiedVisitStory',
        resourceId: storyId,
        newValues: {
          version: story.family_safe_version,
        },
      });
      return updated;
    });
    return this.mapStory(published);
  }

  async rejectVerifiedVisitStory(storyId: string, rejectionReason: string, actorUserId: string, organizationId: string) {
    const reason = (rejectionReason || '').trim();
    if (!reason) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Provide a rejection reason when rejecting a verified visit story.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rejectionActorUserId = this.requireActorUserId(
      actorUserId,
      'Rejecting verified visit stories requires an authenticated staff actor.',
    );

    const story = await this.repository.findVerifiedVisitStoryById(storyId, organizationId);
    if (!story) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit story could not be found for your organisation.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (story.status !== 'DRAFT') {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Only draft verified visit stories can be rejected.',
        HttpStatus.CONFLICT,
      );
    }

    const rejected = await this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.rejectVerifiedVisitStory(
        storyId,
        reason,
        tx,
      );
      if (!updated) {
        throw new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'Verified visit story state changed before rejection.',
          HttpStatus.CONFLICT,
        );
      }
      await this.createAudit(tx, {
        organizationId: story.organization_id,
        actorId: rejectionActorUserId,
        action: 'CAREBRIDGE_VISIT_STORY_REJECTED',
        resourceType: 'VerifiedVisitStory',
        resourceId: storyId,
        newValues: { status: 'REJECTED' },
      });
      return updated;
    });
    return this.mapStory(rejected);
  }

  async raiseConcern(input: RaiseConcernInput, viewer: ViewerContext) {
    const externalViewer = this.isExternalViewer(viewer);
    const familyAccess = externalViewer
      ? await this.requireScopedFamilyRoomAccess(
          input.careRoomId,
          viewer,
          [AccessGrantScope.RAISE_CONCERNS],
        )
      : undefined;
    const room = externalViewer
      ? familyAccess?.room
      : await this.repository.findRoomByIdForOrganization(
          input.careRoomId,
          viewer.organizationId || '',
        );

    if (!room) {
      throw this.familyRoomForbidden();
    }

    return this.prisma.$transaction((tx) =>
      this.createConcernForRoom(
        input,
        viewer,
        room,
        tx,
        familyAccess?.membership,
      ),
    );
  }

  async raiseFamilyConcern(input: RaiseConcernInput, viewer: ViewerContext) {
    const concern = await this.raiseConcern(input, viewer);
    return { title: concern.title, status: concern.status };
  }

  async listFamilyCareRoomConcerns(careRoomId: string, viewer: ViewerContext) {
    const access = await this.requireScopedFamilyRoomAccess(
      careRoomId,
      viewer,
      [AccessGrantScope.RAISE_CONCERNS],
    );
    const concerns = await this.repository.listFamilyConcernsForMembership({
      organizationId: access.room.organization_id,
      careRoomId: access.room.id,
      membershipId: access.membership.id,
    });

    return concerns.map((concern: any) => ({
      id: concern.id,
      title: concern.title,
      status: concern.status,
      submittedAt: concern.created_at,
      events: concern.events.map((event: any) => ({
        eventType: event.event_type,
        createdAt: event.created_at,
      })),
    }));
  }

  private async createConcernForRoom(
    input: RaiseConcernInput,
    viewer: ViewerContext,
    room: any,
    tx: Prisma.TransactionClient,
    familyMembership?: any,
    familyAuditActorId?: string,
  ) {
    const externalViewer = this.isExternalViewer(viewer);
    const auditActorId = externalViewer
      ? familyAuditActorId || this.requireFamilyAuditActorId(viewer, familyMembership)
      : viewer.userId;
    const now = new Date();
    const concern = await this.repository.createConcern({
      organization_id: room.organization_id,
      care_room_id: room.id,
      client_id: room.client_id,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      severity: input.severity,
      priority: input.severity === 'HIGH' || input.severity === 'CRITICAL' ? 'URGENT' as any : 'ROUTINE' as any,
      status: 'OPEN' as any,
      ...(familyMembership?.id
        ? { raised_by_membership_id: familyMembership.id }
        : {}),
      acknowledgement_due_at: new Date(now.getTime() + 60 * 60 * 1000),
      response_due_at: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      resolution_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      source_refs: [{ type: 'CareRoom', id: room.id }],
    }, tx);

    await this.repository.appendConcernEvent({
      concern_id: concern.id,
      event_type: ConcernEventType.RAISED,
      actor_type: this.isExternalViewer(viewer) ? 'FAMILY' as any : 'STAFF' as any,
      actor_id: viewer.userId ?? viewer.email ?? null,
    }, tx);

    if (input.description) {
      if (typeof (this.repository as any).appendConcernMessage === 'function') {
        await this.repository.appendConcernMessage({
          concern_id: concern.id,
          actor_type: this.isExternalViewer(viewer) ? 'FAMILY' as any : 'STAFF' as any,
          actor_id: viewer.userId ?? viewer.email ?? null,
          actor_label: this.isExternalViewer(viewer) ? 'Family member' : 'Staff member',
          body: input.description,
        }, tx);
      }
    }

    await this.createAudit(tx, {
      organizationId: room.organization_id,
      actorId: auditActorId,
      action: 'CAREBRIDGE_CONCERN_RAISED',
      resourceType: 'Concern',
      resourceId: concern.id,
      newValues: { careRoomId: room.id },
    });

    return this.mapConcern(concern);
  }

  async updateConcernStatus(input: UpdateConcernStatusInput, actorUserId: string, actorRole: string, organizationId: string) {
    this.assertStaffRole(actorRole);
    const concern = await this.repository.findConcernById(input.concernId, organizationId);
    if (!concern) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'Concern could not be found for your organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const nextData: Record<string, unknown> = { status: input.status };
    if (input.status === ConcernStatus.ACKNOWLEDGED) {
      nextData.acknowledged_at = new Date();
    }
    if (input.status === ConcernStatus.RESOLVED) {
      nextData.resolved_at = new Date();
      nextData.outcome = input.outcome ?? null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await this.repository.updateConcern(
        input.concernId,
        nextData,
        tx,
      );

      if (input.message) {
        await this.repository.appendConcernMessage({
          concern_id: input.concernId,
          actor_type: 'STAFF' as any,
          actor_id: actorUserId,
          actor_label: 'Care team',
          body: input.message,
        }, tx);
      }

      await this.repository.appendConcernEvent({
        concern_id: input.concernId,
        event_type: this.mapConcernEventType(input.status),
        actor_type: 'STAFF' as any,
        actor_id: actorUserId,
        metadata: input.outcome ? { outcome: input.outcome } : undefined,
      }, tx);

      await this.createAudit(tx, {
        organizationId: concern.organization_id,
        actorId: actorUserId,
        action: 'CAREBRIDGE_CONCERN_UPDATED',
        resourceType: 'Concern',
        resourceId: input.concernId,
        newValues: {
          status: input.status,
        },
      });
      return next;
    });

    return this.mapConcern(updated);
  }

  async submitFamilyPulse(input: SubmitFamilyPulseInput, viewer: ViewerContext) {
    if (!this.isExternalViewer(viewer)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Only family-access users can submit confidence checks.',
        HttpStatus.FORBIDDEN,
      );
    }
    const createsConcern = Boolean(
      (input.sentiment === FamilyPulseSentiment.CONCERNED ||
        input.sentiment === FamilyPulseSentiment.NEED_CALL) &&
        input.note,
    );
    const access = await this.requireScopedFamilyRoomAccess(
      input.careRoomId,
      viewer,
      [
        AccessGrantScope.SUBMIT_PULSE,
        ...(createsConcern ? [AccessGrantScope.RAISE_CONCERNS] : []),
      ],
    );
    const { membership, room } = access;
    const familyAuditActorId = this.requireFamilyAuditActorId(viewer, membership);

    return this.prisma.$transaction(async (tx) => {
      const pulse = await this.repository.createFamilyPulse({
        organization_id: room.organization_id,
        care_room_id: room.id,
        care_room_membership_id: membership.id,
        sentiment: input.sentiment,
        note: input.note ?? null,
      }, tx);

      await this.createAudit(tx, {
        organizationId: pulse.organization_id,
        actorId: familyAuditActorId,
        action: 'CAREBRIDGE_PULSE_SUBMITTED',
        resourceType: 'FamilyPulse',
        resourceId: pulse.id,
        newValues: { sentiment: input.sentiment },
      });

      if (createsConcern) {
        await this.createConcernForRoom(
          {
            careRoomId: input.careRoomId,
            title: input.sentiment === FamilyPulseSentiment.NEED_CALL ? 'Callback requested' : 'Family confidence concern',
            description: input.note,
            severity: 'MEDIUM' as any,
            category: 'COMMUNICATION' as any,
          },
          viewer,
          room,
          tx,
          membership,
          familyAuditActorId,
        );
      }

      return this.mapFamilyPulse(pulse);
    });
  }

  private assertStaffRole(role: string) {
    if (role !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'This action requires administrator access.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private requireOrganizationId(organizationId?: string) {
    const normalizedOrganizationId = (organizationId || '').trim();
    if (!normalizedOrganizationId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Organization context is required for this staff action.',
        HttpStatus.FORBIDDEN,
      );
    }
    return normalizedOrganizationId;
  }

  private requireActorUserId(actorUserId: string | undefined, message: string) {
    const normalizedActorUserId = (actorUserId || '').trim();
    if (!normalizedActorUserId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        message,
        HttpStatus.FORBIDDEN,
      );
    }
    return normalizedActorUserId;
  }

  private isExternalViewer(viewer: ViewerContext) {
    const role = (viewer.role || '').trim().toLowerCase();
    if (role === 'carer') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'This action requires administrator access.',
        HttpStatus.FORBIDDEN,
      );
    }
    return role !== 'admin';
  }

  private requireFamilyAccessLookup(viewer: ViewerContext): FamilyAccessLookup {
    const organizationId = (viewer.organizationId || '').trim();
    const authSubject = (viewer.authSubject || viewer.userId || '').trim();
    if (!organizationId || !authSubject) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Family access is not permitted.',
        HttpStatus.FORBIDDEN,
      );
    }
    return { organizationId, authSubject };
  }

  private async findFamilyRoomAccess(id: string, lookup: FamilyAccessLookup) {
    const room = await this.repository.findRoomByIdForFamilyAccess(id, lookup);
    if (!room) return undefined;
    const membership = this.findFamilyMembership(room.memberships, lookup);
    return membership ? { room, membership, lookup } : undefined;
  }

  private async requireScopedFamilyRoomAccess(
    id: string,
    viewer: ViewerContext,
    requiredScopes: AccessGrantScope[],
  ) {
    const access = await this.findFamilyRoomAccess(
      id,
      this.requireFamilyAccessLookup(viewer),
    );
    if (!access) {
      throw this.familyRoomForbidden();
    }

    try {
      await this.requireFamilyScopes(
        id,
        access.membership.id,
        access.lookup,
        requiredScopes,
      );
    } catch (error) {
      if (this.isFamilyDenial(error)) throw this.familyRoomForbidden();
      throw error;
    }
    return access;
  }

  private async requireFamilyScopes(
    careRoomId: string,
    membershipId: string,
    lookup: FamilyAccessLookup,
    requiredScopes: AccessGrantScope[],
  ) {
    await this.accessService.requireFamilyScopes({
      membershipId,
      careRoomId,
      organizationId: lookup.organizationId,
      authSubject: lookup.authSubject,
      requiredScopes,
    });
  }

  private findFamilyMembership(memberships: any[], lookup: FamilyAccessLookup) {
    const eligibleMemberships = (memberships ?? []).filter((membership: any) =>
      this.isEligibleFamilyMembership(membership, lookup),
    );
    const matches = eligibleMemberships.filter(
      (membership: any) =>
        membership.family_contact.auth_subject === lookup.authSubject,
    );
    return matches.length === 1 ? matches[0] : undefined;
  }

  private isEligibleFamilyMembership(membership: any, lookup: FamilyAccessLookup) {
    const familyContact = membership.family_contact;
    return (
      membership.status === CareRoomMembershipStatus.ACTIVE &&
      !membership.revoked_at &&
      Boolean(familyContact) &&
      familyContact.organization_id === lookup.organizationId &&
      !familyContact.disabled_at &&
      membership.organization_membership_invitation?.status === 'ACCEPTED' &&
      membership.organization_membership_invitation?.organization_id === lookup.organizationId &&
      membership.organization_membership_invitation?.intended_role === 'family' &&
      membership.organization_membership_invitation?.bound_auth_subject === lookup.authSubject &&
      membership.organization_membership_invitation?.activated_membership?.status === 'ACTIVE' &&
      !membership.organization_membership_invitation?.activated_membership?.revoked_at &&
      membership.organization_membership_invitation?.activated_membership?.auth_subject === lookup.authSubject
    );
  }

  private familyRoomForbidden() {
    return new BaseHttpException(
      ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
      'You do not have access to this CareBridge room.',
      HttpStatus.FORBIDDEN,
    );
  }

  private isFamilyDenial(error: unknown) {
    return error instanceof BaseHttpException && error.getStatus() === HttpStatus.FORBIDDEN;
  }

  private requireFamilyAuditActorId(viewer: ViewerContext, membership: any) {
    const actorId = (
      viewer.authSubject ||
      viewer.userId ||
      membership?.family_contact?.id ||
      ''
    ).trim();
    if (!actorId) {
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        'CareBridge audit actor context is required.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return actorId;
  }

  private mapConcernEventType(status: ConcernStatus) {
    switch (status) {
      case ConcernStatus.ACKNOWLEDGED:
        return ConcernEventType.ACKNOWLEDGED;
      case ConcernStatus.RESOLVED:
        return ConcernEventType.RESOLVED;
      case ConcernStatus.ESCALATED:
        return ConcernEventType.ESCALATED;
      default:
        return ConcernEventType.RESPONDED;
    }
  }

  private async createAudit(
    tx: Prisma.TransactionClient,
    options: CreateCarebridgeAuditOptions,
  ) {
    const organizationId = (options.organizationId || '').trim();
    if (!organizationId) {
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        'CareBridge audit organization context is required.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    await tx.auditLog.create({
      data: {
        user_id: options.actorId?.trim() || null,
        organization_id: organizationId,
        action: options.action,
        resource_type: options.resourceType,
        resource_id: options.resourceId,
        new_values: sanitizeAuditMetadata(options.newValues, {
          identifierSource: 'trusted',
        }),
      },
    });
  }

  private mapCareRoom(room: any, options?: { familyMembership?: any }) {
    const memberships = options?.familyMembership
      ? [options.familyMembership]
      : (room.memberships ?? []);

    return {
      id: room.id,
      status: room.status,
      client: room.client
        ? {
            id: room.client.id,
            fullName: room.client.full_name,
          }
        : null,
      memberships: memberships.map((membership: any) => this.mapMembership(membership)),
      policy: room.policies?.[0] ? this.mapPolicy(room.policies[0]) : null,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  }

  private familyLaunchAuthority(membership: any) {
    const activeScopes = new Set(
      (membership.access_grants ?? [])
        .filter((grant: any) => !grant.revoked_at)
        .map((grant: any) => grant.scope),
    );
    return {
      canViewApprovedUpdates:
        activeScopes.has(AccessGrantScope.VIEW_UPDATES) &&
        activeScopes.has(AccessGrantScope.VIEW_TASK_SUMMARY),
      canRaiseConcerns: activeScopes.has(AccessGrantScope.RAISE_CONCERNS),
    };
  }

  private mapFamilyCareRoom(room: any, membership: any) {
    const authority = this.familyLaunchAuthority(membership);
    return {
      id: room.id,
      clientDisplayName: room.client?.full_name || 'Care recipient',
      ...authority,
    };
  }

  private mapMembership(membership: any) {
    return {
      id: membership.id,
      invitationId: membership.organization_membership_invitation?.id ?? null,
      role: membership.role,
      status: membership.status,
      accessBasis: membership.access_basis,
      reviewDueAt: membership.review_due_at ?? null,
      familyContact: membership.family_contact
        ? {
            id: membership.family_contact.id,
            fullName: membership.family_contact.full_name,
            email: membership.family_contact.email ?? null,
            relationship: membership.family_contact.relationship ?? null,
          }
        : null,
      accessGrants: (membership.access_grants ?? []).map((grant: any) => ({
        id: grant.id,
        scope: grant.scope,
        grantedAt: grant.granted_at,
        revokedAt: grant.revoked_at ?? null,
      })),
      invitationStatus: membership.organization_membership_invitation?.status ?? null,
      deliveryStatus:
        membership.organization_membership_invitation?.provisioning_outbox?.status ?? null,
      cleanupStatus: membership.organization_membership_invitation?.external_cleanup_required
        ? membership.organization_membership_invitation.external_cleanup_error_code
          ? 'MANUAL_REVIEW'
          : 'PENDING'
        : 'COMPLETE',
      invitationExpiresAt:
        membership.organization_membership_invitation?.expires_at ?? null,
    };
  }

  private mapPolicy(policy: any) {
    return {
      id: policy.id,
      showVisitTimesDefault: policy.show_visit_times_default,
      showTaskSummaryDefault: policy.show_task_summary_default,
      showMedicationSupportDefault:
        isMedicationEmarEnabled() && policy.show_medication_support_default,
      requireApprovalForAllContent: policy.require_approval_for_all_content,
      familyCanRaiseConcerns: policy.family_can_raise_concerns,
      familyCanReplyToConcerns: policy.family_can_reply_to_concerns,
      familyCanSubmitPulse: policy.family_can_submit_pulse,
    };
  }

  private mapStory(story: any) {
    return {
      id: story.id,
      status: story.status,
      draftTitle: story.draft_title,
      draftBody: story.draft_body,
      approvedTitle: story.approved_title ?? null,
      approvedBody: story.approved_body ?? null,
      familySafeVersion: story.family_safe_version ?? null,
      familySafeTitle: story.family_safe_title ?? null,
      familySafeBody: story.family_safe_body ?? null,
      approvedAt: story.approved_at ?? null,
      rejectionReason: story.rejection_reason ?? null,
      rejectedAt: story.rejected_at ?? null,
      sourceRefs: story.source_refs,
      publishedAt: story.published_at ?? null,
    };
  }

  private isExcludedMedicationStory(story: any): boolean {
    if (isMedicationEmarEnabled()) return false;
    const refs = Array.isArray(story?.source_refs) ? story.source_refs : [];
    const hasMedicationReference = refs.some((ref: any) => {
      const type = String(ref?.type || ref?.sourceType || '')
        .replace(/[^a-z]/gi, '')
        .toLowerCase();
      const category = String(ref?.category || '').trim().toUpperCase();
      return type === 'medicationadministration' || category === 'MEDICATION';
    });
    return (
      hasMedicationReference ||
      containsMedicationEmarContent([
        story?.draft_title,
        story?.draft_body,
        story?.approved_title,
        story?.approved_body,
        story?.family_safe_title,
        story?.family_safe_body,
        story?.rejection_reason,
      ])
    );
  }

  private mapConcern(concern: any) {
    return {
      id: concern.id,
      careRoomId: concern.care_room_id,
      clientId: concern.client_id,
      title: concern.title,
      description: concern.description ?? null,
      severity: concern.severity,
      priority: concern.priority,
      category: concern.category,
      status: concern.status,
      outcome: concern.outcome ?? null,
      acknowledgementDueAt: concern.acknowledgement_due_at ?? null,
      acknowledgedAt: concern.acknowledged_at ?? null,
      responseDueAt: concern.response_due_at ?? null,
      resolutionDueAt: concern.resolution_due_at ?? null,
      resolvedAt: concern.resolved_at ?? null,
      messages: (concern.messages ?? []).map((message: any) => ({
        id: message.id,
        body: message.body,
        actorLabel: message.actor_label ?? 'Care team',
        createdAt: message.created_at,
      })),
      events: (concern.events ?? []).map((event: any) => ({
        id: event.id,
        eventType: event.event_type,
        createdAt: event.created_at,
      })),
    };
  }

  private mapFamilyPulse(pulse: any) {
    return {
      id: pulse.id,
      sentiment: pulse.sentiment,
      note: pulse.note ?? null,
      createdAt: pulse.created_at,
    };
  }
}
