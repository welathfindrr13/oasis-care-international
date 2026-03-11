import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { StartedTestContainer } from 'testcontainers';
import { ClsModule } from 'nestjs-cls';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';
import {
  MedicationModule,
} from '../src/medication/medication.module';
import {
  MedicationStatus,
  PrismaService,
  VisitStatus,
} from '@oasis/db';
import { startPostgres } from './utils/test-container';
import { MockAuthGuard } from './auth.guard.mock';
import { TEST_USERS, getBearerToken, getTestJwtSecret } from './jwt.mock';
import { formatGraphQLError } from '../src/common/filters/graphql-error.filter';
import { GraphqlExceptionFilter } from '../src/common/filters/gql-exception.filter';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Medication E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;

  const GET_TODAYS_MEDICATIONS_QUERY = `
    query GetTodaysMedicationsByClient($date: String!) {
      getTodaysMedicationsByClient(date: $date) {
        id
        status
        prescription {
          client {
            fullName
          }
          medication {
            name
          }
        }
        visit {
          id
          carerId
        }
      }
    }
  `;

  beforeAll(async () => {
    const tc = await startPostgres();
    container = tc.container;
    process.env.DATABASE_URL = tc.dbUrl;
    process.env.JWT_SECRET = getTestJwtSecret();

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
            setup: (cls) => {
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
        MedicationModule,
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);

    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new GraphqlExceptionFilter(),
    );

    const passport = require('passport');
    app.use(passport.initialize());

    await app.init();
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.medicationAudit.deleteMany(),
      prisma.medicationAdministration.deleteMany(),
      prisma.prescription.deleteMany(),
      prisma.medication.deleteMany(),
      prisma.visitTask.deleteMany(),
      prisma.visit.deleteMany(),
      prisma.carer.deleteMany(),
      prisma.client.deleteMany(),
      prisma.organization.deleteMany(),
    ]);

    const organization = await prisma.organization.create({
      data: {
        name: 'Medication Test Org',
      },
    });

    const [carer, otherCarer] = await Promise.all([
      prisma.carer.create({
        data: {
          id: TEST_USERS.carer.sub,
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane.doe@test.com',
        },
      }),
      prisma.carer.create({
        data: {
          id: TEST_USERS.otherCarer.sub,
          first_name: 'John',
          last_name: 'Smith',
          email: 'john.smith@test.com',
        },
      }),
    ]);

    const [client, otherClient] = await Promise.all([
      prisma.client.create({
        data: {
          full_name: 'Mary Jones',
          address_line1: '1 Main Street',
          city: 'London',
          postcode: 'SW1A 1AA',
          organization_id: organization.id,
        },
      }),
      prisma.client.create({
        data: {
          full_name: 'Robert Brown',
          address_line1: '2 Main Street',
          city: 'London',
          postcode: 'SW1A 1AB',
          organization_id: organization.id,
        },
      }),
    ]);

    const medication = await prisma.medication.create({
      data: {
        name: 'Paracetamol',
        dosage: '500',
        unit: 'mg',
        instructions: 'Take with food',
      },
    });

    const [primaryPrescription, secondaryPrescription] = await Promise.all([
      prisma.prescription.create({
        data: {
          client_id: client.id,
          medication_id: medication.id,
          start_date: new Date('2026-03-11T00:00:00Z'),
          frequency_per_day: 2,
          administration_times: ['08:00', '20:00'],
          is_active: true,
        },
      }),
      prisma.prescription.create({
        data: {
          client_id: otherClient.id,
          medication_id: medication.id,
          start_date: new Date('2026-03-11T00:00:00Z'),
          frequency_per_day: 2,
          administration_times: ['08:00', '20:00'],
          is_active: true,
        },
      }),
    ]);

    const [primaryVisit, secondaryVisit] = await Promise.all([
      prisma.visit.create({
        data: {
          carer_id: carer.id,
          client_id: client.id,
          scheduled_start: new Date('2026-03-11T08:30:00Z'),
          scheduled_end: new Date('2026-03-11T09:30:00Z'),
          status: VisitStatus.SCHEDULED,
        },
      }),
      prisma.visit.create({
        data: {
          carer_id: otherCarer.id,
          client_id: otherClient.id,
          scheduled_start: new Date('2026-03-11T10:30:00Z'),
          scheduled_end: new Date('2026-03-11T11:30:00Z'),
          status: VisitStatus.SCHEDULED,
        },
      }),
    ]);

    await prisma.medicationAdministration.createMany({
      data: [
        {
          id: 'med-admin-primary',
          prescription_id: primaryPrescription.id,
          visit_id: primaryVisit.id,
          scheduled_time: new Date('2026-03-11T08:45:00Z'),
          status: MedicationStatus.SCHEDULED,
        },
        {
          id: 'med-admin-secondary',
          prescription_id: secondaryPrescription.id,
          visit_id: secondaryVisit.id,
          scheduled_time: new Date('2026-03-11T10:45:00Z'),
          status: MedicationStatus.SCHEDULED,
        },
      ],
    });
  });

  it('allows admin to retrieve all medications scheduled for the day', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', getBearerToken('admin'))
      .send({
        query: GET_TODAYS_MEDICATIONS_QUERY,
        variables: { date: '2026-03-11' },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.getTodaysMedicationsByClient).toHaveLength(2);
  });

  it('scopes carers to medications on their own assigned visits', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', getBearerToken('carer'))
      .send({
        query: GET_TODAYS_MEDICATIONS_QUERY,
        variables: { date: '2026-03-11' },
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.getTodaysMedicationsByClient).toHaveLength(1);
    expect(response.body.data.getTodaysMedicationsByClient[0]).toMatchObject({
      id: 'med-admin-primary',
      visit: {
        carerId: TEST_USERS.carer.sub,
      },
      prescription: {
        client: {
          fullName: 'Mary Jones',
        },
      },
    });
  });

  it('rejects malformed medication dates with a typed GraphQL error', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', getBearerToken('admin'))
      .send({
        query: GET_TODAYS_MEDICATIONS_QUERY,
        variables: { date: 'not-a-date' },
      })
      .expect(200);

    expect(response.body.data).toBeNull();
    expect(response.body.errors[0].extensions.code).toBe('VALIDATION_FAILED');
  });
});
