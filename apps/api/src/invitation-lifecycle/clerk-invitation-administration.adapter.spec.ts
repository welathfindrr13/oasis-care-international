import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";
import { ClerkInvitationAdministrationAdapter } from "./clerk-invitation-administration.adapter";

describe("ClerkInvitationAdministrationAdapter", () => {
  const originalFetch = global.fetch;
  const previousEnv = { ...process.env };
  const input = {
    externalOrganizationId: "org_external",
    invitationId: "11111111-1111-4111-8111-111111111111",
    emailAddress: "Carer@Example.test",
    intendedRole: "carer" as const,
  };

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = "sk_test_server_only";
    process.env.NEXT_PUBLIC_SITE_URL = "https://care.example.test/";
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

  it("creates a server-fixed org:member invitation with exact opaque metadata", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const bodies = [
      response({ data: [] }),
      response({
        id: "orginv_external",
        email_address: "carer@example.test",
        role: "org:member",
        status: "pending",
        public_metadata: { oasis_invitation_id: input.invitationId },
        private_metadata: { oasis_invitation_id: input.invitationId },
      }),
    ];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return bodies.shift() as Response;
    }) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().ensureOrganizationInvitation(
        input,
      ),
    ).resolves.toEqual({ externalInvitationId: "orginv_external" });

    const body = JSON.parse(String(calls[1].init?.body));
    expect(body).toEqual({
      email_address: "carer@example.test",
      role: "org:member",
      redirect_url: `https://care.example.test/accept-invitation?oasis_invitation_id=${input.invitationId}`,
      expires_in_days: 7,
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    });
    expect(JSON.stringify(body)).not.toContain("org:admin");
  });

  it("reconciles the exact internal invitation without a duplicate POST", async () => {
    global.fetch = jest.fn(async () =>
      response({
        data: [
          {
            id: "orginv_external",
            email_address: "carer@example.test",
            role: "org:member",
            status: "pending",
            public_metadata: { oasis_invitation_id: input.invitationId },
            private_metadata: { oasis_invitation_id: input.invitationId },
          },
        ],
      }),
    ) as typeof fetch;

    await new ClerkInvitationAdministrationAdapter().ensureOrganizationInvitation(
      input,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1]?.method,
    ).toBeUndefined();
  });

  it("fails closed on an unrelated pending invitation for the same email", async () => {
    global.fetch = jest.fn(async () =>
      response({
        data: [
          {
            id: "other",
            email_address: "carer@example.test",
            role: "org:member",
            status: "pending",
            private_metadata: {},
          },
        ],
      }),
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().ensureOrganizationInvitation(
        input,
      ),
    ).rejects.toMatchObject<Partial<ClerkProvisioningError>>({
      code: "CLERK_INVITATION_AMBIGUOUS",
      retryable: false,
    });
  });

  it("fails closed when duplicate exact metadata matches exist", async () => {
    const exact = {
      email_address: "carer@example.test",
      role: "org:member",
      status: "pending",
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    };
    global.fetch = jest.fn(async () =>
      response({
        data: [
          { ...exact, id: "duplicate_one" },
          { ...exact, id: "duplicate_two" },
        ],
      }),
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().ensureOrganizationInvitation(
        input,
      ),
    ).rejects.toMatchObject({ code: "CLERK_INVITATION_AMBIGUOUS" });
  });

  it("finds and revokes an exact invitation by durable internal metadata", async () => {
    const bodies = [
      response({
        data: [
          {
            id: "orginv_external",
            email_address: "carer@example.test",
            role: "org:member",
            status: "pending",
            public_metadata: { oasis_invitation_id: input.invitationId },
            private_metadata: { oasis_invitation_id: input.invitationId },
          },
        ],
      }),
      response({ status: "revoked" }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
      input,
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain(
      "/invitations/orginv_external/revoke",
    );
  });

  it("keeps cleanup unresolved when Clerk already accepted the invitation", async () => {
    global.fetch = jest.fn(async () =>
      response({
        data: [
          {
            id: "orginv_external",
            email_address: "carer@example.test",
            role: "org:member",
            status: "accepted",
            public_metadata: { oasis_invitation_id: input.invitationId },
            private_metadata: { oasis_invitation_id: input.invitationId },
          },
        ],
      }),
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject<Partial<ClerkProvisioningError>>({
      code: "CLERK_INVITATION_ALREADY_ACCEPTED",
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cleanup unresolved for an unmatched pending invitation with the same email", async () => {
    global.fetch = jest.fn(async () =>
      response({
        data: [
          {
            id: "orginv_ambiguous",
            email_address: "carer@example.test",
            role: "org:member",
            status: "pending",
            public_metadata: {},
            private_metadata: {},
          },
        ],
      }),
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject<Partial<ClerkProvisioningError>>({
      code: "CLERK_INVITATION_AMBIGUOUS",
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cleanup unresolved when exact terminal history coexists with an unmatched pending invitation", async () => {
    global.fetch = jest.fn(async () =>
      response({
        data: [
          {
            id: "orginv_exact_terminal",
            email_address: "carer@example.test",
            role: "org:member",
            status: "expired",
            public_metadata: { oasis_invitation_id: input.invitationId },
            private_metadata: { oasis_invitation_id: input.invitationId },
          },
          {
            id: "orginv_unmatched_pending",
            email_address: "carer@example.test",
            role: "org:member",
            status: "pending",
            public_metadata: {},
            private_metadata: {},
          },
        ],
      }),
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject<Partial<ClerkProvisioningError>>({
      code: "CLERK_INVITATION_AMBIGUOUS",
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cleanup unresolved when the Clerk invitation page is incomplete", async () => {
    const exact = {
      id: "orginv_exact_terminal",
      email_address: "carer@example.test",
      role: "org:member",
      status: "expired",
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    };
    const filler = Array.from({ length: 499 }, (_, index) => ({
      id: `orginv_filler_${index}`,
      email_address: `other-${index}@example.test`,
      role: "org:member",
      status: "expired",
      public_metadata: {},
      private_metadata: {},
    }));
    const bodies = [
      response({
        total_count: 501,
        data: [exact, ...filler],
      }),
      response({ total_count: 501, data: [] }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject<Partial<ClerkProvisioningError>>({
      code: "CLERK_INVITATION_PAGE_INCOMPLETE",
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("paginates the full invitation list before revoking an exact match", async () => {
    const exact = {
      id: "orginv_exact_pending",
      email_address: "carer@example.test",
      role: "org:member",
      status: "pending",
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    };
    const filler = Array.from({ length: 499 }, (_, index) => ({
      id: `orginv_filler_${index}`,
      email_address: `other-${index}@example.test`,
      role: "org:member",
      status: "expired",
      public_metadata: {},
      private_metadata: {},
    }));
    const bodies = [
      response({ total_count: 501, data: [exact, ...filler] }),
      response({
        total_count: 501,
        data: [
          {
            id: "orginv_last",
            email_address: "last@example.test",
            role: "org:member",
            status: "expired",
            public_metadata: {},
            private_metadata: {},
          },
        ],
      }),
      response({ status: "revoked" }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
      input,
    );

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      "offset=0",
    );
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain(
      "offset=500",
    );
    expect(String((global.fetch as jest.Mock).mock.calls[2][0])).toContain(
      "/invitations/orginv_exact_pending/revoke",
    );
  });

  it("fails closed when the total changes between invitation pages", async () => {
    const exact = {
      id: "orginv_exact_terminal",
      email_address: "carer@example.test",
      role: "org:member",
      status: "expired",
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    };
    const bodies = [
      response({ total_count: 2, data: [exact] }),
      response({
        total_count: 1,
        data: [
          {
            id: "orginv_other",
            email_address: "other@example.test",
            role: "org:member",
            status: "expired",
            public_metadata: {},
            private_metadata: {},
          },
        ],
      }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject({ code: "CLERK_INVITATION_PAGE_INCOMPLETE" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("fails closed when invitation pages overlap", async () => {
    const exact = {
      id: "orginv_exact_terminal",
      email_address: "carer@example.test",
      role: "org:member",
      status: "expired",
      public_metadata: { oasis_invitation_id: input.invitationId },
      private_metadata: { oasis_invitation_id: input.invitationId },
    };
    const bodies = [
      response({ total_count: 2, data: [exact] }),
      response({ total_count: 2, data: [exact] }),
    ];
    global.fetch = jest.fn(
      async () => bodies.shift() as Response,
    ) as typeof fetch;

    await expect(
      new ClerkInvitationAdministrationAdapter().revokeOrganizationInvitationByInternalId(
        input,
      ),
    ).rejects.toMatchObject({ code: "CLERK_INVITATION_PAGE_INCOMPLETE" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("revokes an exact invitation and removes membership by user subject", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      return response({}, 200);
    }) as typeof fetch;
    const adapter = new ClerkInvitationAdministrationAdapter();

    await adapter.revokeOrganizationInvitation("org_external", "orginv_exact");
    await adapter.removeOrganizationMembership("org_external", "user_exact");

    expect(calls).toEqual([
      {
        url: "https://api.clerk.com/v1/organizations/org_external/invitations/orginv_exact/revoke",
        method: "POST",
      },
      {
        url: "https://api.clerk.com/v1/organizations/org_external/memberships/user_exact",
        method: "DELETE",
      },
    ]);
  });
});
