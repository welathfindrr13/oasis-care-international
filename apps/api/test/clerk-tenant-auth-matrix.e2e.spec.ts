import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "@oasis/auth";
import { PrismaService, VisitStatus } from "@oasis/db";
import { ClsModule } from "nestjs-cls";
import request from "supertest";
import { StartedTestContainer } from "testcontainers";
import { AiSummaryRepository } from "../src/ai-summary/ai-summary.repository";
import { AiSummaryResolver } from "../src/ai-summary/ai-summary.resolver";
import { AiSummaryService } from "../src/ai-summary/ai-summary.service";
import { AuthAccessModule } from "../src/auth/auth-access.module";
import { CareLogService } from "../src/care-log/care-log.service";
import { MedicationRepository } from "../src/medication/medication.repository";
import { VisitRepository } from "../src/visit/visit.repository";
import { VisitResolver } from "../src/visit/visit.resolver";
import { VisitService } from "../src/visit/visit.service";
import { getTestJwtSecret } from "./jwt.mock";
import {
  configureSyntheticClerkAuth,
  syntheticClerkBearer,
} from "./utils/clerk-auth-fixture";
import { startPostgres } from "./utils/test-container";

describe("synthetic Clerk tenant and authorization matrix", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;

  const organizationId = "clerk-matrix-organization";
  const externalOrganizationId = "org_clerk_matrix";
  const otherOrganizationId = "clerk-matrix-other-organization";
  const otherExternalOrganizationId = "org_clerk_matrix_other";

  const managerSubject = "user_clerk_matrix_manager";
  const carerSubject = "user_clerk_matrix_carer";
  const otherCarerSubject = "user_clerk_matrix_other_carer";

  const assignedCarerId = "10000000-0000-4000-8000-000000000001";
  const otherCarerId = "10000000-0000-4000-8000-000000000002";
  const crossOrganizationCarerId = "10000000-0000-4000-8000-000000000003";
  const clientId = "20000000-0000-4000-8000-000000000001";
  const otherClientId = "20000000-0000-4000-8000-000000000002";
  const assignedVisitId = "30000000-0000-4000-8000-000000000001";
  const unassignedVisitId = "30000000-0000-4000-8000-000000000002";
  const crossOrganizationVisitId = "30000000-0000-4000-8000-000000000003";
  const ownSummaryId = "40000000-0000-4000-8000-000000000001";
  const otherSummaryId = "40000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    configureSyntheticClerkAuth();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls) => cls.set("requestId", "clerk-auth-matrix"),
          },
        }),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({ secret: getTestJwtSecret() }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: false,
          context: ({ req }: any) => ({ req }),
        }),
        AuthAccessModule,
      ],
      providers: [
        JwtStrategy,
        AiSummaryResolver,
        AiSummaryService,
        AiSummaryRepository,
        MedicationRepository,
        VisitResolver,
        VisitService,
        VisitRepository,
        // Care-note creation is unrelated to the startVisit authorization path.
        { provide: CareLogService, useValue: { createCareLog: jest.fn() } },
        // Metrics are inert collaborators; repository and service behavior stays real.
        { provide: "visit_overlap_total", useValue: { inc: jest.fn() } },
        { provide: "visits_created_total", useValue: { inc: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanMatrixData();
    await seedMatrixData();
  });

  function bearer(
    subject: string,
    tokenOrganizationId = externalOrganizationId,
    organizationRole = "org:member",
  ): string {
    return syntheticClerkBearer({
      subject,
      externalOrganizationId: tokenOrganizationId,
      organizationRole,
    });
  }

  function graphql(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", token)
      .send({ query, variables });
  }

  async function cleanMatrixData(): Promise<void> {
    await prisma.healthSummary.deleteMany();
    await prisma.visitTask.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.client.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.organization.deleteMany();
  }

  async function seedMatrixData(): Promise<void> {
    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: "Synthetic Clerk Matrix" },
        { id: otherOrganizationId, name: "Synthetic Clerk Matrix Other" },
      ],
    });
    await prisma.carer.createMany({
      data: [
        {
          id: assignedCarerId,
          organization_id: organizationId,
          first_name: "Assigned",
          last_name: "Carer",
          email: "assigned.clerk.matrix@example.test",
        },
        {
          id: otherCarerId,
          organization_id: organizationId,
          first_name: "Other",
          last_name: "Carer",
          email: "other.clerk.matrix@example.test",
        },
        {
          id: crossOrganizationCarerId,
          organization_id: otherOrganizationId,
          first_name: "Cross tenant",
          last_name: "Carer",
          email: "cross-tenant.clerk.matrix@example.test",
        },
      ],
    });
    await prisma.client.createMany({
      data: [
        {
          id: clientId,
          organization_id: organizationId,
          full_name: "Own tenant client",
          address_line1: "1 Test Street",
          city: "Leeds",
          postcode: "LS1 1AA",
        },
        {
          id: otherClientId,
          organization_id: otherOrganizationId,
          full_name: "Other tenant client",
          address_line1: "2 Test Street",
          city: "Leeds",
          postcode: "LS1 1AB",
        },
      ],
    });
    await prisma.visit.createMany({
      data: [
        {
          id: assignedVisitId,
          organization_id: organizationId,
          carer_id: assignedCarerId,
          client_id: clientId,
          scheduled_start: new Date("2026-07-13T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T10:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
        {
          id: unassignedVisitId,
          organization_id: organizationId,
          carer_id: otherCarerId,
          client_id: clientId,
          scheduled_start: new Date("2026-07-13T10:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T11:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
        {
          id: crossOrganizationVisitId,
          organization_id: otherOrganizationId,
          carer_id: crossOrganizationCarerId,
          client_id: otherClientId,
          scheduled_start: new Date("2026-07-13T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T10:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
      ],
    });
    await prisma.healthSummary.createMany({
      data: [
        {
          id: ownSummaryId,
          client_id: clientId,
          period_start: new Date("2026-07-06T00:00:00.000Z"),
          period_end: new Date("2026-07-12T00:00:00.000Z"),
          summary_json: { overview: "own tenant summary" },
          risk_levels: { overall: "green" },
          generated_at: new Date("2026-07-13T08:00:00.000Z"),
          expires_at: new Date("2099-01-01T00:00:00.000Z"),
        },
        {
          id: otherSummaryId,
          client_id: otherClientId,
          period_start: new Date("2026-07-06T00:00:00.000Z"),
          period_end: new Date("2026-07-12T00:00:00.000Z"),
          summary_json: { overview: "other tenant summary" },
          risk_levels: { overall: "green" },
          generated_at: new Date("2026-07-13T08:00:00.000Z"),
          expires_at: new Date("2099-01-01T00:00:00.000Z"),
        },
      ],
    });
    await prisma.$transaction([
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: managerSubject,
          normalized_email: "manager.clerk.matrix@example.test",
          role: "manager",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_manager",
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: carerSubject,
          normalized_email: "assigned.clerk.matrix@example.test",
          role: "carer",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_carer",
          carer_id: assignedCarerId,
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: otherCarerSubject,
          normalized_email: "other.clerk.matrix@example.test",
          role: "carer",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_other_carer",
          carer_id: otherCarerId,
        },
      }),
    ]);
  }

  const managerAndPendingSummariesQuery = `
    query ManagerTenantProof {
      viewerAccessSnapshot {
        effectiveRole
        membershipState
        organizationId
        surface
        capabilities
      }
      listPendingSummaries {
        items {
          id
          clientId
        }
        total
      }
    }
  `;

  const startVisitMutation = `
    mutation StartVisit($visitId: String!) {
      startVisit(visitId: $visitId) {
        id
        carerId
        status
      }
    }
  `;

  it("uses Manager database authority and returns only own-tenant data despite an admin token role", async () => {
    const response = await graphql(
      bearer(managerSubject, externalOrganizationId, "org:admin"),
      managerAndPendingSummariesQuery,
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.viewerAccessSnapshot).toMatchObject({
      effectiveRole: "manager",
      membershipState: "ACTIVE",
      organizationId,
      surface: "STAFF",
      capabilities: ["PROFILE_HELP_VIEW", "AI_SUMMARY_REVIEW", "GDPR_MANAGE"],
    });
    expect(response.body.data.viewerAccessSnapshot.capabilities).not.toContain(
      "TENANT_ADMIN",
    );
    expect(response.body.data.listPendingSummaries).toEqual({
      items: [{ id: ownSummaryId, clientId }],
      total: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain(otherSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(otherClientId);
  });

  it("denies Manager direct GraphQL data access when the Clerk organization claim conflicts", async () => {
    const token = bearer(
      managerSubject,
      otherExternalOrganizationId,
      "org:admin",
    );
    const snapshot = await graphql(
      token,
      `
        query MismatchedManagerSnapshot {
          viewerAccessSnapshot {
            effectiveRole
            membershipState
            organizationId
            surface
            capabilities
          }
        }
      `,
    ).expect(200);

    expect(snapshot.body.errors).toBeUndefined();
    expect(snapshot.body.data.viewerAccessSnapshot).toEqual({
      effectiveRole: null,
      membershipState: "ORGANIZATION_MISMATCH",
      organizationId: null,
      surface: "NONE",
      capabilities: [],
    });

    const response = await graphql(
      token,
      `
        query DeniedManagerTenantData {
          listPendingSummaries {
            items {
              id
              clientId
            }
            total
          }
        }
      `,
    ).expect(200);

    expect(response.body.data?.listPendingSummaries ?? null).toBeNull();
    expect(response.body.errors).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain(ownSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(otherSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(managerSubject);
  });

  it("allows the linked assigned Carer through the real visit repository and service", async () => {
    const response = await graphql(
      bearer(carerSubject, externalOrganizationId, "org:admin"),
      startVisitMutation,
      { visitId: assignedVisitId },
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.startVisit).toEqual({
      id: assignedVisitId,
      carerId: assignedCarerId,
      status: "IN_PROGRESS",
    });
    await expect(
      prisma.visit.findUniqueOrThrow({ where: { id: assignedVisitId } }),
    ).resolves.toMatchObject({
      status: VisitStatus.IN_PROGRESS,
      carer_id: assignedCarerId,
    });
  });

  it.each([
    ["unassigned visit", carerSubject, unassignedVisitId],
    ["another Carer assignment", otherCarerSubject, assignedVisitId],
  ])(
    "denies %s without changing the visit",
    async (_label, subject, visitId) => {
      const response = await graphql(bearer(subject), startVisitMutation, {
        visitId,
      }).expect(200);

      expect(response.body.data?.startVisit ?? null).toBeNull();
      expect(response.body.errors).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain(clientId);
      await expect(
        prisma.visit.findUniqueOrThrow({ where: { id: visitId } }),
      ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
    },
  );

  it("makes a cross-organization visit identifier indistinguishable from a missing identifier", async () => {
    const token = bearer(carerSubject);
    const crossOrganization = await graphql(token, startVisitMutation, {
      visitId: crossOrganizationVisitId,
    }).expect(200);
    const missing = await graphql(token, startVisitMutation, {
      visitId: "30000000-0000-4000-8000-999999999999",
    }).expect(200);

    expect(crossOrganization.body.data?.startVisit ?? null).toBeNull();
    expect(missing.body.data?.startVisit ?? null).toBeNull();
    expect(crossOrganization.body.errors).toHaveLength(1);
    expect(crossOrganization.body.errors[0].message).toBe(
      missing.body.errors[0].message,
    );
    expect(JSON.stringify(crossOrganization.body)).not.toContain(otherClientId);
    expect(JSON.stringify(crossOrganization.body)).not.toContain(
      crossOrganizationCarerId,
    );
    await expect(
      prisma.visit.findUniqueOrThrow({
        where: { id: crossOrganizationVisitId },
      }),
    ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
  });

  it("denies the same Clerk token immediately after membership revocation", async () => {
    const token = bearer(carerSubject);
    const beforeRevocation = await graphql(
      token,
      `
        query ActiveBeforeRevocation {
          viewerAccessSnapshot {
            membershipState
            effectiveRole
          }
        }
      `,
    ).expect(200);
    expect(beforeRevocation.body.data.viewerAccessSnapshot).toEqual({
      membershipState: "ACTIVE",
      effectiveRole: "carer",
    });

    await prisma.organizationMembership.updateMany({
      where: {
        identity_provider: "clerk",
        auth_subject: carerSubject,
        organization_id: organizationId,
      },
      data: { status: "REVOKED", revoked_at: new Date() },
    });

    const afterRevocation = await graphql(
      token,
      `
        query RevokedAccess {
          viewerAccessSnapshot {
            membershipState
            effectiveRole
            capabilities
          }
        }
      `,
    ).expect(200);
    expect(afterRevocation.body.data.viewerAccessSnapshot).toEqual({
      membershipState: "INACTIVE",
      effectiveRole: null,
      capabilities: [],
    });

    const mutation = await graphql(token, startVisitMutation, {
      visitId: assignedVisitId,
    }).expect(200);
    expect(mutation.body.data?.startVisit ?? null).toBeNull();
    expect(mutation.body.errors).toHaveLength(1);
    await expect(
      prisma.visit.findUniqueOrThrow({ where: { id: assignedVisitId } }),
    ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
  });
});
