const CANONICAL_ROLE_MAP: Record<string, string> = {
  admin: 'admin',
  carer: 'carer',
  office: 'carer',
  manager: 'carer',
  care_manager: 'carer',
  client: 'client',
  user: 'user',
};

function toRoleList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(toRoleList);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeAppRoles(raw: unknown): string[] {
  const normalized = toRoleList(raw)
    .map((role) => role.toLowerCase())
    .map((role) => CANONICAL_ROLE_MAP[role] ?? 'user');

  return Array.from(new Set(normalized));
}

export function extractRolesFromClaims(claims: Record<string, unknown> | null | undefined): string[] {
  if (!claims) {
    return [];
  }

  return normalizeAppRoles(
    claims['cognito:groups'] ??
      claims.groups ??
      claims.roles ??
      claims.role
  );
}

export function hasRole(raw: unknown, role: string): boolean {
  return normalizeAppRoles(raw).includes(role);
}
