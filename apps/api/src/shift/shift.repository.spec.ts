import { ShiftRepository } from './shift.repository';

describe('ShiftRepository tenant write safety', () => {
  function createRepository() {
    const prisma = {
      carerShift: {
        create: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new ShiftRepository(prisma),
    };
  }

  it('rejects shift creation without tenant ownership', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.createShift({
        organizationId: '',
        carerId: 'carer-1',
        clockInMethod: 'MANUAL' as any,
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.carerShift.create).not.toHaveBeenCalled();
  });
});
