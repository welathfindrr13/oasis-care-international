import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaService,
  AccessGrantScope,
  CarebridgeContentStatus,
  CareRoomMembershipStatus,
  CareRoomStatus,
} from '@oasis/db';

interface FamilyAccessLookup {
  organizationId: string;
  authSubject: string;
}

@Injectable()
export class CarebridgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private familyContactWhere(input: FamilyAccessLookup): Prisma.FamilyContactWhereInput {
    const authSubject = (input.authSubject || '').trim();
    if (authSubject) {
      return {
        organization_id: input.organizationId,
        disabled_at: null,
        auth_subject: authSubject,
      };
    }

    return {
      organization_id: input.organizationId,
      disabled_at: null,
      id: '__no-family-access__',
    };
  }

  private familyMembershipWhere(input: FamilyAccessLookup): Prisma.CareRoomMembershipWhereInput {
    const authSubject = (input.authSubject || '').trim();
    return {
      status: CareRoomMembershipStatus.ACTIVE,
      revoked_at: null,
      family_contact: this.familyContactWhere(input),
      organization_membership_invitation: {
        status: 'ACCEPTED',
        organization_id: input.organizationId,
        intended_role: 'family',
        bound_auth_subject: authSubject,
        activated_membership: {
          organization_id: input.organizationId,
          auth_subject: authSubject,
          role: 'family',
          status: 'ACTIVE',
          revoked_at: null,
        },
      },
    };
  }

  async ensureClientInOrganization(clientId: string, organizationId: string): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: clientId,
        organization_id: organizationId,
      }),
      select: { id: true },
    });
    return Boolean(client);
  }

  async createCareRoom(data: Prisma.CareRoomUncheckedCreateInput) {
    return this.prisma.careRoom.create({
      data,
      include: this.roomInclude(),
    });
  }

  async ensurePolicyForRoom(careRoomId: string, organizationId: string, clientId: string) {
    const existing = await this.prisma.careBridgePolicy.findFirst({
      where: { care_room_id: careRoomId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.careBridgePolicy.create({
      data: {
        organization_id: organizationId,
        care_room_id: careRoomId,
        client_id: clientId,
      },
    });
  }

  async findPolicyByRoomId(careRoomId: string) {
    return this.prisma.careBridgePolicy.findFirst({
      where: { care_room_id: careRoomId },
    });
  }

  async updatePolicy(careRoomId: string, data: Prisma.CareBridgePolicyUpdateInput) {
    const policy = await this.findPolicyByRoomId(careRoomId);
    if (!policy) {
      throw new Error(`CareBridge policy not found for room ${careRoomId}`);
    }

    return this.prisma.careBridgePolicy.update({
      where: { id: policy.id },
      data,
    });
  }

  async listRoomsForOrganization(organizationId: string) {
    return this.prisma.careRoom.findMany({
      where: { organization_id: organizationId },
      orderBy: { updated_at: 'desc' },
      include: this.roomInclude(),
    });
  }

  async listRoomsForFamilyAccess(input: FamilyAccessLookup) {
    return this.prisma.careRoom.findMany({
      where: {
        organization_id: input.organizationId,
        status: CareRoomStatus.ACTIVE,
        memberships: {
          some: this.familyMembershipWhere(input),
        },
      },
      orderBy: { updated_at: 'desc' },
      include: this.familyRoomInclude(input),
    });
  }

  async findRoomByIdForOrganization(id: string, organizationId: string) {
    return this.prisma.careRoom.findFirst({
      where: { id, organization_id: organizationId },
      include: this.roomInclude(),
    });
  }

  async findRoomByIdForFamilyAccess(id: string, input: FamilyAccessLookup) {
    return this.prisma.careRoom.findFirst({
      where: {
        id,
        organization_id: input.organizationId,
        status: CareRoomStatus.ACTIVE,
        memberships: {
          some: this.familyMembershipWhere(input),
        },
      },
      include: this.familyRoomInclude(input),
    });
  }

  async findVisitForStory(visitId: string, organizationId: string) {
    return this.prisma.visit.findFirst({
      where: this.prisma.whereNotDeleted({
        id: visitId,
        organization_id: organizationId,
      }),
      include: {
        client: true,
        carer: true,
        tasks: {
          where: { deleted_at: null },
        },
      },
    });
  }

  async findRoomByClientId(clientId: string, organizationId: string) {
    return this.prisma.careRoom.findFirst({
      where: {
        client_id: clientId,
        organization_id: organizationId,
        status: { not: 'ARCHIVED' as any },
      },
    });
  }

  async createVerifiedVisitStory(data: Prisma.VerifiedVisitStoryUncheckedCreateInput) {
    return this.prisma.verifiedVisitStory.create({ data });
  }

  async listVerifiedVisitStoriesByRoomId(careRoomId: string, status?: CarebridgeContentStatus) {
    return this.prisma.verifiedVisitStory.findMany({
      where: {
        care_room_id: careRoomId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async listFamilySafePublishedStoriesByRoomId(careRoomId: string) {
    return this.prisma.verifiedVisitStory.findMany({
      where: {
        care_room_id: careRoomId,
        status: CarebridgeContentStatus.PUBLISHED,
        family_safe_version: 1,
        family_safe_title: { not: null },
        family_safe_body: { not: null },
        published_at: { not: null },
        visit: {
          status: 'COMPLETED',
          deleted_at: null,
        },
      },
      orderBy: { created_at: 'desc' },
      select: {
        family_safe_title: true,
        family_safe_body: true,
        published_at: true,
      },
    });
  }

  async listVerifiedVisitStoryApprovalQueue(organizationId: string, careRoomId?: string) {
    return this.prisma.verifiedVisitStory.findMany({
      where: {
        organization_id: organizationId,
        status: CarebridgeContentStatus.DRAFT,
        ...(careRoomId ? { care_room_id: careRoomId } : {}),
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findVerifiedVisitStoryById(id: string, organizationId: string) {
    return this.prisma.verifiedVisitStory.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        visit: {
          select: { status: true, deleted_at: true },
        },
      },
    });
  }

  async publishVerifiedVisitStory(id: string, approvedTitle: string, approvedBody: string, approvedById: string) {
    const changed = await this.prisma.verifiedVisitStory.updateMany({
      where: {
        id,
        status: CarebridgeContentStatus.DRAFT,
        family_safe_version: 1,
        family_safe_title: approvedTitle,
        family_safe_body: approvedBody,
        visit: { status: 'COMPLETED', deleted_at: null },
      },
      data: {
        status: CarebridgeContentStatus.PUBLISHED,
        approved_title: approvedTitle,
        approved_body: approvedBody,
        approved_by_id: approvedById,
        approved_at: new Date(),
        published_at: new Date(),
        rejected_at: null,
        rejection_reason: null,
      },
    });
    if (changed.count !== 1) return null;
    return this.prisma.verifiedVisitStory.findUnique({ where: { id } });
  }

  async rejectVerifiedVisitStory(id: string, rejectionReason: string) {
    const changed = await this.prisma.verifiedVisitStory.updateMany({
      where: { id, status: CarebridgeContentStatus.DRAFT },
      data: {
        status: CarebridgeContentStatus.REJECTED,
        rejection_reason: rejectionReason,
        rejected_at: new Date(),
        approved_title: null,
        approved_body: null,
        approved_by_id: null,
        approved_at: null,
        published_at: null,
      },
    });
    if (changed.count !== 1) return null;
    return this.prisma.verifiedVisitStory.findUnique({ where: { id } });
  }

  async createConcern(data: Prisma.ConcernUncheckedCreateInput) {
    return this.prisma.concern.create({
      data,
      include: this.concernInclude(),
    });
  }

  async appendConcernEvent(data: Prisma.ConcernEventUncheckedCreateInput) {
    return this.prisma.concernEvent.create({ data });
  }

  async appendConcernMessage(data: Prisma.ConcernMessageUncheckedCreateInput) {
    return this.prisma.concernMessage.create({ data });
  }

  async findConcernById(id: string, organizationId: string) {
    return this.prisma.concern.findFirst({
      where: { id, organization_id: organizationId },
      include: this.concernInclude(),
    });
  }

  async listConcernsForOrganization(organizationId: string, status?: string) {
    return this.prisma.concern.findMany({
      where: {
        organization_id: organizationId,
        ...(status ? { status: status as any } : {}),
      },
      include: this.concernInclude(),
      orderBy: [
        { resolution_due_at: 'asc' },
        { created_at: 'desc' },
      ],
    });
  }

  async updateConcern(id: string, data: Prisma.ConcernUpdateInput) {
    return this.prisma.concern.update({
      where: { id },
      data,
      include: this.concernInclude(),
    });
  }

  async createFamilyPulse(data: Prisma.FamilyPulseUncheckedCreateInput) {
    return this.prisma.familyPulse.create({ data });
  }

  private roomInclude() {
    return {
      client: true,
      policies: { take: 1, orderBy: { updated_at: 'desc' as const } },
      memberships: {
        include: {
          family_contact: true,
          organization_membership_invitation: {
            include: { provisioning_outbox: true },
          },
          access_grants: {
            where: { revoked_at: null },
          },
        },
      },
    };
  }

  private familyRoomInclude(input: FamilyAccessLookup) {
    return {
      client: true,
      policies: { take: 1, orderBy: { updated_at: 'desc' as const } },
      memberships: {
        where: this.familyMembershipWhere(input),
        include: {
          family_contact: {
            select: {
              id: true,
              organization_id: true,
              auth_subject: true,
              full_name: true,
              relationship: true,
              disabled_at: true,
            },
          },
          organization_membership_invitation: {
            select: {
              organization_id: true,
              intended_role: true,
              status: true,
              bound_auth_subject: true,
              activated_membership: {
                select: {
                  organization_id: true,
                  auth_subject: true,
                  role: true,
                  status: true,
                  revoked_at: true,
                },
              },
            },
          },
          access_grants: {
            where: { revoked_at: null },
          },
        },
      },
    };
  }

  private concernInclude() {
    return {
      messages: {
        orderBy: { created_at: 'asc' as const },
      },
      events: {
        orderBy: { created_at: 'asc' as const },
      },
    };
  }
}
