import { GUARDS_METADATA } from "@nestjs/common/constants";
import { GqlRolesGuard } from "../auth/gql-roles.guard";
import { CarerResolver } from "./carer.resolver";

describe("CarerResolver membership linking authorization", () => {
  const carerService = {
    findCarers: jest.fn(),
    upsertCarer: jest.fn(),
  };
  const membershipService = {
    listEligibleMemberships: jest.fn(),
    createAndLinkCarer: jest.fn(),
  };
  const invitationService = {
    list: jest.fn(),
    invite: jest.fn(),
    revokeInvitation: jest.fn(),
    reissue: jest.fn(),
    retryDelivery: jest.fn(),
    deactivateMembership: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the GraphQL roles guard on the Carer resolver", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CarerResolver) ?? [];
    expect(guards).toContain(GqlRolesGuard);
  });

  it.each([
    "eligibleCarerMemberships",
    "carerAccessLifecycle",
    "inviteCarer",
    "revokeCarerInvitation",
    "reissueCarerInvitation",
    "retryCarerInvitationDelivery",
    "deactivateCarerMembership",
    "createAndLinkCarer",
  ])("requires the raw admin role for %s", (methodName) => {
    const method = CarerResolver.prototype[methodName as keyof CarerResolver];
    expect(Reflect.getMetadata("roles", method)).toEqual(["admin"]);
  });

  it("derives organization, admin membership, and actor subject from verified context", async () => {
    const resolver = new CarerResolver(
      carerService as any,
      membershipService as any,
      invitationService as any,
    );
    const input = {
      membershipId: "11111111-1111-4111-8111-111111111111",
      firstName: "Amira",
      lastName: "Khan",
      email: "profile@example.test",
    };
    const context = {
      req: {
        user: {
          organizationId: "org-1",
          organizationMembershipId: "admin-membership-1",
          sub: "admin-subject-1",
        },
      },
    };
    membershipService.createAndLinkCarer.mockResolvedValue({
      carer: { id: "carer-1" },
      membershipId: input.membershipId,
    });

    await resolver.createAndLinkCarer(input, context);

    expect(membershipService.createAndLinkCarer).toHaveBeenCalledWith(input, {
      organizationId: "org-1",
      organizationMembershipId: "admin-membership-1",
      authSubject: "admin-subject-1",
    });
    expect(input).not.toHaveProperty("organizationId");
    expect(input).not.toHaveProperty("authSubject");
  });
});
