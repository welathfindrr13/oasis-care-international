import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController, StandardHealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', () => {
    const result = controller.health();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
  });
});

describe('StandardHealthController readiness', () => {
  it('returns ready when the database responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new StandardHealthController(prisma as any);

    await expect(controller.readiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: {
          api: 'ok',
          database: 'ok',
        },
      }),
    );
  });

  it('throws 503 without exposing data when the database is unavailable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new StandardHealthController(prisma as any);

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
