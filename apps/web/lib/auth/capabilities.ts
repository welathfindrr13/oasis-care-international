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

const accessCapabilitySet = new Set<string>(ACCESS_CAPABILITIES);

export function parseAccessCapabilities(value: unknown): AccessCapability[] | null {
  if (!Array.isArray(value)) return null;
  const capabilities: AccessCapability[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !accessCapabilitySet.has(item)) return null;
    if (!capabilities.includes(item as AccessCapability)) {
      capabilities.push(item as AccessCapability);
    }
  }
  return capabilities;
}

export function hasAccessCapability(
  capabilities: readonly AccessCapability[],
  capability: AccessCapability,
): boolean {
  return capabilities.includes(capability);
}
