import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import request from 'supertest';
import { ClsModule } from 'nestjs-cls';
import { MedicationModule } from '../src/medication/medication.module';
import { PrismaService } from '@oasis/db';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@oasis/auth';
import { getBearerToken } from './jwt.mock';
import { formatGraphQLError } from '../src/common/filters/graphql-error.filter';

describe('Medication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockCarerUser = {
    id: 'carer-123',
    role: 'carer',
    email: 'carer@test.com',
  };

  const mockAdminUser = {
    id: 'admin-123',
    role: 'admin',
    email: 'admin@test.com',
  };

  const mockOfficeUser = {
    id: 'office-123',
    role: 'office',
    email: 'office@test.com',
  };

  const mockJwtStrategy = {
    validate: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
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
          autoSchemaFile: true,
          sortSchema: true,
          formatError: formatGraphQLError,
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        MedicationModule,
      ],
      providers: [
        PrismaService,
        {
          provide: JwtStrategy,
          useValue: mockJwtStrategy,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset the mock user for each test
    mockJwtStrategy.validate.mockResolvedValue(mockCarerUser);
  });

  describe('listDueMeds', () => {
    const LIST_DUE_MEDS_QUERY = `
      query ListDueMeds($visitId: String!) {
        listDueMeds(visitId: $visitId) {
          id
          scheduledTime
          status
          notes
          prescription {
            id
            medication {
              name
              dosage
              unit
            }
            client {
              fullName
            }
            specialInstructions
          }
          visit {
            id
            scheduledStart
            scheduledEnd
          }
        }
      }
    `;

    it('should return due medications for a visit', async () => {
      // Mock the database to return some test data
      jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([
        {
          id: 'med-admin-1',
          prescription_id: 'prescription-1',
          visit_id: 'visit-123',
          scheduled_time: new Date('2025-01-08T10:00:00Z'),
          administered_time: null,
          administered_by: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          prescription: {
            id: 'prescription-1',
            client_id: 'client-1',
            medication_id: 'medication-1',
            start_date: new Date('2025-01-01'),
            end_date: null,
            frequency_per_day: 2,
            frequency_interval_hours: 12,
            administration_times: ['08:00', '20:00'],
            special_instructions: 'Take with food',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            client: {
              id: 'client-1',
              full_name: 'John Doe',
              date_of_birth: new Date('1950-01-01'),
              address: '123 Main St',
              phone_number: '555-0123',
              emergency_contact: 'Jane Doe',
              emergency_phone: '555-0124',
              medical_notes: null,
              care_plan: null,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            medication: {
              id: 'medication-1',
              name: 'Metformin',
              dosage: '500',
              unit: 'mg',
              instructions: 'Take with meals',
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            administrations: [],
          },
          visit: {
            id: 'visit-123',
            carer_id: 'carer-123',
            client_id: 'client-1',
            scheduled_start: new Date('2025-01-08T09:30:00Z'),
            scheduled_end: new Date('2025-01-08T10:30:00Z'),
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: LIST_DUE_MEDS_QUERY,
          variables: { visitId: 'visit-123' },
        })
        .expect(200);

      expect(response.body.data.listDueMeds).toBeDefined();
      expect(response.body.data.listDueMeds).toHaveLength(1);
      expect(response.body.data.listDueMeds[0]).toMatchObject({
        id: 'med-admin-1',
        status: 'SCHEDULED',
        prescription: {
          medication: {
            name: 'Metformin',
            dosage: '500',
            unit: 'mg',
          },
          client: {
            fullName: 'John Doe',
          },
          specialInstructions: 'Take with food',
        },
      });
    });

    it('should filter medications for different carer', async () => {
      // Mock data where visit is assigned to different carer
      jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([
        {
          id: 'med-admin-1',
          prescription_id: 'prescription-1',
          visit_id: 'visit-123',
          scheduled_time: new Date('2025-01-08T10:00:00Z'),
          administered_time: null,
          administered_by: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          prescription: {
            id: 'prescription-1',
            client_id: 'client-1',
            medication_id: 'medication-1',
            start_date: new Date('2025-01-01'),
            end_date: null,
            frequency_per_day: 2,
            frequency_interval_hours: 12,
            administration_times: ['08:00', '20:00'],
            special_instructions: 'Take with food',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            client: {
              id: 'client-1',
              full_name: 'John Doe',
              date_of_birth: new Date('1950-01-01'),
              address: '123 Main St',
              phone_number: '555-0123',
              emergency_contact: 'Jane Doe',
              emergency_phone: '555-0124',
              medical_notes: null,
              care_plan: null,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            medication: {
              id: 'medication-1',
              name: 'Metformin',
              dosage: '500',
              unit: 'mg',
              instructions: 'Take with meals',
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            administrations: [],
          },
          visit: {
            id: 'visit-123',
            carer_id: 'different-carer-456', // Different carer
            client_id: 'client-1',
            scheduled_start: new Date('2025-01-08T09:30:00Z'),
            scheduled_end: new Date('2025-01-08T10:30:00Z'),
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: LIST_DUE_MEDS_QUERY,
          variables: { visitId: 'visit-123' },
        })
        .expect(200);

      // Should return empty array since medications are filtered by carer
      expect(response.body.data.listDueMeds).toHaveLength(0);
    });
  });

  describe('recordAdministration', () => {
    const RECORD_ADMINISTRATION_MUTATION = `
      mutation RecordAdministration($input: RecordAdministrationInput!) {
        recordAdministration(input: $input) {
          id
          status
          administeredTime
          administeredBy
          notes
        }
      }
    `;

    it('should successfully record medication administration', async () => {
      const administrationId = 'med-admin-123';
      
      // Mock finding the administration
      jest.spyOn(prisma.medicationAdministration, 'findUnique').mockResolvedValue({
        id: administrationId,
        prescription_id: 'prescription-1',
        visit_id: 'visit-123',
        scheduled_time: new Date('2025-01-08T10:00:00Z'),
        administered_time: null,
        administered_by: null,
        status: 'SCHEDULED',
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        prescription: {
          id: 'prescription-1',
          client_id: 'client-1',
          medication_id: 'medication-1',
          start_date: new Date('2025-01-01'),
          end_date: null,
          frequency_per_day: 2,
          frequency_interval_hours: 12,
          administration_times: ['08:00', '20:00'],
          special_instructions: 'Take with food',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          client: {
            id: 'client-1',
            full_name: 'John Doe',
            date_of_birth: new Date('1950-01-01'),
            address: '123 Main St',
            phone_number: '555-0123',
            emergency_contact: 'Jane Doe',
            emergency_phone: '555-0124',
            medical_notes: null,
            care_plan: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
          medication: {
            id: 'medication-1',
            name: 'Metformin',
            dosage: '500',
            unit: 'mg',
            instructions: 'Take with meals',
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
          administrations: [],
        },
        visit: {
          id: 'visit-123',
          carer_id: 'carer-123', // Same as authenticated user
          client_id: 'client-1',
          scheduled_start: new Date('2025-01-08T09:30:00Z'),
          scheduled_end: new Date('2025-01-08T10:30:00Z'),
          actual_start: null,
          actual_end: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      } as any);

      // Mock no overlapping medications
      jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([]);

      // Mock successful update
      const administeredTime = new Date();
      jest.spyOn(prisma.medicationAdministration, 'update').mockResolvedValue({
        id: administrationId,
        prescription_id: 'prescription-1',
        visit_id: 'visit-123',
        scheduled_time: new Date('2025-01-08T10:00:00Z'),
        administered_time: administeredTime,
        administered_by: 'carer-123',
        status: 'ADMINISTERED',
        notes: 'Patient took medication without issues',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        prescription: {
          id: 'prescription-1',
          client_id: 'client-1',
          medication_id: 'medication-1',
          start_date: new Date('2025-01-01'),
          end_date: null,
          frequency_per_day: 2,
          frequency_interval_hours: 12,
          administration_times: ['08:00', '20:00'],
          special_instructions: 'Take with food',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          client: {
            id: 'client-1',
            full_name: 'John Doe',
            date_of_birth: new Date('1950-01-01'),
            address: '123 Main St',
            phone_number: '555-0123',
            emergency_contact: 'Jane Doe',
            emergency_phone: '555-0124',
            medical_notes: null,
            care_plan: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
          medication: {
            id: 'medication-1',
            name: 'Metformin',
            dosage: '500',
            unit: 'mg',
            instructions: 'Take with meals',
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
          administrations: [],
        },
        visit: {
          id: 'visit-123',
          carer_id: 'carer-123',
          client_id: 'client-1',
          scheduled_start: new Date('2025-01-08T09:30:00Z'),
          scheduled_end: new Date('2025-01-08T10:30:00Z'),
          actual_start: null,
          actual_end: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      } as any);

      // Mock audit creation
      jest.spyOn(prisma.medicationAudit, 'create').mockResolvedValue({
        id: 'audit-1',
        prescription_id: null,
        medication_administration_id: administrationId,
        action: 'MEDICATION_ADMINISTERED',
        actor_id: 'carer-123',
        actor_role: 'carer',
        changes: '{}',
        created_at: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: RECORD_ADMINISTRATION_MUTATION,
          variables: {
            input: {
              administrationId,
              status: 'ADMINISTERED',
              notes: 'Patient took medication without issues',
            },
          },
        })
        .expect(200);

      expect(response.body.data.recordAdministration).toMatchObject({
        id: administrationId,
        status: 'ADMINISTERED',
        administeredBy: 'carer-123',
        notes: 'Patient took medication without issues',
      });
    });

    it('should return error for unauthorized access', async () => {
      // Mock finding administration with different carer
      jest.spyOn(prisma.medicationAdministration, 'findUnique').mockResolvedValue({
        id: 'med-admin-123',
        prescription_id: 'prescription-1',
        visit_id: 'visit-123',
        scheduled_time: new Date('2025-01-08T10:00:00Z'),
        administered_time: null,
        administered_by: null,
        status: 'SCHEDULED',
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        visit: {
          id: 'visit-123',
          carer_id: 'different-carer-456', // Different carer
          client_id: 'client-1',
          scheduled_start: new Date('2025-01-08T09:30:00Z'),
          scheduled_end: new Date('2025-01-08T10:30:00Z'),
          actual_start: null,
          actual_end: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      } as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: RECORD_ADMINISTRATION_MUTATION,
          variables: {
            input: {
              administrationId: 'med-admin-123',
              status: 'ADMINISTERED',
            },
          },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN_OWN_RESOURCE_ONLY');
    });
  });

  describe('getTodaysMedicationsByClient', () => {
    const GET_TODAYS_MEDICATIONS_QUERY = `
      query GetTodaysMedicationsByClient($date: String!) {
        getTodaysMedicationsByClient(date: $date) {
          id
          scheduledTime
          status
          administeredTime
          prescription {
            medication {
              name
              dosage
              unit
            }
            client {
              fullName
            }
          }
        }
      }
    `;

    it('should return todays medications for admin users with resolved organization context', async () => {
      mockJwtStrategy.validate.mockResolvedValue({
        ...mockAdminUser,
        organizationId: 'org-123',
      });

      const findManySpy = jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([
        {
          id: 'med-admin-admin',
          prescription_id: 'prescription-admin',
          visit_id: 'visit-admin',
          scheduled_time: new Date('2025-01-08T10:00:00Z'),
          administered_time: null,
          administered_by: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          prescription: {
            id: 'prescription-admin',
            client_id: 'client-admin',
            medication_id: 'medication-admin',
            start_date: new Date('2025-01-01'),
            end_date: null,
            frequency_per_day: 1,
            frequency_interval_hours: null,
            administration_times: ['10:00'],
            special_instructions: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            client: {
              id: 'client-admin',
              full_name: 'Admin Client',
              address_line1: '1 Admin St',
              address_line2: null,
              city: 'London',
              postcode: 'SW1A 1AA',
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            medication: {
              id: 'medication-admin',
              name: 'Warfarin',
              dosage: '2',
              unit: 'mg',
              instructions: null,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          },
          visit: {
            id: 'visit-admin',
            carer_id: 'carer-123',
            client_id: 'client-admin',
            scheduled_start: new Date('2025-01-08T09:30:00Z'),
            scheduled_end: new Date('2025-01-08T10:30:00Z'),
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: GET_TODAYS_MEDICATIONS_QUERY,
          variables: { date: '2025-01-08' },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getTodaysMedicationsByClient).toHaveLength(1);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prescription: {
              client: {
                organization_id: 'org-123',
                deleted_at: null,
              },
            },
          }),
        }),
      );
    });

    it('should return todays medications for office user', async () => {
      // Set user to office role
      mockJwtStrategy.validate.mockResolvedValue({
        ...mockOfficeUser,
        organizationId: 'org-123',
      });

      jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([
        {
          id: 'med-admin-1',
          prescription_id: 'prescription-1',
          visit_id: 'visit-123',
          scheduled_time: new Date('2025-01-08T10:00:00Z'),
          administered_time: new Date('2025-01-08T10:05:00Z'),
          administered_by: 'carer-123',
          status: 'ADMINISTERED',
          notes: 'Taken with breakfast',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          prescription: {
            id: 'prescription-1',
            client_id: 'client-1',
            medication_id: 'medication-1',
            start_date: new Date('2025-01-01'),
            end_date: null,
            frequency_per_day: 2,
            frequency_interval_hours: 12,
            administration_times: ['08:00', '20:00'],
            special_instructions: 'Take with food',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            client: {
              id: 'client-1',
              full_name: 'John Doe',
              date_of_birth: new Date('1950-01-01'),
              address: '123 Main St',
              phone_number: '555-0123',
              emergency_contact: 'Jane Doe',
              emergency_phone: '555-0124',
              medical_notes: null,
              care_plan: null,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            medication: {
              id: 'medication-1',
              name: 'Metformin',
              dosage: '500',
              unit: 'mg',
              instructions: 'Take with meals',
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            administrations: [],
          },
          visit: {
            id: 'visit-123',
            carer_id: 'carer-123',
            client_id: 'client-1',
            scheduled_start: new Date('2025-01-08T09:30:00Z'),
            scheduled_end: new Date('2025-01-08T10:30:00Z'),
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: GET_TODAYS_MEDICATIONS_QUERY,
          variables: { date: '2025-01-08' },
        })
        .expect(200);

      expect(response.body.data.getTodaysMedicationsByClient).toBeDefined();
      expect(response.body.data.getTodaysMedicationsByClient).toHaveLength(1);
      expect(response.body.data.getTodaysMedicationsByClient[0]).toMatchObject({
        id: 'med-admin-1',
        status: 'ADMINISTERED',
        prescription: {
          medication: {
            name: 'Metformin',
            dosage: '500',
            unit: 'mg',
          },
          client: {
            fullName: 'John Doe',
          },
        },
      });
    });

    it('should allow access for carer role', async () => {
      mockJwtStrategy.validate.mockResolvedValue({
        ...mockCarerUser,
        organizationId: 'org-123',
      });

      const findManySpy = jest.spyOn(prisma.medicationAdministration, 'findMany').mockResolvedValue([
        {
          id: 'med-admin-2',
          prescription_id: 'prescription-2',
          visit_id: 'visit-456',
          scheduled_time: new Date('2025-01-08T12:00:00Z'),
          administered_time: null,
          administered_by: null,
          status: 'SCHEDULED',
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          prescription: {
            id: 'prescription-2',
            client_id: 'client-2',
            medication_id: 'medication-2',
            start_date: new Date('2025-01-01'),
            end_date: null,
            frequency_per_day: 1,
            frequency_interval_hours: 24,
            administration_times: ['12:00'],
            special_instructions: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            client: {
              id: 'client-2',
              full_name: 'Jane Doe',
              address_line1: '456 High St',
              address_line2: null,
              city: 'London',
              postcode: 'SW1A 1AA',
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            medication: {
              id: 'medication-2',
              name: 'Aspirin',
              dosage: '75',
              unit: 'mg',
              instructions: null,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
            administrations: [],
          },
          visit: {
            id: 'visit-456',
            carer_id: 'carer-123',
            client_id: 'client-2',
            scheduled_start: new Date('2025-01-08T11:30:00Z'),
            scheduled_end: new Date('2025-01-08T12:30:00Z'),
            actual_start: null,
            actual_end: null,
            status: 'SCHEDULED',
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: GET_TODAYS_MEDICATIONS_QUERY,
          variables: { date: '2025-01-08' },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getTodaysMedicationsByClient).toHaveLength(1);
      expect(response.body.data.getTodaysMedicationsByClient[0]).toMatchObject({
        id: 'med-admin-2',
        status: 'SCHEDULED',
        prescription: {
          medication: {
            name: 'Aspirin',
            dosage: '75',
            unit: 'mg',
          },
          client: {
            fullName: 'Jane Doe',
          },
        },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visit: {
              is: {
                organization_id: 'org-123',
                carer_id: 'carer-123',
                deleted_at: null,
              },
            },
          }),
        }),
      );
    });

    it('should return explicit forbidden when organization context cannot be resolved', async () => {
      mockJwtStrategy.validate.mockResolvedValue({
        ...mockAdminUser,
        organizationId: null,
      });

      jest.spyOn(prisma.organizationIdentity, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.carer, 'findMany').mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token')
        .send({
          query: GET_TODAYS_MEDICATIONS_QUERY,
          variables: { date: '2025-01-08' },
        })
        .expect(200);

      expect(response.body.data).toBeNull();
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
      expect(response.body.errors[0].message).toBe('Organization context is required for this request');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
