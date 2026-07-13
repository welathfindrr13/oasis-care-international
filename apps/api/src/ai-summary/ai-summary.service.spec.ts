import { HttpStatus } from '@nestjs/common';
import { AiSummaryService } from './ai-summary.service';
import { ErrorCode } from '../common/errors/error-codes';

describe('AiSummaryService Deployment V2 runtime guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, AI_SUMMARY_ENABLED: 'false' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createService(prisma: any = {}) {
    return new AiSummaryService(
      {
        checkOrganizationAIEnabled: jest.fn(),
      } as any,
      {} as any,
      { get: jest.fn() } as any,
      prisma,
    );
  }

  it('does not create a Bedrock client during service construction', () => {
    const service = createService() as any;
    expect(service.bedrock).toBeNull();
  });

  it('blocks generation before AWS config is required when AI is disabled', async () => {
    expect.assertions(2);
    const service = createService();

    await service.generateSummary(
        {
          clientId: 'client-1',
          periodStart: '2026-01-01',
          periodEnd: '2026-01-07',
        },
        'user-1',
        'admin',
        'org-1',
        {
          authenticated: true,
          authSubject: 'user-1',
          identityProvider: 'test',
          organizationId: 'org-1',
          membershipId: 'membership-1',
          membershipState: 'ACTIVE',
          rawRole: 'admin',
          effectiveRole: 'admin',
          surface: 'ADMIN',
          linkedIdentityState: 'NOT_REQUIRED',
          onboardingState: 'READY',
          domainIdentityId: null,
        },
      ).catch((error) => {
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.getResponse()).toEqual({
          code: ErrorCode.FEATURE_NOT_ENABLED,
          message: 'AI summary generation is disabled for this deployment.',
        });
      });
  });

  it('rejects approver carer creation without tenant ownership', async () => {
    const prisma = {
      carer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      whereNotDeleted: jest.fn((where) => where),
    };
    const service = createService(prisma) as any;

    await expect(
      service.resolveApproverId('user-1', 'approver@example.test', '   '),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.carer.create).not.toHaveBeenCalled();
  });

  it('queries summary source visits with an exclusive organization-period end', async () => {
    const prisma = {
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      whereNotDeleted: jest.fn((where) => where),
    };
    const service = createService(prisma) as any;
    const periodStart = new Date('2026-05-02T23:00:00.000Z');
    const periodEndExclusive = new Date('2026-05-09T23:00:00.000Z');

    await service.collectCareLogs(
      'client-1',
      periodStart,
      periodEndExclusive,
      'org-1',
    );

    expect(prisma.visit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          client_id: 'client-1',
          scheduled_start: { gte: periodStart, lt: periodEndExclusive },
        }),
      }),
    );
  });

  it('formats manual model input in the organization timezone after UTC midnight in BST', async () => {
    const visit = {
      scheduled_start: new Date('2026-07-12T23:30:00.000Z'),
      scheduled_end: new Date('2026-07-13T00:30:00.000Z'),
      actual_start: new Date('2026-07-12T23:35:00.000Z'),
      actual_end: new Date('2026-07-13T00:25:00.000Z'),
      status: 'COMPLETED',
      notes: 'Visit note',
      tasks: [
        {
          completed_at: new Date('2026-07-12T23:45:00.000Z'),
          task_name: 'Hydration',
          is_completed: true,
          notes: 'Completed',
        },
      ],
      medication_administrations: [
        {
          administered_time: new Date('2026-07-13T00:15:00.000Z'),
          scheduled_time: new Date('2026-07-12T23:50:00.000Z'),
          status: 'ADMINISTERED',
          notes: null,
          prescription: {
            medication: { name: 'Example', dosage: '1', unit: 'tablet' },
          },
        },
      ],
    };
    const prisma = {
      visit: { findMany: jest.fn().mockResolvedValue([visit]) },
      whereNotDeleted: jest.fn((where) => where),
    };
    const service = createService(prisma) as any;
    service.invokeSummaryModel = jest.fn().mockResolvedValue('{}');

    const logs = await service.collectCareLogs(
      'client-1',
      new Date('2026-07-12T23:00:00.000Z'),
      new Date('2026-07-13T23:00:00.000Z'),
      'org-1',
      'Europe/London',
    );
    await service.generateSummaryFromModel(
      new Date('2026-07-13T00:00:00.000Z'),
      new Date('2026-07-19T00:00:00.000Z'),
      logs,
      'Europe/London',
    );

    const prompt = service.invokeSummaryModel.mock.calls[0][1] as string;
    expect(prompt).toContain('Organization timezone: Europe/London');
    expect(prompt).toContain('Period: 2026-07-13 to 2026-07-19 (inclusive organization calendar dates)');
    expect(prompt).toContain('13 Jul 2026, 00:30:00 BST');
    expect(prompt).toContain('13 Jul 2026, 00:45:00 BST');
    expect(prompt).toContain('13 Jul 2026, 00:50:00 BST');
    expect(prompt).toContain('13 Jul 2026, 01:15:00 BST');
    expect(prompt).not.toContain('2026-07-12T23:30:00.000Z');
  });

  it('rejects a BST organization-boundary instant as a summary date key', async () => {
    process.env.AI_SUMMARY_ENABLED = 'true';
    process.env.AWS_REGION = 'eu-west-2';
    const service = createService() as any;
    service.aiSummaryRepository.checkOrganizationAIEnabled.mockResolvedValue(true);

    await expect(
      service.generateSummary(
        {
          clientId: 'client-1',
          periodStart: '2026-04-30T23:00:00.000Z',
          periodEnd: '2026-05-07',
        },
        'user-1',
        'admin',
        'org-1',
        {
          authenticated: true,
          authSubject: 'user-1',
          identityProvider: 'test',
          organizationId: 'org-1',
          membershipId: 'membership-1',
          membershipState: 'ACTIVE',
          rawRole: 'admin',
          effectiveRole: 'admin',
          surface: 'ADMIN',
          linkedIdentityState: 'NOT_REQUIRED',
          onboardingState: 'READY',
          domainIdentityId: null,
        },
      ),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});
