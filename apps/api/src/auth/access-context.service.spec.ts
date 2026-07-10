import { ForbiddenException } from "@nestjs/common";
import {
  AccessContextService,
  ACCESS_UNAVAILABLE_MESSAGE,
} from "./access-context.service";

describe("AccessContextService", () => {
  const originalEnv = { ...process.env };
  const activeMembership = {
    id: "membership-1",
    organization_id: "org-internal",
    external_organization_id: "org-external",
    auth_subject: "subject-1",
    role: "admin",
    status: "ACTIVE",
    revoked_at: null,
    carer_id: null,
    carer: null,
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function harness() {
    const prisma = {
      organizationMembership: { findMany: jest.fn(), findFirst: jest.fn() },
      familyContact: { findMany: jest.fn() },
      careRoomMembership: { findFirst: jest.fn() },
    } as any;
    return { prisma, service: new AccessContextService(prisma) };
  }

  it("uses provider plus subject and ignores conflicting token role claims", async () => {
    const { prisma, service } = harness();
    process.env.AUTH_IDENTITY_PROVIDER = "clerk";
    prisma.organizationMembership.findMany.mockResolvedValue([
      { ...activeMembership, role: "admin" },
    ]);

    const result = await service.resolve({
      id: "subject-1",
      organizationId: "org-external",
      role: "user",
    } as any);

    expect(result).toMatchObject({
      effectiveRole: "admin",
      surface: "ADMIN",
      organizationId: "org-internal",
    });
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          identity_provider: "clerk",
          auth_subject: "subject-1",
          status: "ACTIVE",
          revoked_at: null,
        },
        take: 2,
      }),
    );
    expect(
      JSON.stringify(prisma.organizationMembership.findMany.mock.calls[0][0]),
    ).not.toMatch(/email/i);
  });

  it("shares one in-flight immutable snapshot across every consumer in a request", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([activeMembership]);
    const request = { user: { id: "subject-1" } };

    const [first, second] = await Promise.all([
      service.resolveForRequest(request),
      service.resolveForRequest(request),
    ]);

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", [], null, "MISSING"],
    [
      "ambiguous",
      [activeMembership, { ...activeMembership, id: "membership-2" }],
      null,
      "AMBIGUOUS",
    ],
    ["suspended", [], { id: "membership-1" }, "INACTIVE"],
    [
      "revoked",
      [],
      { id: "membership-1" },
      "INACTIVE",
    ],
  ])(
    "returns a non-permitted snapshot for %s membership",
    async (_label, rows, existingMembership, membershipState) => {
      const { prisma, service } = harness();
      prisma.organizationMembership.findMany.mockResolvedValue(rows);
      prisma.organizationMembership.findFirst.mockResolvedValue(
        existingMembership,
      );
      const result = await service.resolve({ id: "subject-1" });
      expect(result).toMatchObject({ membershipState, surface: "NONE" });
      expect(() => service.requirePermitted(result)).toThrow(
        new ForbiddenException(ACCESS_UNAVAILABLE_MESSAGE),
      );
    },
  );

  it("uses the sole active membership when historical revoked memberships also exist", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([activeMembership]);

    await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject({
      membershipId: "membership-1",
      membershipState: "ACTIVE",
      surface: "ADMIN",
    });
  });

  it("fails closed when the active provider organization does not match the internal membership", async () => {
    const { prisma, service } = harness();
    process.env.AUTH_IDENTITY_PROVIDER = "clerk";
    prisma.organizationMembership.findMany.mockResolvedValue([
      activeMembership,
    ]);
    await expect(
      service.resolve({ id: "subject-1", organizationId: "different-org" }),
    ).resolves.toMatchObject({
      membershipState: "ORGANIZATION_MISMATCH",
      surface: "NONE",
    });
  });

  it.each(["carer", "staff"])(
    "uses the linked domain Carer for an active raw %s role",
    async (role) => {
      const { prisma, service } = harness();
      prisma.organizationMembership.findMany.mockResolvedValue([
        {
          ...activeMembership,
          role,
          carer_id: "domain-carer-1",
          carer: {
            id: "domain-carer-1",
            organization_id: "org-internal",
            is_active: true,
            deleted_at: null,
          },
        },
      ]);
      await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject(
        {
          surface: "STAFF",
          effectiveRole: "carer",
          linkedIdentityState: "LINKED",
          domainIdentityId: "domain-carer-1",
        },
      );
    },
  );

  it.each([
    ["unlinked", { carer_id: null, carer: null }, "REQUIRED", "SETUP_REQUIRED"],
    [
      "inactive",
      {
        carer_id: "domain-carer-1",
        carer: {
          id: "domain-carer-1",
          organization_id: "org-internal",
          is_active: false,
          deleted_at: null,
        },
      },
      "INVALID",
      "BLOCKED",
    ],
    [
      "cross-tenant",
      {
        carer_id: "domain-carer-1",
        carer: {
          id: "domain-carer-1",
          organization_id: "other-org",
          is_active: true,
          deleted_at: null,
        },
      },
      "INVALID",
      "BLOCKED",
    ],
  ])(
    "returns safe setup state for a %s Carer link",
    async (_label, overrides, linkedIdentityState, onboardingState) => {
      const { prisma, service } = harness();
      prisma.organizationMembership.findMany.mockResolvedValue([
        { ...activeMembership, role: "carer", ...overrides },
      ]);
      await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject(
        {
          surface: "NONE",
          linkedIdentityState,
          onboardingState,
        },
      );
    },
  );

  it("routes an active linked family contact only after an active room membership exists", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([
      { ...activeMembership, role: "family" },
    ]);
    prisma.familyContact.findMany.mockResolvedValue([
      {
        id: "family-1",
        organization_id: "org-internal",
        disabled_at: null,
      },
    ]);
    prisma.careRoomMembership.findFirst.mockResolvedValueOnce({
      id: "room-membership-1",
    });
    await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject({
      surface: "FAMILY",
      onboardingState: "READY",
      linkedIdentityState: "LINKED",
    });
  });

  it("represents a linked family invitation as pending without granting a surface", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([
      { ...activeMembership, role: "user" },
    ]);
    prisma.familyContact.findMany.mockResolvedValue([
      {
        id: "family-1",
        organization_id: "org-internal",
        disabled_at: null,
      },
    ]);
    prisma.careRoomMembership.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "room-membership-1" });
    await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject({
      surface: "NONE",
      onboardingState: "PENDING_INVITATION",
      linkedIdentityState: "LINKED",
    });
  });

  it("blocks revoked, archived, or cross-tenant family room access", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([
      { ...activeMembership, role: "family" },
    ]);
    prisma.familyContact.findMany.mockResolvedValue([
      {
        id: "family-1",
        organization_id: "org-internal",
        disabled_at: null,
      },
    ]);
    prisma.careRoomMembership.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "revoked-room-membership" });

    await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject({
      surface: "NONE",
      onboardingState: "BLOCKED",
    });
    expect(prisma.careRoomMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          care_room: {
            organization_id: "org-internal",
            status: "ACTIVE",
          },
        }),
      }),
    );
  });

  it("returns a blocked snapshot for an unsupported membership role", async () => {
    const { prisma, service } = harness();
    prisma.organizationMembership.findMany.mockResolvedValue([
      { ...activeMembership, role: "billing" },
    ]);
    await expect(service.resolve({ id: "subject-1" })).resolves.toMatchObject({
      membershipState: "ACTIVE",
      surface: "NONE",
      onboardingState: "BLOCKED",
    });
  });
});
