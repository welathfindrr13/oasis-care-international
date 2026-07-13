import { MedicationRepository } from './medication.repository';

describe('MedicationRepository', () => {
  function createRepository() {
    const prisma = {
      medicationAdministration: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      medicationAudit: {
        create: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new MedicationRepository(prisma),
    };
  }

  it('scopes today medication queries to the assigned visit when a carer id is provided', async () => {
    const { prisma, repository } = createRepository();

    await repository.findTodaysMedicationsByClient(
      '2025-01-08',
      'org-123',
      'carer-123',
    );

    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visit: {
            is: {
              organization_id: 'org-123',
              carer_id: 'carer-123',
              deleted_at: null,
            },
          },
          prescription: {
            client: {
              organization_id: 'org-123',
              deleted_at: null,
            },
          },
        }),
      }),
    );
  });

  it('does not inject visit ownership filtering for admin-style queries', async () => {
    const { prisma, repository } = createRepository();

    await repository.findTodaysMedicationsByClient(
      '2025-01-08',
      'org-123',
    );

    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          visit: expect.anything(),
        }),
      }),
    );
  });

  it('uses the 23-hour organization day for eMAR on the BST spring boundary', async () => {
    const { prisma, repository } = createRepository();

    await repository.findTodaysMedicationsByClient(
      '2026-03-29',
      'org-123',
    );

    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduled_time: {
            gte: new Date('2026-03-29T00:00:00.000Z'),
            lt: new Date('2026-03-29T23:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('uses the 25-hour organization day for eMAR on the BST autumn boundary', async () => {
    const { prisma, repository } = createRepository();

    await repository.findTodaysMedicationsByClient(
      '2026-10-25',
      'org-123',
    );

    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduled_time: {
            gte: new Date('2026-10-24T23:00:00.000Z'),
            lt: new Date('2026-10-26T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('treats a selected date as a calendar key rather than an instant', async () => {
    const { prisma, repository } = createRepository();

    await repository.findTodaysMedicationsByClient(
      '2026-07-13',
      'org-future',
    );

    expect(prisma.medicationAdministration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduled_time: {
            gte: new Date('2026-07-12T23:00:00.000Z'),
            lt: new Date('2026-07-13T23:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects medication audit creation without tenant ownership', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.createMedicationAudit({
        organizationId: '',
        action: 'MEDICATION_ADMINISTERED' as any,
        actorId: 'staff-1',
        actorRole: 'admin',
        changes: {},
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.medicationAudit.create).not.toHaveBeenCalled();
  });
});
