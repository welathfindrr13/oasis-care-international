import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '@oasis/db';
import { VisitModule } from '../src/visit/visit.module';
import { ClsModule } from 'nestjs-cls';
import { execSync } from 'child_process';
import { getBearerToken, getTestJwtSecret, TEST_USERS } from './jwt.mock';
import { createTestFixtures, cleanDatabase } from './fixtures';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@oasis/auth';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RolesGuard } from '@oasis/auth';
import { MockAuthGuard } from './auth.guard.mock';
import { AuthGuard } from '@nestjs/passport';
import { formatGraphQLError } from '../src/common/filters/graphql-error.filter';
import { GraphqlExceptionFilter } from '../src/common/filters/gql-exception.filter';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Visit E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postgresContainer: StartedPostgreSqlContainer;
  let fixtures: any;

  beforeAll(async () => {
    // Start PostgreSQL container with specific version for reproducibility
    postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('oasis_test')
      .withUsername('test')
      .withPassword('test')
      .withStartupTimeout(120000) // 2 minutes
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
    
    // Apply global filters
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new GraphqlExceptionFilter(),
    );
    
    // Initialize Passport
    const passport = require('passport');
    app.use(passport.initialize());
    
    await app.init();

    // Create test fixtures
    fixtures = await createTestFixtures(prisma);
  }, 180000); // 3 minutes total timeout

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

  describe('Visit Creation', () => {
    it('should create a visit successfully as admin', async () => {
      const createVisitInput = {
        carerId: fixtures.carers.carer.id,
        clientId: fixtures.clients.client.id,
        scheduledStart: '2024-02-15T09:00:00Z',
        scheduledEnd: '2024-02-15T10:00:00Z',
        notes: 'New test visit',
        tasks: [
          {
            taskName: 'Health Check',
            description: 'Check vital signs',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation CreateVisit($input: CreateVisitInput!) {
              createVisit(input: $input) {
                id
                carerId
                clientId
                scheduledStart
                scheduledEnd
                status
                notes
                carer {
                  id
                  firstName
                  lastName
                }
                client {
                  id
                  fullName
                }
                tasks {
                  id
                  taskName
                  description
                  isCompleted
                }
              }
            }
          `,
          variables: { input: createVisitInput },
        })
        .expect(200);

      expect(response.body.data.createVisit).toMatchObject({
        carerId: fixtures.carers.carer.id,
        clientId: fixtures.clients.client.id,
        status: 'SCHEDULED',
        notes: 'New test visit',
      });
      expect(response.body.data.createVisit.tasks).toHaveLength(1);
      expect(response.body.data.createVisit.carer.firstName).toBe('Jane');
      expect(response.body.data.createVisit.client.fullName).toBe('Mary Jones');
    });

    it('should prevent overlapping visits for same carer', async () => {
      // The fixture already has a visit from 09:00-10:00
      const overlappingInput = {
        carerId: fixtures.carers.carer.id,
        clientId: fixtures.clients.client.id,
        scheduledStart: '2024-02-01T09:30:00Z',
        scheduledEnd: '2024-02-01T10:30:00Z',
      };

      const response = await request(app.getHttpServer())
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
          variables: { input: overlappingInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('already has a visit scheduled');
      expect(response.body.errors[0].extensions.code).toBe('VISIT_OVERLAP');
    });
  });

  describe('Visit Query - RBAC', () => {
    it('should allow carer to view only their own visits', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query GetVisits {
              visits {
                items {
                  id
                  carerId
                  clientId
                  status
                }
                total
              }
            }
          `,
        })
        .expect(200);

      // Should only see their own visits
      expect(response.body.data.visits.items).toHaveLength(2);
      response.body.data.visits.items.forEach((visit: any) => {
        expect(visit.carerId).toBe(TEST_USERS.carer.sub);
      });
    });

    it('should allow client to view only their visits (read-only)', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('client'))
        .send({
          query: `
            query GetVisits {
              visits {
                items {
                  id
                  carerId
                  clientId
                  status
                  carer {
                    firstName
                    lastName
                  }
                }
                total
              }
            }
          `,
        })
        .expect(200);

      // Should only see visits where they are the client
      expect(response.body.data.visits.items).toHaveLength(1);
      expect(response.body.data.visits.items[0].clientId).toBe(TEST_USERS.client.sub);
    });

    it('should prevent client from creating visits', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('client'))
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
              scheduledStart: '2024-02-20T09:00:00Z',
              scheduledEnd: '2024-02-20T10:00:00Z',
            },
          },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Forbidden');
    });
  });

  describe('Task Completion', () => {
    it('should allow carer to complete their visit tasks', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;
      
      // First get the task ID
      const getVisitResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query GetVisit($id: String!) {
              visit(id: $id) {
                id
                tasks {
                  id
                  taskName
                  isCompleted
                }
              }
            }
          `,
          variables: { id: visitId },
        })
        .expect(200);

      const taskId = getVisitResponse.body.data.visit.tasks[0].id;

      // Complete the task
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation CompleteTask($taskId: String!, $notes: String) {
              completeVisitTask(taskId: $taskId, notes: $notes) {
                id
                isCompleted
                completedAt
                notes
              }
            }
          `,
          variables: {
            taskId,
            notes: 'Medication given at 09:15',
          },
        })
        .expect(200);

      expect(response.body.data.completeVisitTask).toMatchObject({
        id: taskId,
        isCompleted: true,
        notes: 'Medication given at 09:15',
      });
      expect(response.body.data.completeVisitTask.completedAt).toBeDefined();
    });

    it('should prevent other carers from completing tasks', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;
      
      // Get task ID first
      const getVisitResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            query GetVisit($id: String!) {
              visit(id: $id) {
                id
                tasks {
                  id
                }
              }
            }
          `,
          variables: { id: visitId },
        })
        .expect(200);

      const taskId = getVisitResponse.body.data.visit.tasks[0].id;

      // Try to complete as different carer
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('otherCarer'))
        .send({
          query: `
            mutation CompleteTask($taskId: String!) {
              completeVisitTask(taskId: $taskId) {
                id
              }
            }
          `,
          variables: { taskId },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('only access your own visits');
    });
  });

  describe('Visit Updates', () => {
    it('should update visit schedule without conflicts', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation UpdateVisit($input: UpdateVisitInput!) {
              updateVisit(input: $input) {
                id
                scheduledStart
                scheduledEnd
                status
              }
            }
          `,
          variables: {
            input: {
              id: visitId,
              scheduledStart: '2024-02-01T11:00:00Z',
              scheduledEnd: '2024-02-01T12:00:00Z',
              status: 'IN_PROGRESS',
            },
          },
        })
        .expect(200);

      expect(response.body.data.updateVisit).toMatchObject({
        id: visitId,
        status: 'IN_PROGRESS',
      });
    });

    it('should prevent update if it creates overlap', async () => {
      // Create another visit for the same carer
      await prisma.visit.create({
        data: {
          carer_id: fixtures.carers.carer.id,
          client_id: fixtures.clients.otherClient.id,
          scheduled_start: new Date('2024-02-01T11:00:00Z'),
          scheduled_end: new Date('2024-02-01T12:00:00Z'),
          status: 'SCHEDULED',
        },
      });

      const visitId = fixtures.visits.scheduledVisit.id;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation UpdateVisit($input: UpdateVisitInput!) {
              updateVisit(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: {
              id: visitId,
              scheduledStart: '2024-02-01T10:30:00Z',
              scheduledEnd: '2024-02-01T11:30:00Z',
            },
          },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('already has a visit scheduled');
      expect(response.body.errors[0].extensions.code).toBe('VISIT_OVERLAP');
    });
  });

  describe('Visit Deletion', () => {
    it('should soft delete visit as admin', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation DeleteVisit($id: String!) {
              deleteVisit(id: $id) {
                id
              }
            }
          `,
          variables: { id: visitId },
        })
        .expect(200);

      expect(response.body.data.deleteVisit.id).toBe(visitId);

      // Verify it's soft deleted
      const deletedVisit = await prisma.visit.findUnique({
        where: { id: visitId },
      });
      expect(deletedVisit?.deleted_at).toBeTruthy();

      // Verify it's not returned in queries
      const queryResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            query GetVisit($id: String!) {
              visit(id: $id) {
                id
              }
            }
          `,
          variables: { id: visitId },
        })
        .expect(200);

      expect(queryResponse.body.errors).toBeDefined();
      expect(queryResponse.body.errors[0].message).toContain('not found');
    });

    it('should prevent non-admin from deleting visits', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation DeleteVisit($id: String!) {
              deleteVisit(id: $id) {
                id
              }
            }
          `,
          variables: { id: visitId },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Forbidden');
    });
  });
});
