import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";
import { ClerkInvitationVerificationAdapter } from "./clerk-invitation-verification.adapter";

describe("ClerkInvitationVerificationAdapter", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function response(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }

  it("returns exact accepted invitations and exact user organization membership", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_server_only";
    const calls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        calls.push(String(url));
        return response({
          total_count: 1,
          data: [
            {
              id: "orginv_accepted",
              organization_id: "org_external",
              email_address: "ADMIN@EXAMPLE.TEST",
              role: "org:admin",
              status: "accepted",
              public_metadata: { oasis_invitation_id: "invite_internal" },
              private_metadata: { oasis_invitation_id: "invite_internal" },
            },
          ],
        });
      })
      .mockImplementationOnce(async (url: string) => {
        calls.push(String(url));
        return response({
          total_count: 1,
          data: [
            {
              id: "orgmem_external",
              role: "org:admin",
              organization: { id: "org_external" },
              public_user_data: { user_id: "user_invited" },
            },
          ],
        });
      }) as any;

    const adapter = new ClerkInvitationVerificationAdapter();
    await expect(
      adapter.listAcceptedInvitationsForUser("user_invited"),
    ).resolves.toEqual([
      {
        id: "orginv_accepted",
        organizationId: "org_external",
        emailAddress: "admin@example.test",
        role: "org:admin",
        publicMetadata: { oasis_invitation_id: "invite_internal" },
        privateMetadata: { oasis_invitation_id: "invite_internal" },
      },
    ]);
    await expect(
      adapter.getOrganizationMembership("user_invited", "org_external"),
    ).resolves.toEqual({
      id: "orgmem_external",
      organizationId: "org_external",
      userId: "user_invited",
      role: "org:admin",
    });
    expect(calls).toEqual([
      "https://api.clerk.com/v1/users/user_invited/organization_invitations?status=accepted&limit=500",
      "https://api.clerk.com/v1/users/user_invited/organization_memberships?limit=500",
    ]);
  });

  it("fails closed for incomplete pagination or a membership owned by another subject", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_server_only";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response({ total_count: 501, data: [] }))
      .mockResolvedValueOnce(
        response({
          total_count: 1,
          data: [
            {
              id: "orgmem_external",
              role: "org:admin",
              organization: { id: "org_external" },
              public_user_data: { user_id: "user_wrong" },
            },
          ],
        }),
      ) as any;
    const adapter = new ClerkInvitationVerificationAdapter();

    await expect(
      adapter.listAcceptedInvitationsForUser("user_invited"),
    ).rejects.toMatchObject({ code: "CLERK_PROOF_PAGE_INCOMPLETE" });
    await expect(
      adapter.getOrganizationMembership("user_invited", "org_external"),
    ).rejects.toMatchObject({ code: "CLERK_MEMBERSHIP_PROOF_INVALID" });
  });

  it("uses only safe bounded error codes for Clerk outages", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_server_only";
    global.fetch = jest.fn().mockResolvedValue(response({}, 503)) as any;
    const adapter = new ClerkInvitationVerificationAdapter();

    const error = await adapter
      .listAcceptedInvitationsForUser("user_invited")
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(ClerkProvisioningError);
    expect(error).toMatchObject({ code: "CLERK_HTTP_503", retryable: true });
    expect(JSON.stringify(error)).not.toContain("sk_test_server_only");
  });
});
