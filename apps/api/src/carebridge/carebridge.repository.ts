import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaService,
  AccessGrantScope,
  CarebridgeContentStatus,
  CareRoomMembershipStatus,
} from '@oasis/db';

@Injectable()
export class CarebridgeRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsertFamilyContact(input: {
    organization_id: string;
    full_name: string;
    email: string;
    relationship?: string;
  }) {
    const existing = await this.prisma.familyContact.findFirst({
      where: {
        organization_id: input.organization_id,
        email: input.email,
      },
    });

    if (existing) {
      return this.prisma.familyContact.update({
        where: { id: existing.id },
        data: {
          full_name: input.full_name,
          relationship: input.relationship ?? existing.relationship,
        },
      });
    }

    return this.prisma.familyContact.create({ data: input });
  }

  async createMembershipWithDefaultScopes(input: {
    care_room_id: string;
    family_contact_id: string;
    role: string;
    access_basis: string;
  }) {
    return this.prisma.careRoomMembership.create({
      data: {
        ...input,
        role: input.role as any,
        access_basis: input.access_basis as any,
        status: CareRoomMembershipStatus.ACTIVE,
        accepted_at: new Date(),
        access_grants: {
          create: [
            { scope: AccessGrantScope.VIEW_UPDATES },
            { scope: AccessGrantScope.VIEW_VISIT_TIMES },
            { scope: AccessGrantScope.VIEW_TASK_SUMMARY },
            { scope: AccessGrantScope.VIEW_WEEKLY_SUMMARIES },
            { scope: AccessGrantScope.RAISE_CONCERNS },
            { scope: AccessGrantScope.REPLY_TO_CONCERNS },
            { scope: AccessGrantScope.SUBMIT_PULSE },
          ],
        },
      },
      include: {
        family_contact: true,
        access_grants: true,
      },
    });
  }

  async listRoomsForOrganization(organizationId: string) {
    return this.prisma.careRoom.findMany({
      where: { organization_id: organizationId },
      orderBy: { updated_at: 'desc' },
      include: this.roomInclude(),
    });
  }

  async listRoomsForFamilyEmail(email: string) {
    return this.prisma.careRoom.findMany({
      where: {
        memberships: {
          some: {
            status: CareRoomMembershipStatus.ACTIVE,
            family_contact: {
              email,
            },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
      include: this.roomInclude(),
    });
  }

  async findRoomByIdForOrganization(id: string, organizationId: string) {
    return this.prisma.careRoom.findFirst({
      where: { id, organization_id: organizationId },
      include: this.roomInclude(),
    });
  }

  async findRoomByIdForFamilyEmail(id: string, email: string) {
    return this.prisma.careRoom.findFirst({
      where: {
        id,
        memberships: {
          some: {
            status: CareRoomMembershipStatus.ACTIVE,
            family_contact: {
              email,
            },
          },
        },
      },
      include: this.roomInclude(),
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
    });
  }

  async publishVerifiedVisitStory(id: string, approvedTitle: string, approvedBody: string, approvedById: string) {
    return this.prisma.verifiedVisitStory.update({
      where: { id },
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
  }

  async rejectVerifiedVisitStory(id: string, rejectionReason: string) {
    return this.prisma.verifiedVisitStory.update({
      where: { id },
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
