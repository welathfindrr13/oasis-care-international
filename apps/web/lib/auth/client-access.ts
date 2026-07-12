import { getAccessContextFromSnapshot, type AccessContext } from './access';
import {
  AuthoritativeAccessSnapshot,
  rolesFromAccessSnapshot,
  unauthenticatedAccessSnapshot,
  unavailableAccessSnapshot,
} from './access-snapshot';

export type ClientAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface ClientAccessSnapshot {
  status: ClientAuthStatus;
  authenticated: boolean;
  roles: string[];
  authoritativeSnapshot: AuthoritativeAccessSnapshot;
  accessContext: AccessContext;
  isAdmin: boolean;
  isCarer: boolean;
  isStaff: boolean;
  capabilities: AuthoritativeAccessSnapshot['capabilities'];
}

export function createClientAccessSnapshot(
  status: ClientAuthStatus,
  authoritativeSnapshot?: AuthoritativeAccessSnapshot | null,
): ClientAccessSnapshot {
  const snapshot =
    status === 'unauthenticated'
      ? unauthenticatedAccessSnapshot()
      : authoritativeSnapshot || unavailableAccessSnapshot();
  const resolvedStatus = status === 'loading' ? 'loading' : status;
  const roles = resolvedStatus === 'authenticated' ? rolesFromAccessSnapshot(snapshot) : [];
  const accessContext = getAccessContextFromSnapshot(
    resolvedStatus === 'authenticated' ? snapshot : unauthenticatedAccessSnapshot(),
  );
  return {
    status: resolvedStatus,
    authenticated: resolvedStatus === 'authenticated' && snapshot.resolution === 'READY',
    roles,
    authoritativeSnapshot: snapshot,
    accessContext,
    isAdmin: resolvedStatus === 'authenticated' && snapshot.surface === 'ADMIN' && snapshot.resolution === 'READY',
    isCarer:
      resolvedStatus === 'authenticated' &&
      snapshot.surface === 'STAFF' &&
      snapshot.effectiveRole === 'carer' &&
      snapshot.resolution === 'READY',
    isStaff:
      resolvedStatus === 'authenticated' &&
      ['ADMIN', 'STAFF'].includes(snapshot.surface) &&
      snapshot.resolution === 'READY',
    capabilities: resolvedStatus === 'authenticated' ? snapshot.capabilities : [],
  };
}

export function loadingClientAccessSnapshot(): ClientAccessSnapshot {
  return createClientAccessSnapshot('loading', unavailableAccessSnapshot());
}
