import { Test, TestingModule } from '@nestjs/testing';
import { VisitService } from '../src/visit/visit.service';
import { VisitRepository } from '../src/visit/visit.repository';
import { ClsService } from 'nestjs-cls';
import { VisitStatus } from '@oasis/db';
import { BaseHttpException } from '../src/common/errors/base-http.exception';
import { ErrorCode } from '../src/common/errors/error-codes';

describe('VisitService', () => {
  let service: VisitService;
  let repository: VisitRepository;
  let clsService: ClsService;

  const mockVisitRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOverlappingVisits: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    findTaskById: jest.fn(),
  };

  const mockClsService = {
    get: jest.fn().mockReturnValue('test-request-id'),
  };

  const mockVisit = {
    id: 'visit-123',
    carer_id: 'carer-123',
    client_id: 'client-123',
    scheduled_start: new Date('2024-01-01T09:00:00Z'),
    scheduled_end: new Date('2024-01-01T10:00:00Z'),
    actual_start: null,
    actual_end: null,
    status: VisitStatus.SCHEDULED,
    notes: 'Test visit',
    carer: {
      id: 'carer-123',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    },
    client: {
      id: 'client-123',
      full_name: 'John Smith',
    },
    tasks: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitService,
        {
          provide: VisitRepository,
          useValue: mockVisitRepository,
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
      ],
    }).compile();

    service = module.get<VisitService>(VisitService);
    repository = module.get<VisitRepository>(VisitRepository);
    clsService = module.get<ClsService>(ClsService);

    jest.clearAllMocks();
  });

  describe('createVisit', () => {
    const createVisitInput = {
      carerId: 'carer-123',
      clientId: 'client-123',
      scheduledStart: '2024-01-01T09:00:00Z',
      scheduledEnd: '2024-01-01T10:00:00Z',
      notes: 'Test visit',
      tasks: [
        { taskName: 'Task 1', description: 'Description 1' },
      ],
    };

    it('should create a visit successfully', async () => {
      mockVisitRepository.findOverlappingVisits.mockResolvedValue([]);
      mockVisitRepository.create.mockResolvedValue({
        ...mockVisit,
        tasks: [],
      });
      mockVisitRepository.createTask.mockResolvedValue({});
      mockVisitRepository.findById.mockResolvedValue({
        ...mockVisit,
        tasks: [{ id: 'task-1', task_name: 'Task 1' }],
      });

      const result = await service.createVisit(createVisitInput, 'user-123', 'admin');

      expect(repository.findOverlappingVisits).toHaveBeenCalledWith(
        'carer-123',
        new Date('2024-01-01T09:00:00Z'),
        new Date('2024-01-01T10:00:00Z')
      );
      expect(repository.create).toHaveBeenCalled();
      expect(repository.createTask).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('visit-123');
    });

    it('should throw BaseHttpException for overlapping visits', async () => {
      mockVisitRepository.findOverlappingVisits.mockResolvedValue([mockVisit]);

      await expect(
        service.createVisit(createVisitInput, 'user-123', 'admin')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.createVisit(createVisitInput, 'user-123', 'admin')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VISIT_OVERLAP }
      });
    });
  });

  describe('updateVisit', () => {
    const updateVisitInput = {
      id: 'visit-123',
      scheduledStart: '2024-01-01T10:00:00Z',
      scheduledEnd: '2024-01-01T11:00:00Z',
      status: VisitStatus.IN_PROGRESS,
    };

    it('should update a visit successfully', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.findOverlappingVisits.mockResolvedValue([]);
      mockVisitRepository.update.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
      });

      const result = await service.updateVisit(
        'visit-123',
        updateVisitInput,
        'carer-123',
        'carer'
      );

      expect(repository.update).toHaveBeenCalledWith('visit-123', expect.any(Object));
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });

    it('should throw BaseHttpException if visit not found', async () => {
      mockVisitRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateVisit('visit-123', updateVisitInput, 'user-123', 'admin')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.updateVisit('visit-123', updateVisitInput, 'user-123', 'admin')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VISIT_NOT_FOUND }
      });
    });

    it('should throw BaseHttpException for unauthorized carer', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.updateVisit('visit-123', updateVisitInput, 'other-carer', 'carer')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.updateVisit('visit-123', updateVisitInput, 'other-carer', 'carer')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY }
      });
    });
  });

  describe('findVisitById', () => {
    it('should return a visit for authorized user', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      const result = await service.findVisitById('visit-123', 'carer-123', 'carer');

      expect(result).toEqual(mockVisit);
    });

    it('should throw BaseHttpException for unauthorized carer', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.findVisitById('visit-123', 'other-carer', 'carer')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.findVisitById('visit-123', 'other-carer', 'carer')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY }
      });
    });

    it('should allow client to read their own visits', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      const result = await service.findVisitById('visit-123', 'client-123', 'client');

      expect(result).toEqual(mockVisit);
    });
  });

  describe('findVisits', () => {
    const filter = {
      carerId: 'carer-123',
      status: VisitStatus.SCHEDULED,
      skip: 0,
      take: 20,
    };

    it('should return paginated visits for admin', async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      const result = await service.findVisits(filter, 'admin-123', 'admin');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter visits by carer role', async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      await service.findVisits(filter, 'carer-123', 'carer');

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            carer_id: 'carer-123',
          }),
        })
      );
    });
  });

  describe('completeTask', () => {
    const mockTask = {
      id: 'task-123',
      visit_id: 'visit-123',
      task_name: 'Test Task',
      is_completed: false,
      completed_at: null,
      notes: null,
    };

    it('should complete a task successfully', async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(mockTask);
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateTask.mockResolvedValue({
        ...mockTask,
        is_completed: true,
        completed_at: new Date(),
      });

      const result = await service.completeTask(
        'task-123',
        'Completed notes',
        'carer-123',
        'carer'
      );

      expect(repository.updateTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          is_completed: true,
          completed_at: expect.any(Date),
          notes: 'Completed notes',
        })
      );
      expect(result.is_completed).toBe(true);
    });

    it('should throw BaseHttpException if task not found', async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(null);

      await expect(
        service.completeTask('task-123', undefined, 'user-123', 'admin')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.completeTask('task-123', undefined, 'user-123', 'admin')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TASK_NOT_FOUND }
      });
    });
  });

  describe('deleteVisit', () => {
    it('should soft delete a visit', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.delete.mockResolvedValue({
        ...mockVisit,
        deleted_at: new Date(),
      });

      const result = await service.deleteVisit('visit-123', 'admin-123', 'admin');

      expect(repository.delete).toHaveBeenCalledWith('visit-123');
      expect(result.deleted_at).toBeTruthy();
    });

    it('should throw BaseHttpException for carers trying to delete other carers visits', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.deleteVisit('visit-123', 'different-carer-123', 'carer')
      ).rejects.toThrow(BaseHttpException);
      
      await expect(
        service.deleteVisit('visit-123', 'different-carer-123', 'carer')
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY }
      });
    });

    it('should allow carers to delete their own visits', async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.delete.mockResolvedValue(mockVisit);

      const result = await service.deleteVisit('visit-123', 'carer-123', 'carer');
      expect(result).toEqual(mockVisit);
      expect(mockVisitRepository.delete).toHaveBeenCalledWith('visit-123');
    });
  });
});
