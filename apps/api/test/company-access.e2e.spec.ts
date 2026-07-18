import { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "@oasis/auth";
import { PrismaService } from "@oasis/db";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { StartedTestContainer } from "testcontainers";
import { AuthAccessModule } from "../src/auth/auth-access.module";
import {
  ClerkProvisioningAdapter,
  ClerkProvisioningError,
} from "../src/company-access/clerk-provisioning.adapter";
import { CompanyAccessModule } from "../src/company-access/company-access.module";
import { ClerkInvitationAdministrationAdapter } from "../src/invitation-lifecycle/clerk-invitation-administration.adapter";
import { startPostgres } from "./utils/test-container";

describe("company access bootstrap", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;
  const previousEnv = { ...process.env };
  const secret = "test-secret-key-for-oasis-testing-only";
  const operatorOrganizationId = "org_platform_ops";
  const operatorSubject = "user_platform_operator";
  const clerk = { ensureBootstrap: jest.fn() };
  const membershipClerk = { removeOrganizationMembership: jest.fn() };

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
    process.env.PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID =
      operatorOrganizationId;
    process.env.PLATFORM_OPERATOR_CLERK_SUBJECTS = operatorSubject;
    process.env.COMPANY_ACCESS_REQUEST_RATE_LIMIT_MAX = "100";

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
        CompanyAccessModule,
      ],
      providers: [JwtStrategy],
    })
      .overrideProvider(ClerkProvisioningAdapter)
      .useValue(clerk)
      .overrideProvider(ClerkInvitationAdministrationAdapter)
      .useValue(membershipClerk)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).set("trust proxy", 1);
    await app.init();
    prisma = app.get(PrismaService);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
    process.env = { ...previousEnv };
  });

  beforeEach(async () => {
    clerk.ensureBootstrap.mockReset();
    clerk.ensureBootstrap.mockResolvedValue({
      externalOrganizationId: "org_external",
      externalOrganizationSlug: "oasis-external",
      externalInvitationId: "orginv_external",
    });
    membershipClerk.removeOrganizationMembership.mockReset();
    membershipClerk.removeOrganizationMembership.mockResolvedValue(undefined);
    await prisma.auditLog.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.companyAccessRequest.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.organizationIdentity.deleteMany();
    await prisma.client.deleteMany();
    await prisma.organization.deleteMany();
  });

  function bearer(
    subject: string,
    organizationId: string,
    role = "org:admin",
  ): string {
    const token = jwt.sign(
      {
        sub: subject,
        iss: process.env.CLERK_ISSUER,
        aud: process.env.CLERK_AUDIENCE,
        azp: process.env.CLERK_AUTHORIZED_PARTIES,
        org_id: organizationId,
        org_role: role,
      },
      secret,
      { expiresIn: "1h" },
    );
    return `Bearer ${token}`;
  }

  function operatorBearer(): string {
    return bearer(operatorSubject, operatorOrganizationId, "org:member");
  }

  function submitCompany(
    email = "admin@example.test",
    companyName = "Synthetic Care Ltd",
  ) {
    return request(app.getHttpServer())
      .post("/company-access-requests")
      .set("Content-Type", "application/json")
      .send({
        companyName,
        contactName: "Synthetic Contact",
        businessEmail: email,
        operationalNote: "Synthetic team in Leeds",
      });
  }

  function platformGraphql(
    query: string,
    variables: Record<string, unknown> = {},
    options: { authorization?: string; action?: boolean } = {},
  ) {
    const call = request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", options.authorization || operatorBearer())
      .send({ query, variables });
    if (options.action) call.set("X-Oasis-Platform-Action", "1");
    return call;
  }

  async function pendingRequestId(): Promise<string> {
    const item = await prisma.companyAccessRequest.findFirstOrThrow({
      where: { status: "PENDING_APPROVAL" },
    });
    return item.id;
  }

  async function approveAndAcceptBootstrap(
    email = "admin@example.test",
    companyName = "Synthetic Care Ltd",
    authSubject = "user_bootstrap_manager",
  ) {
    await submitCompany(email, companyName).expect(202);
    const id = await pendingRequestId();
    const approved = await platformGraphql(
      approvalMutation,
      { id },
      { action: true },
    ).expect(200);
    expect(approved.body.errors).toBeUndefined();
    const organizationId = approved.body.data.approveCompanyAccessRequest
      .organizationId as string;
    const membership = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: authSubject,
        normalized_email: email.toLowerCase(),
        role: "admin",
        status: "ACTIVE",
        external_organization_id: "org_external",
        external_membership_id: `membership_${authSubject}`,
      },
    });
    const invitation =
      await prisma.organizationMembershipInvitation.findFirstOrThrow({
        where: { source_request_id: id },
      });
    await prisma.organizationMembershipInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        activated_membership_id: membership.id,
        bound_auth_subject: authSubject,
        accepted_at: new Date(),
      },
    });
    return { id, organizationId, membership, invitation };
  }

  const approvalMutation = `
    mutation Approve($id: String!) {
      approveCompanyAccessRequest(id: $id) {
        id status organizationId provisioningStatus provisioningAttemptCount provisioningErrorCode
      }
    }
  `;

  const revokeBootstrapManagerMutation = `
    mutation RevokeBootstrapManager($id: String!) {
      revokeBootstrapManagerAccess(id: $id) {
        id
        status
        bootstrapManagerEmail
        bootstrapManagerAccessStatus
        bootstrapManagerCleanupStatus
        bootstrapManagerCleanupErrorCode
      }
    }
  `;

  it("returns the same safe confirmation for new and duplicate public submissions", async () => {
    const first = await submitCompany().expect(202);
    const duplicate = await submitCompany("ADMIN@example.test").expect(202);

    expect(first.body).toEqual({ accepted: true });
    expect(duplicate.body).toEqual(first.body);
    expect(await prisma.companyAccessRequest.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.organizationMembershipInvitation.count()).toBe(0);
    expect(await prisma.organizationMembership.count()).toBe(0);

    const audits = await prisma.auditLog.findMany({
      orderBy: { timestamp: "asc" },
    });
    expect(audits.map((audit) => audit.action)).toEqual([
      "PUBLIC_ACCESS_REQUEST_CREATED",
      "PUBLIC_ACCESS_REQUEST_REPEATED",
    ]);
    const serializedAudit = JSON.stringify(audits);
    expect(serializedAudit).not.toContain("admin@example.test");
    expect(serializedAudit).not.toContain("Synthetic Contact");
    expect(serializedAudit).not.toContain("Synthetic team in Leeds");
  });

  it("rejects non-JSON, unknown, and care-data-shaped public fields", async () => {
    await request(app.getHttpServer())
      .post("/company-access-requests")
      .set("Content-Type", "text/plain")
      .send("companyName=Synthetic")
      .expect(415);

    await request(app.getHttpServer())
      .post("/company-access-requests")
      .set("Content-Type", "application/json")
      .send({
        companyName: "Synthetic",
        contactName: "Contact",
        businessEmail: "contact@example.test",
        clientMedicalRecord: "must never be accepted",
      })
      .expect(400);

    expect(await prisma.companyAccessRequest.count()).toBe(0);
  });

  it("keeps platform operations independent from tenant roles and app memberships", async () => {
    await submitCompany().expect(202);
    const tenantAdmin = bearer(
      "user_tenant_admin",
      "org_customer",
      "org:admin",
    );
    const query = `{ companyAccessRequests { total items { id } } }`;

    const forbidden = await platformGraphql(
      query,
      {},
      { authorization: tenantAdmin },
    ).expect(200);
    expect(forbidden.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    const allowed = await platformGraphql(query).expect(200);
    expect(allowed.body.errors).toBeUndefined();
    expect(allowed.body.data.companyAccessRequests.total).toBe(1);
    expect(await prisma.organizationMembership.count()).toBe(0);
  });

  it("returns organization setup details only through an active tenant administrator membership", async () => {
    const organizationId = "org_setup_tenant";
    const adminSubject = "user_setup_admin";
    await prisma.organization.create({
      data: { id: organizationId, name: "Synthetic Setup Care" },
    });
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "clerk",
        auth_subject: adminSubject,
        normalized_email: "setup-admin@example.test",
        role: "admin",
        status: "ACTIVE",
        external_organization_id: organizationId,
      },
    });
    const setupQuery = `{
      viewerOrganizationSetupDetails { id name }
    }`;

    const allowed = await platformGraphql(
      setupQuery,
      {},
      {
        authorization: bearer(adminSubject, organizationId),
      },
    ).expect(200);
    expect(allowed.body.errors).toBeUndefined();
    expect(allowed.body.data.viewerOrganizationSetupDetails).toEqual({
      id: organizationId,
      name: "Synthetic Setup Care",
    });

    const operatorWithoutMembership =
      await platformGraphql(setupQuery).expect(200);
    expect(operatorWithoutMembership.body.errors?.[0]?.extensions?.code).toBe(
      "FORBIDDEN",
    );
  });

  it("requires explicit platform-action confirmation for mutations", async () => {
    await submitCompany().expect(202);
    const id = await pendingRequestId();
    const response = await platformGraphql(approvalMutation, { id }).expect(
      200,
    );

    expect(response.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect(
      (await prisma.companyAccessRequest.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe("PENDING_APPROVAL");
  });

  it("keeps first-Manager revocation behind Platform Owner and explicit-action guards", async () => {
    const setup = await approveAndAcceptBootstrap();
    const tenantAdmin = bearer(
      "user_tenant_admin",
      setup.organizationId,
      "org:admin",
    );

    const wrongOperator = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { authorization: tenantAdmin, action: true },
    ).expect(200);
    expect(wrongOperator.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    const missingConfirmation = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
    ).expect(200);
    expect(missingConfirmation.body.errors?.[0]?.extensions?.code).toBe(
      "FORBIDDEN",
    );
    expect(
      (
        await prisma.companyAccessRequest.findUniqueOrThrow({
          where: { id: setup.id },
        })
      ).status,
    ).toBe("APPROVED");
    expect(
      (
        await prisma.organizationMembership.findUniqueOrThrow({
          where: { id: setup.membership.id },
        })
      ).status,
    ).toBe("ACTIVE");
    expect(membershipClerk.removeOrganizationMembership).not.toHaveBeenCalled();
  });

  it("atomically revokes the exact first Manager before Clerk cleanup and preserves company care data", async () => {
    const setup = await approveAndAcceptBootstrap();
    const client = await prisma.client.create({
      data: {
        organization_id: setup.organizationId,
        full_name: "Synthetic Person",
        address_line1: "1 Test Street",
        city: "Leeds",
        postcode: "LS1 1AA",
      },
    });
    const sentinelOrganizationId = "org_revocation_sentinel";
    const sentinelMembership = await prisma.organizationMembership.create({
      data: {
        organization: {
          create: {
            id: sentinelOrganizationId,
            name: "Sentinel Care Company",
          },
        },
        identity_provider: "clerk",
        auth_subject: "user_sentinel_manager",
        normalized_email: "sentinel@example.test",
        role: "admin",
        status: "ACTIVE",
        external_organization_id: "org_external_sentinel",
        external_membership_id: "membership_sentinel",
      },
    });
    const managerBearer = bearer(
      setup.membership.auth_subject,
      setup.organizationId,
    );
    const setupQuery = `{ viewerOrganizationSetupDetails { id name } }`;
    const before = await platformGraphql(
      setupQuery,
      {},
      {
        authorization: managerBearer,
      },
    ).expect(200);
    expect(before.body.errors).toBeUndefined();

    membershipClerk.removeOrganizationMembership.mockImplementationOnce(
      async () => {
        const requestRow = await prisma.companyAccessRequest.findUniqueOrThrow({
          where: { id: setup.id },
        });
        const membershipRow =
          await prisma.organizationMembership.findUniqueOrThrow({
            where: { id: setup.membership.id },
          });
        expect(requestRow.status).toBe("DISABLED");
        expect(membershipRow).toMatchObject({
          status: "REVOKED",
          external_cleanup_required: true,
        });
        expect(membershipRow.revoked_at).toBeInstanceOf(Date);
      },
    );

    const revoked = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { action: true },
    ).expect(200);
    expect(revoked.body.errors).toBeUndefined();
    expect(revoked.body.data.revokeBootstrapManagerAccess).toEqual({
      id: setup.id,
      status: "DISABLED",
      bootstrapManagerEmail: "admin@example.test",
      bootstrapManagerAccessStatus: "REVOKED",
      bootstrapManagerCleanupStatus: "COMPLETE",
      bootstrapManagerCleanupErrorCode: null,
    });
    expect(membershipClerk.removeOrganizationMembership).toHaveBeenCalledWith(
      "org_external",
      setup.membership.auth_subject,
    );

    const after = await platformGraphql(
      setupQuery,
      {},
      {
        authorization: managerBearer,
      },
    ).expect(200);
    expect(after.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect(
      await prisma.organization.count({
        where: { id: setup.organizationId },
      }),
    ).toBe(1);
    expect(await prisma.client.count({ where: { id: client.id } })).toBe(1);
    expect(
      await prisma.organizationMembership.count({
        where: {
          organization_id: setup.organizationId,
          role: "admin",
          status: "ACTIVE",
          revoked_at: null,
        },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.organizationMembership.findUniqueOrThrow({
          where: { id: sentinelMembership.id },
        })
      ).status,
    ).toBe("ACTIVE");

    const audits = await prisma.auditLog.findMany({
      where: {
        action: "BOOTSTRAP_MANAGER_ACCESS_REVOKED",
        resource_id: setup.id,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      organization_id: setup.organizationId,
      user_id: operatorSubject,
      resource_type: "CompanyAccessRequest",
    });
    const serializedAudit = JSON.stringify(audits);
    expect(serializedAudit).not.toContain("admin@example.test");
    expect(serializedAudit).not.toContain("Synthetic Care Ltd");
    expect(serializedAudit).not.toContain(setup.membership.auth_subject);

    const repeated = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { action: true },
    ).expect(200);
    expect(repeated.body.errors).toBeUndefined();
    expect(
      repeated.body.data.revokeBootstrapManagerAccess
        .bootstrapManagerCleanupStatus,
    ).toBe("COMPLETE");
    expect(membershipClerk.removeOrganizationMembership).toHaveBeenCalledTimes(
      1,
    );
  });

  it("never restores authority when Clerk cleanup fails and retries cleanup idempotently", async () => {
    const setup = await approveAndAcceptBootstrap(
      "cleanup@example.test",
      "Cleanup Test Care",
      "user_cleanup_manager",
    );
    const managerBearer = bearer(
      setup.membership.auth_subject,
      setup.organizationId,
    );
    membershipClerk.removeOrganizationMembership.mockRejectedValueOnce(
      new ClerkProvisioningError("CLERK_HTTP_503", true),
    );

    const attention = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { action: true },
    ).expect(200);
    expect(attention.body.errors).toBeUndefined();
    expect(attention.body.data.revokeBootstrapManagerAccess).toMatchObject({
      status: "DISABLED",
      bootstrapManagerAccessStatus: "REVOKED",
      bootstrapManagerCleanupStatus: "NEEDS_ATTENTION",
      bootstrapManagerCleanupErrorCode: "CLERK_HTTP_503",
    });
    const denied = await platformGraphql(
      `{ viewerOrganizationSetupDetails { id } }`,
      {},
      { authorization: managerBearer },
    ).expect(200);
    expect(denied.body.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    membershipClerk.removeOrganizationMembership.mockResolvedValueOnce(
      undefined,
    );
    const retried = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { action: true },
    ).expect(200);
    expect(retried.body.errors).toBeUndefined();
    expect(retried.body.data.revokeBootstrapManagerAccess).toMatchObject({
      status: "DISABLED",
      bootstrapManagerAccessStatus: "REVOKED",
      bootstrapManagerCleanupStatus: "COMPLETE",
      bootstrapManagerCleanupErrorCode: null,
    });
    expect(
      await prisma.auditLog.count({
        where: {
          action: "BOOTSTRAP_MANAGER_ACCESS_REVOKED",
          resource_id: setup.id,
        },
      }),
    ).toBe(1);
    expect(membershipClerk.removeOrganizationMembership).toHaveBeenCalledTimes(
      2,
    );
  });

  it("collapses concurrent first-Manager revocation to one internal transition audit", async () => {
    const setup = await approveAndAcceptBootstrap(
      "concurrent-revoke@example.test",
      "Concurrent Revoke Care",
      "user_concurrent_manager",
    );
    const responses = await Promise.all([
      platformGraphql(
        revokeBootstrapManagerMutation,
        { id: setup.id },
        { action: true },
      ),
      platformGraphql(
        revokeBootstrapManagerMutation,
        { id: setup.id },
        { action: true },
      ),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(
        response.body.data.revokeBootstrapManagerAccess
          .bootstrapManagerAccessStatus,
      ).toBe("REVOKED");
    }
    expect(
      await prisma.auditLog.count({
        where: {
          action: "BOOTSTRAP_MANAGER_ACCESS_REVOKED",
          resource_id: setup.id,
        },
      }),
    ).toBe(1);
  });

  it("fails closed without writes when the bootstrap Manager identity is ambiguous", async () => {
    const setup = await approveAndAcceptBootstrap(
      "ambiguous@example.test",
      "Ambiguous Test Care",
      "user_ambiguous_manager_one",
    );
    const secondMembership = await prisma.organizationMembership.create({
      data: {
        organization_id: setup.organizationId,
        identity_provider: "clerk",
        auth_subject: "user_ambiguous_manager_two",
        normalized_email: "ambiguous@example.test",
        role: "admin",
        status: "ACTIVE",
        external_organization_id: "org_external",
        external_membership_id: "membership_ambiguous_two",
      },
    });
    const createdAt = new Date();
    const acceptedAt = new Date(createdAt.getTime() + 1_000);
    await prisma.organizationMembershipInvitation.create({
      data: {
        organization_id: setup.organizationId,
        source_request_id: setup.id,
        activated_membership_id: secondMembership.id,
        identity_provider: "clerk",
        intended_email: "ambiguous@example.test",
        normalized_email: "ambiguous@example.test",
        intended_role: "admin",
        status: "ACCEPTED",
        external_invitation_id: "orginv_ambiguous_two",
        bound_auth_subject: secondMembership.auth_subject,
        created_by_subject: operatorSubject,
        expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        created_at: createdAt,
        accepted_at: acceptedAt,
      },
    });

    const response = await platformGraphql(
      revokeBootstrapManagerMutation,
      { id: setup.id },
      { action: true },
    ).expect(200);
    expect(response.body.errors).toBeDefined();
    expect(
      (
        await prisma.companyAccessRequest.findUniqueOrThrow({
          where: { id: setup.id },
        })
      ).status,
    ).toBe("APPROVED");
    expect(
      await prisma.organizationMembership.count({
        where: {
          organization_id: setup.organizationId,
          status: "ACTIVE",
          revoked_at: null,
        },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { action: "BOOTSTRAP_MANAGER_ACCESS_REVOKED" },
      }),
    ).toBe(0);
    expect(membershipClerk.removeOrganizationMembership).not.toHaveBeenCalled();
  });

  it("collapses concurrent approvals to one org, one pending invitation, and no membership", async () => {
    await submitCompany().expect(202);
    const id = await pendingRequestId();

    const responses = await Promise.all([
      platformGraphql(approvalMutation, { id }, { action: true }),
      platformGraphql(approvalMutation, { id }, { action: true }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.approveCompanyAccessRequest.status).toBe(
        "APPROVED",
      );
    }

    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
    expect(await prisma.organizationProvisioningOutbox.count()).toBe(1);
    expect(await prisma.organizationProviderBinding.count()).toBe(1);
    expect(await prisma.organizationMembership.count()).toBe(0);
    expect(clerk.ensureBootstrap).toHaveBeenCalledTimes(1);
    const invitation =
      await prisma.organizationMembershipInvitation.findFirstOrThrow();
    expect(invitation.status).toBe("PENDING");
    expect(invitation.external_invitation_id).toBe("orginv_external");
  });

  it("reconciles an overdue non-delivered invitation without changing its identity", async () => {
    clerk.ensureBootstrap.mockRejectedValueOnce(
      new ClerkProvisioningError("CLERK_HTTP_503", true),
    );
    await submitCompany().expect(202);
    const id = await pendingRequestId();

    const approved = await platformGraphql(
      approvalMutation,
      { id },
      { action: true },
    ).expect(200);
    expect(approved.body.errors).toBeUndefined();
    expect(approved.body.data.approveCompanyAccessRequest).toMatchObject({
      status: "APPROVED",
      provisioningStatus: "RETRYABLE",
      provisioningErrorCode: "CLERK_HTTP_503",
    });
    expect(await prisma.organizationMembership.count()).toBe(0);
    await prisma.organizationMembershipInvitation.updateMany({
      data: {
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const retry = await platformGraphql(
      `mutation Retry($id: String!) {
        retryCompanyProvisioning(id: $id) { status provisioningStatus provisioningErrorCode }
      }`,
      { id },
      { action: true },
    ).expect(200);
    expect(retry.body.errors).toBeUndefined();
    expect(retry.body.data.retryCompanyProvisioning).toEqual({
      status: "APPROVED",
      provisioningStatus: "DELIVERED",
      provisioningErrorCode: null,
    });
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
    expect(await prisma.organizationProvisioningOutbox.count()).toBe(1);
    expect(await prisma.organizationMembership.count()).toBe(0);
    expect(clerk.ensureBootstrap).toHaveBeenCalledTimes(2);
    expect(
      (
        await prisma.organizationMembershipInvitation.findFirstOrThrow()
      ).expires_at.getTime(),
    ).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it("reissues one delivered invitation only after the prior invitation expires", async () => {
    await submitCompany("expired-admin@example.test").expect(202);
    const id = await pendingRequestId();
    await platformGraphql(approvalMutation, { id }, { action: true }).expect(
      200,
    );
    const original =
      await prisma.organizationMembershipInvitation.findFirstOrThrow();
    const now = Date.now();
    await prisma.organizationMembershipInvitation.update({
      where: { id: original.id },
      data: {
        created_at: new Date(now - 8 * 24 * 60 * 60 * 1000),
        expires_at: new Date(now - 24 * 60 * 60 * 1000),
      },
    });
    clerk.ensureBootstrap.mockResolvedValueOnce({
      externalOrganizationId: "org_external",
      externalOrganizationSlug: "oasis-external",
      externalInvitationId: "orginv_reissued",
    });

    const retryMutation = `mutation Retry($id: String!) {
      retryCompanyProvisioning(id: $id) { provisioningStatus provisioningErrorCode }
    }`;
    const retries = await Promise.all([
      platformGraphql(retryMutation, { id }, { action: true }),
      platformGraphql(retryMutation, { id }, { action: true }),
    ]);
    for (const retry of retries) {
      expect(retry.status).toBe(200);
      expect(retry.body.errors).toBeUndefined();
    }
    const invitations = await prisma.organizationMembershipInvitation.findMany({
      orderBy: { created_at: "asc" },
    });
    expect(invitations).toHaveLength(2);
    expect(invitations[0]).toMatchObject({
      id: original.id,
      source_request_id: id,
      status: "EXPIRED",
      external_invitation_id: "orginv_external",
    });
    expect(invitations[1]).toMatchObject({
      source_request_id: id,
      status: "PENDING",
      external_invitation_id: "orginv_reissued",
    });
    expect(invitations[1].expires_at.getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    expect(
      await prisma.auditLog.count({
        where: {
          action: {
            in: [
              "ORG_MEMBERSHIP_INVITATION_EXPIRED",
              "ORG_MEMBERSHIP_INVITATION_REISSUED",
            ],
          },
        },
      }),
    ).toBe(2);
    expect(clerk.ensureBootstrap).toHaveBeenCalledTimes(2);
  });

  it("reclaims an expired processing lease without overlapping Clerk workers", async () => {
    clerk.ensureBootstrap.mockRejectedValueOnce(
      new ClerkProvisioningError("CLERK_HTTP_503", true),
    );
    await submitCompany("stale-lease@example.test").expect(202);
    const id = await pendingRequestId();
    await platformGraphql(approvalMutation, { id }, { action: true }).expect(
      200,
    );
    await prisma.organizationProvisioningOutbox.update({
      where: { source_request_id: id },
      data: {
        status: "PROCESSING",
        lease_token: "stale-lease-token",
        lease_expires_at: new Date(Date.now() - 60_000),
      },
    });

    const retry = await platformGraphql(
      `mutation Retry($id: String!) {
        retryCompanyProvisioning(id: $id) { provisioningStatus provisioningErrorCode }
      }`,
      { id },
      { action: true },
    ).expect(200);

    expect(retry.body.errors).toBeUndefined();
    expect(retry.body.data.retryCompanyProvisioning).toEqual({
      provisioningStatus: "DELIVERED",
      provisioningErrorCode: null,
    });
    expect(clerk.ensureBootstrap).toHaveBeenCalledTimes(2);
    expect(await prisma.organizationMembership.count()).toBe(0);
  });

  it("uses compare-and-set when operator retries race with each other", async () => {
    clerk.ensureBootstrap.mockRejectedValueOnce(
      new ClerkProvisioningError("CLERK_HTTP_503", true),
    );
    await submitCompany("concurrent-retry@example.test").expect(202);
    const id = await pendingRequestId();
    await platformGraphql(approvalMutation, { id }, { action: true }).expect(
      200,
    );
    const mutation = `mutation Retry($id: String!) {
      retryCompanyProvisioning(id: $id) { provisioningStatus }
    }`;

    const responses = await Promise.all([
      platformGraphql(mutation, { id }, { action: true }),
      platformGraphql(mutation, { id }, { action: true }),
    ]);

    expect(responses.some((response) => !response.body.errors)).toBe(true);
    expect(
      (
        await prisma.organizationProvisioningOutbox.findUniqueOrThrow({
          where: { source_request_id: id },
        })
      ).status,
    ).toBe("DELIVERED");
    expect(clerk.ensureBootstrap).toHaveBeenCalledTimes(2);
    expect(await prisma.organizationProviderBinding.count()).toBe(1);
    expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
  });

  it("collapses concurrent rejections to one transition audit", async () => {
    await submitCompany("concurrent-reject@example.test").expect(202);
    const id = await pendingRequestId();
    const mutation = `mutation Reject($id: String!) {
      rejectCompanyAccessRequest(id: $id, rejectionCode: NOT_ELIGIBLE) { status }
    }`;

    const responses = await Promise.all([
      platformGraphql(mutation, { id }, { action: true }),
      platformGraphql(mutation, { id }, { action: true }),
    ]);

    for (const response of responses) {
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.rejectCompanyAccessRequest.status).toBe(
        "REJECTED",
      );
    }
    expect(
      await prisma.auditLog.count({
        where: { action: "COMPANY_ACCESS_REQUEST_REJECTED", resource_id: id },
      }),
    ).toBe(1);
    expect(await prisma.organization.count()).toBe(0);
  });

  it("resolves approve-versus-reject races to one valid terminal transition", async () => {
    await submitCompany("approval-race@example.test").expect(202);
    const id = await pendingRequestId();
    const rejectMutation = `mutation Reject($id: String!) {
      rejectCompanyAccessRequest(id: $id, rejectionCode: NOT_ELIGIBLE) { status }
    }`;

    const [approved, rejected] = await Promise.all([
      platformGraphql(approvalMutation, { id }, { action: true }),
      platformGraphql(rejectMutation, { id }, { action: true }),
    ]);
    const successfulResponses = [approved, rejected].filter(
      (response) => !response.body.errors,
    );
    expect(successfulResponses).toHaveLength(1);

    const terminal = await prisma.companyAccessRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(["APPROVED", "REJECTED"]).toContain(terminal.status);
    expect(await prisma.organizationMembership.count()).toBe(0);
    if (terminal.status === "APPROVED") {
      expect(await prisma.organization.count()).toBe(1);
      expect(await prisma.organizationMembershipInvitation.count()).toBe(1);
    } else {
      expect(await prisma.organization.count()).toBe(0);
      expect(await prisma.organizationMembershipInvitation.count()).toBe(0);
    }
  });

  it("does not approve rejected, disabled, or duplicate approved bootstraps", async () => {
    await submitCompany().expect(202);
    const rejectedId = await pendingRequestId();
    const rejected = await platformGraphql(
      `mutation Reject($id: String!) {
        rejectCompanyAccessRequest(id: $id, rejectionCode: NOT_ELIGIBLE) { status }
      }`,
      { id: rejectedId },
      { action: true },
    ).expect(200);
    expect(rejected.body.data.rejectCompanyAccessRequest.status).toBe(
      "REJECTED",
    );
    expect(
      (
        await platformGraphql(
          approvalMutation,
          { id: rejectedId },
          { action: true },
        )
      ).body.errors,
    ).toBeDefined();

    const disabled = await prisma.companyAccessRequest.create({
      data: {
        company_name: "Disabled Synthetic",
        contact_name: "Contact",
        business_email: "disabled@example.test",
        normalized_business_email: "disabled@example.test",
        status: "DISABLED",
        disabled_at: new Date(),
      },
    });
    expect(
      (
        await platformGraphql(
          approvalMutation,
          { id: disabled.id },
          { action: true },
        )
      ).body.errors,
    ).toBeDefined();

    await submitCompany("bootstrap@example.test", "First Bootstrap").expect(
      202,
    );
    const firstId = await pendingRequestId();
    await platformGraphql(
      approvalMutation,
      { id: firstId },
      { action: true },
    ).expect(200);
    await submitCompany("bootstrap@example.test", "Second Bootstrap").expect(
      202,
    );
    const second = await prisma.companyAccessRequest.findFirstOrThrow({
      where: {
        normalized_business_email: "bootstrap@example.test",
        status: "PENDING_APPROVAL",
      },
    });
    const duplicateApproval = await platformGraphql(
      approvalMutation,
      { id: second.id },
      { action: true },
    ).expect(200);
    expect(duplicateApproval.body.errors).toBeDefined();
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.organizationMembership.count()).toBe(0);
  });
});
