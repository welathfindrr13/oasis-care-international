import {
  ClerkProvisioningAdapter,
  ClerkProvisioningError,
} from "./clerk-provisioning.adapter";

describe("ClerkProvisioningAdapter", () => {
  const originalFetch = global.fetch;
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = "sk_test_server_only";
    process.env.NEXT_PUBLIC_SITE_URL = "https://care.example.org/";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...previousEnv };
    jest.restoreAllMocks();
  });

  function response(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }

  it("creates a customer organization without enrolling the platform operator", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const organizationId = "11111111-2222-3333-4444-555555555555";
    const slug = "oasis-11111111222233334444555555555555";
    const bodies = [
      response({ data: [] }),
      response({
        id: "org_external",
        name: "Synthetic Care",
        slug,
        private_metadata: { oasis_organization_id: organizationId },
      }),
      response({ data: [] }),
      response({
        id: "orginv_external",
        email_address: "admin@example.test",
        role: "org:admin",
        status: "pending",
        private_metadata: { oasis_invitation_id: "invite-internal" },
      }),
    ];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return bodies.shift() as Response;
    }) as typeof fetch;

    const result = await new ClerkProvisioningAdapter().ensureBootstrap({
      organizationId,
      organizationName: "Synthetic Care",
      invitationId: "invite-internal",
      emailAddress: "admin@example.test",
    });

    expect(result).toEqual({
      externalOrganizationId: "org_external",
      externalOrganizationSlug: slug,
      externalInvitationId: "orginv_external",
    });
    const organizationBody = JSON.parse(String(calls[1].init?.body));
    expect(organizationBody).toEqual({
      name: "Synthetic Care",
      slug,
      private_metadata: { oasis_organization_id: organizationId },
    });
    expect(organizationBody).not.toHaveProperty("created_by");
    const invitationBody = JSON.parse(String(calls[3].init?.body));
    expect(invitationBody).toMatchObject({
      email_address: "admin@example.test",
      role: "org:admin",
      redirect_url: "https://care.example.org/admin/setup",
      expires_in_days: 7,
      private_metadata: { oasis_invitation_id: "invite-internal" },
    });
    expect(invitationBody).not.toHaveProperty("inviter_user_id");
    expect(calls[2].url).toContain("limit=500");
    for (const status of ["pending", "accepted", "revoked", "expired"]) {
      expect(calls[2].url).toContain(`status=${status}`);
    }
  });

  it("reconciles deterministic metadata after a crash without duplicate POSTs", async () => {
    const organizationId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const slug = "oasis-aaaaaaaabbbbccccddddeeeeeeeeeeee";
    const calls: Array<{ url: string; method: string }> = [];
    const bodies = [
      response({
        data: [
          {
            id: "org_external",
            name: "Synthetic",
            slug,
            private_metadata: { oasis_organization_id: organizationId },
          },
        ],
      }),
      response({
        data: [
          {
            id: "orginv_external",
            email_address: "admin@example.test",
            role: "org:admin",
            status: "pending",
            private_metadata: { oasis_invitation_id: "invite-internal" },
          },
        ],
      }),
    ];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || "GET" });
      return bodies.shift() as Response;
    }) as typeof fetch;

    await new ClerkProvisioningAdapter().ensureBootstrap({
      organizationId,
      organizationName: "Synthetic",
      invitationId: "invite-internal",
      emailAddress: "admin@example.test",
    });

    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("stops on an unowned pending invitation instead of guessing", async () => {
    const organizationId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const slug = "oasis-aaaaaaaabbbbccccddddeeeeeeeeeeee";
    const bodies = [
      response({
        data: [
          {
            id: "org_external",
            name: "Synthetic",
            slug,
            private_metadata: { oasis_organization_id: organizationId },
          },
        ],
      }),
      response({
        data: [
          {
            id: "other_invite",
            email_address: "admin@example.test",
            role: "org:admin",
            status: "pending",
            private_metadata: {},
          },
        ],
      }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await expect(
      new ClerkProvisioningAdapter().ensureBootstrap({
        organizationId,
        organizationName: "Synthetic",
        invitationId: "invite-internal",
        emailAddress: "admin@example.test",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClerkProvisioningError>>({
        code: "CLERK_INVITATION_AMBIGUOUS",
        retryable: false,
      }),
    );
  });

  it("fails closed when a recovery match may be beyond the bounded Clerk page", async () => {
    const organizationId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const slug = "oasis-aaaaaaaabbbbccccddddeeeeeeeeeeee";
    const bodies = [
      response({
        data: [
          {
            id: "org_external",
            name: "Synthetic",
            slug,
            private_metadata: { oasis_organization_id: organizationId },
          },
        ],
      }),
      response({ data: [], total_count: 501 }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await expect(
      new ClerkProvisioningAdapter().ensureBootstrap({
        organizationId,
        organizationName: "Synthetic",
        invitationId: "invite-internal",
        emailAddress: "admin@example.test",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClerkProvisioningError>>({
        code: "CLERK_INVITATION_PAGE_INCOMPLETE",
        retryable: false,
      }),
    );
  });
});
