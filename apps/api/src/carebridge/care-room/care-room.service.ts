import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  assertMedicationEmarEnabled,
  isMedicationEmarEnabled,
} from '../../common/features/medication-emar';
import { CreateCareRoomInput } from './dto/create-care-room.input';
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
    if (input.allowMedicationSupportStatus === true) {
      assertMedicationEmarEnabled();
    }
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
      show_medication_support_default: isMedicationEmarEnabled()
        ? input.allowMedicationSupportStatus ?? DEFAULT_POLICY.show_medication_support_default
        : false,
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

  private async attachEffectivePolicy(room: any) {
    const policy = await this.getEffectivePolicy(room.organization_id, room.client_id, room.id);
    const effectivePolicy = policy
      ? {
          ...policy,
          show_medication_support_default:
            isMedicationEmarEnabled() && policy.show_medication_support_default,
        }
      : null;
    return {
      ...room,
      effectivePolicy: effectivePolicy || {
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
