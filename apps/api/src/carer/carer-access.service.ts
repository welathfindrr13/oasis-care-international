import { ForbiddenException, Injectable } from '@nestjs/common';
import { CanonicalAccessContext } from '../auth/access-context.service';

export type VerifiedCarerPrincipal = {
  accessContext?: CanonicalAccessContext | null;
};

export type ResolvedCarerIdentity = {
  carerId: string;
  authSubject: string;
};

export type CarerEnrichedRequestUser = {
  accessContext?: CanonicalAccessContext | null;
};

export type ResolvedOperationalActor = {
  userId: string;
  userRole: string;
  organizationId: string;
  authSubject: string;
  accessContext: CanonicalAccessContext;
};

const CARER_LINK_REQUIRED_MESSAGE = 'Active carer membership link is required';

export function requireOperationalActor(user: CarerEnrichedRequestUser | null | undefined): ResolvedOperationalActor {
  const access = user?.accessContext;
  if (
    !access ||
    access.membershipState !== 'ACTIVE' ||
    access.surface === 'NONE' ||
    access.onboardingState !== 'READY' ||
    !access.organizationId ||
    !access.rawRole
  ) {
    denyCarerAccess();
  }

  if (access.rawRole === 'carer' || access.rawRole === 'staff') {
    if (!access.domainIdentityId || access.linkedIdentityState !== 'LINKED') {
      denyCarerAccess();
    }
    return {
      userId: access.domainIdentityId,
      userRole: 'carer',
      organizationId: access.organizationId,
      authSubject: access.authSubject,
      accessContext: access,
    };
  }

  return {
    userId: access.authSubject,
    userRole: access.rawRole,
    organizationId: access.organizationId,
    authSubject: access.authSubject,
    accessContext: access,
  };
}

@Injectable()
export class CarerAccessService {
  async requireCarerIdentity(principal: VerifiedCarerPrincipal): Promise<ResolvedCarerIdentity> {
    const access = principal.accessContext;
    if (
      !access ||
      access.membershipState !== 'ACTIVE' ||
      access.surface !== 'STAFF' ||
      access.linkedIdentityState !== 'LINKED' ||
      !access.domainIdentityId ||
      !['carer', 'staff'].includes(access.rawRole || '')
    ) {
      denyCarerAccess();
    }
    return { carerId: access.domainIdentityId, authSubject: access.authSubject };
  }
}

function denyCarerAccess(): never {
  throw new ForbiddenException(CARER_LINK_REQUIRED_MESSAGE);
}
