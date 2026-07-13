import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService, VisitStatus } from "@oasis/db";
import { StartedTestContainer } from "testcontainers";
import { AccessContextService } from "../src/auth/access-context.service";
import { CarerAccessService } from "../src/carer/carer-access.service";
import { CarerInvitationService } from "../src/carer/carer-invitation.service";
import { CarerMembershipService } from "../src/carer/carer-membership.service";
import { ClerkProvisioningError } from "../src/company-access/clerk-provisioning.adapter";
import { VisitRepository } from "../src/visit/visit.repository";
import { VisitCompletionProofKeyring } from "../src/visit/visit-completion-proof-keyring";
import { startPostgres } from "./utils/test-container";

describe("Carer invitation lifecycle database integration", () => {
  let container: StartedTestContainer;
  let prisma: PrismaService;
  let invitations: CarerInvitationService;
  let memberships: CarerMembershipService;
  let visits: VisitRepository;
  const previousEnv = { ...process.env };
  const organizationId = "org-carer-invitation-e2e";
  const externalOrganizationId = "org_external_carer_e2e";
  const adminSubject = "admin_carer_invitation_e2e";
  const clerk = {
    ensureOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitationByInternalId: jest.fn(),
    removeOrganizationMembership: jest.fn(),
  };
  let adminMembershipId: string;

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.NODE_ENV = "test";
    process.env.AUTH_IDENTITY_PROVIDER = "clerk";
    prisma = new PrismaService();
    await prisma.$connect();
    invitations = new CarerInvitationService(prisma, clerk as any);
    memberships = new CarerMembershipService(prisma);
    visits = new VisitRepository(
      prisma,
      new VisitCompletionProofKeyring(
        new ConfigService({
          VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "test-v1",
          VISIT_COMPLETION_PROOF_ACTIVE_SECRET:
            "visit-completion-proof-test-secret-32-bytes-minimum",
        }),
      ),
    );
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
    process.env = { ...previousEnv };
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    clerk.ensureOrganizationInvitation.mockImplementation(
      async ({ invitationId }: { invitationId: string }) => ({
        externalInvitationId: `external_${invitationId}`,
      }),
    );
    clerk.revokeOrganizationInvitation.mockResolvedValue(undefined);
    clerk.revokeOrganizationInvitationByInternalId.mockResolvedValue(undefined);
    clerk.removeOrganizationMembership.mockResolvedValue(undefined);
    await prisma.auditLog.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.carerShift.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.client.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organization.create({
      data: { id: organizationId, name: "Carer Invitation E2E" },
    });
    await prisma.organizationProviderBinding.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        external_organization_id: externalOrganizationId,
        external_slug: "oasis-carer-invitation-e2e",
      },
    });
    const admin = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: adminSubject,
        normalized_email: "admin@example.test",
        role: "admin",
        status: "ACTIVE",
      },
    });
    adminMembershipId = admin.id;
  });

  function adminPrincipal() {
    return {
      organizationId,
      organizationMembershipId: adminMembershipId,
      authSubject: adminSubject,
    };
  }

  async function seedLegacyLinkedWorker(
    suffix: string,
    overrides: { provider?: string; external?: boolean } = {},
  ) {
    const carer = await prisma.carer.create({
      data: {
        organization_id: organizationId,
        first_name: "Legacy",
        last_name: suffix,
        email: `legacy-${suffix}@example.test`,
        is_active: true,
      },
    });
    const membership = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: overrides.provider || "clerk",
        auth_subject: `legacy-subject-${suffix}`,
        normalized_email: `legacy-${suffix}@example.test`,
        role: "carer",
        status: "ACTIVE",
        carer_id: carer.id,
        ...(overrides.external
          ? {
              external_organization_id: externalOrganizationId,
              external_membership_id: `external-membership-${suffix}`,
            }
          : {}),
      },
    });
    return { carer, membership };
  }

  it("delivers one tenant-bound org:member invitation across case-variant retries", async () => {
    const first = await invitations.invite(
      "Carer@Example.test",
      adminPrincipal(),
    );
    const second = await invitations.invite(
      "carer@example.test",
      adminPrincipal(),
    );

    expect(second.invitationId).toBe(first.invitationId);
    expect(first).toMatchObject({
      status: "PENDING",
      readiness: "AWAITING_ACCEPTANCE",
      deliveryStatus: "DELIVERED",
      canRevoke: true,
    });
    expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
    expect(await prisma.organizationProvisioningOutbox.count()).toBe(1);
    expect(clerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(1);
    expect(clerk.ensureOrganizationInvitation).toHaveBeenCalledWith({
      externalOrganizationId,
      invitationId: first.invitationId,
      emailAddress: "carer@example.test",
      intendedRole: "carer",
    });
  });

  it("preserves the same invitation after a partial delivery failure and reconciles on retry", async () => {
    clerk.ensureOrganizationInvitation.mockRejectedValueOnce(
      new Error("private provider failure"),
    );
    const failed = await invitations.invite(
      "retry@example.test",
      adminPrincipal(),
    );
    expect(failed.deliveryStatus).toBe("NEEDS_ATTENTION");

    const retried = await invitations.invite(
      "retry@example.test",
      adminPrincipal(),
    );
    expect(retried.invitationId).toBe(failed.invitationId);
    expect(retried.deliveryStatus).toBe("DELIVERED");
    expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
    expect(clerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(2);
  });

  it("preserves expired history and creates one exact replacement", async () => {
    const original = await invitations.invite(
      "expired@example.test",
      adminPrincipal(),
    );
    await prisma.organizationMembershipInvitation.update({
      where: { id: original.invitationId as string },
      data: {
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const lifecycle = await invitations.list(adminPrincipal());
    expect(lifecycle[0].status).toBe("EXPIRED");
    const replacement = await invitations.reissue(
      original.invitationId as string,
      adminPrincipal(),
    );

    expect(replacement.invitationId).not.toBe(original.invitationId);
    expect(replacement.status).toBe("PENDING");
    expect(await prisma.organizationMembershipInvitation.count()).toBe(2);
    expect(clerk.revokeOrganizationInvitationByInternalId).toHaveBeenCalledWith(
      {
        externalOrganizationId,
        invitationId: original.invitationId,
        emailAddress: "expired@example.test",
        intendedRole: "carer",
      },
    );
  });

  it("links only after acceptance, becomes assignable, then revokes access immediately", async () => {
    const issued = await invitations.invite(
      "worker@example.test",
      adminPrincipal(),
    );
    const membership = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: "worker_subject_e2e",
        normalized_email: "worker@example.test",
        role: "carer",
        status: "ACTIVE",
        external_organization_id: externalOrganizationId,
        external_membership_id: "orgmem_worker_e2e",
      },
    });
    await prisma.organizationMembershipInvitation.update({
      where: { id: issued.invitationId as string },
      data: {
        status: "ACCEPTED",
        bound_auth_subject: "worker_subject_e2e",
        activated_membership_id: membership.id,
        accepted_at: new Date(),
      },
    });

    expect(await invitations.list(adminPrincipal())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          membershipId: membership.id,
          readiness: "LINK_REQUIRED",
          canLink: true,
        }),
      ]),
    );

    const linked = await memberships.createAndLinkCarer(
      {
        membershipId: membership.id,
        firstName: "Amira",
        lastName: "Khan",
      },
      adminPrincipal(),
    );
    await expect(
      visits.findCarerInOrganization(linked.carer.id, organizationId),
    ).resolves.toBe(true);

    const revoked = await invitations.deactivateMembership(
      membership.id,
      adminPrincipal(),
    );
    expect(revoked).toMatchObject({
      status: "REVOKED",
      readiness: "DISABLED",
      canDeactivate: false,
    });
    await expect(
      visits.findCarerInOrganization(linked.carer.id, organizationId),
    ).resolves.toBe(false);
    const accessContext = await new AccessContextService(prisma).resolve({
      sub: "worker_subject_e2e",
      organizationId,
    });
    await expect(
      new CarerAccessService().requireCarerIdentity({ accessContext }),
    ).rejects.toEqual(
      new ForbiddenException("Active carer membership link is required"),
    );
    expect(clerk.removeOrganizationMembership).toHaveBeenCalledWith(
      externalOrganizationId,
      "worker_subject_e2e",
    );
  });

  it("includes and deactivates a legacy linked membership with no invitation", async () => {
    const carer = await prisma.carer.create({
      data: {
        organization_id: organizationId,
        first_name: "Legacy",
        last_name: "Carer",
        email: "legacy@example.test",
        is_active: true,
      },
    });
    const membership = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: "legacy_worker_subject",
        normalized_email: "legacy@example.test",
        role: "carer",
        status: "ACTIVE",
        carer_id: carer.id,
      },
    });

    expect(await invitations.list(adminPrincipal())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lifecycleId: `membership:${membership.id}`,
          invitationId: null,
          readiness: "READY",
        }),
      ]),
    );
    await expect(
      invitations.deactivateMembership(membership.id, adminPrincipal()),
    ).resolves.toMatchObject({ status: "REVOKED", invitationId: null });
  });

  it("never reuses another role's pending invitation as a Carer invite", async () => {
    await prisma.organizationMembershipInvitation.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        intended_email: "family@example.test",
        normalized_email: "family@example.test",
        intended_role: "family",
        status: "PENDING",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      invitations.invite("family@example.test", adminPrincipal()),
    ).rejects.toEqual(
      new ConflictException(
        "A different access invitation is already pending for this email",
      ),
    );
    expect(clerk.ensureOrganizationInvitation).not.toHaveBeenCalled();
  });

  it("compensates when revocation wins while Clerk delivery is in flight", async () => {
    let releaseDelivery!: () => void;
    let markDeliveryStarted!: () => void;
    const deliveryStarted = new Promise<void>((resolve) => {
      markDeliveryStarted = resolve;
    });
    const holdDelivery = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    clerk.ensureOrganizationInvitation.mockImplementationOnce(
      async ({ invitationId }: { invitationId: string }) => {
        markDeliveryStarted();
        await holdDelivery;
        return { externalInvitationId: `external_${invitationId}` };
      },
    );

    const inviting = invitations.invite("raced@example.test", adminPrincipal());
    await deliveryStarted;
    const pending =
      await prisma.organizationMembershipInvitation.findFirstOrThrow({
        where: { normalized_email: "raced@example.test" },
      });
    await invitations.revokeInvitation(pending.id, adminPrincipal());
    releaseDelivery();
    const result = await inviting;

    expect(result.status).toBe("REVOKED");
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: pending.id },
      }),
    ).resolves.toMatchObject({
      status: "REVOKED",
      external_invitation_id: `external_${pending.id}`,
      external_cleanup_required: false,
      external_cleanup_error_code: null,
    });
    expect(
      clerk.revokeOrganizationInvitationByInternalId.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("allows only one worker to take over an expired delivery lease", async () => {
    const issued = await invitations.invite(
      "lease@example.test",
      adminPrincipal(),
    );
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: issued.invitationId as string },
      data: {
        status: "PROCESSING",
        lease_token: "expired-lease",
        lease_expires_at: new Date(Date.now() - 60_000),
        delivered_at: null,
      },
    });

    const claims = await Promise.all([
      (invitations as any).claimDelivery(issued.invitationId),
      (invitations as any).claimDelivery(issued.invitationId),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("keeps accepted-before-activation cleanup in manual review", async () => {
    const issued = await invitations.invite(
      "accepted-race@example.test",
      adminPrincipal(),
    );
    clerk.revokeOrganizationInvitationByInternalId.mockRejectedValueOnce(
      new ClerkProvisioningError(
        "CLERK_INVITATION_ALREADY_ACCEPTED",
        false,
      ),
    );

    await expect(
      invitations.revokeInvitation(
        issued.invitationId as string,
        adminPrincipal(),
      ),
    ).resolves.toMatchObject({ status: "REVOKED" });
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: issued.invitationId as string },
      }),
    ).resolves.toMatchObject({
      status: "REVOKED",
      external_cleanup_required: true,
      external_cleanup_error_code: "CLERK_INVITATION_ALREADY_ACCEPTED",
      external_cleanup_completed_at: null,
    });
    await expect(
      invitations.invite("accepted-race@example.test", adminPrincipal()),
    ).rejects.toThrow("manual access review");
    await expect(
      prisma.organizationMembershipInvitation.count(),
    ).resolves.toBe(1);
    await expect(prisma.organizationProvisioningOutbox.count()).resolves.toBe(
      1,
    );
  });

  it("does not create a replacement until old external cleanup succeeds", async () => {
    const issued = await invitations.invite(
      "reissue-cleanup@example.test",
      adminPrincipal(),
    );
    await prisma.organizationMembershipInvitation.update({
      where: { id: issued.invitationId as string },
      data: {
        status: "EXPIRED",
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expired_at: new Date(),
        expires_at: new Date(Date.now() - 60_000),
      },
    });
    clerk.revokeOrganizationInvitationByInternalId.mockRejectedValueOnce(
      new ClerkProvisioningError(
        "CLERK_INVITATION_ALREADY_ACCEPTED",
        false,
      ),
    );

    await expect(
      invitations.reissue(issued.invitationId as string, adminPrincipal()),
    ).resolves.toMatchObject({
      invitationId: issued.invitationId,
      status: "EXPIRED",
      cleanupStatus: "MANUAL_REVIEW",
    });
    await expect(
      prisma.organizationMembershipInvitation.count(),
    ).resolves.toBe(1);
    await expect(prisma.organizationProvisioningOutbox.count()).resolves.toBe(
      1,
    );
  });

  it("revokes immediately with an open shift and durably retries failed Clerk cleanup", async () => {
    const { carer, membership } = await seedLegacyLinkedWorker("open-shift", {
      external: true,
    });
    await prisma.carerShift.create({
      data: {
        organization_id: organizationId,
        carer_id: carer.id,
        clock_in_at: new Date(),
      },
    });
    clerk.removeOrganizationMembership.mockRejectedValueOnce(
      new Error("private provider failure"),
    );

    await expect(
      invitations.deactivateMembership(membership.id, adminPrincipal()),
    ).resolves.toMatchObject({ status: "REVOKED" });
    await expect(
      prisma.organizationMembership.findUniqueOrThrow({
        where: { id: membership.id },
      }),
    ).resolves.toMatchObject({
      status: "REVOKED",
      external_cleanup_required: true,
      external_cleanup_error_code: "CLERK_CLEANUP_FAILED",
    });
    await expect(
      prisma.carerShift.count({
        where: { carer_id: carer.id, clock_out_at: null },
      }),
    ).resolves.toBe(1);

    await invitations.list(adminPrincipal());
    await expect(
      prisma.organizationMembership.findUniqueOrThrow({
        where: { id: membership.id },
      }),
    ).resolves.toMatchObject({
      external_cleanup_required: false,
      external_cleanup_error_code: null,
    });
  });

  it("serializes deactivation ahead of a queued assignment", async () => {
    const { carer, membership } =
      await seedLegacyLinkedWorker("assignment-race");
    const client = await prisma.client.create({
      data: {
        organization_id: organizationId,
        full_name: "Assignment Race Client",
        address_line1: "1 Test Street",
        city: "London",
        postcode: "SW1A 1AA",
      },
    });
    let releaseLock!: () => void;
    let markLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      markLocked = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const lockHolder = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`carer-assignment:${organizationId}:${carer.id}`}, 0))`;
      markLocked();
      await hold;
    });
    await locked;
    const deactivating = invitations.deactivateMembership(
      membership.id,
      adminPrincipal(),
    );
    let deactivationQueued = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
        SELECT count(*)::bigint AS waiting
        FROM pg_locks
        WHERE locktype = 'advisory' AND granted = false
      `;
      if (Number(rows[0]?.waiting || 0) >= 1) {
        deactivationQueued = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(deactivationQueued).toBe(true);
    const assigning = visits.createIfAssignable(
      {
        organization: { connect: { id: organizationId } },
        carer: { connect: { id: carer.id } },
        client: { connect: { id: client.id } },
        scheduled_start: new Date(Date.now() + 60_000),
        scheduled_end: new Date(Date.now() + 120_000),
        status: VisitStatus.SCHEDULED,
      },
      {
        organizationId,
        carerId: carer.id,
        clientId: client.id,
        scheduledStart: new Date(Date.now() + 60_000),
        scheduledEnd: new Date(Date.now() + 120_000),
      },
    );
    releaseLock();
    await lockHolder;
    await deactivating;
    await expect(assigning).resolves.toEqual({
      status: "INVALID_TENANT_RESOURCE",
    });
    await expect(
      prisma.visit.count({ where: { carer_id: carer.id } }),
    ).resolves.toBe(0);
  });

  it("rejects a linked membership from the wrong configured provider", async () => {
    const { carer } = await seedLegacyLinkedWorker("wrong-provider", {
      provider: "cognito",
    });
    await expect(
      visits.findCarerInOrganization(carer.id, organizationId),
    ).resolves.toBe(false);
  });
});
