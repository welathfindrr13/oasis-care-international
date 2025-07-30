import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '@oasis/db';
import { execSync } from 'child_process';
import { getBearerToken, getTestJwtSecret, TEST_USERS } from './jwt.mock';
import { createTestFixtures, cleanDatabase } from './fixtures';
import { AppModule } from '../src/app.module';
import { MockAuthGuard } from './auth.guard.mock';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';

describe('Stats E2E Tests', () => {
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
      imports: [AppModule],
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
      // Override the mock to simulate a carer role
      jest.spyOn(MockAuthGuard.prototype, 'canActivate').mockImplementationOnce((context) => {
        const request = context.switchToHttp().getRequest();
        request.user = {
          sub: '123',
          email: 'carer@example.com',
          realm_access: { roles: ['carer'] },
        };
        return true;
      });

      return request(app.getHttpServer())
        .get('/stats/today')
        .expect(403);
    });

    it('should return today stats for admin users', () => {
      // Override the mock to simulate an admin role
      jest.spyOn(MockAuthGuard.prototype, 'canActivate').mockImplementationOnce((context) => {
        const request = context.switchToHttp().getRequest();
        request.user = {
          sub: '123',
          email: 'admin@example.com',
          realm_access: { roles: ['admin'] },
        };
        return true;
      });

      return request(app.getHttpServer())
        .get('/stats/today')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            booked: 2,    // Two visits created today
            finished: 2,  // Two visits finished today (one created today, one created yesterday)
          });
        });
    });

    it('should return 401 for unauthenticated requests', () => {
      // Override the mock to simulate no authentication
      jest.spyOn(MockAuthGuard.prototype, 'canActivate').mockImplementationOnce(() => false);

      return request(app.getHttpServer())
        .get('/stats/today')
        .expect(401);
    });
  });
});
