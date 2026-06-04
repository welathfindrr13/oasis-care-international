const STAFF_ROLES = new Set(['carer', 'office', 'manager', 'care_manager']);

function normalizeRawRoles(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return values
    .map((value) => String(value).trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);
}

export function normalizeAppRoles(raw: unknown): string[] {
  const normalizedRoles = normalizeRawRoles(raw);
  const hasAdmin = normalizedRoles.includes('admin');
  const hasStaffRole = normalizedRoles.some((role) => STAFF_ROLES.has(role));
  const hasClient = normalizedRoles.includes('client');

  const canonicalRole = hasAdmin ? 'admin' : hasStaffRole ? 'carer' : hasClient ? 'client' : 'user';
  return Array.from(new Set([canonicalRole, ...normalizedRoles]));
}

export function extractRolesFromClaims(claims: Record<string, any> | null): string[] {
  if (!claims) return [];
  const cognitoGroups = claims['cognito:groups'];
  const realmRoles = claims?.realm_access?.roles;
  const rawRoles = Array.isArray(cognitoGroups) ? cognitoGroups : realmRoles;
  return rawRoles ? normalizeAppRoles(rawRoles) : [];
}

export function hasRole(raw: unknown, role: string): boolean {
  const normalizedRole = String(role).trim().toLowerCase();
  if (!normalizedRole) return false;
  return normalizeAppRoles(raw).includes(normalizedRole);
}
