import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CareRoomMembershipStatus,
  ConcernEventType,
  ConcernStatus,
  FamilyPulseSentiment,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { CarebridgeRepository } from './carebridge.repository';
import {
  InviteFamilyContactInput,
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

@Injectable()
export class CarebridgeService {
  constructor(
    private readonly repository: CarebridgeRepository,
    private readonly prisma: PrismaService,
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

    const room = await this.repository.createCareRoom({
      organization_id: organizationId,
      client_id: clientId,
    });
    await this.repository.ensurePolicyForRoom(room.id, organizationId, clientId);
    await this.createAudit(actorUserId, 'CAREBRIDGE_ROOM_CREATED', 'CareRoom', room.id, {
      clientId,
    });
    return this.mapCareRoom({
      ...room,
      policies: room.policies ?? [],
    });
  }

  async inviteFamilyContact(input: InviteFamilyContactInput, actorUserId: string, actorRole: string, organizationId: string) {
    this.assertStaffRole(actorRole);
    const room = await this.repository.findRoomByIdForOrganization(input.careRoomId, organizationId);
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'CareBridge room could not be found for your organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const familyContact = await this.repository.upsertFamilyContact({
      organization_id: organizationId,
      full_name: input.fullName,
      email: input.email.trim().toLowerCase(),
      relationship: input.relationship,
    });

    const membership = await this.repository.createMembershipWithDefaultScopes({
      care_room_id: room.id,
      family_contact_id: familyContact.id,
      role: input.role,
      access_basis: input.accessBasis,
    });

    await this.createAudit(actorUserId, 'CAREBRIDGE_FAMILY_INVITED', 'CareRoomMembership', membership.id, {
      careRoomId: room.id,
      familyContactId: familyContact.id,
      accessBasis: input.accessBasis,
    });

    return this.mapMembership(membership);
  }

  async updatePolicy(input: UpdateCarebridgePolicyInput, actorUserId: string, actorRole: string, organizationId: string) {
    this.assertStaffRole(actorRole);
    const room = await this.repository.findRoomByIdForOrganization(input.careRoomId, organizationId);
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'CareBridge room could not be found for your organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const policy = await this.repository.updatePolicy(input.careRoomId, {
      show_visit_times_default: input.showVisitTimesDefault ?? undefined,
      show_task_summary_default: input.showTaskSummaryDefault ?? undefined,
      show_medication_support_default: input.showMedicationSupportDefault ?? undefined,
      require_approval_for_all_content: input.requireApprovalForAllContent ?? undefined,
    });

    await this.createAudit(actorUserId, 'CAREBRIDGE_POLICY_UPDATED', 'CareBridgePolicy', policy.id, {
      careRoomId: input.careRoomId,
    });

    return this.mapPolicy(policy);
  }

  async listCareRooms(viewer: ViewerContext) {
    if (this.isExternalViewer(viewer)) {
      if (!viewer.email) {
        return [];
      }
      const rooms = await this.repository.listRoomsForFamilyEmail(viewer.email.trim().toLowerCase());
      return rooms.map((room: any) => this.mapCareRoom(room));
    }

    if (!viewer.organizationId) {
      return [];
    }

    const rooms = await this.repository.listRoomsForOrganization(viewer.organizationId);
    return rooms.map((room: any) => this.mapCareRoom(room));
  }

  async getCareRoom(id: string, viewer: ViewerContext) {
    const room = this.isExternalViewer(viewer)
      ? await this.repository.findRoomByIdForFamilyEmail(id, (viewer.email || '').trim().toLowerCase())
      : await this.repository.findRoomByIdForOrganization(id, viewer.organizationId || '');

    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You do not have access to this CareBridge room.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.mapCareRoom(room);
  }

  async listVerifiedVisitStories(careRoomId: string, viewer: ViewerContext) {
    await this.getCareRoom(careRoomId, viewer);
    const status = this.isExternalViewer(viewer) ? 'PUBLISHED' : undefined;
    const stories = await this.repository.listVerifiedVisitStoriesByRoomId(careRoomId, status as any);
    return stories.map((story: any) => this.mapStory(story));
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
    return stories.map((story: any) => this.mapStory(story));
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

    const completedTasks = visit.tasks.filter((task) => task.is_completed);
    const pendingTasks = visit.tasks.filter((task) => !task.is_completed);
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
      visit.notes ? `Care update: ${visit.notes}` : null,
    ].filter(Boolean).join(' ');

    const sourceRefs = [
      { type: 'Visit', id: visit.id },
      ...visit.tasks.map((task) => ({ type: 'VisitTask', id: task.id })),
    ];

    const story = await this.repository.createVerifiedVisitStory({
      organization_id: organizationId,
      care_room_id: room.id,
      client_id: visit.client_id,
      visit_id: visit.id,
      status: 'DRAFT' as any,
      draft_title: draftTitle,
      draft_body: draftBody,
      source_refs: sourceRefs,
    });

    await this.createAudit(actorUserId, 'CAREBRIDGE_VISIT_STORY_DRAFTED', 'VerifiedVisitStory', story.id, {
      visitId,
      careRoomId: room.id,
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

    const refs = Array.isArray(story.source_refs) ? story.source_refs : [];
    if (refs.length === 0) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Verified visit stories must include source references before publication.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const published = await this.repository.publishVerifiedVisitStory(
      storyId,
      story.draft_title,
      story.draft_body,
      approvalActorUserId,
    );
    await this.createAudit(approvalActorUserId, 'CAREBRIDGE_VISIT_STORY_PUBLISHED', 'VerifiedVisitStory', storyId, {});
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

    if (story.status === 'PUBLISHED') {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Published verified visit stories cannot be rejected.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rejected = await this.repository.rejectVerifiedVisitStory(storyId, reason);
    await this.createAudit(rejectionActorUserId, 'CAREBRIDGE_VISIT_STORY_REJECTED', 'VerifiedVisitStory', storyId, {
      rejectionReason: reason,
    });
    return this.mapStory(rejected);
  }

  async raiseConcern(input: RaiseConcernInput, viewer: ViewerContext) {
    const room = this.isExternalViewer(viewer)
      ? await this.repository.findRoomByIdForFamilyEmail(input.careRoomId, (viewer.email || '').trim().toLowerCase())
      : await this.repository.findRoomByIdForOrganization(input.careRoomId, viewer.organizationId || '');

    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You do not have access to this CareBridge room.',
        HttpStatus.FORBIDDEN,
      );
    }

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
      acknowledgement_due_at: new Date(now.getTime() + 60 * 60 * 1000),
      response_due_at: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      resolution_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      source_refs: [{ type: 'CareRoom', id: room.id }],
    });

    await this.repository.appendConcernEvent({
      concern_id: concern.id,
      event_type: ConcernEventType.RAISED,
      actor_type: this.isExternalViewer(viewer) ? 'FAMILY' as any : 'STAFF' as any,
      actor_id: viewer.userId ?? viewer.email ?? null,
    });

    if (input.description) {
      if (typeof (this.repository as any).appendConcernMessage === 'function') {
        await this.repository.appendConcernMessage({
          concern_id: concern.id,
          actor_type: this.isExternalViewer(viewer) ? 'FAMILY' as any : 'STAFF' as any,
          actor_id: viewer.userId ?? viewer.email ?? null,
          actor_label: this.isExternalViewer(viewer) ? 'Family member' : 'Staff member',
          body: input.description,
        });
      }
    }

    await this.createAudit(viewer.userId ?? viewer.email ?? 'family-user', 'CAREBRIDGE_CONCERN_RAISED', 'Concern', concern.id, {
      careRoomId: room.id,
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

    const updated = await this.repository.updateConcern(input.concernId, nextData);

    if (input.message) {
      await this.repository.appendConcernMessage({
        concern_id: input.concernId,
        actor_type: 'STAFF' as any,
        actor_id: actorUserId,
        actor_label: 'Care team',
        body: input.message,
      });
    }

    await this.repository.appendConcernEvent({
      concern_id: input.concernId,
      event_type: this.mapConcernEventType(input.status),
      actor_type: 'STAFF' as any,
      actor_id: actorUserId,
      metadata: input.outcome ? { outcome: input.outcome } : undefined,
    });

    await this.createAudit(actorUserId, 'CAREBRIDGE_CONCERN_UPDATED', 'Concern', input.concernId, {
      status: input.status,
      outcome: input.outcome ?? null,
    });

    return this.mapConcern(updated);
  }

  async submitFamilyPulse(input: SubmitFamilyPulseInput, viewer: ViewerContext) {
    if (!this.isExternalViewer(viewer) || !viewer.email) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Only family-access users can submit confidence checks.',
        HttpStatus.FORBIDDEN,
      );
    }

    const room = await this.repository.findRoomByIdForFamilyEmail(input.careRoomId, viewer.email.trim().toLowerCase());
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You do not have access to this CareBridge room.',
        HttpStatus.FORBIDDEN,
      );
    }

    const membership = room.memberships.find(
      (item: any) =>
        item.status === CareRoomMembershipStatus.ACTIVE &&
        item.family_contact?.email?.toLowerCase() === viewer.email?.trim().toLowerCase(),
    );

    if (!membership) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'No active family membership was found for this care room.',
        HttpStatus.FORBIDDEN,
      );
    }

    const pulse = await this.repository.createFamilyPulse({
      organization_id: room.organization_id,
      care_room_id: room.id,
      care_room_membership_id: membership.id,
      sentiment: input.sentiment,
      note: input.note ?? null,
    });

    await this.createAudit(viewer.email, 'CAREBRIDGE_PULSE_SUBMITTED', 'FamilyPulse', pulse.id, {
      sentiment: input.sentiment,
    });

    if (
      (input.sentiment === FamilyPulseSentiment.CONCERNED || input.sentiment === FamilyPulseSentiment.NEED_CALL) &&
      input.note
    ) {
      await this.raiseConcern(
        {
          careRoomId: input.careRoomId,
          title: input.sentiment === FamilyPulseSentiment.NEED_CALL ? 'Callback requested' : 'Family confidence concern',
          description: input.note,
          severity: 'MEDIUM' as any,
          category: 'COMMUNICATION' as any,
        },
        viewer,
      );
    }

    return this.mapFamilyPulse(pulse);
  }

  private assertStaffRole(role: string) {
    if (!['admin', 'carer'].includes(role)) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'This action requires staff access.',
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
    return !['admin', 'carer'].includes((viewer.role || '').trim().toLowerCase());
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

  private async createAudit(userId: string | undefined, action: string, resourceType: string, resourceId: string, newValues: unknown) {
    const organizationId =
      typeof (newValues as any)?.organizationId === 'string'
        ? (newValues as any).organizationId
        : null;
    await this.prisma.auditLog.create({
      data: {
        user_id: userId ?? null,
        organization_id: organizationId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        new_values: newValues as any,
      },
    });
  }

  private mapCareRoom(room: any) {
    return {
      id: room.id,
      status: room.status,
      client: room.client
        ? {
            id: room.client.id,
            fullName: room.client.full_name,
          }
        : null,
      memberships: (room.memberships ?? []).map((membership: any) => this.mapMembership(membership)),
      policy: room.policies?.[0] ? this.mapPolicy(room.policies[0]) : null,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  }

  private mapMembership(membership: any) {
    return {
      id: membership.id,
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
    };
  }

  private mapPolicy(policy: any) {
    return {
      id: policy.id,
      showVisitTimesDefault: policy.show_visit_times_default,
      showTaskSummaryDefault: policy.show_task_summary_default,
      showMedicationSupportDefault: policy.show_medication_support_default,
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
      approvedAt: story.approved_at ?? null,
      rejectionReason: story.rejection_reason ?? null,
      rejectedAt: story.rejected_at ?? null,
      sourceRefs: story.source_refs,
      publishedAt: story.published_at ?? null,
    };
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
