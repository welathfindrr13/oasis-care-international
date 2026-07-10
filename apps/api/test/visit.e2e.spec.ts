import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '@oasis/db';
import { VisitModule } from '../src/visit/visit.module';
import { VisitService } from '../src/visit/visit.service';
import { VisitResolver } from '../src/visit/visit.resolver';
import { VisitRepository } from '../src/visit/visit.repository';
import { CareLogService } from '../src/care-log/care-log.service';
import { CareLogRepository } from '../src/care-log/care-log.repository';
import { MetricsModule } from '../src/metrics/metrics.module';
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
import { CarerAccessService } from '../src/carer/carer-access.service';
import { GqlRolesGuard } from '../src/auth/gql-roles.guard';
import { ShiftResolver } from '../src/shift/shift.resolver';
import { ShiftService } from '../src/shift/shift.service';
import { ShiftRepository } from '../src/shift/shift.repository';
import { MedicationResolver } from '../src/medication/medication.resolver';
import { MedicationService } from '../src/medication/medication.service';
import { MedicationRepository } from '../src/medication/medication.repository';
import { AuthAccessModule } from '../src/auth/auth-access.module';

describe('Visit E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postgresContainer: StartedPostgreSqlContainer;
  let fixtures: any;

  beforeAll(async () => {
    // Use pgvector-enabled Postgres image because migrations require `vector` extension.
    postgresContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('oasis_test')
      .withUsername('test')
      .withPassword('test')
      .withStartupTimeout(120000) // 2 minutes
      .start();

    const databaseUrl = `postgresql://test:test@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/oasis_test`;
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = getTestJwtSecret();
    process.env.AUTH_IDENTITY_PROVIDER = 'cognito';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';

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
          load: [
            () => ({
              DATABASE_URL: databaseUrl,
              JWT_SECRET: getTestJwtSecret(),
              NODE_ENV: 'test',
            }),
          ],
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
        AuthAccessModule,
      ],
      providers: [
        JwtStrategy,
        VisitService,
        VisitResolver,
        VisitRepository,
        CareLogService,
        CareLogRepository,
        CarerAccessService,
        GqlRolesGuard,
        ShiftResolver,
        ShiftService,
        ShiftRepository,
        MedicationResolver,
        MedicationService,
        MedicationRepository,
        PrismaService,
        // Stub the Prometheus counters for testing
        { provide: 'visit_overlap_total', useValue: { inc: jest.fn() } },
        { provide: 'visits_created_total', useValue: { inc: jest.fn() } },
        { provide: 'medication_administrations_total', useValue: { inc: jest.fn() } },
        { provide: 'medication_overlaps_total', useValue: { inc: jest.fn() } },
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
    app.useGlobalFilters(new HttpExceptionFilter(), new GraphqlExceptionFilter());

    // Initialize Passport
    const passport = require('passport');
    app.use(passport.initialize());

    await app.init();

    // Create test fixtures
    fixtures = await createTestFixtures(prisma);
  }, 180000); // 3 minutes total timeout

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (postgresContainer) {
      await postgresContainer.stop();
    }
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
        expect(visit.carerId).toBe(fixtures.carers.carer.id);
      });
    });

    it('should prevent client from reading raw operational visits', async () => {
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

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toBe('Access is unavailable for this account');
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
      expect(response.body.errors[0].message).toBe('Access is unavailable for this account');
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

  describe('Guided Visit Workflow Commands', () => {
    it('should start, record outcome, submit care note, complete visit, and not create a family update', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;
      const task = await prisma.visitTask.findFirstOrThrow({
        where: { visit_id: visitId },
        orderBy: { created_at: 'asc' },
      });
      const taskId = task.id;

      const startResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation StartVisit($visitId: String!) {
              startVisit(visitId: $visitId) {
                id
                status
                actualStart
              }
            }
          `,
          variables: { visitId },
        })
        .expect(200);

      expect(startResponse.body.data.startVisit).toMatchObject({
        id: visitId,
        status: 'IN_PROGRESS',
      });
      expect(startResponse.body.data.startVisit.actualStart).toBeDefined();

      const taskOutcomeResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation RecordVisitTaskOutcome($input: RecordVisitTaskOutcomeInput!) {
              recordVisitTaskOutcome(input: $input) {
                id
                isCompleted
                notes
              }
            }
          `,
          variables: {
            input: {
              taskId,
              outcome: 'NOT_REQUIRED',
              notes: 'Not needed because client had already completed this safely.',
            },
          },
        })
        .expect(200);

      expect(taskOutcomeResponse.body.data.recordVisitTaskOutcome).toMatchObject({
        id: taskId,
        isCompleted: false,
      });
      expect(taskOutcomeResponse.body.data.recordVisitTaskOutcome.notes).toContain('VISIT_TASK_OUTCOME::');
      expect(taskOutcomeResponse.body.data.recordVisitTaskOutcome.notes).toContain('"outcome":"NOT_REQUIRED"');

      const careNoteResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation SubmitVisitCareNote($input: SubmitVisitCareNoteInput!) {
              submitVisitCareNote(input: $input) {
                id
                visitId
                clientId
                carerId
                category
                notes
                source
              }
            }
          `,
          variables: {
            input: {
              visitId,
              category: 'OTHER',
              notes: 'Client was comfortable and settled before departure.',
              occurredAt: '2024-02-01T09:35:00Z',
            },
          },
        })
        .expect(200);

      expect(careNoteResponse.body.data.submitVisitCareNote).toMatchObject({
        visitId,
        clientId: fixtures.clients.client.id,
        carerId: fixtures.carers.carer.id,
        category: 'OTHER',
        source: 'visit_workflow',
      });

      const completeResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation CompleteVisit($input: CompleteVisitInput!) {
              completeVisit(input: $input) {
                id
                status
                actualEnd
                notes
              }
            }
          `,
          variables: {
            input: {
              visitId,
              notes: 'Visit complete. Proof-of-care source records are available for later review.',
              actualEnd: '2024-02-01T09:55:00Z',
            },
          },
        })
        .expect(200);

      expect(completeResponse.body.data.completeVisit).toMatchObject({
        id: visitId,
        status: 'COMPLETED',
      });
      expect(completeResponse.body.data.completeVisit.actualEnd).toBe('2024-02-01T09:55:00.000Z');

      const [visit, careLogCount, storyTableRows] = await Promise.all([
        prisma.visit.findUnique({ where: { id: visitId } }),
        prisma.careLog.count({ where: { visit_id: visitId } }),
        prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT to_regclass('public.verified_visit_story') IS NOT NULL AS exists
        `,
      ]);
      const storyRows = storyTableRows[0]?.exists
        ? await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            'SELECT COUNT(*)::bigint AS count FROM verified_visit_story WHERE visit_id = $1',
            visitId,
          )
        : [{ count: BigInt(0) }];
      const storyCount = Number(storyRows[0]?.count ?? 0);

      expect(visit?.status).toBe('COMPLETED');
      expect(careLogCount).toBe(1);
      expect(storyCount).toBe(0);
    });

    it('denies every guided workflow write to a different linked Carer', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;
      const task = await prisma.visitTask.findFirstOrThrow({
        where: { visit_id: visitId },
        orderBy: { created_at: 'asc' },
      });
      const attempts = [
        {
          query: `
            mutation StartVisit($visitId: String!) {
              startVisit(visitId: $visitId) { id }
            }
          `,
          variables: { visitId },
        },
        {
          query: `
            mutation RecordVisitTaskOutcome($input: RecordVisitTaskOutcomeInput!) {
              recordVisitTaskOutcome(input: $input) { id }
            }
          `,
          variables: {
            input: {
              taskId: task.id,
              outcome: 'DONE',
              notes: 'Attempted by unassigned carer',
            },
          },
        },
        {
          query: `
            mutation SubmitVisitCareNote($input: SubmitVisitCareNoteInput!) {
              submitVisitCareNote(input: $input) { id }
            }
          `,
          variables: {
            input: {
              visitId,
              category: 'OTHER',
              notes: 'Attempted by unassigned carer',
            },
          },
        },
        {
          query: `
            mutation CompleteVisit($input: CompleteVisitInput!) {
              completeVisit(input: $input) { id }
            }
          `,
          variables: {
            input: {
              visitId,
              notes: 'Attempted by unassigned carer',
            },
          },
        },
      ];

      for (const attempt of attempts) {
        const response = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', getBearerToken('otherCarer'))
          .send(attempt)
          .expect(200);

        expect(response.body.data).toBeNull();
        expect(response.body.errors?.[0]?.message).toContain('only access your own visits');
      }

      const [visit, persistedTask, careLogCount] = await Promise.all([
        prisma.visit.findUniqueOrThrow({ where: { id: visitId } }),
        prisma.visitTask.findUniqueOrThrow({ where: { id: task.id } }),
        prisma.careLog.count({ where: { visit_id: visitId } }),
      ]);
      expect(visit.status).toBe('SCHEDULED');
      expect(persistedTask.is_completed).toBe(false);
      expect(careLogCount).toBe(0);
    });
  });

  describe('Linked Carer Shifts', () => {
    it('clocks in, reads history, and clocks out using the linked domain Carer UUID', async () => {
      const clockInResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation ClockIn($input: ClockInInput) {
              clockIn(input: $input) {
                id
                carerId
                isActive
                clockInProof { method source }
              }
            }
          `,
          variables: {
            input: {
              method: 'MANUAL',
              source: 'membership-e2e',
              notes: 'Synthetic linked-carer shift',
            },
          },
        })
        .expect(200);

      expect(clockInResponse.body.errors).toBeUndefined();
      expect(clockInResponse.body.data.clockIn).toMatchObject({
        carerId: fixtures.carers.carer.id,
        isActive: true,
        clockInProof: { method: 'MANUAL', source: 'membership-e2e' },
      });
      expect(clockInResponse.body.data.clockIn.carerId).not.toBe(TEST_USERS.carer.sub);

      const activeResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query MyActiveShift {
              myActiveShift { id carerId isActive }
            }
          `,
        })
        .expect(200);
      expect(activeResponse.body.data.myActiveShift).toMatchObject({
        id: clockInResponse.body.data.clockIn.id,
        carerId: fixtures.carers.carer.id,
        isActive: true,
      });

      const recentResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query MyRecentShifts {
              myRecentShifts(take: 5) { id carerId isActive }
            }
          `,
        })
        .expect(200);
      expect(recentResponse.body.data.myRecentShifts).toContainEqual({
        id: clockInResponse.body.data.clockIn.id,
        carerId: fixtures.carers.carer.id,
        isActive: true,
      });

      const clockOutResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation ClockOut($input: ClockOutInput) {
              clockOut(input: $input) {
                id
                carerId
                isActive
                clockOutProof { method source }
              }
            }
          `,
          variables: {
            input: {
              method: 'MANUAL',
              source: 'membership-e2e',
            },
          },
        })
        .expect(200);
      expect(clockOutResponse.body.data.clockOut).toMatchObject({
        id: clockInResponse.body.data.clockIn.id,
        carerId: fixtures.carers.carer.id,
        isActive: false,
        clockOutProof: { method: 'MANUAL', source: 'membership-e2e' },
      });

      const persistedShift = await prisma.carerShift.findUniqueOrThrow({
        where: { id: clockInResponse.body.data.clockIn.id },
      });
      expect(persistedShift.carer_id).toBe(fixtures.carers.carer.id);
      expect(persistedShift.carer_id).not.toBe(TEST_USERS.carer.sub);
      expect(persistedShift.clock_out_at).not.toBeNull();
    });

    it('denies shift access immediately after the linked membership is revoked', async () => {
      await prisma.organizationMembership.update({
        where: { id: fixtures.memberships.carerMembership.id },
        data: {
          status: 'REVOKED',
          revoked_at: new Date(),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query MyActiveShift {
              myActiveShift { id }
            }
          `,
        })
        .expect(200);

      expect(response.body.data.myActiveShift).toBeNull();
      expect(response.body.errors?.[0]?.message).toBe('Access is unavailable for this account');
    });
  });

  describe('Linked Carer Medication Support', () => {
    it('persists the domain Carer UUID while auditing the authenticated subject', async () => {
      const medication = await prisma.medication.create({
        data: {
          name: 'Synthetic medicine',
          dosage: '1',
          unit: 'tablet',
        },
      });
      const prescription = await prisma.prescription.create({
        data: {
          client_id: fixtures.clients.client.id,
          medication_id: medication.id,
          start_date: new Date('2024-01-01T00:00:00Z'),
          frequency_per_day: 1,
          administration_times: ['09:00'],
        },
      });
      const administration = await prisma.medicationAdministration.create({
        data: {
          prescription_id: prescription.id,
          visit_id: fixtures.visits.scheduledVisit.id,
          scheduled_time: new Date('2024-02-01T09:15:00Z'),
          status: 'SCHEDULED',
        },
      });

      const dueResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            query DueMeds($visitId: String!) {
              listDueMeds(visitId: $visitId) { id status }
            }
          `,
          variables: { visitId: fixtures.visits.scheduledVisit.id },
        })
        .expect(200);
      expect(dueResponse.body.data.listDueMeds).toEqual([
        { id: administration.id, status: 'SCHEDULED' },
      ]);

      const recordResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: `
            mutation RecordAdministration($input: RecordAdministrationInput!) {
              recordAdministration(input: $input) { id status }
            }
          `,
          variables: {
            input: {
              administrationId: administration.id,
              status: 'ADMINISTERED',
              notes: 'Synthetic linked-carer medication proof',
            },
          },
        })
        .expect(200);
      expect(recordResponse.body.data.recordAdministration).toEqual({
        id: administration.id,
        status: 'ADMINISTERED',
      });

      const [persisted, audit] = await Promise.all([
        prisma.medicationAdministration.findUniqueOrThrow({
          where: { id: administration.id },
        }),
        prisma.medicationAudit.findFirstOrThrow({
          where: { medication_administration_id: administration.id },
          orderBy: { timestamp: 'desc' },
        }),
      ]);
      expect(persisted.administered_by).toBe(fixtures.carers.carer.id);
      expect(persisted.administered_by).not.toBe(TEST_USERS.carer.sub);
      expect(audit.actor_id).toBe(TEST_USERS.carer.sub);
      expect(audit.actor_id).not.toBe(fixtures.carers.carer.id);
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
          organization_id: fixtures.organization.id,
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
