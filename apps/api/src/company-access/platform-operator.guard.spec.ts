import { GqlExecutionContext } from "@nestjs/graphql";
import { GqlPlatformOperatorGuard } from "./platform-operator.guard";

describe("GqlPlatformOperatorGuard", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID = "org_platform_ops";
    process.env.PLATFORM_OPERATOR_CLERK_SUBJECTS = "user_operator,user_backup";
  });

  afterEach(() => {
    process.env = { ...previousEnv };
    jest.restoreAllMocks();
  });

  function context(
    user: Record<string, unknown>,
    operation: "query" | "mutation" = "query",
    headers: Record<string, string> = {},
  ) {
    jest.spyOn(GqlExecutionContext, "create").mockReturnValue({
      getContext: () => ({ req: { user, headers } }),
      getInfo: () => ({ operation: { operation } }),
    } as any);
    return {} as any;
  }

  it("accepts only an exact Clerk subject in the dedicated operator organization", () => {
    const guard = new GqlPlatformOperatorGuard();
    expect(
      guard.canActivate(
        context({
          sub: "user_operator",
          authProvider: "clerk",
          organizationId: "org_platform_ops",
          role: "user",
          realm_access: { roles: ["user"] },
        }),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "customer tenant admin",
      {
        sub: "user_operator",
        authProvider: "clerk",
        organizationId: "org_customer",
        role: "admin",
      },
    ],
    [
      "unlisted org admin",
      {
        sub: "user_other",
        authProvider: "clerk",
        organizationId: "org_platform_ops",
        role: "admin",
      },
    ],
    [
      "non-Clerk subject",
      {
        sub: "user_operator",
        authProvider: "cognito",
        organizationId: "org_platform_ops",
        role: "admin",
      },
    ],
  ])("rejects a %s regardless of role metadata", (_label, user) => {
    const guard = new GqlPlatformOperatorGuard();
    expect(() => guard.canActivate(context(user))).toThrow(
      "Platform operator access required",
    );
  });

  it("requires the explicit platform-action header for mutations", () => {
    const guard = new GqlPlatformOperatorGuard();
    const user = {
      sub: "user_operator",
      authProvider: "clerk",
      organizationId: "org_platform_ops",
    };

    expect(() => guard.canActivate(context(user, "mutation"))).toThrow(
      "Platform action confirmation required",
    );
    jest.restoreAllMocks();
    expect(
      guard.canActivate(
        context(user, "mutation", { "x-oasis-platform-action": "1" }),
      ),
    ).toBe(true);
  });
});
