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
    await prisma.auditLog.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.companyAccessRequest.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.organizationIdentity.deleteMany();
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

  const approvalMutation = `
    mutation Approve($id: String!) {
      approveCompanyAccessRequest(id: $id) {
        id status organizationId provisioningStatus provisioningAttemptCount provisioningErrorCode
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

  it("keeps approved internal state retryable when Clerk fails, then delivers without duplicates", async () => {
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
