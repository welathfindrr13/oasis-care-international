import { normalizeAppRoles } from './roles';

type ClaimRecord = Record<string, any>;

const CLERK_SESSION_COOKIE_PREFIX = '__session';
const CLERK_DB_JWT_COOKIE_PREFIX = '__clerk_db_jwt';

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function mapClerkRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) return null;

  if (['org:admin', 'organization_admin', 'admin'].includes(normalized)) {
    return 'admin';
  }

  if (['org:care_manager', 'org:manager', 'manager', 'care_manager', 'carer', 'staff'].includes(normalized)) {
    return 'carer';
  }

  if (['org:family', 'family', 'client'].includes(normalized)) {
    return 'client';
  }

  // Clerk's default org member role is not staff-authoritative for Oasis.
  if (normalized === 'org:member' || normalized === 'member') {
    return 'user';
  }

  return normalized;
}

function collectClaimRoles(claims: ClaimRecord): string[] {
  const publicMetadata = claims.public_metadata ?? claims.publicMetadata ?? {};
  const privateMetadata = claims.private_metadata ?? claims.privateMetadata ?? {};
  const organizationMetadata = claims.organization_metadata ?? claims.organizationMetadata ?? {};

  return [
    claims.org_role,
    claims.orgRole,
    claims.organization_role,
    claims.organizationRole,
    claims.o?.rol,
    claims.role,
    claims.roles,
    claims.realm_access?.roles,
    publicMetadata.role,
    publicMetadata.roles,
    privateMetadata.role,
    privateMetadata.roles,
    organizationMetadata.role,
    organizationMetadata.roles,
  ]
    .flatMap(asArray)
    .map(mapClerkRole)
    .filter((role): role is string => Boolean(role));
}

export function extractClerkRolesFromClaims(claims: ClaimRecord | null | undefined): string[] {
  if (!claims) return normalizeAppRoles([]);
  return normalizeAppRoles(collectClaimRoles(claims));
}

export function getClerkOrganizationIdFromClaims(claims: ClaimRecord | null | undefined): string | null {
  if (!claims) return null;
  const orgId = claims.org_id ?? claims.orgId ?? claims.organization_id ?? claims.organizationId ?? claims.o?.id;
  return typeof orgId === 'string' && orgId.trim() ? orgId.trim() : null;
}

export function getClerkBearerTokenFromCookieHeader(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return '';

  let exactDbJwtToken = '';
  let suffixedDbJwtToken = '';
  let exactSessionToken = '';
  let suffixedSessionToken = '';

  for (const part of cookieHeader.split(';')) {
    const trimmedPart = part.trim();
    const separatorIndex = trimmedPart.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = trimmedPart.slice(0, separatorIndex).trim();
    if (!name || !isSupportedClerkBearerCookieName(name)) {
      continue;
    }

    const rawValue = trimmedPart.slice(separatorIndex + 1).trim();
    if (!rawValue) continue;

    const token = decodeClerkCookieValue(rawValue);
    if (name === CLERK_DB_JWT_COOKIE_PREFIX) {
      exactDbJwtToken ||= token;
      continue;
    }

    if (name.startsWith(`${CLERK_DB_JWT_COOKIE_PREFIX}_`)) {
      suffixedDbJwtToken ||= token;
      continue;
    }

    if (name === CLERK_SESSION_COOKIE_PREFIX) {
      exactSessionToken ||= token;
      continue;
    }

    suffixedSessionToken ||= token;
  }

  return exactDbJwtToken || suffixedDbJwtToken || exactSessionToken || suffixedSessionToken;
}

function isSupportedClerkBearerCookieName(name: string): boolean {
  return (
    name === CLERK_DB_JWT_COOKIE_PREFIX ||
    name.startsWith(`${CLERK_DB_JWT_COOKIE_PREFIX}_`) ||
    name === CLERK_SESSION_COOKIE_PREFIX ||
    name.startsWith(`${CLERK_SESSION_COOKIE_PREFIX}_`)
  );
}

function decodeClerkCookieValue(rawValue: string): string {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}
