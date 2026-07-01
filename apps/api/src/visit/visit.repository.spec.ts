import { VisitRepository } from './visit.repository';

describe('VisitRepository tenant write safety', () => {
  function createRepository() {
    const prisma = {
      visit: {
        create: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new VisitRepository(prisma),
    };
  }

  it('rejects visit creation without tenant ownership', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.create({
        carer: { connect: { id: 'carer-1' } },
        client: { connect: { id: 'client-1' } },
        scheduled_start: new Date('2026-05-01T09:00:00.000Z'),
        scheduled_end: new Date('2026-05-01T10:00:00.000Z'),
      } as any),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.visit.create).not.toHaveBeenCalled();
  });
});
