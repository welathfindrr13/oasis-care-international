import { HttpStatus, Injectable } from '@nestjs/common';
import { CareRoomMembershipStatus, PrismaService } from '@oasis/db';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';

interface RequireFamilyScopeInput {
  careRoomId: string;
  organizationId?: string | null;
  authSubject?: string;
  email?: string;
  requiredScope: string;
}

@Injectable()
export class CarebridgeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireFamilyScope(input: RequireFamilyScopeInput) {
    const membership = await this.prisma.careRoomMembership.findFirst({
      where: {
        care_room_id: input.careRoomId,
        status: CareRoomMembershipStatus.ACTIVE,
        care_room: {
          status: 'ACTIVE',
          ...(input.organizationId ? { organization_id: input.organizationId } : {}),
        },
        family_contact: {
          disabled_at: null,
          OR: [
            ...(input.authSubject ? [{ auth_subject: input.authSubject }] : []),
            ...(input.email ? [{ email: input.email.toLowerCase() }] : []),
          ],
        },
        access_grants: {
          some: {
            scope: input.requiredScope as any,
            revoked_at: null,
          },
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
    });

    if (!membership) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Family access is not permitted for this care room.',
        HttpStatus.FORBIDDEN,
      );
    }

    return membership;
  }
}
