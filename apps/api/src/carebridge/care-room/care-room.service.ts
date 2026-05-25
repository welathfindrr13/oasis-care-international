import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { CreateCareRoomInput } from './dto/create-care-room.input';
import { GrantCareRoomAccessInput } from './dto/grant-care-room-access.input';
import { UpsertCarebridgePolicyInput } from './dto/upsert-carebridge-policy.input';

const DEFAULT_POLICY = {
  require_approval_for_all_content: true,
  family_can_raise_concerns: true,
  family_can_reply_to_concerns: true,
  show_medication_support_default: false,
};

@Injectable()
export class CareRoomService {
  constructor(private readonly prisma: PrismaService) {}

  async createCareRoom(input: CreateCareRoomInput, actorUserId: string, organizationId?: string | null) {
    const orgId = this.requireOrganizationId(organizationId);
    const client = await this.prisma.client.findFirst({
      where: this.prisma.whereNotDeleted({
        id: input.clientId,
        organization_id: orgId,
      }),
    });

    if (!client) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client was not found in your organization',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.careRoom.findFirst({
      where: {
        organization_id: orgId,
        client_id: input.clientId,
        status: 'ACTIVE',
      },
      include: this.roomInclude(),
    });
    if (existing) {
      return this.attachEffectivePolicy(existing);
    }

    const room = await this.prisma.careRoom.create({
      data: {
        organization_id: orgId,
        client_id: input.clientId,
      },
      include: this.roomInclude(),
    });

    return this.attachEffectivePolicy(room);
  }

  async grantFamilyAccess(input: GrantCareRoomAccessInput, actorUserId: string, organizationId?: string | null) {
    const orgId = this.requireOrganizationId(organizationId);
    const room = await this.prisma.careRoom.findFirst({
      where: {
        id: input.careRoomId,
        organization_id: orgId,
        status: 'ACTIVE',
      },
    });
    if (!room) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'Care room was not found in your organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const familyContact = await this.resolveFamilyContact(orgId, input);
    const existingMembership = await this.prisma.careRoomMembership.findFirst({
      where: {
        care_room_id: room.id,
        family_contact_id: familyContact.id,
      },
    });

    const membership = existingMembership
      ? await this.prisma.careRoomMembership.update({
          where: { id: existingMembership.id },
          data: {
            role: input.role,
            access_basis: input.accessBasis,
            status: 'ACTIVE',
            approved_by_user_id: actorUserId,
            revoked_by_user_id: null,
            revoked_at: null,
            accepted_at: existingMembership.accepted_at || new Date(),
            review_due_at: input.reviewDueAt || null,
          },
          include: {
            family_contact: true,
            access_grants: true,
          },
        })
      : await this.prisma.careRoomMembership.create({
          data: {
            care_room_id: room.id,
            family_contact_id: familyContact.id,
            role: input.role,
            access_basis: input.accessBasis,
            status: 'ACTIVE',
            invited_by_user_id: actorUserId,
            approved_by_user_id: actorUserId,
            accepted_at: new Date(),
            review_due_at: input.reviewDueAt || null,
          },
          include: {
            family_contact: true,
            access_grants: true,
          },
        });

    await this.prisma.accessGrant.updateMany({
      where: {
        care_room_membership_id: membership.id,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    for (const scope of input.scopes) {
      const existingGrant = await this.prisma.accessGrant.findFirst({
        where: {
          care_room_membership_id: membership.id,
          scope,
        },
      });

      if (existingGrant) {
        await this.prisma.accessGrant.update({
          where: { id: existingGrant.id },
          data: {
            revoked_at: null,
          },
        });
      } else {
        await this.prisma.accessGrant.create({
          data: {
            care_room_membership_id: membership.id,
            scope,
          },
        });
      }
    }

    return this.prisma.careRoomMembership.findFirst({
      where: { id: membership.id },
      include: {
        family_contact: true,
        access_grants: {
          where: { revoked_at: null },
        },
      },
    });
  }

  async listMyCareRooms(authSubject?: string, email?: string) {
    if (!authSubject && !email) {
      return [];
    }

    const memberships = await this.prisma.careRoomMembership.findMany({
      where: {
        status: 'ACTIVE',
        family_contact: {
          disabled_at: null,
          OR: [
            ...(authSubject ? [{ auth_subject: authSubject }] : []),
            ...(email ? [{ email: email.toLowerCase() }] : []),
          ],
        },
        care_room: {
          status: 'ACTIVE',
        },
      },
      include: {
        care_room: {
          include: this.roomInclude(),
        } as any,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const seen = new Set<string>();
    const rooms = memberships
      .map((membership: any) => membership.care_room)
      .filter((room: any) => {
        if (seen.has(room.id)) return false;
        seen.add(room.id);
        return true;
      });

    return Promise.all(rooms.map((room: any) => this.attachEffectivePolicy(room)));
  }

  async getEffectivePolicy(organizationId: string, clientId?: string | null, careRoomId?: string | null) {
    const roomPolicy = careRoomId
      ? await this.prisma.careBridgePolicy.findFirst({
          where: {
            organization_id: organizationId,
            care_room_id: careRoomId,
          },
          orderBy: { updated_at: 'desc' },
        })
      : null;

    if (roomPolicy) return roomPolicy;

    const clientPolicy = clientId
      ? await this.prisma.careBridgePolicy.findFirst({
          where: {
            organization_id: organizationId,
            client_id: clientId,
            care_room_id: null,
          },
          orderBy: { updated_at: 'desc' },
        })
      : null;
    if (clientPolicy) return clientPolicy;

    return this.prisma.careBridgePolicy.findFirst({
      where: {
        organization_id: organizationId,
        client_id: null,
        care_room_id: null,
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async upsertPolicy(input: UpsertCarebridgePolicyInput, actorUserId: string, organizationId?: string | null) {
    const orgId = this.requireOrganizationId(organizationId);
    const existing = await this.prisma.careBridgePolicy.findFirst({
      where: {
        organization_id: orgId,
        care_room_id: input.careRoomId || null,
        client_id: input.clientId || null,
      },
    });

    const data = {
      require_approval_for_all_content: input.requireApprovalForAllContent ?? DEFAULT_POLICY.require_approval_for_all_content,
      family_can_raise_concerns: input.familyCanRaiseConcerns ?? DEFAULT_POLICY.family_can_raise_concerns,
      family_can_reply_to_concerns: input.familyCanReplyToConcerns ?? DEFAULT_POLICY.family_can_reply_to_concerns,
      show_medication_support_default: input.allowMedicationSupportStatus ?? DEFAULT_POLICY.show_medication_support_default,
    };

    return existing
      ? this.prisma.careBridgePolicy.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.careBridgePolicy.create({
          data: {
            organization_id: orgId,
            care_room_id: input.careRoomId || null,
            client_id: input.clientId || null,
            ...data,
          },
        });
  }

  private async resolveFamilyContact(organizationId: string, input: GrantCareRoomAccessInput) {
    const normalizedEmail = input.email?.trim().toLowerCase();
    const existing = input.authSubject
      ? await this.prisma.familyContact.findUnique({
          where: { auth_subject: input.authSubject },
        })
      : normalizedEmail
        ? await this.prisma.familyContact.findFirst({
            where: {
              organization_id: organizationId,
              email: normalizedEmail,
            },
          })
        : null;

    if (existing) {
      if (existing.organization_id !== organizationId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
          'Family contact belongs to a different organization',
          HttpStatus.FORBIDDEN,
        );
      }

      return this.prisma.familyContact.update({
        where: { id: existing.id },
        data: {
          full_name: input.fullName,
          phone: input.phone || existing.phone,
          relationship: input.relationship || existing.relationship,
          email: normalizedEmail || existing.email,
          auth_subject: input.authSubject || existing.auth_subject,
          disabled_at: null,
        },
      });
    }

    return this.prisma.familyContact.create({
      data: {
        organization_id: organizationId,
        auth_subject: input.authSubject || null,
        email: normalizedEmail || null,
        phone: input.phone || null,
        full_name: input.fullName,
        relationship: input.relationship || null,
        identity_type: 'FAMILY',
      },
    });
  }

  private async attachEffectivePolicy(room: any) {
    const policy = await this.getEffectivePolicy(room.organization_id, room.client_id, room.id);
    return {
      ...room,
      effectivePolicy: policy || {
        id: 'default',
        require_approval_for_all_content: DEFAULT_POLICY.require_approval_for_all_content,
        family_can_raise_concerns: DEFAULT_POLICY.family_can_raise_concerns,
        family_can_reply_to_concerns: DEFAULT_POLICY.family_can_reply_to_concerns,
        show_medication_support_default: DEFAULT_POLICY.show_medication_support_default,
      },
    };
  }

  private roomInclude() {
    return {
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

  private requireOrganizationId(organizationId?: string | null) {
    const orgId = (organizationId || '').trim();
    if (!orgId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Organization context is required for CareBridge staff actions',
        HttpStatus.FORBIDDEN,
      );
    }
    return orgId;
  }
}
