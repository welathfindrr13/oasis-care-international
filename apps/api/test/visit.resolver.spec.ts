import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { VisitResolver } from '../src/visit/visit.resolver';
import { VisitService } from '../src/visit/visit.service';
import { CareLogCategory, PrismaService, VisitStatus } from '@oasis/db';
import { VisitTaskOutcome } from '../src/visit/dto/visit.dto';

describe('VisitResolver', () => {
  let resolver: VisitResolver;
  let service: VisitService;

  const mockVisitService = {
    createVisit: jest.fn(),
    updateVisit: jest.fn(),
    findVisitById: jest.fn(),
    findVisits: jest.fn(),
    deleteVisit: jest.fn(),
    completeTask: jest.fn(),
    startVisit: jest.fn(),
    recordVisitTaskOutcome: jest.fn(),
    submitVisitCareNote: jest.fn(),
    completeVisit: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        sub: 'user-123',
        realm_access: {
          roles: ['admin'],
        },
        preferred_username: 'test.user',
      },
    },
  };

  const mockCarerContext = {
    req: {
      user: {
        sub: 'carer-123',
        realm_access: {
          roles: ['carer'],
        },
        preferred_username: 'jane.doe',
      },
    },
  };

  const mockClientContext = {
    req: {
      user: {
        sub: 'client-123',
        realm_access: {
          roles: ['client'],
        },
        preferred_username: 'john.smith',
      },
    },
  };

  const mockTask = {
    id: 'task-1',
    visit_id: 'visit-123',
    task_name: 'Medication',
    description: 'Give medication',
    is_completed: true,
    completed_at: new Date(),
    notes: 'VISIT_TASK_OUTCOME::{"outcome":"DONE"}',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCareLog = {
    id: 'care-log-1',
    client_id: 'client-123',
    carer_id: 'carer-123',
    visit_id: 'visit-123',
    medication_administration_id: null,
    occurred_at: new Date('2024-01-01T09:30:00Z'),
    category: CareLogCategory.OTHER,
    notes: 'Visit progressing well',
    urine_passed: null,
    bowel_movement: null,
    stool_type: null,
    continence_status: null,
    assistance_level: null,
    meal_type: null,
    intake_amount: null,
    fluid_ml: null,
    appetite: null,
    slept: null,
    sleep_start: null,
    sleep_end: null,
    sleep_quality: null,
    mood_level: null,
    agitation: null,
    confusion: null,
    pain_score: null,
    escalated: false,
    escalated_to: null,
    escalated_at: null,
    source: 'visit_workflow',
    created_at: new Date(),
    updated_at: new Date(),
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
      phone: '1234567890',
    },
    client: {
      id: 'client-123',
      full_name: 'John Smith',
      address_line1: '123 Main St',
      address_line2: null,
      city: 'London',
      postcode: 'SW1A 1AA',
    },
    tasks: [
      {
        id: 'task-1',
        task_name: 'Medication',
        description: 'Give medication',
        is_completed: false,
        completed_at: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitResolver,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: VisitService,
          useValue: mockVisitService,
        },
      ],
    }).compile();

    resolver = module.get<VisitResolver>(VisitResolver);
    service = module.get<VisitService>(VisitService);

    jest.clearAllMocks();
  });

  describe('visit', () => {
    it('should return a visit by id', async () => {
      mockVisitService.findVisitById.mockResolvedValue(mockVisit);

      const result = await resolver.visit('visit-123', mockContext);

      expect(service.findVisitById).toHaveBeenCalledWith(
        'visit-123',
        'user-123',
        'admin',
        undefined,
      );
      expect(result.id).toBe('visit-123');
      expect(result.carer).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.tasks).toHaveLength(1);
    });
  });

  describe('visits', () => {
    it('should return paginated visits', async () => {
      mockVisitService.findVisits.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      const filter = {
        carerId: 'carer-123',
        status: VisitStatus.SCHEDULED,
        skip: 0,
        take: 20,
      };

      const result = await resolver.visits(filter, mockContext);

      expect(service.findVisits).toHaveBeenCalledWith(
        filter,
        'user-123',
        'admin',
        undefined,
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use carer role from context', async () => {
      mockVisitService.findVisits.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      const filter = { skip: 0, take: 20 };

      await resolver.visits(filter, mockCarerContext);

      expect(service.findVisits).toHaveBeenCalledWith(
        filter,
        'carer-123',
        'carer',
        undefined,
      );
    });
  });

  describe('createVisit', () => {
    const createInput = {
      carerId: 'carer-123',
      clientId: 'client-123',
      scheduledStart: '2024-01-01T09:00:00Z',
      scheduledEnd: '2024-01-01T10:00:00Z',
      notes: 'Test visit',
      tasks: [
        { taskName: 'Medication', description: 'Give medication' },
      ],
    };

    it('should create a visit successfully', async () => {
      mockVisitService.createVisit.mockResolvedValue(mockVisit);

      const result = await resolver.createVisit(createInput, mockContext);

      expect(service.createVisit).toHaveBeenCalledWith(
        createInput,
        'user-123',
        'admin',
        undefined,
      );
      expect(result.id).toBe('visit-123');
    });

    it('should use carer role when creating as carer', async () => {
      mockVisitService.createVisit.mockResolvedValue(mockVisit);

      await resolver.createVisit(createInput, mockCarerContext);

      expect(service.createVisit).toHaveBeenCalledWith(
        createInput,
        'carer-123',
        'carer',
        undefined,
      );
    });
  });

  describe('updateVisit', () => {
    const updateInput = {
      id: 'visit-123',
      status: VisitStatus.IN_PROGRESS,
      actualStart: '2024-01-01T09:05:00Z',
    };

    it('should update a visit successfully', async () => {
      mockVisitService.updateVisit.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
        actual_start: new Date('2024-01-01T09:05:00Z'),
      });

      const result = await resolver.updateVisit(updateInput, mockContext);

      expect(service.updateVisit).toHaveBeenCalledWith(
        'visit-123',
        updateInput,
        'user-123',
        'admin',
        undefined,
      );
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });
  });

  describe('deleteVisit', () => {
    it('should delete a visit as admin', async () => {
      mockVisitService.deleteVisit.mockResolvedValue({
        ...mockVisit,
        deleted_at: new Date(),
      });

      const result = await resolver.deleteVisit('visit-123', mockContext);

      expect(service.deleteVisit).toHaveBeenCalledWith(
        'visit-123',
        'user-123',
        'admin',
        undefined,
      );
      expect(result.id).toBe('visit-123');
    });
  });

  describe('completeVisitTask', () => {
    const completedTask = {
      id: 'task-1',
      visit_id: 'visit-123',
      task_name: 'Medication',
      description: 'Give medication',
      is_completed: true,
      completed_at: new Date(),
      notes: 'Completed successfully',
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should complete a task successfully', async () => {
      mockVisitService.completeTask.mockResolvedValue(completedTask);

      const result = await resolver.completeVisitTask(
        'task-1',
        'Completed successfully',
        mockContext
      );

      expect(service.completeTask).toHaveBeenCalledWith(
        'task-1',
        'Completed successfully',
        'user-123',
        'admin',
        undefined,
      );
      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).toBeDefined();
      expect(result.notes).toBe('Completed successfully');
    });

    it('should handle undefined notes', async () => {
      mockVisitService.completeTask.mockResolvedValue({
        ...completedTask,
        notes: null,
      });

      await resolver.completeVisitTask('task-1', undefined, mockCarerContext);

      expect(service.completeTask).toHaveBeenCalledWith(
        'task-1',
        undefined,
        'carer-123',
        'carer',
        undefined,
      );
    });
  });

  describe('startVisit', () => {
    it('should forward visitId and auth context to service', async () => {
      mockVisitService.startVisit.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
        actual_start: new Date('2024-01-01T09:01:00Z'),
      });

      const result = await resolver.startVisit('visit-123', mockCarerContext);

      expect(service.startVisit).toHaveBeenCalledWith(
        'visit-123',
        'carer-123',
        'carer',
        undefined,
      );
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });
  });

  describe('recordVisitTaskOutcome', () => {
    it('should call service with input and return mapped VisitTaskDTO', async () => {
      const input = {
        taskId: 'task-1',
        outcome: VisitTaskOutcome.DONE,
        notes: 'Taken with breakfast',
      };
      mockVisitService.recordVisitTaskOutcome.mockResolvedValue(mockTask);

      const result = await resolver.recordVisitTaskOutcome(input, mockCarerContext);

      expect(service.recordVisitTaskOutcome).toHaveBeenCalledWith(
        input,
        'carer-123',
        'carer',
        undefined,
      );
      expect(result.id).toBe('task-1');
      expect(result.isCompleted).toBe(true);
      expect(result.notes).toContain('VISIT_TASK_OUTCOME::');
    });
  });

  describe('submitVisitCareNote', () => {
    it('should call service and map care log response', async () => {
      const input = {
        visitId: 'visit-123',
        category: CareLogCategory.OTHER,
        notes: 'Client comfortable and hydrated',
      };
      mockVisitService.submitVisitCareNote.mockResolvedValue(mockCareLog);

      const result = await resolver.submitVisitCareNote(input, mockCarerContext);

      expect(service.submitVisitCareNote).toHaveBeenCalledWith(
        input,
        'carer-123',
        'carer',
        undefined,
      );
      expect(result.id).toBe('care-log-1');
      expect(result.clientId).toBe('client-123');
      expect(result.carerId).toBe('carer-123');
      expect(result.visitId).toBe('visit-123');
    });
  });

  describe('completeVisit', () => {
    it('should call service and return mapped visit dto', async () => {
      const input = {
        visitId: 'visit-123',
        notes: 'Visit complete and client settled',
      };
      mockVisitService.completeVisit.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.COMPLETED,
        actual_end: new Date('2024-01-01T10:00:00Z'),
        notes: 'Visit complete and client settled',
      });

      const result = await resolver.completeVisit(input, mockCarerContext);

      expect(service.completeVisit).toHaveBeenCalledWith(
        input,
        'carer-123',
        'carer',
        undefined,
      );
      expect(result.status).toBe(VisitStatus.COMPLETED);
      expect(result.actualEnd).toBeDefined();
    });
  });

  describe('mapVisitToDTO', () => {
    it('should handle null carer and client', async () => {
      const visitWithoutRelations = {
        ...mockVisit,
        carer: null,
        client: null,
      };

      mockVisitService.findVisitById.mockResolvedValue(visitWithoutRelations);

      const result = await resolver.visit('visit-123', mockContext);

      expect(result.carer).toBeNull();
      expect(result.client).toBeNull();
    });

    it('should handle empty tasks array', async () => {
      const visitWithoutTasks = {
        ...mockVisit,
        tasks: [],
      };

      mockVisitService.findVisitById.mockResolvedValue(visitWithoutTasks);

      const result = await resolver.visit('visit-123', mockContext);

      expect(result.tasks).toEqual([]);
    });
  });
});
