import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '@oasis/db';
import { MetricsModule } from '../src/metrics/metrics.module';
import { VisitModule } from '../src/visit/visit.module';
import { ClsModule } from 'nestjs-cls';
import { execSync } from 'child_process';
import { getBearerToken, getTestJwtSecret } from './jwt.mock';
import { createTestFixtures, cleanDatabase } from './fixtures';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@oasis/auth';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { RolesGuard } from '@oasis/auth';
import { MockAuthGuard } from './auth.guard.mock';
import { AuthGuard } from '@nestjs/passport';

describe('/metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postgresContainer: StartedPostgreSqlContainer;
  let fixtures: any;

  beforeAll(async () => {
    // Start PostgreSQL container
    postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('oasis_test')
      .withUsername('test')
      .withPassword('test')
      .withStartupTimeout(120000)
      .start();

    const databaseUrl = `postgresql://test:test@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/oasis_test`;
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = getTestJwtSecret();

    // Run migrations
    execSync(`cd ../../libs/db && npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            DATABASE_URL: databaseUrl,
            JWT_SECRET: getTestJwtSecret(),
            NODE_ENV: 'test',
          })],
        }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              cls.set('requestId', `test-${Date.now()}`);
            },
          },
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'test-schema.gql'),
          sortSchema: true,
          playground: false,
          context: ({ req }: any) => ({ req }),
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: getTestJwtSecret(),
          signOptions: { expiresIn: '1h' },
        }),
        MetricsModule,
        VisitModule,
      ],
      providers: [
        JwtStrategy,
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    
    await app.init();
    await app.getHttpServer();   // ensures all async providers (Prometheus) are ready

    // Create test fixtures
    fixtures = await createTestFixtures(prisma);
  }, 180000);

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
  });

  beforeEach(async () => {
    // Clean database between tests
    await cleanDatabase(prisma);
    // Recreate fixtures for each test
    fixtures = await createTestFixtures(prisma);
  });

  it('exposes prometheus metrics and increments counters', async () => {
    // First, trigger one overlap rejection by creating a visit that overlaps with existing fixture
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', getBearerToken('admin'))
      .send({
        query: `
          mutation CreateVisit($input: CreateVisitInput!) {
            createVisit(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            carerId: fixtures.carers.carer.id,
            clientId: fixtures.clients.client.id,
            scheduledStart: '2024-02-01T09:30:00Z',
            scheduledEnd: '2024-02-01T10:30:00Z',
          },
        },
      });

    // Now check the metrics endpoint
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', getBearerToken('admin'))
      .expect(200);

    // Should contain our custom counters
    expect(res.text).toContain('visit_overlap_total');
    expect(res.text).toContain('visits_created_total');
    
    // Should contain default Node.js metrics
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('nodejs_heap_size_total_bytes');

    // The overlap counter should have been incremented
    expect(res.text).toMatch(/visit_overlap_total\s+1/);
  });

  it('should deny access to non-admin users', async () => {
    await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', getBearerToken('carer'))
      .expect(403);
  });

  it('should require authentication', async () => {
    await request(app.getHttpServer())
      .get('/metrics')
      .expect(401);
  });
});
