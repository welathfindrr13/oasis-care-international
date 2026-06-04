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

  function createService() {
    return new AiSummaryService(
      {
        checkOrganizationAIEnabled: jest.fn(),
      } as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
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
      ).catch((error) => {
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.getResponse()).toEqual({
          code: ErrorCode.FEATURE_NOT_ENABLED,
          message: 'AI summary generation is disabled for this deployment.',
        });
      });
  });
});
