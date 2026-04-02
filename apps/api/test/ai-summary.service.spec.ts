import { Test, TestingModule } from '@nestjs/testing';
import { AiSummaryService } from '../src/ai-summary/ai-summary.service';
import { AiSummaryRepository } from '../src/ai-summary/ai-summary.repository';
import { MedicationRepository } from '../src/medication/medication.repository';
import { EmbeddingBatchService } from '../src/ai-summary/embeddings/embedding.batch';
import { ClsService } from 'nestjs-cls';

describe('AiSummaryService', () => {
  let service: AiSummaryService;

  const mockRepository = {
    checkOrganizationAIEnabled: jest.fn(),
    findByClientAndPeriod: jest.fn(),
    create: jest.fn(),
  };

  const mockMedicationRepository = {
    createMedicationAudit: jest.fn(),
  };

  const mockEmbeddingBatchService = {
    generateSummaryPayload: jest.fn(),
  };

  const mockCls = {
    get: jest.fn().mockReturnValue('request-123'),
  };

  beforeEach(async () => {
    process.env.AI_SUMMARY_ENABLED_ENV = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSummaryService,
        {
          provide: AiSummaryRepository,
          useValue: mockRepository,
        },
        {
          provide: MedicationRepository,
          useValue: mockMedicationRepository,
        },
        {
          provide: EmbeddingBatchService,
          useValue: mockEmbeddingBatchService,
        },
        {
          provide: ClsService,
          useValue: mockCls,
        },
      ],
    }).compile();

    service = module.get(AiSummaryService);
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.AI_SUMMARY_ENABLED_ENV;
  });

  it('returns the existing non-expired summary for the requested period', async () => {
    const existingSummary = {
      id: 'summary-1',
      client_id: 'client-123',
      period_start: new Date('2026-03-20'),
      period_end: new Date('2026-03-27'),
      summary_json: { overall_health: 'Stable' },
      risk_levels: { overall: 'green' },
      generated_at: new Date('2026-03-27T09:00:00.000Z'),
      generated_by: 'ai',
      approved_by: null,
      approved_at: null,
      feedback: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      created_at: new Date('2026-03-27T09:00:00.000Z'),
      updated_at: new Date('2026-03-27T09:00:00.000Z'),
    };

    mockRepository.checkOrganizationAIEnabled.mockResolvedValue(true);
    mockRepository.findByClientAndPeriod.mockResolvedValue(existingSummary);

    const result = await service.generateSummary(
      {
        clientId: 'client-123',
        periodStart: '2026-03-20',
        periodEnd: '2026-03-27',
      },
      'admin-123',
      'admin'
    );

    expect(result).toBe(existingSummary);
    expect(mockEmbeddingBatchService.generateSummaryPayload).not.toHaveBeenCalled();
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('creates a real AI summary from the batch payload when no current summary exists', async () => {
    const createdSummary = {
      id: 'summary-2',
      client_id: 'client-123',
      period_start: new Date('2026-03-20'),
      period_end: new Date('2026-03-27'),
      summary_json: { overall_health: 'Needs closer hydration support' },
      risk_levels: { overall: 'amber', medication: 'green' },
      generated_at: new Date('2026-03-27T09:00:00.000Z'),
      generated_by: 'ai',
      approved_by: null,
      approved_at: null,
      feedback: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date('2026-03-27T09:00:00.000Z'),
      updated_at: new Date('2026-03-27T09:00:00.000Z'),
    };

    mockRepository.checkOrganizationAIEnabled.mockResolvedValue(true);
    mockRepository.findByClientAndPeriod.mockResolvedValue(null);
    mockEmbeddingBatchService.generateSummaryPayload.mockResolvedValue({
      summaryJson: { overall_health: 'Needs closer hydration support' },
      riskLevels: { overall: 'amber', medication: 'green' },
      careLogCount: 9,
    });
    mockRepository.create.mockResolvedValue(createdSummary);

    const result = await service.generateSummary(
      {
        clientId: 'client-123',
        periodStart: '2026-03-20',
        periodEnd: '2026-03-27',
      },
      'admin-123',
      'admin'
    );

    expect(mockEmbeddingBatchService.generateSummaryPayload).toHaveBeenCalledWith(
      'client-123',
      new Date('2026-03-20'),
      new Date('2026-03-27')
    );
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        summary_json: { overall_health: 'Needs closer hydration support' },
        risk_levels: { overall: 'amber', medication: 'green' },
      })
    );
    expect(mockMedicationRepository.createMedicationAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-123',
        actorRole: 'admin',
        changes: expect.objectContaining({
          careLogCount: 9,
        }),
      })
    );
    expect(result).toBe(createdSummary);
  });
});
