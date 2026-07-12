import { AccessContextResolver } from "./access-context.resolver";
import { AccessContextService, CanonicalAccessContext } from "./access-context.service";

describe("AccessContextResolver", () => {
  it("uses the request-scoped canonical snapshot cache", async () => {
    const context: CanonicalAccessContext = {
      authenticated: true,
      authSubject: "subject-1",
      identityProvider: "cognito",
      organizationId: "org-1",
      membershipId: "membership-1",
      membershipState: "ACTIVE",
      rawRole: "admin",
      effectiveRole: "admin",
      surface: "ADMIN",
      linkedIdentityState: "NOT_REQUIRED",
      onboardingState: "READY",
      domainIdentityId: null,
    };
    const service = {
      resolveForRequest: jest.fn().mockResolvedValue(context),
    } as unknown as AccessContextService;
    const resolver = new AccessContextResolver(service);
    const request = { user: { id: "subject-1" } };

    await expect(resolver.viewerAccessSnapshot(request)).resolves.toMatchObject({
      organizationId: "org-1",
      surface: "ADMIN",
      capabilities: expect.arrayContaining([
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
    });
    expect(service.resolveForRequest).toHaveBeenCalledWith(request);
  });
});
