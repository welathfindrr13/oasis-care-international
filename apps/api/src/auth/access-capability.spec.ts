import {
  capabilitiesForAccess,
  hasAccessCapability,
  hasCanonicalActorCapability,
} from "./access-capability";

describe("server-derived access capabilities", () => {
  it.each(
    [
      [
        "admin",
        "ADMIN",
        [
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
        ],
      ],
      [
        "carer",
        "STAFF",
        [
          "PROFILE_HELP_VIEW",
          "FRONTLINE_SHIFT_VIEW",
          "FRONTLINE_SHIFT_EXECUTE",
          "FRONTLINE_ASSIGNED_VISITS_VIEW",
          "FRONTLINE_VISIT_EXECUTE",
        ],
      ],
      [
        "staff",
        "STAFF",
        [
          "PROFILE_HELP_VIEW",
          "FRONTLINE_SHIFT_VIEW",
          "FRONTLINE_SHIFT_EXECUTE",
          "FRONTLINE_ASSIGNED_VISITS_VIEW",
          "FRONTLINE_VISIT_EXECUTE",
        ],
      ],
      [
        "manager",
        "STAFF",
        ["PROFILE_HELP_VIEW", "AI_SUMMARY_REVIEW", "GDPR_MANAGE"],
      ],
      [
        "care_manager",
        "STAFF",
        ["PROFILE_HELP_VIEW"],
      ],
      ["office", "STAFF", ["PROFILE_HELP_VIEW"]],
      [
        "family",
        "FAMILY",
        ["FAMILY_UPDATES_VIEW", "FAMILY_CONCERN_CREATE"],
      ],
    ] as const,
  )(
    "maps %s to its exact least-privilege matrix",
    (effectiveRole, surface, expected) => {
      expect(capabilitiesForAccess({ effectiveRole, surface })).toEqual(
        expected,
      );
    },
  );

  it("fails closed for unknown roles and role/surface mismatches", () => {
    expect(
      capabilitiesForAccess({ effectiveRole: "admin", surface: "STAFF" }),
    ).toEqual([]);
    expect(
      capabilitiesForAccess({ effectiveRole: "manager", surface: "NONE" }),
    ).toEqual([]);
    expect(
      capabilitiesForAccess({ effectiveRole: "super_admin", surface: "ADMIN" }),
    ).toEqual([]);
  });

  it("does not grant tenant, care-execution, or family access to management roles", () => {
    for (const effectiveRole of ["manager", "care_manager", "office"]) {
      const access = { effectiveRole, surface: "STAFF" as const };
      expect(hasAccessCapability(access, "TENANT_ADMIN")).toBe(false);
      expect(
        hasAccessCapability(access, "FRONTLINE_ASSIGNED_VISITS_VIEW"),
      ).toBe(false);
      expect(hasAccessCapability(access, "FAMILY_UPDATES_VIEW")).toBe(false);
      expect(hasAccessCapability(access, "PLATFORM_COMPANY_BOOTSTRAP")).toBe(
        false,
      );
    }
    expect(
      hasAccessCapability(
        { effectiveRole: "manager", surface: "STAFF" },
        "AI_SUMMARY_REVIEW",
      ),
    ).toBe(true);
    expect(
      hasAccessCapability(
        { effectiveRole: "care_manager", surface: "STAFF" },
        "AI_SUMMARY_REVIEW",
      ),
    ).toBe(false);
  });

  it("keeps frontline, tenant, family, and platform authorities disjoint", () => {
    const admin = { effectiveRole: "admin", surface: "ADMIN" as const };
    const carer = { effectiveRole: "carer", surface: "STAFF" as const };
    const family = { effectiveRole: "family", surface: "FAMILY" as const };

    expect(hasAccessCapability(admin, "FRONTLINE_VISIT_EXECUTE")).toBe(false);
    expect(hasAccessCapability(admin, "PLATFORM_COMPANY_BOOTSTRAP")).toBe(
      false,
    );
    expect(hasAccessCapability(carer, "TENANT_ADMIN")).toBe(false);
    expect(hasAccessCapability(carer, "CARE_MANAGEMENT_REVIEW")).toBe(false);
    expect(hasAccessCapability(carer, "OPERATIONAL_REPORTS_VIEW")).toBe(false);
    expect(hasAccessCapability(family, "TENANT_ADMIN")).toBe(false);
    expect(hasAccessCapability(family, "FRONTLINE_SHIFT_VIEW")).toBe(false);
  });

  it("binds service capabilities to the same canonical tenant, role, and identity", () => {
    const access = {
      authenticated: true as const,
      authSubject: "auth-carer-1",
      identityProvider: "test",
      organizationId: "org-1",
      membershipId: "membership-1",
      membershipState: "ACTIVE" as const,
      rawRole: "staff",
      effectiveRole: "carer",
      surface: "STAFF" as const,
      linkedIdentityState: "LINKED" as const,
      onboardingState: "READY" as const,
      domainIdentityId: "carer-1",
    };

    expect(hasCanonicalActorCapability(access, "FRONTLINE_VISIT_EXECUTE", {
      organizationId: "org-1",
      userId: "carer-1",
      userRole: "carer",
    })).toBe(true);
    expect(hasCanonicalActorCapability(access, "FRONTLINE_VISIT_EXECUTE", {
      organizationId: "org-2",
      userId: "carer-1",
      userRole: "carer",
    })).toBe(false);
    expect(hasCanonicalActorCapability(access, "FRONTLINE_VISIT_EXECUTE", {
      organizationId: "org-1",
      userId: "admin-1",
      userRole: "admin",
    })).toBe(false);
  });
});
