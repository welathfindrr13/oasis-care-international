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
import { CarerModule } from "../src/carer/carer.module";
import { ClerkInvitationAdministrationAdapter } from "../src/invitation-lifecycle/clerk-invitation-administration.adapter";
import { startPostgres } from "./utils/test-container";

describe("Carer invitation GraphQL boundary", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;
  const previousEnv = { ...process.env };
  const secret = "phase-six-graphql-secret-for-tests";
  const organizationId = "org-carer-graphql";
  const otherOrganizationId = "org-carer-graphql-other";
  const externalOrganizationId = "org_external_carer_graphql";
  const adminSubject = "admin_carer_graphql";
  const carerSubject = "carer_graphql";
  const clerk = {
    ensureOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitationByInternalId: jest.fn(),
    removeOrganizationMembership: jest.fn(),
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
        CarerModule,
      ],
      providers: [JwtStrategy],
    })
      .overrideProvider(ClerkInvitationAdministrationAdapter)
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
    jest.clearAllMocks();
    clerk.ensureOrganizationInvitation.mockImplementation(
      async ({ invitationId }: { invitationId: string }) => ({
        externalInvitationId: `external_${invitationId}`,
      }),
    );
    clerk.revokeOrganizationInvitationByInternalId.mockResolvedValue(undefined);
    clerk.removeOrganizationMembership.mockResolvedValue(undefined);
    await prisma.auditLog.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: "Carer GraphQL" },
        { id: otherOrganizationId, name: "Carer GraphQL Other" },
      ],
    });
    await prisma.organizationProviderBinding.createMany({
      data: [
        {
          organization_id: organizationId,
          identity_provider: "clerk",
          external_organization_id: externalOrganizationId,
          external_slug: "oasis-carer-graphql",
        },
        {
          organization_id: otherOrganizationId,
          identity_provider: "clerk",
          external_organization_id: "org_external_carer_graphql_other",
          external_slug: "oasis-carer-graphql-other",
        },
      ],
    });
    await prisma.organizationMembership.createMany({
      data: [
        {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: adminSubject,
          normalized_email: "admin-graphql@example.test",
          role: "admin",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_admin_graphql",
        },
        {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: carerSubject,
          normalized_email: "carer-graphql@example.test",
          role: "carer",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_carer_graphql",
        },
      ],
    });
  });

  function bearer(subject: string, externalOrg = externalOrganizationId) {
    return `Bearer ${jwt.sign(
      {
        sub: subject,
        iss: process.env.CLERK_ISSUER,
        aud: process.env.CLERK_AUDIENCE,
        azp: process.env.CLERK_AUTHORIZED_PARTIES,
        org_id: externalOrg,
        org_role: subject === adminSubject ? "org:admin" : "org:member",
      },
      secret,
      { expiresIn: "1h" },
    )}`;
  }

  function gql(token: string, query: string, variables?: unknown) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", token)
      .send({ query, variables });
  }

  it("derives tenant and carer role from verified admin context", async () => {
    const response = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteCarerInput!) {
        inviteCarer(input: $input) {
          invitationId status readiness deliveryStatus canRevoke
        }
      }`,
      { input: { emailAddress: "worker-graphql@example.test" } },
    ).expect(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.inviteCarer).toMatchObject({
      status: "PENDING",
      readiness: "AWAITING_ACCEPTANCE",
      deliveryStatus: "DELIVERED",
      canRevoke: true,
    });
    await expect(
      prisma.organizationMembershipInvitation.findFirstOrThrow({
        where: { normalized_email: "worker-graphql@example.test" },
      }),
    ).resolves.toMatchObject({
      organization_id: organizationId,
      intended_role: "carer",
      created_by_subject: adminSubject,
    });
  });

  it("denies a non-admin and invalid input before creating delivery state", async () => {
    const denied = await gql(
      bearer(carerSubject),
      `mutation Invite($input: InviteCarerInput!) {
        inviteCarer(input: $input) { invitationId }
      }`,
      { input: { emailAddress: "blocked@example.test" } },
    ).expect(200);
    expect(denied.body.errors).toHaveLength(1);

    const invalid = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteCarerInput!) {
        inviteCarer(input: $input) { invitationId }
      }`,
      { input: { emailAddress: "not-an-email" } },
    ).expect(200);
    expect(invalid.body.errors).toHaveLength(1);
    await expect(prisma.organizationMembershipInvitation.count()).resolves.toBe(
      0,
    );
  });

  it("fails closed when an admin supplies another tenant's invitation ID", async () => {
    const other = await prisma.organizationMembershipInvitation.create({
      data: {
        organization_id: otherOrganizationId,
        identity_provider: "clerk",
        intended_email: "other@example.test",
        normalized_email: "other@example.test",
        intended_role: "carer",
        status: "PENDING",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.organizationProvisioningOutbox.create({
      data: {
        organization_id: otherOrganizationId,
        invitation_id: other.id,
        status: "PENDING",
      },
    });

    const response = await gql(
      bearer(adminSubject),
      `mutation Revoke($input: CarerInvitationActionInput!) {
        revokeCarerInvitation(input: $input) { status }
      }`,
      { input: { invitationId: other.id } },
    ).expect(200);
    expect(response.body.errors).toHaveLength(1);
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: other.id },
      }),
    ).resolves.toMatchObject({ status: "PENDING", revoked_at: null });
  });
});
