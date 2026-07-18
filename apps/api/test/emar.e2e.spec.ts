import { startPostgres } from './utils/test-container';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService, MedicationStatus, VisitStatus } from '@oasis/db';
import { TEST_USERS, getBearerToken, getTestJwtSecret } from './jwt.mock';
import { StartedTestContainer } from 'testcontainers';
import { MedicationModule } from '../src/medication/medication.module';
import { MedicationService } from '../src/medication/medication.service';
import { MedicationResolver } from '../src/medication/medication.resolver';
import { MedicationRepository } from '../src/medication/medication.repository';
import { ClsModule } from 'nestjs-cls';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@oasis/auth';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { CarerAccessService } from '../src/carer/carer-access.service';
import { AuthAccessModule } from '../src/auth/auth-access.module';
import { MedicationLaunchGuard } from '../src/medication/medication-launch.guard';
import { formatGraphQLError } from '../src/common/filters/graphql-error.filter';

const EMAR_CARER_ID = '88888888-8888-4888-8888-888888888888';

describe('eMAR real DB flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;

  beforeAll(async () => {
    const tc = await startPostgres();
    container = tc.container;
    process.env.DATABASE_URL = tc.dbUrl;
    process.env.JWT_SECRET = getTestJwtSecret();
    process.env.AUTH_IDENTITY_PROVIDER = 'cognito';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    process.env.MEDICATION_EMAR_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            DATABASE_URL: tc.dbUrl,
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
          formatError: formatGraphQLError,
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
        MedicationService,
        MedicationResolver,
        MedicationRepository,
        MedicationLaunchGuard,
        PrismaService,
        CarerAccessService,
        // Mock Prometheus counters for testing
        { provide: 'medication_administrations_total', useValue: { inc: jest.fn() } },
        { provide: 'medication_overlaps_total', useValue: { inc: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // --- seed minimal data ---
    await prisma.organization.create({
      data: {
        id: TEST_USERS.carer.organization_id!,
        name: 'Test Organization',
      },
    });

    const client = await prisma.client.create({
      data: {
        full_name: 'Test Client',
        address_line1: '1 Demo St',
        city: 'London',
        postcode: 'SW1A 1AA',
        organization_id: TEST_USERS.carer.organization_id,
      },
    });

    const carer = await prisma.carer.create({
      data: {
        id: EMAR_CARER_ID,
        organization_id: TEST_USERS.carer.organization_id,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@demo.com'
      },
    });

    await prisma.organizationMembership.create({
      data: {
        id: '99999999-9999-4999-8999-999999999999',
        organization_id: TEST_USERS.carer.organization_id!,
        identity_provider: 'cognito',
        auth_subject: TEST_USERS.carer.sub,
        normalized_email: 'jane@demo.com',
        role: 'carer',
        status: 'ACTIVE',
        carer_id: carer.id,
      },
    });

    const med = await prisma.medication.create({
      data: {
        name: 'Paracetamol',
        dosage: '500',
        unit: 'mg',
        instructions: 'Take with food'
      },
    });

    const prescription = await prisma.prescription.create({
      data: {
        client_id: client.id,
        medication_id: med.id,
        start_date: new Date(),
        frequency_per_day: 2,
        administration_times: ['08:00', '20:00'],
        is_active: true,
      },
    });

    const visit = await prisma.visit.create({
      data: {
        carer_id: carer.id,
        client_id: client.id,
        organization_id: TEST_USERS.carer.organization_id!,
        scheduled_start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scheduled_end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: VisitStatus.SCHEDULED,
      },
    });

    await prisma.medicationAdministration.create({
      data: {
        id: 'adm-001',
        visit_id: visit.id,
        prescription_id: prescription.id,
        scheduled_time: new Date(),
        status: MedicationStatus.SCHEDULED,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
    if (container) {
      await container.stop();
    }
  });

  it('records medication administration end-to-end', async () => {
    process.env.MEDICATION_EMAR_ENABLED = 'true';
    const MUTATION = `
      mutation Record($input: RecordAdministrationInput!) {
        recordAdministration(input: $input) {
          id
          status
        }
      }
    `;

    const variables = {
      input: {
        administrationId: "adm-001",
        status: "ADMINISTERED"
      }
    };

    try {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', getBearerToken('carer'))
        .send({ query: MUTATION, variables })
        .expect(200);

      expect(response.body.data.recordAdministration.status).toBe('ADMINISTERED');

      const inDb = await prisma.medicationAdministration.findUnique({
        where: { id: 'adm-001' }
      });
      expect(inDb?.status).toBe('ADMINISTERED');
      expect(inDb?.administered_by).toBe(EMAR_CARER_ID);
      expect(inDb?.administered_by).not.toBe(TEST_USERS.carer.sub);
    } finally {
      process.env.MEDICATION_EMAR_ENABLED = 'false';
    }
  });

  it('authenticates first, then rejects disabled operations without service access or writes', async () => {
    process.env.MEDICATION_EMAR_ENABLED = 'false';
    const existing = await prisma.medicationAdministration.findUniqueOrThrow({
      where: { id: 'adm-001' },
    });
    await prisma.medicationAdministration.create({
      data: {
        id: 'adm-disabled',
        visit_id: existing.visit_id,
        prescription_id: existing.prescription_id,
        scheduled_time: new Date(),
        status: MedicationStatus.SCHEDULED,
      },
    });
    const service = app.get(MedicationService);
    const serviceSpy = jest.spyOn(service, 'recordAdministration');
    const mutation = `
      mutation DisabledRecord($input: RecordAdministrationInput!) {
        recordAdministration(input: $input) { id status }
      }
    `;
    const variables = {
      input: { administrationId: 'adm-disabled', status: 'MISSED' },
    };

    const unauthenticated = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation, variables })
      .expect(200);
    expect(unauthenticated.body.errors?.[0]?.extensions?.code).toBe(
      'UNAUTHENTICATED',
    );

    const disabled = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', getBearerToken('carer'))
      .send({ query: mutation, variables })
      .expect(200);
    expect(disabled.body.data?.recordAdministration ?? null).toBeNull();
    expect(disabled.body.errors?.[0]?.extensions?.code).toBe(
      'FEATURE_NOT_ENABLED',
    );
    expect(serviceSpy).not.toHaveBeenCalled();

    const inDb = await prisma.medicationAdministration.findUnique({
      where: { id: 'adm-disabled' },
    });
    expect(inDb?.status).toBe(MedicationStatus.SCHEDULED);
    expect(inDb?.administered_by).toBeNull();
  });
});
