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

    expect(period.queryStart.toISO()).toBe('2026-03-27T00:00:00.000+00:00');
    expect(period.queryEndExclusive.toISO()).toBe('2026-04-03T00:00:00.000+01:00');
    expect(period.recordStart.toISOString()).toBe('2026-03-27T00:00:00.000Z');
    expect(period.recordEnd.toISOString()).toBe('2026-04-02T00:00:00.000Z');
    expect(period.timezone).toBe('Europe/London');
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
        queryStart: DateTime.fromISO(
          organizationId === 'org-a'
            ? '2026-03-27T00:00:00.000Z'
            : '2026-03-27T01:00:00.000Z',
        ),
        queryEndExclusive: DateTime.fromISO(
          organizationId === 'org-a'
            ? '2026-04-02T23:00:00.000Z'
            : '2026-04-03T00:00:00.000Z',
        ),
        recordStart: new Date('2026-03-27T00:00:00.000Z'),
        recordEnd: new Date('2026-04-02T00:00:00.000Z'),
        timezone: organizationId === 'org-a' ? 'Europe/London' : 'America/New_York',
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

  it('formats AI log timestamps in the organization timezone instead of the host timezone', () => {
    const service = new EmbeddingBatchService({} as any);
    const text = (service as any).formatLogForEmbedding(
      {
        timestamp: new Date('2026-07-12T07:00:00.000Z'),
        logType: 'medication',
        data: { status: 'SCHEDULED' },
      },
      'Europe/London',
    );

    expect(text).toContain('2026-07-12 08:00 medication');
  });

  it('stores inclusive date-only reporting keys', async () => {
    const prisma = {
      healthSummary: { create: jest.fn().mockResolvedValue({ id: 'summary-1' }) },
    } as any;
    const service = new EmbeddingBatchService(prisma);

    await (service as any).storeSummary(
      'client-1',
      {},
      new Date('2026-03-27T00:00:00.000Z'),
      new Date('2026-04-02T00:00:00.000Z'),
    );

    expect(prisma.healthSummary.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          period_start: new Date('2026-03-27T00:00:00.000Z'),
          period_end: new Date('2026-04-02T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('labels the AI prompt with inclusive Thursday and organization-local log time', async () => {
    const service = new EmbeddingBatchService({} as any);
    let prompt = '';
    (service as any).bedrock = {
      send: jest.fn().mockImplementation(async (command: any) => {
        const request = JSON.parse(command.input.body);
        prompt = request.messages[0].content;
        return {
          body: new TextEncoder().encode(JSON.stringify({
            content: [{ text: '{"overall":"green"}' }],
          })),
        };
      }),
    };

    await (service as any).createHealthSummary(
      'client-1',
      [{
        timestamp: new Date('2026-07-12T07:00:00.000Z'),
        logType: 'visit',
        data: { status: 'COMPLETED' },
      }],
      {
        queryStart: DateTime.fromISO('2026-03-27T00:00:00.000Z'),
        queryEndExclusive: DateTime.fromISO('2026-04-02T23:00:00.000Z'),
        recordStart: new Date('2026-03-27T00:00:00.000Z'),
        recordEnd: new Date('2026-04-02T00:00:00.000Z'),
        timezone: 'Europe/London',
      },
    );

    expect(prompt).toContain(
      'Period: 2026-03-27 to 2026-04-02 (Friday to Thursday, inclusive)',
    );
    expect(prompt).toContain('"timestamp": "2026-07-12 08:00"');
    expect(prompt).not.toContain('Period: 2026-03-27 to 2026-04-03');
  });
});
