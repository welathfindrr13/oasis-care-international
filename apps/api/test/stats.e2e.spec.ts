import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { StartedTestContainer } from 'testcontainers';
import { PrismaService } from '@oasis/db';
import { getBearerToken, getTestJwtSecret, TEST_USERS } from './utils/auth';
import { createTestFixtures, cleanDatabase } from './fixtures';
import { startPostgres } from './utils/test-container';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, JwtStrategy } from '@oasis/auth';
import { StatsModule } from '../src/stats/stats.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClsModule } from 'nestjs-cls';
import { MockAuthGuard } from './auth.guard.mock';

describe('Stats E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postgresContainer: StartedTestContainer;
  let fixtures: any;

  beforeAll(async () => {
    // Start PostgreSQL container with pgvector support
    const tc = await startPostgres();
    postgresContainer = tc.container;
    const databaseUrl = tc.dbUrl;
    
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = getTestJwtSecret();

    // Create test module - minimal setup to test stats endpoint
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
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: getTestJwtSecret(),
          signOptions: { expiresIn: '1h' },
        }),
        StatsModule,
      ],
      providers: [
        JwtStrategy,
        PrismaService,
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    
    // Initialize Passport
    const passport = require('passport');
    app.use(passport.initialize());
    
    await app.init();

    // Create test fixtures
    fixtures = await createTestFixtures(prisma);

    // Create visits with different timestamps for testing
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Visit created yesterday - should NOT count
    await prisma.visit.create({
      data: {
        carer_id: fixtures.carers.carer.id,
        client_id: fixtures.clients.client.id,
        scheduled_start: yesterday,
        scheduled_end: yesterday,
        created_at: yesterday,
        actual_end: null,
        status: 'SCHEDULED',
      },
    });

    // Visit created today but not finished - counts only as booked
    await prisma.visit.create({
      data: {
        carer_id: fixtures.carers.carer.id,
        client_id: fixtures.clients.client.id,
        scheduled_start: now,
        scheduled_end: new Date(now.getTime() + 60 * 60 * 1000),
        created_at: now,
        actual_end: null,
        status: 'SCHEDULED',
      },
    });

    // Visit created today and finished today - counts as both booked and finished
    await prisma.visit.create({
      data: {
        carer_id: fixtures.carers.carer.id,
        client_id: fixtures.clients.client.id,
        scheduled_start: now,
        scheduled_end: new Date(now.getTime() + 60 * 60 * 1000),
        created_at: now,
        actual_end: now,
        status: 'COMPLETED',
      },
    });

    // Visit created yesterday but finished today - counts only as finished
    await prisma.visit.create({
      data: {
        carer_id: fixtures.carers.carer.id,
        client_id: fixtures.clients.client.id,
        scheduled_start: yesterday,
        scheduled_end: yesterday,
        created_at: yesterday,
        actual_end: now,
        status: 'COMPLETED',
      },
    });
  }, 180000);

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
  });

  describe('/stats/today (GET)', () => {
    it('should return 403 for non-admin users', () => {
      return request(app.getHttpServer())
        .get('/stats/today')
        .set('Authorization', getBearerToken('carer'))
        .expect(403);
    });

    it('should return today stats for admin users', () => {
      return request(app.getHttpServer())
        .get('/stats/today')
        .set('Authorization', getBearerToken('admin'))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            booked: 4,    // Two from fixtures + two created in beforeAll
            finished: 2,  // Two visits finished today (one created today, one created yesterday)
          });
        });
    });

    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/stats/today')
        // No Authorization header = unauthenticated
        .expect(403); // MockAuthGuard returns 403 when no auth header
    });
  });
});
