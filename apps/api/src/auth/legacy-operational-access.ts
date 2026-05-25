import { ForbiddenException, SetMetadata } from '@nestjs/common';

export const LEGACY_OPERATIONAL_SURFACE_KEY = 'legacyOperationalSurface';

export const LegacyOperationalSurface = (): MethodDecorator & ClassDecorator =>
  SetMetadata(LEGACY_OPERATIONAL_SURFACE_KEY, true);

const STAFF_ROLES = new Set(['admin', 'carer', 'manager', 'office']);

export type AuthRoleCarrier = {
  role?: string | null;
  realm_access?: {
    roles?: unknown;
  } | null;
};

export function getNormalizedAuthRoles(user?: AuthRoleCarrier | null): string[] {
  const normalizedRoles = new Set<string>();

  const baseRole = typeof user?.role === 'string' ? user.role.toLowerCase().trim() : '';
  if (baseRole) {
    normalizedRoles.add(baseRole);
  }

  if (Array.isArray(user?.realm_access?.roles)) {
    for (const role of user?.realm_access?.roles ?? []) {
      const normalized = String(role || '')
        .toLowerCase()
        .trim();
      if (normalized) {
        normalizedRoles.add(normalized);
      }
    }
  }

  return Array.from(normalizedRoles);
}

export function isStaffActor(user?: AuthRoleCarrier | null): boolean {
  return getNormalizedAuthRoles(user).some((role) => STAFF_ROLES.has(role));
}

export function assertLegacyOperationalAccess(user?: AuthRoleCarrier | null): void {
  if (isStaffActor(user)) {
    return;
  }

  throw new ForbiddenException(
    'Legacy operational GraphQL access is restricted to staff. Family and external users must use CareBridge surfaces.',
  );
}
