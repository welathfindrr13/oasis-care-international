import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@oasis/db';
import { StatsService } from '../stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: { visit: { count: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      visit: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTodayStats', () => {
    it('returns scheduled and finished counts for an admin', async () => {
      prisma.visit.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      const result = await service.getTodayStats('admin-1', 'admin', 'org-1');

      expect(result).toEqual({ booked: 5, finished: 3 });
      expect(prisma.visit.count).toHaveBeenCalledTimes(2);
      expect(prisma.visit.count).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
            scheduled_start: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
            client: {
              organization_id: 'org-1',
              deleted_at: null,
            },
          }),
        }),
      );
      expect(prisma.visit.count).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
            actual_end: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
            client: {
              organization_id: 'org-1',
              deleted_at: null,
            },
          }),
        }),
      );
    });

    it('scopes carer stats to the authenticated carer', async () => {
      prisma.visit.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);

      await service.getTodayStats('carer-42', 'carer', 'org-1');

      expect(prisma.visit.count).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            carer_id: 'carer-42',
          }),
        }),
      );
      expect(prisma.visit.count).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            carer_id: 'carer-42',
          }),
        }),
      );
    });

    it('uses the London operational day when building date boundaries', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-29T12:30:00.000Z'));
      prisma.visit.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      await service.getTodayStats('admin-1', 'admin', 'org-1');

      const firstWhere = prisma.visit.count.mock.calls[0][0].where;
      expect(firstWhere.scheduled_start.gte.toISOString()).toBe('2026-03-29T00:00:00.000Z');
      expect(firstWhere.scheduled_start.lt.toISOString()).toBe('2026-03-29T23:00:00.000Z');
    });

    it('rejects unsupported roles', async () => {
      await expect(service.getTodayStats('client-1', 'client', 'org-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.visit.count).not.toHaveBeenCalled();
    });
  });
});
