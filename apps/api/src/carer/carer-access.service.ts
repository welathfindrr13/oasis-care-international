import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

export type VerifiedCarerPrincipal = {
  organizationMembershipId?: string | null;
  organizationId?: string | null;
  authSubject?: string | null;
};

export type ResolvedCarerIdentity = {
  carerId: string;
  authSubject: string;
};

export type CarerEnrichedRequestUser = {
  id?: string | null;
  sub?: string | null;
  userId?: string | null;
  role?: string | null;
  realm_access?: { roles?: unknown[] | null } | null;
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  organizationMembershipRole?: string | null;
  carerId?: string | null;
};

export type ResolvedOperationalActor = {
  userId: string;
  userRole: string;
  organizationId: string;
  authSubject: string;
};

type MembershipCarerRow = {
  id: string;
  organization_id: string;
  auth_subject: string;
  role: string;
  status: string;
  carer_id: string | null;
  carer: {
    id: string;
    organization_id: string;
    is_active: boolean;
    deleted_at: Date | null;
  } | null;
};

const ALLOWED_CARER_MEMBERSHIP_ROLES = new Set(['carer', 'staff']);
const CARER_LINK_REQUIRED_MESSAGE = 'Active carer membership link is required';

export function requireOperationalActor(user: CarerEnrichedRequestUser | null | undefined): ResolvedOperationalActor {
  const authSubject = nonEmpty(user?.sub || user?.id || user?.userId);
  const organizationId = nonEmpty(user?.organizationId);
  const rawMembershipRole = nonEmpty(user?.organizationMembershipRole);
  const fallbackRole = nonEmpty(user?.role) || firstRole(user?.realm_access?.roles);
  const membershipRole = (rawMembershipRole || fallbackRole || '').toLowerCase();

  if (!authSubject || !organizationId || !membershipRole) {
    denyCarerAccess();
  }

  if (ALLOWED_CARER_MEMBERSHIP_ROLES.has(membershipRole)) {
    const carerId = nonEmpty(user?.carerId);
    if (!carerId) {
      denyCarerAccess();
    }
    return {
      userId: carerId,
      userRole: 'carer',
      organizationId,
      authSubject,
    };
  }

  return {
    userId: authSubject,
    userRole: membershipRole,
    organizationId,
    authSubject,
  };
}

@Injectable()
export class CarerAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireCarerIdentity(principal: VerifiedCarerPrincipal): Promise<ResolvedCarerIdentity> {
    const organizationMembershipId = this.nonEmpty(principal.organizationMembershipId);
    const organizationId = this.nonEmpty(principal.organizationId);
    const authSubject = this.nonEmpty(principal.authSubject);

    if (!organizationMembershipId || !organizationId || !authSubject) {
      this.deny();
    }

    const memberships = (await this.prisma.organizationMembership.findMany({
      where: {
        auth_subject: authSubject,
        status: 'ACTIVE',
        revoked_at: null,
      },
      select: {
        id: true,
        organization_id: true,
        auth_subject: true,
        role: true,
        status: true,
        carer_id: true,
        carer: {
          select: {
            id: true,
            organization_id: true,
            is_active: true,
            deleted_at: true,
          },
        },
      },
      take: 2,
    } as any)) as unknown as MembershipCarerRow[];

    if (memberships.length !== 1) {
      this.deny();
    }

    const membership = memberships[0];
    const rawRole = membership.role.trim().toLowerCase();
    const carer = membership.carer;

    if (
      membership.status !== 'ACTIVE' ||
      membership.id !== organizationMembershipId ||
      membership.organization_id !== organizationId ||
      membership.auth_subject !== authSubject ||
      !ALLOWED_CARER_MEMBERSHIP_ROLES.has(rawRole) ||
      !membership.carer_id ||
      !carer ||
      carer.id !== membership.carer_id ||
      carer.organization_id !== organizationId ||
      !carer.is_active ||
      carer.deleted_at !== null
    ) {
      this.deny();
    }

    return {
      carerId: carer.id,
      authSubject,
    };
  }

  private nonEmpty(value?: string | null): string | null {
    return nonEmpty(value);
  }

  private deny(): never {
    return denyCarerAccess();
  }
}

function nonEmpty(value?: string | null): string | null {
  const normalized = (value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function firstRole(roles?: unknown[] | null): string | null {
  if (!Array.isArray(roles)) {
    return null;
  }
  for (const role of roles) {
    const normalized = nonEmpty(String(role ?? ''));
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function denyCarerAccess(): never {
  throw new ForbiddenException(CARER_LINK_REQUIRED_MESSAGE);
}
