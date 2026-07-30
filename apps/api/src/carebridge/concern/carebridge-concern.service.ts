import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ConcernActorType,
  ConcernEventType,
  ConcernOutcome,
  ConcernPriority,
  ConcernStatus,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { activeOperationalCareRoomWhere } from '../active-operational-care-room';

interface RaiseConcernInput {
  careRoomId: string;
  organizationId?: string | null;
  raisedByMembershipId?: string;
  title: string;
  category: any;
  severity: any;
  messageBody?: string;
  now?: Date;
}

interface ConcernActorInput {
  concernId: string;
  organizationId?: string | null;
  actorUserId: string;
  assignedToUserId?: string;
}

interface RespondToConcernInput extends ConcernActorInput {
  body: string;
}

interface ResolveConcernInput extends ConcernActorInput {
  outcome: ConcernOutcome;
  resolutionSummary: string;
  familySatisfied?: boolean;
}

@Injectable()
export class CarebridgeConcernService {
  constructor(private readonly prisma: PrismaService) {}

  async raiseConcern(input: RaiseConcernInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const now = input.now ?? new Date();
    const careRoom = await this.prisma.careRoom.findFirst({
      where: {
        id: input.careRoomId,
        ...activeOperationalCareRoomWhere(organizationId),
      },
    });

    if (!careRoom) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'This care room is not available for the current organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    const concern = await this.prisma.concern.create({
      data: {
        organization_id: organizationId,
        care_room_id: careRoom.id,
        client_id: careRoom.client_id,
        title: input.title,
        description: input.messageBody ?? null,
        category: input.category,
        severity: input.severity,
        priority: input.severity === 'HIGH' || input.severity === 'CRITICAL'
          ? ConcernPriority.URGENT
          : ConcernPriority.ROUTINE,
        status: ConcernStatus.OPEN,
        raised_by_membership_id: input.raisedByMembershipId ?? null,
        acknowledgement_due_at: new Date(now.getTime() + 60 * 60 * 1000),
        response_due_at: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        resolution_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        source_refs: [{ type: 'CareRoom', id: careRoom.id }],
      },
    });

    await this.prisma.concernEvent.create({
      data: {
        concern_id: concern.id,
        type: 'RAISED',
        event_type: ConcernEventType.RAISED,
        actor_type: input.raisedByMembershipId ? ConcernActorType.FAMILY : ConcernActorType.STAFF,
        actor_id: input.raisedByMembershipId ?? null,
      } as any,
    });

    if (input.messageBody) {
      await this.prisma.concernMessage.create({
        data: {
          concern_id: concern.id,
          actor_type: input.raisedByMembershipId ? ConcernActorType.FAMILY : ConcernActorType.STAFF,
          actor_id: input.raisedByMembershipId ?? null,
          actor_label: input.raisedByMembershipId ? 'Family member' : 'Staff member',
          body: input.messageBody,
        },
      });
    }

    return concern;
  }

  async acknowledgeConcern(input: ConcernActorInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const concern = await this.findConcern(input.concernId, organizationId);
    const updated = await this.prisma.concern.update({
      where: { id: concern.id },
      data: {
        status: ConcernStatus.ACKNOWLEDGED,
        acknowledged_at: new Date(),
        assigned_to_user_id: input.assignedToUserId ?? concern.assigned_to_user_id,
      },
    });

    await this.prisma.concernEvent.create({
      data: {
        concern_id: concern.id,
        type: 'ACKNOWLEDGED',
        event_type: ConcernEventType.ACKNOWLEDGED,
        actor_type: ConcernActorType.STAFF,
        actor_id: input.actorUserId,
      } as any,
    });

    return updated;
  }

  async respondToConcern(input: RespondToConcernInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const concern = await this.findConcern(input.concernId, organizationId);

    await this.prisma.concernMessage.create({
      data: {
        concern_id: concern.id,
        actor_type: ConcernActorType.STAFF,
        actor_id: input.actorUserId,
        actor_label: 'Care team',
        body: input.body,
      },
    });

    await this.prisma.concernEvent.create({
      data: {
        concern_id: concern.id,
        type: 'RESPONDED',
        event_type: ConcernEventType.RESPONDED,
        actor_type: ConcernActorType.STAFF,
        actor_id: input.actorUserId,
      } as any,
    });

    return concern;
  }

  async resolveConcern(input: ResolveConcernInput) {
    const organizationId = this.requireOrganizationId(input.organizationId);
    const concern = await this.findConcern(input.concernId, organizationId);
    const updated = await this.prisma.concern.update({
      where: { id: concern.id },
      data: {
        status: ConcernStatus.RESOLVED,
        outcome: input.outcome,
        resolved_at: new Date(),
        description: input.resolutionSummary,
      },
    });

    await this.prisma.concernEvent.create({
      data: {
        concern_id: concern.id,
        type: 'RESOLVED',
        event_type: ConcernEventType.RESOLVED,
        actor_type: ConcernActorType.STAFF,
        actor_id: input.actorUserId,
        metadata: {
          outcome: input.outcome,
          resolutionSummary: input.resolutionSummary,
          familySatisfied: input.familySatisfied ?? null,
        },
      } as any,
    });

    return updated;
  }

  async listConcernsForRoom(careRoomId: string, organizationId?: string | null) {
    const orgId = this.requireOrganizationId(organizationId);
    return this.prisma.concern.findMany({
      where: {
        organization_id: orgId,
        care_room_id: careRoomId,
        care_room: activeOperationalCareRoomWhere(orgId),
      },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
        events: {
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  private async findConcern(concernId: string, organizationId: string) {
    const concern = await this.prisma.concern.findFirst({
      where: {
        id: concernId,
        organization_id: organizationId,
        care_room: activeOperationalCareRoomWhere(organizationId),
      },
    });

    if (!concern) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'Concern is not available for the current organisation.',
        HttpStatus.FORBIDDEN,
      );
    }

    return concern;
  }

  private requireOrganizationId(organizationId?: string | null) {
    const orgId = (organizationId || '').trim();
    if (!orgId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Organization context is required for CareBridge staff actions.',
        HttpStatus.FORBIDDEN,
      );
    }
    return orgId;
  }
}
