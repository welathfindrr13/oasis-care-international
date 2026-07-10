import { Test, TestingModule } from "@nestjs/testing";
import { VisitService } from "../src/visit/visit.service";
import { VisitRepository } from "../src/visit/visit.repository";
import { ClsService } from "nestjs-cls";
import { CareLogCategory, PrismaService, VisitStatus } from "@oasis/db";
import { BaseHttpException } from "../src/common/errors/base-http.exception";
import { ErrorCode } from "../src/common/errors/error-codes";
import { CareLogService } from "../src/care-log/care-log.service";
import { VisitTaskOutcome } from "../src/visit/dto/visit.dto";

describe("VisitService", () => {
  let service: VisitService;
  let repository: VisitRepository;
  let clsService: ClsService;
  let prisma: PrismaService;

  const mockVisitRepository = {
    create: jest.fn(),
    createIfAssignable: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOverlappingVisits: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    findTaskById: jest.fn(),
    countTaskOutcomeEntriesForVisit: jest.fn(),
    countCareLogsForVisit: jest.fn(),
    countMedicationOutcomesForVisit: jest.fn(),
    findCarerInOrganization: jest.fn(),
    findClientInOrganization: jest.fn(),
  };

  const mockCareLogService = {
    createCareLog: jest.fn(),
  };

  const mockClsService = {
    get: jest.fn().mockReturnValue("test-request-id"),
  };

  const mockCounter = {
    inc: jest.fn(),
  };

  const mockPrisma = {
    organization: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockVisit = {
    id: "visit-123",
    carer_id: "carer-123",
    client_id: "client-123",
    scheduled_start: new Date("2024-01-01T09:00:00Z"),
    scheduled_end: new Date("2024-01-01T10:00:00Z"),
    actual_start: null,
    actual_end: null,
    status: VisitStatus.SCHEDULED,
    notes: "Test visit",
    carer: {
      id: "carer-123",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
    },
    client: {
      id: "client-123",
      full_name: "John Smith",
    },
    tasks: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };
  const organizationId = "org-123";

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
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CareLogService,
          useValue: mockCareLogService,
        },
        {
          provide: "visit_overlap_total",
          useValue: mockCounter,
        },
        {
          provide: "visits_created_total",
          useValue: mockCounter,
        },
      ],
    }).compile();

    service = module.get<VisitService>(VisitService);
    repository = module.get<VisitRepository>(VisitRepository);
    clsService = module.get<ClsService>(ClsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    mockVisitRepository.findCarerInOrganization.mockResolvedValue(true);
    mockVisitRepository.findClientInOrganization.mockResolvedValue(true);
    mockVisitRepository.createIfAssignable.mockResolvedValue({
      status: "CREATED",
      visit: mockVisit,
    });
    mockVisitRepository.countTaskOutcomeEntriesForVisit.mockResolvedValue(0);
    mockVisitRepository.countCareLogsForVisit.mockResolvedValue(0);
    mockVisitRepository.countMedicationOutcomesForVisit.mockResolvedValue(0);
  });

  describe("createVisit", () => {
    const createVisitInput = {
      carerId: "carer-123",
      clientId: "client-123",
      scheduledStart: "2024-01-01T09:00:00Z",
      scheduledEnd: "2024-01-01T10:00:00Z",
      notes: "Test visit",
      tasks: [{ taskName: "Task 1", description: "Description 1" }],
    };

    it("should create a visit successfully", async () => {
      mockVisitRepository.createTask.mockResolvedValue({});
      mockVisitRepository.findById.mockResolvedValue({
        ...mockVisit,
        tasks: [{ id: "task-1", task_name: "Task 1" }],
      });

      const result = await service.createVisit(
        createVisitInput,
        "user-123",
        "admin",
        organizationId,
      );

      expect(repository.createIfAssignable).toHaveBeenCalled();
      expect(repository.createTask).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe("visit-123");
    });

    it("should throw BaseHttpException for overlapping visits", async () => {
      mockVisitRepository.createIfAssignable.mockResolvedValue({
        status: "OVERLAP",
      });

      await expect(
        service.createVisit(
          createVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.createVisit(
          createVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VISIT_OVERLAP },
      });
    });

    it("should deny create when carer or client are outside organization", async () => {
      mockVisitRepository.createIfAssignable.mockResolvedValue({
        status: "INVALID_TENANT_RESOURCE",
      });

      await expect(
        service.createVisit(
          createVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
      });
    });

    it("should deny create when organization scope is missing", async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.createVisit(createVisitInput, "user-123", "admin"),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS },
      });
    });
  });

  describe("updateVisit", () => {
    const updateVisitInput = {
      id: "visit-123",
      scheduledStart: "2024-01-01T10:00:00Z",
      scheduledEnd: "2024-01-01T11:00:00Z",
      status: VisitStatus.IN_PROGRESS,
    };

    it("should update a visit successfully", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.findOverlappingVisits.mockResolvedValue([]);
      mockVisitRepository.update.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
      });

      const result = await service.updateVisit(
        "visit-123",
        updateVisitInput,
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.update).toHaveBeenCalledWith(
        "visit-123",
        expect.any(Object),
        organizationId,
      );
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });

    it("should throw BaseHttpException if visit not found", async () => {
      mockVisitRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VISIT_NOT_FOUND },
      });
    });

    it("should throw BaseHttpException for unauthorized carer", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "other-carer",
          "carer",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "other-carer",
          "carer",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
      });
    });
  });

  describe("findVisitById", () => {
    it("should return a visit for authorized user", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      const result = await service.findVisitById(
        "visit-123",
        "carer-123",
        "carer",
        organizationId,
      );

      expect(result).toEqual(mockVisit);
    });

    it("should throw BaseHttpException for unauthorized carer", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.findVisitById(
          "visit-123",
          "other-carer",
          "carer",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.findVisitById(
          "visit-123",
          "other-carer",
          "carer",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
      });
    });

    it("should allow client to read their own visits", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      const result = await service.findVisitById(
        "visit-123",
        "client-123",
        "client",
        organizationId,
      );

      expect(result).toEqual(mockVisit);
    });
  });

  describe("findVisits", () => {
    const filter = {
      carerId: "carer-123",
      status: VisitStatus.SCHEDULED,
      skip: 0,
      take: 20,
    };

    it("should return paginated visits for admin", async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      const result = await service.findVisits(
        filter,
        "admin-123",
        "admin",
        organizationId,
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter visits by carer role", async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [mockVisit],
        total: 1,
      });

      await service.findVisits(filter, "carer-123", "carer", organizationId);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            carer_id: "carer-123",
          }),
        }),
        organizationId,
      );
    });

    it("should not allow carers to override carerId filter", async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.findVisits(
        { ...filter, carerId: "other-carer-999" },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            carer_id: "carer-123",
          }),
        }),
        organizationId,
      );
    });

    it("should not allow clients to override clientId filter", async () => {
      mockVisitRepository.findMany.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.findVisits(
        { clientId: "other-client-999", skip: 0, take: 20 },
        "client-123",
        "client",
        organizationId,
      );

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            client_id: "client-123",
          }),
        }),
        organizationId,
      );
    });
  });

  describe("completeTask", () => {
    const mockTask = {
      id: "task-123",
      visit_id: "visit-123",
      task_name: "Test Task",
      is_completed: false,
      completed_at: null,
      notes: null,
    };

    it("should complete a task successfully", async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(mockTask);
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateTask.mockResolvedValue({
        ...mockTask,
        is_completed: true,
        completed_at: new Date(),
      });

      const result = await service.completeTask(
        "task-123",
        "Completed notes",
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.updateTask).toHaveBeenCalledWith(
        "task-123",
        expect.objectContaining({
          is_completed: true,
          completed_at: expect.any(Date),
          notes: "Completed notes",
        }),
        organizationId,
      );
      expect(result.is_completed).toBe(true);
    });

    it("should throw BaseHttpException if task not found", async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(null);

      await expect(
        service.completeTask(
          "task-123",
          undefined,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.completeTask(
          "task-123",
          undefined,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TASK_NOT_FOUND },
      });
    });
  });

  describe("startVisit", () => {
    it("should set status to IN_PROGRESS and set actual_start when missing", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.update.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
        actual_start: new Date("2024-01-01T09:02:00Z"),
      });

      const result = await service.startVisit(
        "visit-123",
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.update).toHaveBeenCalledWith(
        "visit-123",
        expect.objectContaining({
          status: VisitStatus.IN_PROGRESS,
          actual_start: expect.any(Date),
        }),
        organizationId,
      );
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });

    it("should deny family role from starting a visit", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.startVisit("visit-123", "family-123", "family", organizationId),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_ROLE },
      });
    });
  });

  describe("recordVisitTaskOutcome", () => {
    const task = {
      id: "task-123",
      visit_id: "visit-123",
      task_name: "Medication",
      description: "Give morning meds",
      is_completed: false,
      completed_at: null,
      notes: "Initial observation",
      created_at: new Date(),
      updated_at: new Date(),
    };

    it("should mark task complete for DONE and persist structured outcome metadata", async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(task);
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateTask.mockResolvedValue({
        ...task,
        is_completed: true,
        completed_at: new Date(),
      });

      await service.recordVisitTaskOutcome(
        {
          taskId: task.id,
          outcome: VisitTaskOutcome.DONE,
          notes: "Taken with water",
        },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.updateTask).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          is_completed: true,
          completed_at: expect.any(Date),
          notes: expect.stringContaining("VISIT_TASK_OUTCOME::"),
        }),
        organizationId,
      );
      expect(repository.updateTask).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          notes: expect.stringContaining('"outcome":"DONE"'),
        }),
        organizationId,
      );
    });

    it("should mark task incomplete for non-DONE outcomes", async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(task);
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateTask.mockResolvedValue({
        ...task,
        is_completed: false,
        completed_at: null,
      });

      await service.recordVisitTaskOutcome(
        { taskId: task.id, outcome: VisitTaskOutcome.REFUSED },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.updateTask).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          is_completed: false,
          completed_at: null,
        }),
        organizationId,
      );
    });

    it("should deny unassigned carers from recording task outcomes", async () => {
      mockVisitRepository.findTaskById.mockResolvedValue(task);
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.recordVisitTaskOutcome(
          { taskId: task.id, outcome: VisitTaskOutcome.DONE },
          "other-carer-999",
          "carer",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
      });
    });
  });

  describe("submitVisitCareNote", () => {
    const careLog = {
      id: "care-log-123",
      organization_id: organizationId,
      visit_id: "visit-123",
      client_id: "client-123",
      carer_id: "carer-123",
      occurred_at: new Date(),
      category: CareLogCategory.OTHER,
      notes: "Client settled well after lunch.",
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    it("should create a care log linked to visit, client, carer, and organization", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockCareLogService.createCareLog.mockResolvedValue(careLog);

      const result = await service.submitVisitCareNote(
        {
          visitId: "visit-123",
          category: CareLogCategory.OTHER,
          notes: "Client settled well after lunch.",
        },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(mockCareLogService.createCareLog).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: "visit-123",
          clientId: "client-123",
          carerId: "carer-123",
          category: CareLogCategory.OTHER,
          notes: "Client settled well after lunch.",
        }),
        "carer-123",
        "carer",
        organizationId,
      );
      expect(result.id).toBe("care-log-123");
    });

    it("should deny family role from submitting visit care notes", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.submitVisitCareNote(
          {
            visitId: "visit-123",
            category: CareLogCategory.OTHER,
            notes: "Family attempt should fail",
          },
          "family-123",
          "family",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_ROLE },
      });
    });
  });

  describe("completeVisit", () => {
    it("should require at least one completion evidence input", async () => {
      mockVisitRepository.findById.mockResolvedValue({
        ...mockVisit,
        notes: null,
      });

      await expect(
        service.completeVisit(
          { visitId: "visit-123" },
          "carer-123",
          "carer",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VALIDATION_FAILED },
      });
    });

    it("should complete when visit note is provided and set actual_end when missing", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.update.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.COMPLETED,
        actual_end: new Date(),
        notes: "Finished visit and client comfortable.",
      });

      const result = await service.completeVisit(
        {
          visitId: "visit-123",
          notes: "Finished visit and client comfortable.",
        },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.update).toHaveBeenCalledWith(
        "visit-123",
        expect.objectContaining({
          status: VisitStatus.COMPLETED,
          actual_end: expect.any(Date),
          notes: expect.stringContaining(
            "Finished visit and client comfortable.",
          ),
        }),
        organizationId,
      );
      expect(result.status).toBe(VisitStatus.COMPLETED);
    });

    it("should allow completion when medication outcomes exist even without visit note", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.countMedicationOutcomesForVisit.mockResolvedValue(1);
      mockVisitRepository.update.mockResolvedValue({
        ...mockVisit,
        status: VisitStatus.COMPLETED,
        actual_end: new Date(),
      });

      const result = await service.completeVisit(
        { visitId: "visit-123" },
        "carer-123",
        "carer",
        organizationId,
      );

      expect(result.status).toBe(VisitStatus.COMPLETED);
    });
  });

  describe("deleteVisit", () => {
    it("should soft delete a visit", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.delete.mockResolvedValue({
        ...mockVisit,
        deleted_at: new Date(),
      });

      const result = await service.deleteVisit(
        "visit-123",
        "admin-123",
        "admin",
        organizationId,
      );

      expect(repository.delete).toHaveBeenCalledWith(
        "visit-123",
        organizationId,
      );
      expect(result.deleted_at).toBeTruthy();
    });

    it("should throw BaseHttpException for carers trying to delete other carers visits", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.deleteVisit(
          "visit-123",
          "different-carer-123",
          "carer",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.deleteVisit(
          "visit-123",
          "different-carer-123",
          "carer",
          organizationId,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY },
      });
    });

    it("should allow carers to delete their own visits", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.delete.mockResolvedValue(mockVisit);

      const result = await service.deleteVisit(
        "visit-123",
        "carer-123",
        "carer",
        organizationId,
      );
      expect(result).toEqual(mockVisit);
      expect(mockVisitRepository.delete).toHaveBeenCalledWith(
        "visit-123",
        organizationId,
      );
    });
  });
});
