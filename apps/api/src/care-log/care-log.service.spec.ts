import { CareLogCategory } from '@oasis/db';
import { ErrorCode } from '../common/errors/error-codes';
import { CareLogService } from './care-log.service';

describe('CareLogService raw operational access policy', () => {
  function createService() {
    const repository = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
    const prisma = {
      careLog: {
        findMany: jest.fn(),
      },
      medicationAdministration: {
        findMany: jest.fn(),
      },
      visit: {
        findFirst: jest.fn(),
      },
      whereNotDeleted: jest.fn((where) => ({ ...where, deleted_at: null })),
    };

    return {
      repository,
      prisma,
      service: new CareLogService(repository as any, prisma as any),
    };
  }

  it('denies client and family-style actors from listing raw care notes at the service layer', async () => {
    const { repository, service } = createService();

    await expect(
      service.listCareLogs({ take: 10 }, 'client-1', 'client', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
    });
    await expect(
      service.listCareLogs({ take: 10 }, 'family-1', 'family_contact', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
    });

    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it('denies client and family-style actors from monthly raw care summaries at the service layer', async () => {
    const { prisma, service } = createService();

    await expect(
      service.monthlyCareSummary('client-1', 2026, 5, 'client-1', 'client', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
    });
    await expect(
      service.monthlyCareSummary('client-1', 2026, 5, 'family-1', 'family_contact', 'org-1'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.FORBIDDEN_ROLE_REQUIRED },
    });

    expect(prisma.careLog.findMany).not.toHaveBeenCalled();
    expect(prisma.medicationAdministration.findMany).not.toHaveBeenCalled();
  });

  it('still allows admin reads through the raw care-note service', async () => {
    const { repository, service } = createService();
    repository.findMany.mockResolvedValue({ items: [], total: 0 });

    await expect(
      service.listCareLogs(
        {
          category: CareLogCategory.OTHER,
          take: 10,
        },
        'admin-1',
        'admin',
        'org-1',
      ),
    ).resolves.toEqual({ items: [], total: 0 });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          category: CareLogCategory.OTHER,
        }),
      }),
    );
  });

  it('uses organization calendar boundaries for monthly care records and eMAR', async () => {
    const { prisma, service } = createService();
    prisma.careLog.findMany.mockResolvedValue([]);
    prisma.medicationAdministration.findMany.mockResolvedValue([]);

    await service.monthlyCareSummary('client-1', 2026, 3, 'admin-1', 'admin', 'org-1');

    const expectedRange = {
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lt: new Date('2026-03-31T23:00:00.000Z'),
    };
    expect(prisma.careLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ occurred_at: expectedRange }),
      }),
    );
    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scheduled_time: expectedRange }),
      }),
    );
  });
});
