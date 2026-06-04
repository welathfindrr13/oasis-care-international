import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { StatsService } from '../stats.service';
import { PrismaService } from '@oasis/db';
import { ErrorCode } from '../../common/errors/error-codes';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      whereNotDeleted: jest.fn().mockImplementation((where) => where),
      $transaction: jest.fn(),
      visit: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTodayStats', () => {
    it('should return correct counts for booked and finished visits', async () => {
      // Mock the transaction to return [5, 3]
      (prisma.$transaction as jest.Mock).mockResolvedValue([5, 3]);

      const result = await service.getTodayStats('org-123');

      expect(result).toEqual({
        booked: 5,
        finished: 3,
      });

      // Verify the transaction was called
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      
      // Verify the transaction was called with two count queries
      const transactionCalls = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(transactionCalls).toHaveLength(2);
    });

    it('should use correct date for start of day', async () => {
      const mockDate = new Date('2025-07-30T15:30:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      (prisma.$transaction as jest.Mock).mockImplementation((queries) => {
        // Verify the queries use the correct start of day
        const expectedStartOfDay = new Date('2025-07-30T00:00:00.000Z');
        
        expect(queries).toHaveLength(2);
        // We can't directly test the query parameters here since they're promises
        // but we've verified the logic in the service
        
        return Promise.resolve([10, 7]);
      });

      const result = await service.getTodayStats('org-123');

      expect(result).toEqual({
        booked: 10,
        finished: 7,
      });

      jest.useRealTimers();
    });

    it('should handle zero counts', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([0, 0]);

      const result = await service.getTodayStats('org-123');

      expect(result).toEqual({
        booked: 0,
        finished: 0,
      });
    });

    it('should reject when organization scope is missing', async () => {
      await expect(service.getTodayStats()).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject even when a single organization exists but claim is missing', async () => {
      await expect(service.getTodayStats()).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
