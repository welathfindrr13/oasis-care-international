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
import { generateTestToken, getTestJwtSecret } from "./jwt.mock";
import { startPostgres } from "./utils/test-container";

describe("canonical viewer access snapshot", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;

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
      providers: [JwtStrategy],
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
    await prisma.organizationMembership.deleteMany();
    await prisma.carer.deleteMany();
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
            }
          }
        `,
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
    [
      "multiple active",
      async () =>
        Promise.all([
          prisma.organizationMembership.create({
            data: {
              organization_id: organizationId,
              identity_provider: "cognito",
              auth_subject: subject,
              normalized_email: "multiple@example.test",
              role: "admin",
              status: "ACTIVE",
            },
          }),
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
        ]),
      "AMBIGUOUS",
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
      });
      expect(JSON.stringify(response.body)).not.toContain(subject);
      expect(JSON.stringify(response.body)).not.toContain("Prisma");
    },
  );
});
