import { AiSummaryRepository } from './ai-summary.repository';

describe('AiSummaryRepository organization timezone', () => {
  it('uses the 167-hour organization week containing the BST spring change', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
    const prisma = {
      healthSummary: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const repository = new AiSummaryRepository(prisma);

    await repository.findCurrentWeekSummary('client-1', 'org-1');

    expect(prisma.healthSummary.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          period_start: { gte: new Date('2026-03-29T00:00:00.000Z') },
          period_end: { lte: new Date('2026-04-04T22:59:59.999Z') },
        }),
      }),
    );
    jest.useRealTimers();
  });
});
