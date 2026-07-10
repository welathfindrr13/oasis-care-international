import { INestApplication } from "@nestjs/common";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { JwtStrategy } from "@oasis/auth";
import { PrismaService } from "@oasis/db";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { StartedTestContainer } from "testcontainers";
import { AuthAccessModule } from "../src/auth/auth-access.module";
import { ClerkInvitationVerificationAdapter } from "../src/invitation-lifecycle/clerk-invitation-verification.adapter";
import { InvitationLifecycleModule } from "../src/invitation-lifecycle/invitation-lifecycle.module";
import { startPostgres } from "./utils/test-container";

describe("verified organization invitation activation", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;
  const previousEnv = { ...process.env };
  const secret = "test-secret-key-for-oasis-testing-only";
  const subject = "user_invited_admin";
  const organizationId = "org-internal-invited";
  const externalOrganizationId = "org_external_invited";
  const invitationId = "11111111-1111-4111-8111-111111111111";
  const externalInvitationId = "orginv_external_admin";
  const externalMembershipId = "orgmem_external_admin";
  const clerk = {
    listAcceptedInvitationsForUser: jest.fn(),
    getOrganizationMembership: jest.fn(),
  };

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = secret;
    process.env.AUTH_IDENTITY_PROVIDER = "clerk";
    process.env.CLERK_ISSUER = "https://clerk.example.test";
    process.env.CLERK_AUDIENCE = "oasis-api";
    process.env.CLERK_AUTHORIZED_PARTIES = "https://care.example.test";

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({ secret }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: false,
          context: ({ req }: any) => ({ req }),
        }),
        AuthAccessModule,
        InvitationLifecycleModule,
      ],
      providers: [JwtStrategy],
    })
      .overrideProvider(ClerkInvitationVerificationAdapter)
      .useValue(clerk)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
    process.env = { ...previousEnv };
  });

  beforeEach(async () => {
    clerk.listAcceptedInvitationsForUser.mockReset();
    clerk.getOrganizationMembership.mockReset();
    await prisma.auditLog.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.companyAccessRequest.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.organization.deleteMany();
    await seedPendingInvitation();
    clerk.listAcceptedInvitationsForUser.mockResolvedValue([
      acceptedInvitation(),
    ]);
    clerk.getOrganizationMembership.mockResolvedValue({
      id: externalMembershipId,
      organizationId: externalOrganizationId,
      userId: subject,
      role: "org:admin",
    });
  });

  function bearer(includeOrganization = false, tokenSubject = subject): string {
    return `Bearer ${jwt.sign(
      {
        sub: tokenSubject,
        iss: process.env.CLERK_ISSUER,
        aud: process.env.CLERK_AUDIENCE,
        azp: process.env.CLERK_AUTHORIZED_PARTIES,
        ...(includeOrganization
          ? { org_id: externalOrganizationId, org_role: "org:admin" }
          : {}),
      },
      secret,
      { expiresIn: "1h" },
    )}`;
  }

  function acceptedInvitation(overrides: Record<string, unknown> = {}) {
    return {
      id: externalInvitationId,
      organizationId: externalOrganizationId,
      emailAddress: "admin@example.test",
      role: "org:admin",
      publicMetadata: { oasis_invitation_id: invitationId },
      privateMetadata: { oasis_invitation_id: invitationId },
      ...overrides,
    };
  }

  async function seedPendingInvitation(
    overrides: { status?: "PENDING" | "REVOKED"; expired?: boolean } = {},
  ) {
    const createdAt = overrides.expired
      ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      : new Date();
    const expiresAt = overrides.expired
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.organization.create({
      data: { id: organizationId, name: "Synthetic Invitation Care" },
    });
    await prisma.companyAccessRequest.create({
      data: {
        id: "company-request-invited",
        company_name: "Synthetic Invitation Care",
        contact_name: "Synthetic Admin",
        business_email: "admin@example.test",
        normalized_business_email: "admin@example.test",
        status: "APPROVED",
        organization_id: organizationId,
        reviewed_at: createdAt,
        reviewed_by_subject: "user_platform_operator",
        approved_at: createdAt,
        requested_at: createdAt,
        created_at: createdAt,
      },
    });
    await prisma.organizationProviderBinding.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        external_organization_id: externalOrganizationId,
        external_slug: "oasis-synthetic-invited",
      },
    });
    await prisma.organizationMembershipInvitation.create({
      data: {
        id: invitationId,
        organization_id: organizationId,
        source_request_id: "company-request-invited",
        identity_provider: "clerk",
        intended_email: "admin@example.test",
        normalized_email: "admin@example.test",
        intended_role: "admin",
        status: overrides.status || "PENDING",
        external_invitation_id: externalInvitationId,
        expires_at: expiresAt,
        created_at: createdAt,
        ...(overrides.status === "REVOKED" ? { revoked_at: new Date() } : {}),
      },
    });
    await prisma.organizationProvisioningOutbox.create({
      data: {
        organization_id: organizationId,
        source_request_id: "company-request-invited",
        invitation_id: invitationId,
        status: "DELIVERED",
        delivered_at: new Date(),
      },
    });
  }

  function activate(token = bearer(), requestedInvitationId = invitationId) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", token)
      .send({
        query: `mutation Activate($input: InvitationActivationInputDTO!) {
          activateViewerOrganizationInvitation(input: $input) { status externalOrganizationId nextPath }
        }`,
        variables: { input: { invitationId: requestedInvitationId } },
      });
  }

  function accessSnapshot(token: string) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", token)
      .send({
        query: `{ viewerAccessSnapshot { membershipState surface onboardingState } }`,
      });
  }

  it("binds a subject-only accepted invitation before enabling tenant admin access", async () => {
    const before = await accessSnapshot(bearer()).expect(200);
    expect(before.body.data.viewerAccessSnapshot).toMatchObject({
      membershipState: "ORGANIZATION_MISMATCH",
      surface: "NONE",
    });

    const activated = await activate().expect(200);
    expect(activated.body.errors).toBeUndefined();
    expect(activated.body.data.activateViewerOrganizationInvitation).toEqual({
      status: "ACTIVE",
      externalOrganizationId,
      nextPath: "/admin/setup",
    });

    const membership = await prisma.organizationMembership.findFirstOrThrow();
    expect(membership).toMatchObject({
      organization_id: organizationId,
      identity_provider: "clerk",
      auth_subject: subject,
      normalized_email: "admin@example.test",
      role: "admin",
      status: "ACTIVE",
      external_organization_id: externalOrganizationId,
      external_membership_id: externalMembershipId,
    });
    expect(
      await prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).toMatchObject({
      status: "ACCEPTED",
      bound_auth_subject: subject,
      activated_membership_id: membership.id,
    });
    const after = await accessSnapshot(bearer(true)).expect(200);
    expect(after.body.data.viewerAccessSnapshot).toMatchObject({
      membershipState: "ACTIVE",
      surface: "ADMIN",
      onboardingState: "READY",
    });
  });

  it("activates a verified Carer as setup-required and returns a non-admin destination", async () => {
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.organizationMembershipInvitation.create({
      data: {
        id: invitationId,
        organization_id: organizationId,
        source_request_id: null,
        identity_provider: "clerk",
        intended_email: "carer@example.test",
        normalized_email: "carer@example.test",
        intended_role: "carer",
        status: "PENDING",
        external_invitation_id: externalInvitationId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    clerk.listAcceptedInvitationsForUser.mockResolvedValue([
      acceptedInvitation({
        emailAddress: "carer@example.test",
        role: "org:member",
      }),
    ]);
    clerk.getOrganizationMembership.mockResolvedValue({
      id: externalMembershipId,
      organizationId: externalOrganizationId,
      userId: subject,
      role: "org:member",
    });

    const activated = await activate().expect(200);
    expect(activated.body.errors).toBeUndefined();
    expect(activated.body.data.activateViewerOrganizationInvitation).toEqual({
      status: "ACTIVE",
      externalOrganizationId,
      nextPath: "/access/setup",
    });
    await expect(
      prisma.organizationMembership.findFirstOrThrow({
        where: { auth_subject: subject },
      }),
    ).resolves.toMatchObject({
      role: "carer",
      status: "ACTIVE",
      carer_id: null,
    });
    const snapshot = await accessSnapshot(bearer(true)).expect(200);
    expect(snapshot.body.data.viewerAccessSnapshot).toMatchObject({
      membershipState: "ACTIVE",
      surface: "NONE",
      onboardingState: "SETUP_REQUIRED",
    });
  });

  it("collapses concurrent and repeated activation to one membership and audit", async () => {
    const [first, second] = await Promise.all([activate(), activate()]);
    expect(first.body.errors).toBeUndefined();
    expect(second.body.errors).toBeUndefined();
    expect(await prisma.organizationMembership.count()).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: "ORG_MEMBERSHIP_INVITATION_ACCEPTED" },
      }),
    ).toBe(1);
    const repeated = await activate().expect(200);
    expect(repeated.body.errors).toBeUndefined();
    expect(await prisma.organizationMembership.count()).toBe(1);
  });

  it("never treats an unrelated invitation as an idempotent retry", async () => {
    expect((await activate()).body.errors).toBeUndefined();
    const unrelatedInvitationId = "22222222-2222-4222-8222-222222222222";
    const response = await activate(bearer(), unrelatedInvitationId).expect(
      200,
    );
    expect(response.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect(await prisma.organizationMembership.count()).toBe(1);
    expect(
      (
        await prisma.organizationMembershipInvitation.findUniqueOrThrow({
          where: { id: invitationId },
        })
      ).status,
    ).toBe("ACCEPTED");
  });

  it("fails closed for the wrong account without revealing invitation details", async () => {
    clerk.listAcceptedInvitationsForUser.mockResolvedValue([]);
    const response = await activate(bearer(false, "user_wrong_account")).expect(
      200,
    );
    expect(response.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect(response.body.errors?.[0]?.message).toBe(
      "Invitation activation is unavailable",
    );
    expect(await prisma.organizationMembership.count()).toBe(0);
  });

  it("expires stale internal invitations and never activates revoked invitations", async () => {
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.companyAccessRequest.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organization.deleteMany();
    await seedPendingInvitation({ expired: true });

    await prisma.organizationProvisioningOutbox.updateMany({
      data: {
        status: "RETRYABLE",
        last_error_code: "CLERK_NETWORK_ERROR",
        delivered_at: null,
      },
    });
    expect((await activate()).body.errors).toBeDefined();
    expect(
      (
        await prisma.organizationMembershipInvitation.findUniqueOrThrow({
          where: { id: invitationId },
        })
      ).status,
    ).toBe("PENDING");

    await prisma.organizationProvisioningOutbox.updateMany({
      data: {
        status: "DELIVERED",
        last_error_code: null,
        delivered_at: new Date(),
      },
    });
    expect((await activate()).body.errors).toBeDefined();
    expect(
      (
        await prisma.organizationMembershipInvitation.findUniqueOrThrow({
          where: { id: invitationId },
        })
      ).status,
    ).toBe("EXPIRED");
    expect(await prisma.organizationMembership.count()).toBe(0);

    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.companyAccessRequest.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organization.deleteMany();
    await seedPendingInvitation({ status: "REVOKED" });
    expect((await activate()).body.errors).toBeDefined();
    expect(await prisma.organizationMembership.count()).toBe(0);
  });

  it("rejects role, metadata, and existing-membership mismatches", async () => {
    clerk.listAcceptedInvitationsForUser.mockResolvedValue([
      acceptedInvitation({ role: "org:member" }),
    ]);
    expect((await activate()).body.errors).toBeDefined();

    clerk.listAcceptedInvitationsForUser.mockResolvedValue([
      acceptedInvitation({
        privateMetadata: { oasis_invitation_id: "different" },
      }),
    ]);
    expect((await activate()).body.errors).toBeDefined();

    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: subject,
        normalized_email: "prior@example.test",
        role: "admin",
        status: "SUSPENDED",
      },
    });
    clerk.listAcceptedInvitationsForUser.mockResolvedValue([
      acceptedInvitation(),
    ]);
    expect((await activate()).body.errors).toBeDefined();
    expect(await prisma.organizationMembership.count()).toBe(1);
  });

  it("requires exact external membership, tenant binding, and delivered company bootstrap", async () => {
    clerk.getOrganizationMembership.mockResolvedValue({
      id: externalMembershipId,
      organizationId: externalOrganizationId,
      userId: "user_different",
      role: "org:admin",
    });
    expect((await activate()).body.errors).toBeDefined();
    expect(await prisma.organizationMembership.count()).toBe(0);

    clerk.getOrganizationMembership.mockResolvedValue({
      id: externalMembershipId,
      organizationId: externalOrganizationId,
      userId: subject,
      role: "org:admin",
    });
    await prisma.organizationProviderBinding.deleteMany();
    expect((await activate()).body.errors).toBeDefined();

    await prisma.organizationProviderBinding.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        external_organization_id: externalOrganizationId,
        external_slug: "oasis-synthetic-invited",
      },
    });
    await prisma.organizationProvisioningOutbox.updateMany({
      data: {
        status: "NEEDS_ATTENTION",
        last_error_code: "CLERK_MANUAL_REVIEW",
        delivered_at: null,
      },
    });
    expect((await activate()).body.errors).toBeDefined();

    await prisma.organizationProvisioningOutbox.updateMany({
      data: {
        status: "DELIVERED",
        last_error_code: null,
        delivered_at: new Date(),
      },
    });
    await prisma.companyAccessRequest.updateMany({
      data: { status: "DISABLED", disabled_at: new Date() },
    });
    expect((await activate()).body.errors).toBeDefined();
    expect(await prisma.organizationMembership.count()).toBe(0);
  });

  it("rechecks internal approval state after external verification", async () => {
    let releaseVerification!: () => void;
    let verificationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      verificationStarted = resolve;
    });
    clerk.getOrganizationMembership.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseVerification = () =>
            resolve({
              id: externalMembershipId,
              organizationId: externalOrganizationId,
              userId: subject,
              role: "org:admin",
            });
          verificationStarted();
        }),
    );

    const responsePromise = activate()
      .expect(200)
      .then((response) => response);
    await started;
    await prisma.companyAccessRequest.updateMany({
      data: { status: "DISABLED", disabled_at: new Date() },
    });
    releaseVerification();

    const response = await responsePromise;
    expect(response.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect(await prisma.organizationMembership.count()).toBe(0);
    expect(
      (
        await prisma.organizationMembershipInvitation.findUniqueOrThrow({
          where: { id: invitationId },
        })
      ).status,
    ).toBe("PENDING");
  });

  it("prevents duplicate outstanding invitations for one tenant identity", async () => {
    await expect(
      prisma.organizationMembershipInvitation.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          intended_email: "admin@example.test",
          normalized_email: "admin@example.test",
          intended_role: "admin",
          status: "PENDING",
          external_invitation_id: "orginv_duplicate",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
