import { getAccessContext, type AccessContext } from '../../lib/auth/access';
import { extractClerkRolesFromClaims } from '../../lib/auth/clerk';
import { normalizeAppRoles } from '../../lib/auth/roles';

type HeaderAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface HeaderViewer {
  accessContext: AccessContext;
  roles: string[];
  userRole: string;
  userName: string;
  userEmail: string;
  userInitial: string;
  isAdmin: boolean;
  status: HeaderAuthStatus;
}

interface HeaderViewerInput {
  pathname: string;
  status: HeaderAuthStatus;
  roles: unknown;
  userName?: string | null;
  userEmail?: string | null;
}

interface ClerkHeaderViewerInput {
  pathname: string;
  isLoaded: boolean;
  isSignedIn?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  sessionClaims?: Record<string, any> | null;
}

export function formatHeaderRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return '';

  switch (normalized) {
    case 'admin':
      return 'ADMIN';
    case 'carer':
      return 'CARER';
    case 'care_manager':
      return 'CARE MANAGER';
    case 'manager':
      return 'MANAGER';
    case 'office':
      return 'OFFICE';
    case 'client':
      return 'CLIENT';
    default:
      return normalized.replace(/_/g, ' ').toUpperCase();
  }
}

function loadingFallbackRoles(pathname: string, status: HeaderAuthStatus, roles: string[]): string[] {
  if (status !== 'loading' || roles.length > 0) {
    return roles;
  }

  return pathname.startsWith('/family') ? ['user'] : ['admin'];
}

function hasRawRoles(roles: unknown): boolean {
  if (Array.isArray(roles)) return roles.length > 0;
  return typeof roles === 'string' && roles.trim().length > 0;
}

export function createHeaderViewer({
  pathname,
  status,
  roles,
  userName,
  userEmail,
}: HeaderViewerInput): HeaderViewer {
  const normalizedRoles = hasRawRoles(roles) ? normalizeAppRoles(roles) : [];
  const effectiveRoles = loadingFallbackRoles(pathname, status, normalizedRoles);
  const accessContext = getAccessContext(effectiveRoles);
  const primaryRole = effectiveRoles[0];
  const email = userEmail || '';
  const name = userName || email.split('@')[0] || (status === 'loading' ? '' : 'User');
  const initialSource = userName || email || 'U';

  return {
    accessContext,
    roles: effectiveRoles,
    userRole: primaryRole ? formatHeaderRoleLabel(primaryRole) : '',
    userName: name,
    userEmail: email,
    userInitial: initialSource.charAt(0).toUpperCase(),
    isAdmin: effectiveRoles.includes('admin'),
    status,
  };
}

export function createNextAuthHeaderViewer(input: HeaderViewerInput): HeaderViewer {
  return createHeaderViewer(input);
}

export function createClerkHeaderViewer({
  pathname,
  isLoaded,
  isSignedIn,
  userName,
  userEmail,
  sessionClaims,
}: ClerkHeaderViewerInput): HeaderViewer {
  const status: HeaderAuthStatus = !isLoaded ? 'loading' : isSignedIn ? 'authenticated' : 'unauthenticated';

  return createHeaderViewer({
    pathname,
    status,
    roles: isLoaded ? extractClerkRolesFromClaims(sessionClaims) : [],
    userName,
    userEmail,
  });
}

export function getHeaderAccessLabel(viewer: HeaderViewer): string {
  if (viewer.accessContext.isExternal) {
    return 'FAMILY ACCESS';
  }

  return viewer.userRole || (viewer.status === 'loading' ? '' : 'MEMBER');
}
