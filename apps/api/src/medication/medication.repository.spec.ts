import { MedicationRepository } from './medication.repository';

describe('MedicationRepository', () => {
  function createRepository() {
    const prisma = {
      medicationAdministration: {
        findMany: jest.fn().mockResolvedValue([]),
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
      new Date('2025-01-08T12:00:00Z'),
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
      new Date('2025-01-08T12:00:00Z'),
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
});
