import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  PrismaService,
} from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';

interface RequireFamilyScopeInput {
  membershipId?: string;
  careRoomId: string;
  organizationId: string;
  authSubject?: string;
  email?: string;
  requiredScopes: AccessGrantScope[];
}

@Injectable()
export class CarebridgeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireFamilyScopes(input: RequireFamilyScopeInput) {
    const membershipId = (input.membershipId || '').trim();
    const careRoomId = (input.careRoomId || '').trim();
    const organizationId = (input.organizationId || '').trim();
    const authSubject = (input.authSubject || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const requiredScopes = [...new Set(input.requiredScopes ?? [])];

    if (
      !careRoomId ||
      !organizationId ||
      (!authSubject && !email) ||
      requiredScopes.length === 0
    ) {
      throw this.forbidden();
    }

    const memberships = await this.prisma.careRoomMembership.findMany({
      where: {
        ...(membershipId ? { id: membershipId } : {}),
        care_room_id: careRoomId,
        status: CareRoomMembershipStatus.ACTIVE,
        care_room: {
          status: 'ACTIVE',
          organization_id: organizationId,
        },
        family_contact: {
          organization_id: organizationId,
          disabled_at: null,
          ...(authSubject ? { auth_subject: authSubject } : { email }),
        },
      },
      include: {
        care_room: true,
        family_contact: true,
        access_grants: {
          where: {
            revoked_at: null,
          },
        },
      },
      take: 2,
    });

    if (memberships.length !== 1) {
      throw this.forbidden();
    }

    const membership = memberships[0];
    const activeScopes = new Set(
      membership.access_grants.map((grant: any) => grant.scope),
    );
    if (!requiredScopes.every((scope) => activeScopes.has(scope))) {
      throw this.forbidden();
    }

    return membership;
  }

  private forbidden() {
    return new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Family access is not permitted for this care room.',
      HttpStatus.FORBIDDEN,
    );
  }
}
