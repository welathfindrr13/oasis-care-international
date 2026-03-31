import { Test, TestingModule } from '@nestjs/testing';
import { CarePlanStatus } from '@oasis/db';
import { CarePlanService } from '../src/care-plan/care-plan.service';
import { CarePlanRepository } from '../src/care-plan/care-plan.repository';

describe('CarePlanService', () => {
  let service: CarePlanService;
  let repository: CarePlanRepository;

  const mockRepository = {
    findClientById: jest.fn(),
    findByClientId: jest.fn(),
    findById: jest.fn(),
    findPublishedHistoryByClientId: jest.fn(),
    createCarePlan: jest.fn(),
    getNextVersionNumber: jest.fn(),
    createVersion: jest.fn(),
    updateVersion: jest.fn(),
    updateCarePlan: jest.fn(),
    runPublishTransaction: jest.fn(),
  };

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
  };

  const baseClient = {
    id: 'client-123',
  };

  const makeVersion = (overrides: Record<string, unknown> = {}) => ({
    id: 'version-1',
    care_plan_id: 'care-plan-123',
    version_number: 1,
    status: CarePlanStatus.DRAFT,
    review_due_at: new Date('2026-05-01T00:00:00.000Z'),
    effective_from: new Date('2026-04-01T00:00:00.000Z'),
    authored_by: 'admin-123',
    approved_by: null,
    approved_at: null,
    content: {
      overview: {
        summary: 'Lives independently with a morning prompt and clear transfer guidance.',
        strengths: ['Knows her preferred routine'],
        preferences: ['Prefers support explained before touch assistance'],
      },
      goalsAndOutcomes: {
        goals: ['Maintain confidence with transfers'],
        desiredOutcomes: ['Complete safe morning support'],
      },
      dailyRoutines: {
        morning: 'Prompt washing and dressing.',
        midday: '',
        evening: '',
        overnight: '',
      },
      personalCareSupport: {
        bathing: '',
        dressing: '',
        toileting: '',
        grooming: '',
      },
      mobilityAndTransfers: {
        mobilitySummary: 'Mobilises with a frame indoors.',
        transferGuidance: 'Stand-by assist for chair transfers.',
        equipment: ['Walking frame'],
      },
      nutritionAndHydration: {
        nutritionSummary: '',
        hydrationSupport: '',
        dietaryNeeds: [],
      },
      medicationSupport: {
        levelOfSupport: '',
        keyInstructions: '',
        refusalEscalation: '',
      },
      communicationAndAccessibility: {
        communicationApproach: '',
        communicationNeeds: [],
        accessibilityAdjustments: [],
      },
      risksAndRedFlags: {
        items: [],
      },
      contingencyAndEscalation: {
        summary: '',
        actions: [],
        escalationTriggers: [],
      },
      representativesAndInvolvement: {
        summary: '',
        involvedPeople: [],
      },
    },
    created_at: new Date('2026-04-01T09:00:00.000Z'),
    updated_at: new Date('2026-04-01T09:00:00.000Z'),
    deleted_at: null,
    ...overrides,
  });

  const makeCarePlan = (overrides: Record<string, unknown> = {}) => ({
    id: 'care-plan-123',
    client_id: 'client-123',
    active_version_id: null,
    draft_version_id: null,
    active_version: null,
    draft_version: null,
    created_at: new Date('2026-04-01T09:00:00.000Z'),
    updated_at: new Date('2026-04-01T09:00:00.000Z'),
    deleted_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarePlanService,
        {
          provide: CarePlanRepository,
          useValue: mockRepository,
        },
        {
          provide: 'PrismaService',
          useValue: mockPrisma,
        },
        {
          provide: require('@oasis/db').PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get(CarePlanService);
    repository = module.get(CarePlanRepository);
    jest.clearAllMocks();
  });

  it('creates the first draft for a client with no existing care plan', async () => {
    const createdDraft = makeVersion();
    mockRepository.findClientById.mockResolvedValue(baseClient);
    mockRepository.findByClientId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCarePlan());
    mockRepository.createCarePlan.mockResolvedValue(makeCarePlan());
    mockRepository.getNextVersionNumber.mockResolvedValue(1);
    mockRepository.createVersion.mockResolvedValue(createdDraft);
    mockRepository.updateCarePlan.mockResolvedValue(makeCarePlan({ draft_version_id: createdDraft.id }));

    const result = await service.saveDraft(
      {
        clientId: 'client-123',
        reviewDueAt: '2026-05-01',
        effectiveFrom: '2026-04-01',
        content: {
          overview: { summary: 'Lives independently with morning prompting.' },
          dailyRoutines: { morning: 'Prompt washing and dressing.' },
          mobilityAndTransfers: { transferGuidance: 'Stand-by assist for chair transfers.' },
        },
      } as any,
      'admin-123',
      'admin'
    );

    expect(repository.createCarePlan).toHaveBeenCalledWith('client-123');
    expect(repository.createVersion).toHaveBeenCalled();
    expect(repository.updateCarePlan).toHaveBeenCalledWith('care-plan-123', {
      draft_version_id: 'version-1',
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(result.versionNumber).toBe(1);
    expect(result.status).toBe(CarePlanStatus.DRAFT);
  });

  it('updates the open draft instead of creating a second draft', async () => {
    const existingDraft = makeVersion({ id: 'version-2', version_number: 2 });
    mockRepository.findClientById.mockResolvedValue(baseClient);
    mockRepository.findByClientId.mockResolvedValue(
      makeCarePlan({
        draft_version_id: 'version-2',
        draft_version: existingDraft,
      })
    );
    mockRepository.updateVersion.mockResolvedValue({
      ...existingDraft,
      updated_at: new Date('2026-04-01T10:00:00.000Z'),
    });

    const result = await service.saveDraft(
      {
        clientId: 'client-123',
        reviewDueAt: '2026-05-01',
        effectiveFrom: '2026-04-01',
        content: {
          overview: { summary: 'Updated summary' },
          communicationAndAccessibility: { communicationApproach: 'Speak slowly and face the client.' },
        },
      } as any,
      'admin-123',
      'admin'
    );

    expect(repository.createVersion).not.toHaveBeenCalled();
    expect(repository.updateVersion).toHaveBeenCalledWith('version-2', expect.any(Object));
    expect(result.id).toBe('version-2');
  });

  it('publishes the open draft and marks it active', async () => {
    const draftVersion = makeVersion({ id: 'version-3', version_number: 3 });
    const publishedVersion = makeVersion({
      id: 'version-3',
      version_number: 3,
      status: CarePlanStatus.ACTIVE,
      approved_at: new Date('2026-04-02T09:00:00.000Z'),
      approved_by: 'admin-123',
    });
    mockRepository.findById.mockResolvedValue(
      makeCarePlan({
        active_version_id: 'version-2',
        draft_version_id: 'version-3',
        draft_version: draftVersion,
      })
    );
    mockRepository.runPublishTransaction.mockResolvedValue(publishedVersion);

    const result = await service.publishDraft('care-plan-123', 'admin-123', 'admin');

    expect(repository.runPublishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        carePlanId: 'care-plan-123',
        draftVersionId: 'version-3',
        previousActiveVersionId: 'version-2',
      })
    );
    expect(result.status).toBe(CarePlanStatus.ACTIVE);
    expect(result.approvedBy).toBe('admin-123');
  });

  it('discards the open draft and clears the draft pointer', async () => {
    const draftVersion = makeVersion({ id: 'version-4', version_number: 4 });
    const carePlan = makeCarePlan({
      draft_version_id: 'version-4',
      draft_version: draftVersion,
    });
    mockRepository.findById.mockResolvedValue(carePlan);
    mockRepository.updateVersion.mockResolvedValue({
      ...draftVersion,
      deleted_at: new Date('2026-04-02T11:00:00.000Z'),
    });
    mockRepository.updateCarePlan.mockResolvedValue({
      ...carePlan,
      draft_version_id: null,
      draft_version: null,
    });

    const result = await service.discardDraft('care-plan-123', 'admin-123', 'admin');

    expect(repository.updateVersion).toHaveBeenCalledWith('version-4', {
      deleted_at: expect.any(Date),
    });
    expect(repository.updateCarePlan).toHaveBeenCalledWith('care-plan-123', {
      draft_version_id: null,
    });
    expect(result.draftVersion).toBeNull();
  });

  it('rejects care-plan writes from non-admin roles', async () => {
    await expect(
      service.saveDraft(
        {
          clientId: 'client-123',
          content: {
            overview: { summary: 'Test' },
          },
        } as any,
        'carer-123',
        'carer'
      )
    ).rejects.toMatchObject({
      response: { code: 'FORBIDDEN_ADMIN_ONLY' },
    });
  });
});
