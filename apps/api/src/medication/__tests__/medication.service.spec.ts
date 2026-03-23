import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Counter } from 'prom-client';
import { MedicationService } from '../medication.service';
import { MedicationRepository } from '../medication.repository';
import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { MedicationStatus, MedicationAuditAction } from '@oasis/db';

describe('MedicationService', () => {
  let service: MedicationService;
  let repository: jest.Mocked<MedicationRepository>;
  let clsService: jest.Mocked<ClsService>;
  let adminCounter: jest.Mocked<Counter>;
  let overlapCounter: jest.Mocked<Counter>;

  const mockUser = {
    id: 'user-123',
    role: 'carer',
  };

  const mockAdminUser = {
    id: 'admin-123',
    role: 'admin',
  };

  const mockMedicationAdministration = {
    id: 'med-admin-123',
    prescription_id: 'prescription-123',
    visit_id: 'visit-123',
    scheduled_time: new Date('2025-01-08T10:00:00Z'),
    administered_time: null,
    administered_by: null,
    status: MedicationStatus.SCHEDULED,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    prescription: {
      id: 'prescription-123',
      client_id: 'client-123',
      medication_id: 'medication-123',
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
        id: 'client-123',
        full_name: 'John Doe',
      },
      medication: {
        id: 'medication-123',
        name: 'Metformin',
        dosage: '500',
        unit: 'mg',
      },
    },
    visit: {
      id: 'visit-123',
      carer_id: 'user-123',
      client_id: 'client-123',
      scheduled_start: new Date('2025-01-08T09:30:00Z'),
      scheduled_end: new Date('2025-01-08T10:30:00Z'),
    },
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-08T06:00:00Z'));

    const mockRepository = {
      findMedicationAdministrationById: jest.fn(),
      updateMedicationAdministration: jest.fn(),
      createMedicationAudit: jest.fn(),
      findOverlappingMedicationTimes: jest.fn(),
      findDueMedicationsForVisit: jest.fn(),
      findVisitMedications: jest.fn(),
      findTodaysMedicationsByClient: jest.fn(),
      createMedication: jest.fn(),
      findMedicationById: jest.fn(),
      findPrescriptionById: jest.fn(),
      createPrescriptionWithSchedule: jest.fn(),
      updatePrescriptionWithScheduleReconciliation: jest.fn(),
      findVisitsForClientInRange: jest.fn(),
      findScheduledMedicationAdministrationsForClientInRange: jest.fn(),
      findActivePrescriptionsOverlappingWindow: jest.fn().mockResolvedValue([]),
      ensureScheduledAdministrationsForPrescription: jest.fn().mockResolvedValue(0),
      findVisitById: jest.fn().mockResolvedValue(null),
      findPrescriptions: jest.fn(),
    };

    const mockClsService = {
      get: jest.fn(),
    };

    const mockAdminCounter = {
      inc: jest.fn(),
    };

    const mockOverlapCounter = {
      inc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicationService,
        {
          provide: MedicationRepository,
          useValue: mockRepository,
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
        {
          provide: 'medication_administrations_total',
          useValue: mockAdminCounter,
        },
        {
          provide: 'medication_overlaps_total',
          useValue: mockOverlapCounter,
        },
      ],
    }).compile();

    service = module.get<MedicationService>(MedicationService);
    repository = module.get(MedicationRepository);
    clsService = module.get(ClsService);
    adminCounter = module.get('medication_administrations_total');
    overlapCounter = module.get('medication_overlaps_total');

    clsService.get.mockReturnValue('test-request-id');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createPrescription', () => {
    it('should seed scheduled administrations and pre-link matching visits', async () => {
      repository.findMedicationById.mockResolvedValue({
        id: 'medication-123',
        name: 'Metformin',
      } as any);
      repository.findVisitsForClientInRange.mockResolvedValue([
        {
          id: 'visit-123',
          client_id: 'client-123',
          scheduled_start: new Date('2025-01-08T09:00:00Z'),
          scheduled_end: new Date('2025-01-08T10:00:00Z'),
          status: 'SCHEDULED',
        },
      ] as any);
      repository.createPrescriptionWithSchedule.mockResolvedValue({
        id: 'prescription-123',
      } as any);

      const result = await service.createPrescription(
        {
          clientId: 'client-123',
          medicationId: 'medication-123',
          startDate: '2025-01-08T00:00:00.000Z',
          endDate: '2025-01-09T23:59:59.000Z',
          frequencyPerDay: 1,
          administrationTimes: ['08:00'],
          isActive: true,
        },
        mockAdminUser.id,
        'admin'
      );

      expect(repository.createPrescriptionWithSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          prescription: expect.objectContaining({
            frequency_per_day: 1,
            administration_times: ['08:00'],
          }),
          administrations: [
            {
              scheduledTime: new Date('2025-01-08T08:00:00.000Z'),
              visitId: 'visit-123',
            },
            {
              scheduledTime: new Date('2025-01-09T08:00:00.000Z'),
              visitId: null,
            },
          ],
          actorId: mockAdminUser.id,
          actorRole: 'admin',
        })
      );
      expect(result.id).toBe('prescription-123');
    });
  });

  describe('reconcileMedicationAdministrationsForVisitWindow', () => {
    it('should attach scheduled administrations to the nearest matching visit', async () => {
      repository.findVisitsForClientInRange.mockResolvedValue([
        {
          id: 'visit-123',
          client_id: 'client-123',
          scheduled_start: new Date('2025-01-08T09:00:00Z'),
          scheduled_end: new Date('2025-01-08T10:00:00Z'),
          status: 'SCHEDULED',
        },
      ] as any);
      repository.findScheduledMedicationAdministrationsForClientInRange.mockResolvedValue([
        {
          id: 'med-admin-123',
          visit_id: null,
          scheduled_time: new Date('2025-01-08T08:00:00Z'),
        },
      ] as any);
      repository.updateMedicationAdministration.mockResolvedValue(mockMedicationAdministration as any);

      await service.reconcileMedicationAdministrationsForVisitWindow(
        'client-123',
        new Date('2025-01-08T09:00:00Z'),
        new Date('2025-01-08T10:00:00Z')
      );

      expect(repository.updateMedicationAdministration).toHaveBeenCalledWith('med-admin-123', {
        visit: { connect: { id: 'visit-123' } },
      });
    });
  });

  describe('updatePrescription', () => {
    const existingPrescription = {
      id: 'prescription-123',
      client_id: 'client-123',
      medication_id: 'medication-123',
      start_date: new Date('2025-01-01T00:00:00.000Z'),
      end_date: new Date('2025-01-09T23:59:59.000Z'),
      frequency_per_day: 1,
      frequency_interval_hours: null,
      administration_times: ['08:00'],
      special_instructions: 'Take with food',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    it('should rebuild future scheduled administrations when the live schedule changes', async () => {
      repository.findPrescriptionById.mockResolvedValue(existingPrescription as any);
      repository.findVisitsForClientInRange.mockResolvedValue([
        {
          id: 'visit-123',
          client_id: 'client-123',
          scheduled_start: new Date('2025-01-08T09:00:00Z'),
          scheduled_end: new Date('2025-01-08T10:00:00Z'),
          status: 'SCHEDULED',
        },
      ] as any);
      repository.updatePrescriptionWithScheduleReconciliation.mockResolvedValue({
        id: 'prescription-123',
      } as any);

      const result = await service.updatePrescription(
        {
          id: 'prescription-123',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-09T23:59:59.000Z',
          frequencyPerDay: 1,
          administrationTimes: ['09:00'],
          isActive: true,
          specialInstructions: 'Updated instructions',
        },
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(repository.updatePrescriptionWithScheduleReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({
          prescriptionId: 'prescription-123',
          cancelScheduledFrom: new Date('2025-01-08T06:00:00.000Z'),
          administrations: [
            {
              scheduledTime: new Date('2025-01-08T09:00:00.000Z'),
              visitId: 'visit-123',
            },
            {
              scheduledTime: new Date('2025-01-09T09:00:00.000Z'),
              visitId: null,
            },
          ],
          reconciliationReason: 'Prescription schedule updated',
        })
      );
      expect(result.id).toBe('prescription-123');
    });

    it('should preserve future rows when only non-scheduling details change', async () => {
      repository.findPrescriptionById.mockResolvedValue(existingPrescription as any);
      repository.updatePrescriptionWithScheduleReconciliation.mockResolvedValue({
        id: 'prescription-123',
      } as any);

      await service.updatePrescription(
        {
          id: 'prescription-123',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-09T23:59:59.000Z',
          frequencyPerDay: 1,
          administrationTimes: ['08:00'],
          isActive: true,
          specialInstructions: 'Updated narrative only',
        },
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(repository.updatePrescriptionWithScheduleReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelScheduledFrom: undefined,
          administrations: [],
          reconciliationReason: 'Prescription details updated',
        })
      );
      expect(repository.findVisitsForClientInRange).not.toHaveBeenCalled();
    });
  });

  describe('recordAdministration', () => {
    it('should successfully record medication administration', async () => {
      const input = {
        administrationId: 'med-admin-123',
        status: MedicationStatus.ADMINISTERED,
        notes: 'Patient took medication without issues',
      };

      repository.findMedicationAdministrationById.mockResolvedValue(mockMedicationAdministration as any);
      repository.findOverlappingMedicationTimes.mockResolvedValue([]);
      repository.updateMedicationAdministration.mockResolvedValue({
        ...mockMedicationAdministration,
        status: MedicationStatus.ADMINISTERED,
        administered_time: new Date(),
        administered_by: mockUser.id,
        notes: input.notes,
      } as any);

      const result = await service.recordAdministration(
        input,
        mockUser.id,
        mockUser.role
      );

      expect(result.status).toBe(MedicationStatus.ADMINISTERED);
      expect(result.administered_by).toBe(mockUser.id);
      expect(result.notes).toBe(input.notes);
      expect(adminCounter.inc).toHaveBeenCalled();
      expect(repository.createMedicationAudit).toHaveBeenCalledWith({
        medicationAdministrationId: mockMedicationAdministration.id,
        action: MedicationAuditAction.MEDICATION_ADMINISTERED,
        actorId: mockUser.id,
        actorRole: mockUser.role,
        changes: expect.any(Object),
      });
    });

    it('should throw error if administration record not found', async () => {
      const input = {
        administrationId: 'nonexistent-id',
        status: MedicationStatus.ADMINISTERED,
      };

      repository.findMedicationAdministrationById.mockResolvedValue(null);

      await expect(
        service.recordAdministration(input, mockUser.id, mockUser.role)
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.MEDICATION_ADMINISTRATION_NOT_FOUND,
          'Medication administration record not found',
          HttpStatus.NOT_FOUND
        )
      );
    });

    it('should throw error if carer tries to record for different visit', async () => {
      const input = {
        administrationId: 'med-admin-123',
        status: MedicationStatus.ADMINISTERED,
      };

      const differentCarerAdmin = {
        ...mockMedicationAdministration,
        visit: {
          ...mockMedicationAdministration.visit,
          carer_id: 'different-carer-123',
        },
      };

      repository.findMedicationAdministrationById.mockResolvedValue(differentCarerAdmin as any);

      await expect(
        service.recordAdministration(input, mockUser.id, mockUser.role)
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'You can only record medications for your own visits',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should detect and prevent medication overlap', async () => {
      const input = {
        administrationId: 'med-admin-123',
        status: MedicationStatus.ADMINISTERED,
      };

      const overlappingMedication = {
        id: 'overlapping-med-123',
        prescription_id: mockMedicationAdministration.prescription_id,
        scheduled_time: new Date('2025-01-08T10:15:00Z'), // 15 minutes after
        status: MedicationStatus.ADMINISTERED,
      };

      repository.findMedicationAdministrationById.mockResolvedValue(mockMedicationAdministration as any);
      repository.findOverlappingMedicationTimes.mockResolvedValue([overlappingMedication] as any);

      await expect(
        service.recordAdministration(input, mockUser.id, mockUser.role)
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.MEDICATION_OVERLAP,
          'This medication was already administered within the time window',
          HttpStatus.CONFLICT
        )
      );

      expect(overlapCounter.inc).toHaveBeenCalled();
    });

    it('should allow overlap with the same administration record', async () => {
      const input = {
        administrationId: 'med-admin-123',  
        status: MedicationStatus.ADMINISTERED,
      };

      const sameAdministration = {
        id: 'med-admin-123', // Same ID as the one being updated
        prescription_id: mockMedicationAdministration.prescription_id,
        scheduled_time: mockMedicationAdministration.scheduled_time,
        status: MedicationStatus.SCHEDULED,
      };

      repository.findMedicationAdministrationById.mockResolvedValue(mockMedicationAdministration as any);
      repository.findOverlappingMedicationTimes.mockResolvedValue([sameAdministration] as any);
      repository.updateMedicationAdministration.mockResolvedValue({
        ...mockMedicationAdministration,
        status: MedicationStatus.ADMINISTERED,
        administered_time: new Date(),
        administered_by: mockUser.id,
      } as any);

      const result = await service.recordAdministration(
        input,
        mockUser.id,
        mockUser.role
      );

      expect(result.status).toBe(MedicationStatus.ADMINISTERED);
      expect(overlapCounter.inc).not.toHaveBeenCalled();
    });

    it('should record missed medication without overlap check', async () => {
      const input = {
        administrationId: 'med-admin-123',
        status: MedicationStatus.MISSED,
        notes: 'Patient was sleeping',
      };

      repository.findMedicationAdministrationById.mockResolvedValue(mockMedicationAdministration as any);
      repository.updateMedicationAdministration.mockResolvedValue({
        ...mockMedicationAdministration,
        status: MedicationStatus.MISSED,
        notes: input.notes,
      } as any);

      const result = await service.recordAdministration(
        input,
        mockUser.id,
        mockUser.role
      );

      expect(result.status).toBe(MedicationStatus.MISSED);
      expect(repository.findOverlappingMedicationTimes).not.toHaveBeenCalled();
      expect(adminCounter.inc).toHaveBeenCalled();
    });
  });

  describe('listDueMeds', () => {
    it('should return due medications for carer\'s own visit', async () => {
      const dueMeds = [mockMedicationAdministration];
      
      repository.findDueMedicationsForVisit.mockResolvedValue(dueMeds as any);

      const result = await service.listDueMeds(
        'visit-123',
        mockUser.id,
        mockUser.role
      );

      expect(result).toEqual(dueMeds);
      expect(repository.findDueMedicationsForVisit).toHaveBeenCalledWith('visit-123');
    });

    it('should filter out medications for other carers', async () => {
      const dueMeds = [
        mockMedicationAdministration,
        {
          ...mockMedicationAdministration,
          id: 'other-med-123',
          visit: {
            ...mockMedicationAdministration.visit,
            carer_id: 'other-carer-123',
          },
        },
      ];

      repository.findDueMedicationsForVisit.mockResolvedValue(dueMeds as any);

      const result = await service.listDueMeds(
        'visit-123',
        mockUser.id,
        mockUser.role
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMedicationAdministration.id);
    });

    it('should return all medications for admin users', async () => {
      const dueMeds = [
        mockMedicationAdministration,
        {
          ...mockMedicationAdministration,
          id: 'other-med-123',
          visit: {
            ...mockMedicationAdministration.visit,
            carer_id: 'other-carer-123',
          },
        },
      ];

      repository.findDueMedicationsForVisit.mockResolvedValue(dueMeds as any);

      const result = await service.listDueMeds(
        'visit-123',
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('listVisitMedications', () => {
    it('should top up and relink medication rows for the visit window before reading visit medications', async () => {
      const reconcileSpy = jest
        .spyOn(service, 'reconcileMedicationAdministrationsForVisitWindow')
        .mockResolvedValue(undefined);

      repository.findVisitById.mockResolvedValue({
        id: 'visit-123',
        client_id: 'client-123',
        scheduled_start: new Date('2025-02-12T09:00:00Z'),
        scheduled_end: new Date('2025-02-12T10:00:00Z'),
      } as any);
      repository.findVisitMedications.mockResolvedValue([mockMedicationAdministration] as any);

      const result = await service.listVisitMedications(
        'visit-123',
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(reconcileSpy).toHaveBeenCalledWith(
        'client-123',
        new Date('2025-02-12T09:00:00Z'),
        new Date('2025-02-12T10:00:00Z')
      );
      expect(result).toEqual([mockMedicationAdministration]);

      reconcileSpy.mockRestore();
    });
  });

  describe('getTodaysMedicationsByClient', () => {
    it('should extend active prescriptions for future operational dates before reading eMAR rows', async () => {
      repository.findActivePrescriptionsOverlappingWindow.mockResolvedValue([
        {
          id: 'prescription-rolling-123',
          client_id: 'client-123',
          start_date: new Date('2025-01-01T00:00:00.000Z'),
          end_date: null,
          frequency_per_day: 1,
          frequency_interval_hours: null,
          administration_times: ['08:00'],
        },
      ] as any);
      repository.findVisitsForClientInRange.mockResolvedValue([
        {
          id: 'visit-123',
          client_id: 'client-123',
          scheduled_start: new Date('2025-02-12T07:45:00Z'),
          scheduled_end: new Date('2025-02-12T08:30:00Z'),
          status: 'SCHEDULED',
        },
      ] as any);
      repository.findTodaysMedicationsByClient.mockResolvedValue([mockMedicationAdministration] as any);

      await service.getTodaysMedicationsByClient(
        new Date('2025-02-12T00:00:00.000Z'),
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(repository.findActivePrescriptionsOverlappingWindow).toHaveBeenCalledWith(
        new Date('2025-02-12T00:00:00.000Z'),
        new Date('2025-02-12T23:59:59.999Z'),
        undefined
      );
      expect(repository.ensureScheduledAdministrationsForPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          prescriptionId: 'prescription-rolling-123',
          actorId: 'system',
          actorRole: 'system',
        })
      );

      const scheduledAdministrations =
        repository.ensureScheduledAdministrationsForPrescription.mock.calls[0][0].administrations;
      expect(scheduledAdministrations[0]).toEqual({
        scheduledTime: new Date('2025-02-12T08:00:00.000Z'),
        visitId: 'visit-123',
      });
      expect(scheduledAdministrations.at(-1)).toEqual({
        scheduledTime: new Date('2025-03-14T08:00:00.000Z'),
        visitId: null,
      });
      expect(scheduledAdministrations).toHaveLength(31);
    });

    it('should return scoped medications for carers', async () => {
      const todaysMeds = [mockMedicationAdministration];

      repository.findTodaysMedicationsByClient.mockResolvedValue(todaysMeds as any);

      const result = await service.getTodaysMedicationsByClient(
        new Date(),
        mockUser.id,
        mockUser.role
      );

      expect(result).toEqual(todaysMeds);
      expect(repository.findTodaysMedicationsByClient).toHaveBeenCalledWith(
        expect.any(Date),
        { carerId: mockUser.id }
      );
    });

    it('should return medications for office users', async () => {
      const todaysMeds = [mockMedicationAdministration];
      
      repository.findTodaysMedicationsByClient.mockResolvedValue(todaysMeds as any);

      const result = await service.getTodaysMedicationsByClient(
        new Date(),
        'office-user-123',
        'office'
      );

      expect(result).toEqual(todaysMeds);
      expect(repository.findTodaysMedicationsByClient).toHaveBeenCalledWith(
        expect.any(Date),
        {}
      );
    });

    it('should return medications for admin users', async () => {
      const todaysMeds = [mockMedicationAdministration];
      
      repository.findTodaysMedicationsByClient.mockResolvedValue(todaysMeds as any);

      const result = await service.getTodaysMedicationsByClient(
        new Date(),
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(result).toEqual(todaysMeds);
      expect(repository.findTodaysMedicationsByClient).toHaveBeenCalledWith(
        expect.any(Date),
        {}
      );
    });

    it('should reject invalid dates', async () => {
      await expect(
        service.getTodaysMedicationsByClient(
          new Date('invalid'),
          mockAdminUser.id,
          mockAdminUser.role
        )
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'A valid medication date is required',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should reject requests with an unknown role instead of throwing a TypeError', async () => {
      await expect(
        service.getTodaysMedicationsByClient(
          new Date(),
          mockAdminUser.id,
          undefined as any
        )
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.FORBIDDEN_OFFICE_ACCESS,
          'Admin, office, or carer access required',
          HttpStatus.FORBIDDEN
        )
      );
    });

    it('should drop incomplete medication rows instead of throwing', async () => {
      repository.findTodaysMedicationsByClient.mockResolvedValue([
        mockMedicationAdministration,
        {
          ...mockMedicationAdministration,
          id: 'missing-relations',
          prescription: undefined,
        },
      ] as any);

      const result = await service.getTodaysMedicationsByClient(
        new Date(),
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMedicationAdministration.id);
    });
  });

  describe('permission checks', () => {
    it('should allow admin to create medications', async () => {
      const medicationData = {
        name: 'Test Med',
        dosage: '10',
        unit: 'mg',
        instructions: 'Take daily',
      };

      const mockMedication = {
        id: 'med-123',
        ...medicationData,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      repository.createMedication.mockResolvedValue(mockMedication as any);
      repository.createMedicationAudit.mockResolvedValue({} as any);

      const result = await service.createMedication(
        medicationData,
        mockAdminUser.id,
        mockAdminUser.role
      );

      expect(result).toEqual(mockMedication);
    });

    it('should prevent non-admin from creating medications', async () => {
      const medicationData = {
        name: 'Test Med',
        dosage: '10',
        unit: 'mg',
        instructions: 'Take daily',
      };

      await expect(
        service.createMedication(
          medicationData,
          mockUser.id,
          mockUser.role
        )
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.FORBIDDEN_ADMIN_ONLY,
          'Admin access required',
          HttpStatus.FORBIDDEN
        )
      );
    });
  });
});
