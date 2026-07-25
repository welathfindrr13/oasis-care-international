import { INestApplication, Module, UseGuards } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule, Query, Resolver } from "@nestjs/graphql";
import { JwtStrategy } from "@oasis/auth";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { json } from "express";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { Public } from "./public.decorator";
import { createGraphQLAuthenticationMiddleware } from "./graphql-authentication.middleware";
import { GqlJwtAuthGuard } from "./gql-jwt-auth.guard";

const JWT_SECRET = "test-secret-key-for-oasis-testing-only";

@Resolver()
@UseGuards(GqlJwtAuthGuard)
class GuardedTestResolver {
  @Query(() => String)
  guardedValue(): string {
    return "available";
  }

  @Public()
  @Query(() => String)
  publicValue(): string {
    return "public";
  }
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({ secret: JWT_SECRET }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      introspection: true,
      playground: false,
    }),
  ],
  providers: [
    JwtStrategy,
    GqlJwtAuthGuard,
    GuardedTestResolver,
    {
      provide: APP_GUARD,
      useExisting: GqlJwtAuthGuard,
    },
  ],
})
class GraphQLAuthenticationTestModule {}

describe("GraphQL authentication boundary", () => {
  let app: INestApplication;
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    AUTH_IDENTITY_PROVIDER: process.env.AUTH_IDENTITY_PROVIDER,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.AUTH_IDENTITY_PROVIDER = "cognito";

    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLAuthenticationTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(json());
    app.use("/graphql", createGraphQLAuthenticationMiddleware());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("rejects unauthenticated introspection with one stable GraphQL error", async () => {
    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({ query: "{ __schema { queryType { name } } }" })
      .expect(200);

    expect(response.body.data).toBeNull();
    expect(response.body.errors).toEqual([
      {
        message: "Authentication required",
        extensions: { code: "UNAUTHENTICATED" },
      },
    ]);
  });

  it("rejects unauthenticated introspection hidden behind a fragment", async () => {
    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query:
          "query Tooling { ...SchemaFields } fragment SchemaFields on Query { __schema { queryType { name } } }",
      })
      .expect(200);

    expect(response.body.errors).toEqual([
      {
        message: "Authentication required",
        extensions: { code: "UNAUTHENTICATED" },
      },
    ]);
  });

  it("allows authenticated introspection and repeated resolver guards without duplicate errors", async () => {
    const token = sign(
      {
        sub: "authenticated-test-user",
        "cognito:groups": ["admin"],
      },
      JWT_SECRET,
      { expiresIn: "5m" },
    );
    const guardSpy = jest.spyOn(GqlJwtAuthGuard.prototype, "canActivate");

    const introspection = await request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "{ __schema { queryType { name } } }" })
      .expect(200);
    expect(introspection.body.errors).toBeUndefined();
    expect(introspection.body.data?.__schema?.queryType?.name).toBe("Query");

    guardSpy.mockClear();
    const operation = await request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "{ guardedValue }" })
      .expect(200);

    expect(operation.body).toEqual({ data: { guardedValue: "available" } });
    expect(guardSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    guardSpy.mockRestore();
  });

  it("does not block an explicitly public GraphQL operation at the transport boundary", async () => {
    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({ query: "{ publicValue }" })
      .expect(200);

    expect(response.body).toEqual({ data: { publicValue: "public" } });
  });
});
