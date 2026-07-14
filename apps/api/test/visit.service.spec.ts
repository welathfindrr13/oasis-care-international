import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus } from "@nestjs/common";
import { VisitService } from "../src/visit/visit.service";
import { VisitRepository } from "../src/visit/visit.repository";
import { ClsService } from "nestjs-cls";
import { CareLogCategory, PrismaService, VisitStatus } from "@oasis/db";
import { BaseHttpException } from "../src/common/errors/base-http.exception";
import { ErrorCode } from "../src/common/errors/error-codes";
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
    updateScheduleAtomically: jest.fn(),
    startAtomically: jest.fn(),
    completeAtomically: jest.fn(),
    deleteAtomically: jest.fn(),
    findOverlappingVisits: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    writeGuidedTaskAtomically: jest.fn(),
    createGuidedCareLogAtomically: jest.fn(),
    findTaskById: jest.fn(),
    countTaskOutcomeEntriesForVisit: jest.fn(),
    countCareLogsForVisit: jest.fn(),
    countMedicationOutcomesForVisit: jest.fn(),
    findCarerInOrganization: jest.fn(),
    findClientInOrganization: jest.fn(),
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
  const frontlineAccess = {
    authenticated: true as const,
    identityProvider: "clerk",
    membershipId: "membership-carer-123",
    surface: "STAFF" as const,
    effectiveRole: "carer",
    organizationId: "org-123",
    membershipState: "ACTIVE",
    onboardingState: "READY",
    rawRole: "carer",
    linkedIdentityState: "LINKED",
    domainIdentityId: "carer-123",
    authSubject: "auth-carer-123",
  } satisfies import("../src/auth/access-context.service").CanonicalAccessContext;

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

    it("should ignore direct status injection and always create SCHEDULED", async () => {
      await service.createVisit(
        {
          ...createVisitInput,
          tasks: undefined,
          status: VisitStatus.COMPLETED,
        } as any,
        "user-123",
        "admin",
        organizationId,
      );

      expect(repository.createIfAssignable).toHaveBeenCalledWith(
        expect.objectContaining({ status: VisitStatus.SCHEDULED }),
        expect.any(Object),
      );
    });

    it.each([
      ["equal", "2024-01-01T09:00:00Z", "2024-01-01T09:00:00Z"],
      ["inverted", "2024-01-01T10:00:00Z", "2024-01-01T09:00:00Z"],
    ])(
      "should reject %s scheduled times before persistence",
      async (_case, start, end) => {
        await expect(
          service.createVisit(
            { ...createVisitInput, scheduledStart: start, scheduledEnd: end },
            "user-123",
            "admin",
            organizationId,
          ),
        ).rejects.toMatchObject({
          status: HttpStatus.BAD_REQUEST,
          response: { code: ErrorCode.VALIDATION_FAILED },
        });
        expect(repository.createIfAssignable).not.toHaveBeenCalled();
      },
    );

    it("should throw BaseHttpException for overlapping visits", async () => {
      mockVisitRepository.createIfAssignable.mockResolvedValue({
        status: "OVERLAP",
      });

      await expect(
        service.createVisit(
          createVisitInput,
          "carer-123",
          "admin",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.createVisit(
          createVisitInput,
          "carer-123",
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
    };

    it("should route only scheduling fields through the atomic repository path", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateScheduleAtomically.mockResolvedValue({
        status: "UPDATED",
        visit: {
          ...mockVisit,
          scheduled_start: new Date(updateVisitInput.scheduledStart),
          scheduled_end: new Date(updateVisitInput.scheduledEnd),
        },
      });

      const result = await service.updateVisit(
        "visit-123",
        updateVisitInput,
        "carer-123",
        "carer",
        organizationId,
      );

      expect(repository.updateScheduleAtomically).toHaveBeenCalledWith({
        visitId: "visit-123",
        organizationId,
        expectedCarerId: "carer-123",
        scheduledStart: new Date(updateVisitInput.scheduledStart),
        scheduledEnd: new Date(updateVisitInput.scheduledEnd),
      });
      expect(result.scheduled_start).toEqual(
        new Date(updateVisitInput.scheduledStart),
      );
    });

    it.each(["status", "actualStart", "actualEnd", "notes"])(
      "should reject direct generic updates to completion-owned %s",
      async (field) => {
        await expect(
          service.updateVisit(
            "visit-123",
            {
              id: "visit-123",
              [field]: field === "status" ? VisitStatus.SCHEDULED : "unsafe",
            } as any,
            "user-123",
            "admin",
            organizationId,
          ),
        ).rejects.toMatchObject({
          status: HttpStatus.BAD_REQUEST,
          response: { code: ErrorCode.VALIDATION_FAILED },
        });
        expect(repository.findById).not.toHaveBeenCalled();
        expect(repository.updateScheduleAtomically).not.toHaveBeenCalled();
      },
    );

    it("should reject scheduling changes after a terminal transition wins", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);
      mockVisitRepository.updateScheduleAtomically.mockResolvedValue({
        status: "TERMINAL",
      });

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "user-123",
          "admin",
          organizationId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ErrorCode.VISIT_COMPLETION_CONFLICT },
      });
    });

    it("should throw BaseHttpException if visit not found", async () => {
      mockVisitRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "user-123",
          "carer",
          organizationId,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.updateVisit(
          "visit-123",
          updateVisitInput,
          "user-123",
          "carer",
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
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "UPDATED",
        task: { ...mockTask, is_completed: true, completed_at: new Date() },
      });

      const result = await service.completeTask(
        "task-123",
        "Completed notes",
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(repository.writeGuidedTaskAtomically).toHaveBeenCalledWith({
        taskId: "task-123",
        organizationId,
        expectedCarerId: "carer-123",
        actor: {
          authSubject: "auth-carer-123",
          identityProvider: "clerk",
          membershipId: "membership-carer-123",
        },
        write: { kind: "COMPLETE", notes: "Completed notes" },
      });
      expect(result.is_completed).toBe(true);
    });

    it("should throw BaseHttpException if task not found", async () => {
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "NOT_FOUND",
      });

      await expect(
        service.completeTask(
          "task-123",
          undefined,
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toThrow(BaseHttpException);

      await expect(
        service.completeTask(
          "task-123",
          undefined,
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.TASK_NOT_FOUND },
      });
    });

    it("should reject a task write when the locked visit is terminal", async () => {
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "TERMINAL",
      });
      await expect(
        service.completeTask(
          "task-123",
          "late note",
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ErrorCode.VISIT_COMPLETION_CONFLICT },
      });
    });
  });

  describe("startVisit", () => {
    it("should set status to IN_PROGRESS and set actual_start when missing", async () => {
      const started = {
        ...mockVisit,
        status: VisitStatus.IN_PROGRESS,
        actual_start: new Date("2024-01-01T09:02:00Z"),
      };
      mockVisitRepository.startAtomically.mockResolvedValue({
        status: "STARTED",
        visit: started,
      });

      const result = await service.startVisit(
        "visit-123",
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(repository.startAtomically).toHaveBeenCalledWith({
        visitId: "visit-123",
        organizationId,
        expectedCarerId: "carer-123",
        actor: {
          authSubject: "auth-carer-123",
          identityProvider: "clerk",
          membershipId: "membership-carer-123",
        },
      });
      expect(result.status).toBe(VisitStatus.IN_PROGRESS);
    });

    it("should reject a terminal state reported by the atomic start", async () => {
      mockVisitRepository.startAtomically.mockResolvedValue({
        status: "CONFLICT",
      });

      await expect(
        service.startVisit(
          "visit-123",
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ErrorCode.VALIDATION_FAILED },
      });
    });

    it("should deny family role from starting a visit", async () => {
      mockVisitRepository.findById.mockResolvedValue(mockVisit);

      await expect(
        service.startVisit(
          "visit-123",
          "family-123",
          "family",
          organizationId,
          { surface: "FAMILY", effectiveRole: "family" } as any,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
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
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "UPDATED",
        task: { ...task, is_completed: true, completed_at: new Date() },
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
        frontlineAccess,
      );

      expect(repository.writeGuidedTaskAtomically).toHaveBeenCalledWith({
        taskId: task.id,
        organizationId,
        expectedCarerId: "carer-123",
        actor: {
          authSubject: "auth-carer-123",
          identityProvider: "clerk",
          membershipId: "membership-carer-123",
        },
        write: {
          kind: "OUTCOME",
          outcome: VisitTaskOutcome.DONE,
          completed: true,
          notes: "Taken with water",
        },
      });
    });

    it("should mark task incomplete for non-DONE outcomes", async () => {
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "UPDATED",
        task: { ...task, is_completed: false, completed_at: null },
      });

      await service.recordVisitTaskOutcome(
        { taskId: task.id, outcome: VisitTaskOutcome.REFUSED },
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(repository.writeGuidedTaskAtomically).toHaveBeenCalledWith(
        expect.objectContaining({
          write: expect.objectContaining({ completed: false }),
        }),
      );
    });

    it("should deny unassigned carers from recording task outcomes", async () => {
      mockVisitRepository.writeGuidedTaskAtomically.mockResolvedValue({
        status: "FORBIDDEN",
      });
      const otherCarerAccess = {
        ...frontlineAccess,
        domainIdentityId: "other-carer-999",
      };

      await expect(
        service.recordVisitTaskOutcome(
          { taskId: task.id, outcome: VisitTaskOutcome.DONE },
          "other-carer-999",
          "carer",
          organizationId,
          otherCarerAccess,
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
      mockVisitRepository.createGuidedCareLogAtomically.mockResolvedValue({
        status: "CREATED",
        careLog,
      });

      const result = await service.submitVisitCareNote(
        {
          visitId: "visit-123",
          category: CareLogCategory.OTHER,
          notes: "Client settled well after lunch.",
        },
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(repository.createGuidedCareLogAtomically).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: "visit-123",
          organizationId,
          expectedCarerId: "carer-123",
          actor: {
            authSubject: "auth-carer-123",
            identityProvider: "clerk",
            membershipId: "membership-carer-123",
          },
          occurredAt: expect.any(Date),
          category: CareLogCategory.OTHER,
          notes: "Client settled well after lunch.",
        }),
      );
      expect(result.id).toBe("care-log-123");
    });

    it("should reject care-note writes when the locked visit is terminal", async () => {
      mockVisitRepository.createGuidedCareLogAtomically.mockResolvedValue({
        status: "TERMINAL",
      });
      await expect(
        service.submitVisitCareNote(
          {
            visitId: "visit-123",
            category: CareLogCategory.OTHER,
            notes: "Late write",
          },
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ErrorCode.VISIT_COMPLETION_CONFLICT },
      });
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
          { surface: "FAMILY", effectiveRole: "family" } as any,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
      });
    });
  });

  describe("completeVisit", () => {
    it("should require at least one completion evidence input", async () => {
      mockVisitRepository.completeAtomically.mockResolvedValue({
        status: "EVIDENCE_REQUIRED",
      });

      await expect(
        service.completeVisit(
          { visitId: "visit-123" },
          "carer-123",
          "carer",
          organizationId,
          frontlineAccess,
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VALIDATION_FAILED },
      });
    });

    it("should complete when visit note is provided and set actual_end when missing", async () => {
      const completedVisit = {
        ...mockVisit,
        status: VisitStatus.COMPLETED,
        actual_end: new Date(),
        notes: "Finished visit and client comfortable.",
      };
      mockVisitRepository.completeAtomically.mockResolvedValue({
        status: "COMPLETED",
        visit: completedVisit,
      });

      const result = await service.completeVisit(
        {
          visitId: "visit-123",
          notes: "Finished visit and client comfortable.",
        },
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(repository.completeAtomically).toHaveBeenCalledWith({
        visitId: "visit-123",
        organizationId,
        expectedCarerId: "carer-123",
        completionNote: "Finished visit and client comfortable.",
        actor: {
          authSubject: "auth-carer-123",
          identityProvider: "clerk",
          membershipId: "membership-carer-123",
          role: "carer",
          surface: "STAFF",
        },
      });
      expect(result.status).toBe(VisitStatus.COMPLETED);
    });

    it("should return the original record for an identical idempotent retry", async () => {
      const completedVisit = {
        ...mockVisit,
        status: VisitStatus.COMPLETED,
        actual_end: new Date("2024-01-01T10:00:00.000Z"),
      };
      mockVisitRepository.completeAtomically.mockResolvedValue({
        status: "IDEMPOTENT",
        visit: completedVisit,
      });

      const result = await service.completeVisit(
        {
          visitId: "visit-123",
          notes: "same completion note",
        },
        "carer-123",
        "carer",
        organizationId,
        frontlineAccess,
      );

      expect(result).toBe(completedVisit);
    });

    it.each([
      ["CANCELLED", "Cancelled visits cannot be completed"],
      [
        "COMPLETED_DETAILS",
        "Visit is already completed with different completion details",
      ],
      ["NOT_STARTED", "Visit must be started before it can be completed"],
    ] as const)(
      "should map %s completion conflicts to a stable domain error",
      async (reason, message) => {
        mockVisitRepository.completeAtomically.mockResolvedValue({
          status: "CONFLICT",
          reason,
        });

        await expect(
          service.completeVisit(
            { visitId: "visit-123", notes: "Completion note" },
            "carer-123",
            "carer",
            organizationId,
            frontlineAccess,
          ),
        ).rejects.toMatchObject({
          status: HttpStatus.CONFLICT,
          response: {
            code: ErrorCode.VISIT_COMPLETION_CONFLICT,
            message,
          },
        });
      },
    );

    it("should reject a non-Clerk completion before starting the transaction", async () => {
      await expect(
        service.completeVisit(
          { visitId: "visit-123" },
          "carer-123",
          "carer",
          organizationId,
          { ...frontlineAccess, identityProvider: "legacy" },
        ),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN },
      });
      expect(repository.completeAtomically).not.toHaveBeenCalled();
    });
  });

  describe("deleteVisit", () => {
    it("should route an admin delete through the atomic audit path", async () => {
      mockVisitRepository.deleteAtomically.mockResolvedValue({
        status: "DELETED",
        visit: { ...mockVisit, deleted_at: new Date() },
      });

      const result = await service.deleteVisit(
        "visit-123",
        "admin-123",
        "admin",
        organizationId,
      );

      expect(repository.deleteAtomically).toHaveBeenCalledWith({
        visitId: "visit-123",
        organizationId,
        actorAuthSubject: "admin-123",
      });
      expect(result.deleted_at).toBeTruthy();
    });

    it("should reject non-admin direct service callers", async () => {
      await expect(
        service.deleteVisit("visit-123", "carer-123", "carer", organizationId),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.FORBIDDEN_ADMIN_ONLY },
      });
      expect(repository.deleteAtomically).not.toHaveBeenCalled();
    });

    it("should reject deletion after the locked visit is no longer scheduled", async () => {
      mockVisitRepository.deleteAtomically.mockResolvedValue({
        status: "NOT_SCHEDULED",
      });
      await expect(
        service.deleteVisit("visit-123", "admin-123", "admin", organizationId),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ErrorCode.VISIT_COMPLETION_CONFLICT },
      });
    });
  });
});
