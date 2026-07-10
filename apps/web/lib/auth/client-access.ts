import { getAccessContext, type AccessContext } from './access';
import { extractClerkRolesFromClaims } from './clerk';
import { normalizeAppRoles } from './roles';

export type ClientAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface ClientAccessSnapshot {
  status: ClientAuthStatus;
  authenticated: boolean;
  roles: string[];
  accessContext: AccessContext;
  isAdmin: boolean;
  isCarer: boolean;
  isStaff: boolean;
}

interface ClerkClientAccessInput {
  isLoaded: boolean;
  isSignedIn?: boolean;
  sessionClaims?: Record<string, any> | null;
}

interface NextAuthClientAccessInput {
  status: ClientAuthStatus;
  roles: unknown;
}

export function createClientAccessSnapshot(
  status: ClientAuthStatus,
  rawRoles: unknown,
): ClientAccessSnapshot {
  const authenticated = status === 'authenticated';
  const roles = authenticated ? normalizeAppRoles(rawRoles) : [];
  const accessContext = getAccessContext(roles);

  return {
    status,
    authenticated,
    roles,
    accessContext,
    isAdmin: authenticated && accessContext.isAdmin,
    isCarer: authenticated && roles.includes('carer'),
    isStaff: authenticated && accessContext.isStaff,
  };
}

export function createClerkClientAccessSnapshot({
  isLoaded,
  isSignedIn,
  sessionClaims,
}: ClerkClientAccessInput): ClientAccessSnapshot {
  const status: ClientAuthStatus = !isLoaded
    ? 'loading'
    : isSignedIn
      ? 'authenticated'
      : 'unauthenticated';
  const roles = status === 'authenticated'
    ? extractClerkRolesFromClaims(sessionClaims)
    : [];

  return createClientAccessSnapshot(status, roles);
}

export function createNextAuthClientAccessSnapshot({
  status,
  roles,
}: NextAuthClientAccessInput): ClientAccessSnapshot {
  return createClientAccessSnapshot(status, roles);
}
