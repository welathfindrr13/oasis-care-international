const CARER_ALIASES = new Set([
  'carer',
  'caregiver',
  'office',
  'manager',
  'care_manager',
  'care-manager',
]);

function toRoleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

export function normalizeRole(raw: string): string {
  const normalized = raw.trim().toLowerCase();

  if (normalized === 'admin' || normalized === 'administrator') {
    return 'admin';
  }

  if (CARER_ALIASES.has(normalized)) {
    return 'carer';
  }

  return normalized;
}

export function extractRoles(payload: Record<string, any> | null | undefined): string[] {
  if (!payload) {
    return [];
  }

  const rawRoles = [
    ...toRoleList(payload.realm_access?.roles),
    ...toRoleList(payload.resource_access?.roles),
    ...toRoleList(payload['cognito:groups']),
    ...toRoleList(payload.groups),
    ...toRoleList(payload.roles),
    ...(typeof payload.role === 'string' ? [payload.role] : []),
  ];

  return [...new Set(rawRoles.map(normalizeRole).filter(Boolean))];
}

export function primaryRole(payload: Record<string, any> | null | undefined): string {
  return extractRoles(payload)[0] || 'user';
}
