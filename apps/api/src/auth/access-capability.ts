import { SetMetadata } from "@nestjs/common";
import type { CanonicalAccessContext } from "./access-context.service";

export const ACCESS_CAPABILITIES = [
  "PROFILE_HELP_VIEW",
  "FRONTLINE_SHIFT_VIEW",
  "FRONTLINE_SHIFT_EXECUTE",
  "FRONTLINE_ASSIGNED_VISITS_VIEW",
  "FRONTLINE_VISIT_EXECUTE",
  "TENANT_ADMIN",
  "PEOPLE_MANAGE",
  "WORKFORCE_MANAGE",
  "SCHEDULE_MANAGE",
  "FAMILY_ACCESS_MANAGE",
  "OPERATIONAL_REPORTS_VIEW",
  "CARE_MANAGEMENT_REVIEW",
  "AI_SUMMARY_REVIEW",
  "AI_SUMMARY_GENERATE",
  "AI_SUMMARY_CONFIGURE",
  "GDPR_MANAGE",
  "FAMILY_UPDATES_VIEW",
  "FAMILY_CONCERN_CREATE",
  "PLATFORM_COMPANY_BOOTSTRAP",
] as const;

export type AccessCapability = (typeof ACCESS_CAPABILITIES)[number];

export const REQUIRED_ACCESS_CAPABILITIES = "requiredAccessCapabilities";

export const RequireCapabilities = (
  ...capabilities: AccessCapability[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ACCESS_CAPABILITIES, capabilities);

export type CapabilitySource = {
  surface: "ADMIN" | "STAFF" | "FAMILY" | "NONE";
  effectiveRole: string | null;
};

const ROLE_CAPABILITIES = Object.freeze({
  admin: Object.freeze([
    "PROFILE_HELP_VIEW",
    "TENANT_ADMIN",
    "PEOPLE_MANAGE",
    "WORKFORCE_MANAGE",
    "SCHEDULE_MANAGE",
    "FAMILY_ACCESS_MANAGE",
    "OPERATIONAL_REPORTS_VIEW",
    "AI_SUMMARY_REVIEW",
    "AI_SUMMARY_GENERATE",
    "AI_SUMMARY_CONFIGURE",
    "GDPR_MANAGE",
  ]),
  carer: Object.freeze([
    "PROFILE_HELP_VIEW",
    "FRONTLINE_SHIFT_VIEW",
    "FRONTLINE_SHIFT_EXECUTE",
    "FRONTLINE_ASSIGNED_VISITS_VIEW",
    "FRONTLINE_VISIT_EXECUTE",
  ]),
  staff: Object.freeze([
    "PROFILE_HELP_VIEW",
    "FRONTLINE_SHIFT_VIEW",
    "FRONTLINE_SHIFT_EXECUTE",
    "FRONTLINE_ASSIGNED_VISITS_VIEW",
    "FRONTLINE_VISIT_EXECUTE",
  ]),
  manager: Object.freeze([
    "PROFILE_HELP_VIEW",
    "AI_SUMMARY_REVIEW",
    "GDPR_MANAGE",
  ]),
  care_manager: Object.freeze(["PROFILE_HELP_VIEW"]),
  office: Object.freeze(["PROFILE_HELP_VIEW"]),
  family: Object.freeze(["FAMILY_UPDATES_VIEW", "FAMILY_CONCERN_CREATE"]),
} satisfies Record<string, readonly AccessCapability[]>);

const ROLE_SURFACES: Readonly<Record<string, CapabilitySource["surface"]>> =
  Object.freeze({
    admin: "ADMIN",
    carer: "STAFF",
    staff: "STAFF",
    manager: "STAFF",
    care_manager: "STAFF",
    office: "STAFF",
    family: "FAMILY",
  });

function capabilitiesForRole(
  role: string | null | undefined,
): readonly AccessCapability[] {
  const normalized = normalizeRole(role);
  if (!normalized || !(normalized in ROLE_CAPABILITIES)) return [];
  return ROLE_CAPABILITIES[normalized as keyof typeof ROLE_CAPABILITIES];
}

export function capabilitiesForAccess(
  access: CapabilitySource,
): readonly AccessCapability[] {
  const role = normalizeRole(access.effectiveRole);
  if (!role || ROLE_SURFACES[role] !== access.surface) return [];
  return capabilitiesForRole(role);
}

export function hasAccessCapability(
  access: CapabilitySource,
  capability: AccessCapability,
): boolean {
  return capabilitiesForAccess(access).includes(capability);
}

export type CanonicalCapabilityActor = CanonicalAccessContext;

export function hasCanonicalActorCapability(
  access: CanonicalCapabilityActor | null | undefined,
  capability: AccessCapability,
  expected: {
    organizationId: string;
    userId: string;
    userRole: string;
  },
): boolean {
  if (
    !access ||
    access.membershipState !== "ACTIVE" ||
    access.onboardingState !== "READY" ||
    access.organizationId !== expected.organizationId ||
    !hasAccessCapability(access, capability)
  ) {
    return false;
  }

  const rawRole = normalizeRole(access.rawRole);
  const canonicalRole = rawRole === "staff" ? "carer" : rawRole;
  const canonicalUserId =
    canonicalRole === "carer" ? access.domainIdentityId : access.authSubject;

  if (
    canonicalRole !== normalizeRole(expected.userRole) ||
    canonicalUserId !== expected.userId
  ) {
    return false;
  }

  return (
    canonicalRole !== "carer" ||
    (access.surface === "STAFF" &&
      access.linkedIdentityState === "LINKED" &&
      Boolean(access.domainIdentityId))
  );
}

function normalizeRole(role: string | null | undefined): string | null {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return normalized || null;
}
