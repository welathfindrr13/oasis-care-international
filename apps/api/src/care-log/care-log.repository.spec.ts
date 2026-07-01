import { CareLogRepository } from './care-log.repository';

describe('CareLogRepository tenant write safety', () => {
  function createRepository() {
    const prisma = {
      careLog: {
        create: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new CareLogRepository(prisma),
    };
  }

  it('rejects care log creation without tenant ownership', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.create({
        client: { connect: { id: 'client-1' } },
        carer: { connect: { id: 'carer-1' } },
        occurred_at: new Date('2026-05-01T09:00:00.000Z'),
        category: 'OTHER',
      } as any),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.careLog.create).not.toHaveBeenCalled();
  });
});
