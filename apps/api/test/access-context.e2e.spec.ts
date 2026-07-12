import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "@oasis/auth";
import { PrismaService } from "@oasis/db";
import request from "supertest";
import { StartedTestContainer } from "testcontainers";
import { AuthAccessModule } from "../src/auth/auth-access.module";
import { AccessContextService } from "../src/auth/access-context.service";
import { AiSummaryResolver } from "../src/ai-summary/ai-summary.resolver";
import { AiSummaryService } from "../src/ai-summary/ai-summary.service";
import { VisitResolver } from "../src/visit/visit.resolver";
import { VisitService } from "../src/visit/visit.service";
import { generateTestToken, getTestJwtSecret } from "./jwt.mock";
import { startPostgres } from "./utils/test-container";

describe("canonical viewer access snapshot", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;
  const aiSummaryService = {
    listPendingSummaries: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const visitService = {
    startVisit: jest.fn().mockResolvedValue({ id: "visit-capability-probe" }),
  };

  const organizationId = "access-context-org";
  const otherOrganizationId = "access-context-other-org";
  const subject = "access-context-subject";

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.JWT_SECRET = getTestJwtSecret();
    process.env.NODE_ENV = "test";
    process.env.AUTH_IDENTITY_PROVIDER = "cognito";

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
        { provide: AiSummaryService, useValue: aiSummaryService },
        VisitResolver,
        { provide: VisitService, useValue: visitService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    aiSummaryService.listPendingSummaries.mockClear();
    visitService.startVisit.mockClear();
    await prisma.accessGrant.deleteMany();
    await prisma.careRoomMembership.deleteMany();
    await prisma.careRoom.deleteMany();
    await prisma.familyContact.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.client.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: "Canonical Access" },
        { id: otherOrganizationId, name: "Canonical Access Other" },
      ],
    });
  });

  function bearer(
    tokenRole: string,
    tokenOrganizationId = organizationId,
  ): string {
    return `Bearer ${generateTestToken({
      sub: subject,
      preferred_username: "access.context",
      organization_id: tokenOrganizationId,
      realm_access: { roles: [tokenRole] },
    })}`;
  }

  function querySnapshot(tokenRole = "user") {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", bearer(tokenRole))
      .send({
        query: `
          query ViewerAccessSnapshot {
            viewerAccessSnapshot {
              authenticated
              organizationId
              effectiveRole
              membershipState
              surface
              linkedIdentityState
              onboardingState
              capabilities
            }
          }
        `,
      });
  }

  function queryPendingSummaries(tokenRole: string) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", bearer(tokenRole))
      .send({
        query: `
          query PendingAiSummaries {
            listPendingSummaries {
              total
            }
          }
        `,
      });
  }

  function startVisit(tokenRole: string) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", bearer(tokenRole))
      .send({
        query: `
          mutation StartAssignedVisit {
            startVisit(visitId: "visit-capability-probe") {
              id
            }
          }
        `,
      });
  }

  async function createMembershipForRole(role: string): Promise<void> {
    let carerId: string | undefined;
    if (role === "carer" || role === "staff") {
      const carer = await prisma.carer.create({
        data: {
          organization_id: organizationId,
          first_name: "Capability",
          last_name: "Carer",
          email: "capability.carer@example.test",
        },
      });
      carerId = carer.id;
    }
    if (role === "family") {
      const client = await prisma.client.create({
        data: {
          organization_id: organizationId,
          full_name: "Capability Family Person",
          address_line1: "1 Test Street",
          city: "Leeds",
          postcode: "LS1 1AA",
        },
      });
      const room = await prisma.careRoom.create({
        data: { organization_id: organizationId, client_id: client.id },
      });
      const contact = await prisma.familyContact.create({
        data: {
          organization_id: organizationId,
          auth_subject: subject,
          full_name: "Capability Relative",
          email: "capability.family@example.test",
          identity_type: "cognito",
        },
      });
      const roomMembership = await prisma.careRoomMembership.create({
        data: {
          care_room_id: room.id,
          family_contact_id: contact.id,
          role: "FAMILY_VIEWER",
          status: "ACTIVE",
          access_basis: "CLIENT_CONSENT",
          accepted_at: new Date(),
        },
      });
      await prisma.accessGrant.create({
        data: {
          care_room_membership_id: roomMembership.id,
          scope: "VIEW_UPDATES",
        },
      });
    }
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: `capability.${role}@example.test`,
        role,
        status: "ACTIVE",
        carer_id: carerId,
      },
    });
  }

  it("uses the linked database Carer when the token falsely claims admin", async () => {
    const carer = await prisma.carer.create({
      data: {
        organization_id: organizationId,
        first_name: "Canonical",
        last_name: "Carer",
        email: "canonical.carer@example.test",
      },
    });
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: "canonical.carer@example.test",
        role: "carer",
        status: "ACTIVE",
        carer_id: carer.id,
      },
    });

    const response = await querySnapshot("admin").expect(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.viewerAccessSnapshot).toEqual({
      authenticated: true,
      organizationId,
      effectiveRole: "carer",
      membershipState: "ACTIVE",
      surface: "STAFF",
      linkedIdentityState: "LINKED",
      onboardingState: "READY",
      capabilities: [
        "PROFILE_HELP_VIEW",
        "FRONTLINE_SHIFT_VIEW",
        "FRONTLINE_SHIFT_EXECUTE",
        "FRONTLINE_ASSIGNED_VISITS_VIEW",
        "FRONTLINE_VISIT_EXECUTE",
      ],
    });
  });

  it("uses the database admin membership when the token falsely claims family access", async () => {
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: "canonical.admin@example.test",
        role: "admin",
        status: "ACTIVE",
      },
    });

    const response = await querySnapshot("client").expect(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.viewerAccessSnapshot).toMatchObject({
      effectiveRole: "admin",
      membershipState: "ACTIVE",
      surface: "ADMIN",
      onboardingState: "READY",
    });
  });

  it("publishes capabilities from the database manager role, not conflicting token claims", async () => {
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: "canonical.manager@example.test",
        role: "manager",
        status: "ACTIVE",
      },
    });

    const response = await querySnapshot("admin").expect(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.viewerAccessSnapshot).toMatchObject({
      effectiveRole: "manager",
      surface: "STAFF",
      capabilities: ["PROFILE_HELP_VIEW", "AI_SUMMARY_REVIEW", "GDPR_MANAGE"],
    });
    expect(response.body.data.viewerAccessSnapshot.capabilities).not.toContain(
      "TENANT_ADMIN",
    );
    expect(response.body.data.viewerAccessSnapshot.capabilities).not.toContain(
      "FRONTLINE_VISIT_EXECUTE",
    );
  });

  it.each([
    ["admin", "carer", true],
    ["manager", "carer", true],
    ["care_manager", "admin", false],
    ["office", "admin", false],
    ["carer", "admin", false],
    ["staff", "admin", false],
    ["family", "admin", false],
  ] as const)(
    "enforces AI review for database role %s despite token role %s",
    async (databaseRole, tokenRole, allowed) => {
      await createMembershipForRole(databaseRole);

      const response = await queryPendingSummaries(tokenRole).expect(200);
      if (allowed) {
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.listPendingSummaries).toEqual({ total: 0 });
        expect(aiSummaryService.listPendingSummaries).toHaveBeenCalledTimes(1);
      } else {
        expect(response.body.data?.listPendingSummaries ?? null).toBeNull();
        expect(response.body.errors?.[0]?.message).toBeDefined();
        expect(aiSummaryService.listPendingSummaries).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ["carer", "admin", true],
    ["staff", "admin", true],
    ["admin", "carer", false],
    ["manager", "carer", false],
    ["care_manager", "admin", false],
    ["office", "admin", false],
    ["family", "admin", false],
  ] as const)(
    "enforces frontline visit execution for database role %s despite token role %s",
    async (databaseRole, tokenRole, allowed) => {
      await createMembershipForRole(databaseRole);

      const response = await startVisit(tokenRole).expect(200);
      if (allowed) {
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.startVisit).toEqual({
          id: "visit-capability-probe",
        });
        expect(visitService.startVisit).toHaveBeenCalledTimes(1);
      } else {
        expect(response.body.data?.startVisit ?? null).toBeNull();
        expect(response.body.errors?.[0]?.message).toBeDefined();
        expect(visitService.startVisit).not.toHaveBeenCalled();
      }
    },
  );

  it("derives aliased snapshot fields from one immutable request snapshot", async () => {
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: "canonical.admin@example.test",
        role: "admin",
        status: "ACTIVE",
      },
    });
    const service = app.get(AccessContextService);
    const resolve = jest.spyOn(service, "resolve");

    const response = await request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", bearer("user"))
      .send({
        query: `
          query RepeatedViewerAccessSnapshot {
            first: viewerAccessSnapshot { surface effectiveRole }
            second: viewerAccessSnapshot { surface effectiveRole }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.first).toEqual(response.body.data.second);
    expect(resolve).toHaveBeenCalledTimes(1);
    resolve.mockRestore();
  });

  it.each([
    ["missing", async () => undefined, "MISSING"],
    [
      "inactive",
      async () =>
        prisma.organizationMembership.create({
          data: {
            organization_id: organizationId,
            identity_provider: "cognito",
            auth_subject: subject,
            normalized_email: "inactive@example.test",
            role: "admin",
            status: "SUSPENDED",
          },
        }),
      "INACTIVE",
    ],
  ])(
    "returns a safe non-permitted snapshot for %s membership state",
    async (_label, seed, membershipState) => {
      await seed();
      const response = await querySnapshot("admin").expect(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.viewerAccessSnapshot).toEqual({
        authenticated: true,
        organizationId: null,
        effectiveRole: null,
        membershipState,
        surface: "NONE",
        linkedIdentityState: "NOT_REQUIRED",
        onboardingState:
          membershipState === "MISSING" ? "NOT_STARTED" : "BLOCKED",
        capabilities: [],
      });
      expect(JSON.stringify(response.body)).not.toContain(subject);
      expect(JSON.stringify(response.body)).not.toContain("Prisma");
    },
  );

  it("prevents one authenticated subject from gaining two active organizations", async () => {
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: "cognito",
        auth_subject: subject,
        normalized_email: "multiple@example.test",
        role: "admin",
        status: "ACTIVE",
      },
    });

    await expect(
      prisma.organizationMembership.create({
        data: {
          organization_id: otherOrganizationId,
          identity_provider: "cognito",
          auth_subject: subject,
          normalized_email: "multiple@example.test",
          role: "admin",
          status: "ACTIVE",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
