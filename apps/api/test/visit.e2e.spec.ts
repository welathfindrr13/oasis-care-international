import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '@oasis/db';
import { VisitModule } from '../src/visit/visit.module';
import { VisitService } from '../src/visit/visit.service';
import { VisitResolver } from '../src/visit/visit.resolver';
import { VisitRepository } from '../src/visit/visit.repository';
import { VisitCompletionProofKeyring } from '../src/visit/visit-completion-proof-keyring';
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
import { MedicationLaunchGuard } from '../src/medication/medication-launch.guard';
import { AuthAccessModule } from '../src/auth/auth-access.module';
import type { CanonicalAccessContext } from '../src/auth/access-context.service';
import { CarerInvitationService } from '../src/carer/carer-invitation.service';

describe('Visit E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let visitService: VisitService;
  let carerInvitations: CarerInvitationService;
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
    process.env.VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID = 'test-v1';
    process.env.VISIT_COMPLETION_PROOF_ACTIVE_SECRET =
      'visit-completion-proof-test-secret-32-bytes-minimum';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
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
              VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: 'test-v1',
              VISIT_COMPLETION_PROOF_ACTIVE_SECRET:
                'visit-completion-proof-test-secret-32-bytes-minimum',
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
        VisitCompletionProofKeyring,
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
        MedicationLaunchGuard,
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
    visitService = app.get<VisitService>(VisitService);
    carerInvitations = new CarerInvitationService(prisma, {
      ensureOrganizationInvitation: jest.fn(),
      revokeOrganizationInvitation: jest.fn(),
      revokeOrganizationInvitationByInternalId: jest.fn(),
      removeOrganizationMembership: jest.fn(),
    } as any);

    // Apply global filters
    app.useGlobalFilters(new HttpExceptionFilter(), new GraphqlExceptionFilter());

    // Initialize Passport
    const passport = require('passport');
    app.use(passport.initialize());

    await app.init();

    // Create test fixtures
    fixtures = await createTestFixtures(prisma, 'clerk');
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
    fixtures = await createTestFixtures(prisma, 'clerk');
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

    it('rejects GraphQL status injection on visit creation', async () => {
      const before = await prisma.visit.count();
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation CreateVisit($input: CreateVisitInput!) {
              createVisit(input: $input) { id status }
            }
          `,
          variables: {
            input: {
              carerId: fixtures.carers.carer.id,
              clientId: fixtures.clients.client.id,
              scheduledStart: '2024-02-15T11:00:00Z',
              scheduledEnd: '2024-02-15T12:00:00Z',
              status: 'COMPLETED',
            },
          },
        })
        .expect(400);

      expect(response.body.data).toBeUndefined();
      expect(response.body.errors?.[0]?.message).toContain(
        'Field "status" is not defined by type "CreateVisitInput"',
      );
      await expect(prisma.visit.count()).resolves.toBe(before);
    });

    it.each([
      ['equal', '2024-02-15T11:00:00Z', '2024-02-15T11:00:00Z'],
      ['inverted', '2024-02-15T12:00:00Z', '2024-02-15T11:00:00Z'],
    ])('rejects %s create times through the real API', async (_case, start, end) => {
      const before = await prisma.visit.count();
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation CreateVisit($input: CreateVisitInput!) {
              createVisit(input: $input) { id }
            }
          `,
          variables: {
            input: {
              carerId: fixtures.carers.carer.id,
              clientId: fixtures.clients.client.id,
              scheduledStart: start,
              scheduledEnd: end,
            },
          },
        })
        .expect(200);

      expect(response.body.data).toBeNull();
      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'VALIDATION_FAILED',
      );
      await expect(prisma.visit.count()).resolves.toBe(before);
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
    const admittedCarerAccess = (): CanonicalAccessContext => ({
      authenticated: true as const,
      identityProvider: 'clerk',
      membershipId: fixtures.memberships.carerMembership.id,
      surface: 'STAFF' as const,
      effectiveRole: 'carer',
      organizationId: fixtures.organization.id,
      membershipState: 'ACTIVE',
      onboardingState: 'READY',
      rawRole: 'carer',
      linkedIdentityState: 'LINKED',
      domainIdentityId: fixtures.carers.carer.id,
      authSubject: TEST_USERS.carer.sub,
    });

    const completeVisitMutation = `
      mutation CompleteVisit($input: CompleteVisitInput!) {
        completeVisit(input: $input) {
          id
          status
          actualEnd
          notes
        }
      }
    `;

    async function completeVisit(input: {
      visitId: string;
      notes?: string;
    }) {
      return request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({ query: completeVisitMutation, variables: { input } })
        .expect(200);
    }

    async function createCompletionVisit(overrides: Record<string, unknown> = {}) {
      return prisma.visit.create({
        data: {
          organization_id: fixtures.organization.id,
          carer_id: fixtures.carers.carer.id,
          client_id: fixtures.clients.client.id,
          scheduled_start: new Date('2024-03-01T09:00:00.000Z'),
          scheduled_end: new Date('2024-03-01T10:00:00.000Z'),
          actual_start: new Date('2024-03-01T09:02:00.000Z'),
          status: 'IN_PROGRESS',
          notes: 'Initial handover note.',
          ...overrides,
        } as any,
      });
    }

    it.each(['COMPLETED', 'CANCELLED'] as const)(
      'rejects task completion, task outcome, and care-note writes for a %s visit',
      async (status) => {
        const visit = await createCompletionVisit({
          status,
          actual_end: status === 'COMPLETED' ? new Date() : null,
        });
        const task = await prisma.visitTask.create({
          data: { visit_id: visit.id, task_name: 'Terminal-safe task' },
        });
        const access = admittedCarerAccess();
        const attempts = [
          () =>
            visitService.completeTask(
              task.id,
              'Must not persist after terminal state.',
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            ),
          () =>
            visitService.recordVisitTaskOutcome(
              {
                taskId: task.id,
                outcome: 'DONE' as any,
                notes: 'Must not persist after terminal state.',
              },
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            ),
          () =>
            visitService.submitVisitCareNote(
              {
                visitId: visit.id,
                category: 'OTHER' as any,
                notes: 'Must not persist after terminal state.',
              },
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            ),
        ];
        for (const attempt of attempts) {
          await expect(attempt()).rejects.toMatchObject({
            response: { code: 'VISIT_COMPLETION_CONFLICT' },
          });
        }
        const [persistedTask, careLogs] = await Promise.all([
          prisma.visitTask.findUniqueOrThrow({ where: { id: task.id } }),
          prisma.careLog.count({ where: { visit_id: visit.id } }),
        ]);
        expect(persistedTask.is_completed).toBe(false);
        expect(persistedTask.notes).toBeNull();
        expect(careLogs).toBe(0);
      },
    );

    it.each(['task-completion', 'task-outcome', 'care-note'] as const)(
      'revalidates the current Clerk membership for %s writes',
      async (write) => {
        const visit = await createCompletionVisit();
        const task = await prisma.visitTask.create({
          data: { visit_id: visit.id, task_name: 'Membership-bound task' },
        });
        const access = admittedCarerAccess();
        await carerInvitations.deactivateMembership(
          fixtures.memberships.carerMembership.id,
          {
            organizationId: fixtures.organization.id,
            organizationMembershipId: fixtures.memberships.adminMembership.id,
            authSubject: TEST_USERS.admin.sub,
          },
        );
        const attempt = write === 'task-completion'
          ? visitService.completeTask(
              task.id,
              'Stale admitted request.',
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            )
          : write === 'task-outcome'
            ? visitService.recordVisitTaskOutcome(
                { taskId: task.id, outcome: 'DONE' as any },
                fixtures.carers.carer.id,
                'carer',
                fixtures.organization.id,
                access,
              )
            : visitService.submitVisitCareNote(
                {
                  visitId: visit.id,
                  category: 'OTHER' as any,
                  notes: 'Stale admitted request.',
                },
                fixtures.carers.carer.id,
                'carer',
                fixtures.organization.id,
                access,
              );
        await expect(attempt).rejects.toMatchObject({
          response: {
            code: 'FORBIDDEN',
            message: 'Access is unavailable for this account',
          },
        });
        const [persistedTask, careLogs] = await Promise.all([
          prisma.visitTask.findUniqueOrThrow({ where: { id: task.id } }),
          prisma.careLog.count({ where: { visit_id: visit.id } }),
        ]);
        expect(persistedTask.is_completed).toBe(false);
        expect(persistedTask.notes).toBeNull();
        expect(careLogs).toBe(0);
      },
    );

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
                hasRecordedOutcome
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
        hasRecordedOutcome: true,
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
            },
          },
        })
        .expect(200);

      expect(completeResponse.body.data.completeVisit).toMatchObject({
        id: visitId,
        status: 'COMPLETED',
      });
      expect(completeResponse.body.data.completeVisit.actualEnd).toEqual(
        expect.any(String),
      );

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

    it('serializes identical concurrent completion retries and appends the note once', async () => {
      const visit = await createCompletionVisit();
      const input = {
        visitId: visit.id,
        notes: 'Client settled before the Carer left.',
      };

      const responses = await Promise.all([
        completeVisit(input),
        completeVisit(input),
      ]);

      for (const response of responses) {
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.completeVisit).toMatchObject({
          id: visit.id,
          status: 'COMPLETED',
        });
      }
      const actualEnds = new Set(
        responses.map((response) => response.body.data.completeVisit.actualEnd),
      );
      expect(actualEnds.size).toBe(1);
      const recordedActualEnd = responses[0].body.data.completeVisit.actualEnd;

      const omittedNote = await completeVisit({ visitId: visit.id });
      expect(omittedNote.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );

      const [persisted, audits] = await Promise.all([
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
        prisma.auditLog.findMany({
          where: { resource_type: 'Visit', resource_id: visit.id },
          orderBy: { timestamp: 'asc' },
        }),
      ]);
      expect(persisted.actual_end?.toISOString()).toBe(recordedActualEnd);
      expect(persisted.notes).toBe(
        `Initial handover note.\n${input.notes}`,
      );
      expect((persisted.notes ?? '').split(input.notes).length - 1).toBe(1);
      expect(audits.map((audit) => audit.action).sort()).toEqual([
        'VISIT_COMPLETED',
        'VISIT_COMPLETION_IDEMPOTENT',
      ]);

      const completionAudit = audits.find(
        (audit) => audit.action === 'VISIT_COMPLETED',
      );
      expect(completionAudit).toMatchObject({
        organization_id: fixtures.organization.id,
        user_id: TEST_USERS.carer.sub,
        resource_type: 'Visit',
        resource_id: visit.id,
      });
      expect(completionAudit?.new_values).toMatchObject({
        status: 'COMPLETED',
        actualEnd: recordedActualEnd,
        membershipId: fixtures.memberships.carerMembership.id,
        actorRole: 'carer',
        notesAppended: true,
        actorSurface: 'STAFF',
        completionFingerprintVersion: 3,
        completionProofKeyId: 'test-v1',
        completionRequestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        completionRecordFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(JSON.stringify(audits)).not.toContain(input.notes);
    });

    it('rejects identical completion details after the linked membership rotates', async () => {
      const visit = await createCompletionVisit();
      const input = {
        visitId: visit.id,
        notes: 'Client comfortable when the Carer left.',
      };
      await expect(
        visitService.completeVisit(
          input,
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          admittedCarerAccess(),
        ),
      ).resolves.toMatchObject({ status: 'COMPLETED' });

      await prisma.organizationMembership.update({
        where: { id: fixtures.memberships.carerMembership.id },
        data: { status: 'REVOKED', revoked_at: new Date() },
      });
      const secondMembership = await prisma.organizationMembership.create({
        data: {
          organization_id: fixtures.organization.id,
          identity_provider: 'clerk',
          auth_subject: 'second-subject-for-same-carer',
          role: 'carer',
          status: 'ACTIVE',
          carer_id: fixtures.carers.carer.id,
        } as any,
      });
      const secondAccess: CanonicalAccessContext = {
        ...admittedCarerAccess(),
        authSubject: secondMembership.auth_subject,
        membershipId: secondMembership.id,
      };

      await expect(
        visitService.completeVisit(
          input,
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          secondAccess,
        ),
      ).rejects.toMatchObject({
        response: { code: 'VISIT_COMPLETION_CONFLICT' },
      });
      await expect(
        prisma.auditLog.count({
          where: {
            resource_type: 'Visit',
            resource_id: visit.id,
            action: 'VISIT_COMPLETION_IDEMPOTENT',
          },
        }),
      ).resolves.toBe(0);
    });

    it('fails closed for an unknown proof key or metadata copied to another visit', async () => {
      const input = {
        notes: 'Client settled before departure.',
      };
      const source = await createCompletionVisit();
      await completeVisit({ visitId: source.id, ...input });
      const sourceAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          resource_type: 'Visit',
          resource_id: source.id,
          action: 'VISIT_COMPLETED',
        },
      });
      const sourceActualEnd = new Date(
        String((sourceAudit.new_values as Record<string, unknown>).actualEnd),
      );

      await prisma.auditLog.update({
        where: { id: sourceAudit.id },
        data: {
          new_values: {
            ...(sourceAudit.new_values as Record<string, unknown>),
            completionProofKeyId: 'unknown-key',
          } as any,
        },
      });
      const unknownKeyRetry = await completeVisit({ visitId: source.id, ...input });
      expect(unknownKeyRetry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );

      const copied = await createCompletionVisit({
        status: 'COMPLETED',
        actual_end: sourceActualEnd,
        notes: `Initial handover note.\n${input.notes}`,
      });
      await prisma.auditLog.create({
        data: {
          organization_id: fixtures.organization.id,
          user_id: TEST_USERS.carer.sub,
          action: 'VISIT_COMPLETED',
          resource_type: 'Visit',
          resource_id: copied.id,
          old_values: sourceAudit.old_values as any,
          new_values: sourceAudit.new_values as any,
        },
      });
      const copiedRetry = await completeVisit({ visitId: copied.id, ...input });
      expect(copiedRetry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );
    });

    it('allows only one conflicting concurrent completion and never loses the prior note', async () => {
      const visit = await createCompletionVisit();
      const completionNotes = [
        'First concurrent completion detail.',
        'Second concurrent completion detail.',
      ];

      const responses = await Promise.all(
        completionNotes.map((notes) =>
          completeVisit({ visitId: visit.id, notes }),
        ),
      );
      const successes = responses.filter(
        (response) => response.body.data?.completeVisit,
      );
      const conflicts = responses.filter(
        (response) =>
          response.body.errors?.[0]?.extensions?.code ===
          'VISIT_COMPLETION_CONFLICT',
      );
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(1);

      const [persisted, completionAuditCount] = await Promise.all([
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
        prisma.auditLog.count({
          where: {
            resource_type: 'Visit',
            resource_id: visit.id,
            action: 'VISIT_COMPLETED',
          },
        }),
      ]);
      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.actual_end).not.toBeNull();
      expect(persisted.notes).toMatch(/^Initial handover note\.\n/);
      expect(
        completionNotes.filter((note) => persisted.notes?.includes(note)),
      ).toHaveLength(1);
      expect(completionAuditCount).toBe(1);
    });

    it('requires exact audit-bounded note evidence instead of a matching suffix', async () => {
      const completionNote = 'Repeated suffix.';
      const visit = await createCompletionVisit({
        notes: `Original note ending in the same text.\n${completionNote}`,
      });
      const completed = await completeVisit({
        visitId: visit.id,
        notes: completionNote,
      });
      expect(completed.body.errors).toBeUndefined();

      const persisted = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
      });
      const equalLengthReplacement = `X${persisted.notes!.slice(1)}`;
      expect(equalLengthReplacement).toHaveLength(persisted.notes!.length);
      expect(equalLengthReplacement.endsWith(completionNote)).toBe(true);
      await prisma.visit.update({
        where: { id: visit.id },
        data: { notes: equalLengthReplacement },
      });
      const retry = await completeVisit({
        visitId: visit.id,
        notes: completionNote,
      });
      expect(retry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );
    });

    it('rejects an identical request after the persisted actual end is mutated', async () => {
      const visit = await createCompletionVisit();
      const input = {
        visitId: visit.id,
        notes: 'Audited completion request.',
      };
      const completed = await completeVisit(input);
      expect(completed.body.errors).toBeUndefined();

      await prisma.visit.update({
        where: { id: visit.id },
        data: { actual_end: new Date('2024-03-01T09:56:00.000Z') },
      });
      const retry = await completeVisit(input);
      expect(retry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );
    });

    it('rejects caller-selected completion time before any visit mutation', async () => {
      const visit = await createCompletionVisit();
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({
          query: completeVisitMutation,
          variables: {
            input: {
              visitId: visit.id,
              notes: 'Caller-selected time must not be accepted.',
              actualEnd: '2024-03-01T09:55:00.000Z',
            },
          },
        })
        .expect(400);

      expect(response.body.errors).toHaveLength(1);
      await expect(
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
      ).resolves.toMatchObject({
        status: 'IN_PROGRESS',
        actual_end: null,
        notes: 'Initial handover note.',
      });
    });

    it('preserves a recorded actual end and rejects cancelled or conflicting terminal changes', async () => {
      const originalActualEnd = new Date('2024-03-01T09:50:00.000Z');
      const visit = await createCompletionVisit({
        actual_end: originalActualEnd,
      });
      const completed = await completeVisit({
        visitId: visit.id,
        notes: 'Completion recorded after connectivity returned.',
      });
      expect(completed.body.errors).toBeUndefined();
      expect(completed.body.data.completeVisit.actualEnd).toBe(
        originalActualEnd.toISOString(),
      );

      const conflictingRetry = await completeVisit({
        visitId: visit.id,
        notes: 'Different completion detail.',
      });
      expect(conflictingRetry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );

      const cancelled = await createCompletionVisit({
        status: 'CANCELLED',
        notes: 'Visit cancelled by the office.',
      });
      const cancelledAttempt = await completeVisit({
        visitId: cancelled.id,
        notes: 'Must not complete a cancelled visit.',
      });
      expect(cancelledAttempt.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );

      const legacyCompleted = await createCompletionVisit({
        status: 'COMPLETED',
        actual_end: originalActualEnd,
        notes: 'Legacy completion without transactional audit metadata.',
      });
      await prisma.auditLog.create({
        data: {
          organization_id: fixtures.organization.id,
          user_id: TEST_USERS.carer.sub,
          action: 'VISIT_COMPLETED',
          resource_type: 'Visit',
          resource_id: legacyCompleted.id,
          new_values: {
            status: 'COMPLETED',
            actualEnd: originalActualEnd.toISOString(),
            notesAppended: true,
          },
        },
      });
      const unprovableRetry = await completeVisit({
        visitId: legacyCompleted.id,
        notes: 'Legacy completion without transactional audit metadata.',
      });
      expect(unprovableRetry.body.errors?.[0]?.extensions?.code).toBe(
        'VISIT_COMPLETION_CONFLICT',
      );

      const [preserved, cancelledPersisted, legacyPersisted] =
        await Promise.all([
          prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
          prisma.visit.findUniqueOrThrow({ where: { id: cancelled.id } }),
          prisma.visit.findUniqueOrThrow({
            where: { id: legacyCompleted.id },
          }),
        ]);
      expect(preserved.actual_end?.toISOString()).toBe(
        originalActualEnd.toISOString(),
      );
      expect(preserved.notes).not.toContain('Different completion detail.');
      expect(cancelledPersisted.status).toBe('CANCELLED');
      expect(cancelledPersisted.actual_end).toBeNull();
      expect(legacyPersisted.notes).toBe(
        'Legacy completion without transactional audit metadata.',
      );
    });

    it('rejects direct completion until a scheduled visit has started', async () => {
      const visit = await createCompletionVisit({
        status: 'SCHEDULED',
        actual_start: null,
        notes: 'Scheduled visit evidence.',
      });

      await expect(
        visitService.completeVisit(
          {
            visitId: visit.id,
            notes: 'Must not complete before start.',
          },
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          admittedCarerAccess(),
        ),
      ).rejects.toMatchObject({
        response: { code: 'VISIT_COMPLETION_CONFLICT' },
      });

      await expect(
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
      ).resolves.toMatchObject({
        status: 'SCHEDULED',
        actual_start: null,
        actual_end: null,
        notes: 'Scheduled visit evidence.',
      });
    });

    it('serializes concurrent start before completion and never skips actual start', async () => {
      const visit = await createCompletionVisit({
        status: 'SCHEDULED',
        actual_start: null,
      });
      const access = admittedCarerAccess();
      const [startResult, completionResult] = await Promise.allSettled([
        visitService.startVisit(
          visit.id,
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          access,
        ),
        visitService.completeVisit(
          {
            visitId: visit.id,
            notes: 'Concurrent completion evidence.',
          },
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          access,
        ),
      ]);

      expect(startResult.status).toBe('fulfilled');
      expect(['fulfilled', 'rejected']).toContain(completionResult.status);
      if (completionResult.status === 'rejected') {
        expect(completionResult.reason).toMatchObject({
          response: { code: 'VISIT_COMPLETION_CONFLICT' },
        });
        await expect(
          visitService.completeVisit(
            {
              visitId: visit.id,
              notes: 'Concurrent completion evidence.',
            },
            fixtures.carers.carer.id,
            'carer',
            fixtures.organization.id,
            access,
          ),
        ).resolves.toMatchObject({ status: 'COMPLETED' });
      }
      const persisted = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
      });
      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.actual_start).not.toBeNull();
      expect(persisted.actual_end).not.toBeNull();
      expect(persisted.notes).toContain('Concurrent completion evidence.');
    });

    it.each(['task-outcome', 'care-note'] as const)(
      'serializes a concurrent %s against completion without any post-completion write',
      async (write) => {
        const visit = await createCompletionVisit();
        const task = await prisma.visitTask.create({
          data: { visit_id: visit.id, task_name: 'Concurrent guided task' },
        });
        const access = admittedCarerAccess();
        const guidedWrite = write === 'task-outcome'
          ? visitService.recordVisitTaskOutcome(
              {
                taskId: task.id,
                outcome: 'DONE' as any,
                notes: 'Concurrent task evidence.',
              },
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            )
          : visitService.submitVisitCareNote(
              {
                visitId: visit.id,
                category: 'OTHER' as any,
                notes: 'Concurrent care evidence.',
              },
              fixtures.carers.carer.id,
              'carer',
              fixtures.organization.id,
              access,
            );
        const [completionResult, guidedResult] = await Promise.allSettled([
          visitService.completeVisit(
            { visitId: visit.id, notes: 'Concurrent completion evidence.' },
            fixtures.carers.carer.id,
            'carer',
            fixtures.organization.id,
            access,
          ),
          guidedWrite,
        ]);
        expect(completionResult.status).toBe('fulfilled');
        if (guidedResult.status === 'rejected') {
          expect(guidedResult.reason).toMatchObject({
            response: { code: 'VISIT_COMPLETION_CONFLICT' },
          });
        }
        const [persisted, completionAudit, persistedTask, careLog] = await Promise.all([
          prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
          prisma.auditLog.findFirstOrThrow({
            where: {
              resource_type: 'Visit',
              resource_id: visit.id,
              action: 'VISIT_COMPLETED',
            },
          }),
          prisma.visitTask.findUniqueOrThrow({ where: { id: task.id } }),
          prisma.careLog.findFirst({ where: { visit_id: visit.id } }),
        ]);
        expect(persisted.status).toBe('COMPLETED');
        if (guidedResult.status === 'fulfilled') {
          const guidedTimestamp = write === 'task-outcome'
            ? persistedTask.updated_at
            : careLog!.created_at;
          expect(guidedTimestamp.getTime()).toBeLessThanOrEqual(
            completionAudit.timestamp.getTime(),
          );
        } else if (write === 'task-outcome') {
          expect(persistedTask.notes).toBeNull();
        } else {
          expect(careLog).toBeNull();
        }
      },
    );

    it.each(['complete', 'start'] as const)(
      'revalidates an admitted %s request after real deactivation wins the lifecycle lock',
      async (action) => {
      const visit = await createCompletionVisit(
        action === 'start'
          ? { status: 'SCHEDULED', actual_start: null }
          : undefined,
      );
      const membershipId = fixtures.memberships.carerMembership.id;
      const organizationId = fixtures.organization.id;
      const carerId = fixtures.carers.carer.id;
      const access = admittedCarerAccess();
      let releaseLock!: () => void;
      let markLocked!: () => void;
      const locked = new Promise<void>((resolve) => {
        markLocked = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const lockHolder = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`carer-membership:${membershipId}`}, 0))`;
        markLocked();
        await hold;
      });
      await locked;

      const deactivating = carerInvitations.deactivateMembership(membershipId, {
        organizationId,
        organizationMembershipId: fixtures.memberships.adminMembership.id,
        authSubject: TEST_USERS.admin.sub,
      });

      let revocationQueued = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const rows = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
          SELECT count(*)::bigint AS waiting
          FROM pg_locks
          WHERE locktype = 'advisory' AND granted = false
        `;
        if (Number(rows[0]?.waiting || 0) >= 1) {
          revocationQueued = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!revocationQueued) {
        releaseLock();
        await lockHolder;
        await deactivating;
      }
      expect(revocationQueued).toBe(true);

      const admittedWrite =
        action === 'complete'
          ? visitService.completeVisit(
              { visitId: visit.id, notes: 'Must be denied after revocation.' },
              carerId,
              'carer',
              organizationId,
              access,
            )
          : visitService.startVisit(
              visit.id,
              carerId,
              'carer',
              organizationId,
              access,
            );
      const writeDenied = expect(admittedWrite).rejects.toMatchObject({
        response: {
          code: 'FORBIDDEN',
          message: 'Access is unavailable for this account',
        },
      });
      releaseLock();
      await lockHolder;
      await deactivating;
      await writeDenied;

      const [persisted, membership, auditCount] = await Promise.all([
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
        prisma.organizationMembership.findUniqueOrThrow({
          where: { id: membershipId },
        }),
        prisma.auditLog.count({
          where: { resource_type: 'Visit', resource_id: visit.id },
        }),
      ]);
      expect(membership.status).toBe('REVOKED');
      expect(membership.revoked_at).not.toBeNull();
      expect(persisted.status).toBe(
        action === 'complete' ? 'IN_PROGRESS' : 'SCHEDULED',
      );
      expect(persisted.actual_end).toBeNull();
      expect(persisted.notes).toBe('Initial handover note.');
      if (action === 'start') expect(persisted.actual_start).toBeNull();
      expect(auditCount).toBe(0);
      },
    );

    it('rolls back the visit mutation when the completion audit insert fails', async () => {
      const visit = await createCompletionVisit();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE test_visit_audit_failure (
          resource_id text PRIMARY KEY
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION fail_selected_visit_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'VISIT_COMPLETED' AND EXISTS (
            SELECT 1 FROM test_visit_audit_failure
            WHERE resource_id = NEW.resource_id
          ) THEN
            RAISE EXCEPTION 'forced completion audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER fail_selected_visit_audit_trigger
        BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_selected_visit_audit()
      `);
      await prisma.$executeRaw`
        INSERT INTO test_visit_audit_failure (resource_id) VALUES (${visit.id})
      `;

      try {
        await expect(
          visitService.completeVisit(
            {
              visitId: visit.id,
              notes: 'This write must roll back with its audit.',
            },
            fixtures.carers.carer.id,
            'carer',
            fixtures.organization.id,
            admittedCarerAccess(),
          ),
        ).rejects.toThrow();

        const [persisted, auditCount] = await Promise.all([
          prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
          prisma.auditLog.count({
            where: { resource_type: 'Visit', resource_id: visit.id },
          }),
        ]);
        expect(persisted.status).toBe('IN_PROGRESS');
        expect(persisted.actual_end).toBeNull();
        expect(persisted.notes).toBe('Initial handover note.');
        expect(auditCount).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS fail_selected_visit_audit_trigger ON audit_log',
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION IF EXISTS fail_selected_visit_audit()',
        );
        await prisma.$executeRawUnsafe(
          'DROP TABLE IF EXISTS test_visit_audit_failure',
        );
      }
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
            mutation ClockOut($input: ClockOutInput!) {
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
              shiftId: clockInResponse.body.data.clockIn.id,
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
    beforeAll(() => {
      process.env.MEDICATION_EMAR_ENABLED = 'true';
    });

    afterAll(() => {
      process.env.MEDICATION_EMAR_ENABLED = 'false';
    });

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
            },
          },
        })
        .expect(200);

      expect(response.body.data.updateVisit).toMatchObject({
        id: visitId,
        status: 'SCHEDULED',
      });
    });

    it('rejects generic writes to completion-owned status, times, and notes', async () => {
      const visitId = fixtures.visits.scheduledVisit.id;
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('admin'))
        .send({
          query: `
            mutation UpdateVisit($input: UpdateVisitInput!) {
              updateVisit(input: $input) { id }
            }
          `,
          variables: {
            input: {
              id: visitId,
              status: 'COMPLETED',
              actualStart: '2024-02-01T09:01:00Z',
              actualEnd: '2024-02-01T09:59:00Z',
              notes: 'Unsafe generic completion overwrite.',
            },
          },
        })
        .expect(400);

      expect(response.body.errors).toHaveLength(4);
      await expect(
        prisma.visit.findUniqueOrThrow({ where: { id: visitId } }),
      ).resolves.toMatchObject({
        status: 'SCHEDULED',
        actual_start: null,
        actual_end: null,
      });
    });

    it('does not overwrite completion-owned fields when rescheduling races completion', async () => {
      const visit = await prisma.visit.create({
        data: {
          organization_id: fixtures.organization.id,
          carer_id: fixtures.carers.carer.id,
          client_id: fixtures.clients.client.id,
          scheduled_start: new Date('2024-03-01T09:00:00.000Z'),
          scheduled_end: new Date('2024-03-01T10:00:00.000Z'),
          actual_start: new Date('2024-03-01T09:02:00.000Z'),
          status: 'IN_PROGRESS',
          notes: 'Original completion evidence.',
        },
      });
      const access: CanonicalAccessContext = {
        authenticated: true as const,
        identityProvider: 'clerk',
        membershipId: fixtures.memberships.carerMembership.id,
        surface: 'STAFF' as const,
        effectiveRole: 'carer',
        organizationId: fixtures.organization.id,
        membershipState: 'ACTIVE',
        onboardingState: 'READY',
        rawRole: 'carer',
        linkedIdentityState: 'LINKED',
        domainIdentityId: fixtures.carers.carer.id,
        authSubject: TEST_USERS.carer.sub,
      };

      const [scheduleResult, completionResult] = await Promise.allSettled([
        visitService.updateVisit(
          visit.id,
          {
            id: visit.id,
            scheduledStart: '2024-03-01T15:00:00.000Z',
            scheduledEnd: '2024-03-01T16:00:00.000Z',
          },
          TEST_USERS.admin.sub,
          'admin',
          fixtures.organization.id,
        ),
        visitService.completeVisit(
          {
            visitId: visit.id,
            notes: 'Atomic completion note.',
          },
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          access,
        ),
      ]);

      expect(completionResult.status).toBe('fulfilled');
      expect(['fulfilled', 'rejected']).toContain(scheduleResult.status);
      const persisted = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
      });
      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.actual_end).not.toBeNull();
      expect(persisted.notes).toBe(
        'Original completion evidence.\nAtomic completion note.',
      );
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
      const deletionAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          resource_type: 'Visit',
          resource_id: visitId,
          action: 'VISIT_DELETED',
        },
      });
      expect(deletionAudit).toMatchObject({
        organization_id: fixtures.organization.id,
        user_id: TEST_USERS.admin.sub,
        old_values: { status: 'SCHEDULED', deleted: false },
        new_values: expect.objectContaining({
          status: 'SCHEDULED',
          deleted: true,
        }),
      });
      expect(JSON.stringify(deletionAudit)).not.toContain(
        deletedVisit?.notes || 'fixture-note-not-present',
      );

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

    it('serializes delete against completion and never deletes an in-progress visit', async () => {
      const visit = await prisma.visit.create({
        data: {
          organization_id: fixtures.organization.id,
          carer_id: fixtures.carers.carer.id,
          client_id: fixtures.clients.client.id,
          scheduled_start: new Date('2024-04-01T09:00:00.000Z'),
          scheduled_end: new Date('2024-04-01T10:00:00.000Z'),
          actual_start: new Date('2024-04-01T09:01:00.000Z'),
          status: 'IN_PROGRESS',
          notes: 'Completion evidence that must never enter deletion audit.',
        },
      });
      const access: CanonicalAccessContext = {
        authenticated: true,
        identityProvider: 'clerk',
        membershipId: fixtures.memberships.carerMembership.id,
        surface: 'STAFF',
        effectiveRole: 'carer',
        organizationId: fixtures.organization.id,
        membershipState: 'ACTIVE',
        onboardingState: 'READY',
        rawRole: 'carer',
        linkedIdentityState: 'LINKED',
        domainIdentityId: fixtures.carers.carer.id,
        authSubject: TEST_USERS.carer.sub,
      };
      const [deleteResult, completionResult] = await Promise.allSettled([
        visitService.deleteVisit(
          visit.id,
          TEST_USERS.admin.sub,
          'admin',
          fixtures.organization.id,
        ),
        visitService.completeVisit(
          { visitId: visit.id, notes: 'Atomic completion wins.' },
          fixtures.carers.carer.id,
          'carer',
          fixtures.organization.id,
          access,
        ),
      ]);
      expect(deleteResult.status).toBe('rejected');
      if (deleteResult.status === 'rejected') {
        expect(deleteResult.reason).toMatchObject({
          response: { code: 'VISIT_COMPLETION_CONFLICT' },
        });
      }
      expect(completionResult.status).toBe('fulfilled');
      const [persisted, deletionAudits] = await Promise.all([
        prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
        prisma.auditLog.count({
          where: {
            resource_type: 'Visit',
            resource_id: visit.id,
            action: 'VISIT_DELETED',
          },
        }),
      ]);
      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.deleted_at).toBeNull();
      expect(deletionAudits).toBe(0);
    });

    it('rolls back the soft delete when its narrow audit insert fails', async () => {
      const visit = await prisma.visit.create({
        data: {
          organization_id: fixtures.organization.id,
          carer_id: fixtures.carers.carer.id,
          client_id: fixtures.clients.client.id,
          scheduled_start: new Date('2024-04-01T11:00:00.000Z'),
          scheduled_end: new Date('2024-04-01T12:00:00.000Z'),
          status: 'SCHEDULED',
          notes: 'Sensitive note that must not enter deletion audit.',
        },
      });
      await prisma.$executeRawUnsafe(`
        CREATE TABLE test_visit_delete_audit_failure (
          resource_id text PRIMARY KEY
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION fail_visit_delete_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'VISIT_DELETED' AND EXISTS (
            SELECT 1 FROM test_visit_delete_audit_failure
            WHERE resource_id = NEW.resource_id
          ) THEN
            RAISE EXCEPTION 'forced visit deletion audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER fail_visit_delete_audit_trigger
        BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION fail_visit_delete_audit()
      `);
      await prisma.$executeRaw`
        INSERT INTO test_visit_delete_audit_failure (resource_id)
        VALUES (${visit.id})
      `;
      try {
        await expect(
          visitService.deleteVisit(
            visit.id,
            TEST_USERS.admin.sub,
            'admin',
            fixtures.organization.id,
          ),
        ).rejects.toThrow();
        const [persisted, auditCount] = await Promise.all([
          prisma.visit.findUniqueOrThrow({ where: { id: visit.id } }),
          prisma.auditLog.count({
            where: { resource_type: 'Visit', resource_id: visit.id },
          }),
        ]);
        expect(persisted.deleted_at).toBeNull();
        expect(auditCount).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS fail_visit_delete_audit_trigger ON audit_log',
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION IF EXISTS fail_visit_delete_audit()',
        );
        await prisma.$executeRawUnsafe(
          'DROP TABLE IF EXISTS test_visit_delete_audit_failure',
        );
      }
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
