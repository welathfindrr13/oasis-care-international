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
    const mockRepository = {
      findMedicationAdministrationById: jest.fn(),
      updateMedicationAdministration: jest.fn(),
      createMedicationAudit: jest.fn(),
      findOverlappingMedicationTimes: jest.fn(),
      findDueMedicationsForVisit: jest.fn(),
      findTodaysMedicationsByClient: jest.fn(),
      createMedication: jest.fn(),
      findMedicationById: jest.fn(),
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

  describe('getTodaysMedicationsByClient', () => {
    it('should throw error for non-office users', async () => {
      await expect(
        service.getTodaysMedicationsByClient(
          new Date(),
          mockUser.id,
          mockUser.role
        )
      ).rejects.toThrow(
        new BaseHttpException(
          ErrorCode.FORBIDDEN_OFFICE_ACCESS,
          'Office or admin access required',
          HttpStatus.FORBIDDEN
        )
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
