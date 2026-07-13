import { DateTime } from 'luxon';
import { EmbeddingBatchService } from './embedding.batch';

describe('EmbeddingBatchService organization reporting periods', () => {
  const originalEnabled = process.env.AI_SUMMARY_ENABLED_ENV;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.AI_SUMMARY_ENABLED_ENV;
    } else {
      process.env.AI_SUMMARY_ENABLED_ENV = originalEnabled;
    }
    jest.restoreAllMocks();
  });

  it('uses the completed Friday-Thursday organization period across BST', () => {
    const service = new EmbeddingBatchService({} as any);
    const period = (service as any).calculateCompletedReportingPeriod(
      new Date('2026-04-03T01:00:00.000Z'),
      'org-uk',
    );

    expect(period.periodStart.toISO()).toBe('2026-03-27T00:00:00.000+00:00');
    expect(period.periodEnd.toISO()).toBe('2026-04-03T00:00:00.000+01:00');
  });

  it('resolves a completed reporting period separately for each organization', async () => {
    process.env.AI_SUMMARY_ENABLED_ENV = 'true';
    const prisma = {
      client: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'client-a', organization_id: 'org-a', organization: {} },
          { id: 'client-b', organization_id: 'org-b', organization: {} },
        ]),
      },
    } as any;
    const service = new EmbeddingBatchService(prisma);
    const calculate = jest
      .spyOn(service as any, 'calculateCompletedReportingPeriod')
      .mockImplementation((_now: Date, organizationId: string) => ({
        periodStart: DateTime.fromISO(
          organizationId === 'org-a'
            ? '2026-03-27T00:00:00.000Z'
            : '2026-03-27T01:00:00.000Z',
        ),
        periodEnd: DateTime.fromISO(
          organizationId === 'org-a'
            ? '2026-04-02T23:00:00.000Z'
            : '2026-04-03T00:00:00.000Z',
        ),
      }));
    const generate = jest
      .spyOn(service as any, 'generateClientSummary')
      .mockResolvedValue(undefined);

    await service.generateWeeklySummaries();

    expect(calculate.mock.calls.map((call) => call[1])).toEqual(['org-a', 'org-b']);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][0]).toBe('client-a');
    expect(generate.mock.calls[1][0]).toBe('client-b');
  });
});
