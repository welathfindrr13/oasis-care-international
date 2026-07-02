import { ForbiddenException } from '@nestjs/common';
import { CarerRepository } from './carer.repository';

describe('CarerRepository tenant safety', () => {
  function createRepository() {
    const prisma = {
      carer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      whereNotDeleted: jest.fn((where) => where),
    } as any;

    return {
      prisma,
      repository: new CarerRepository(prisma),
    };
  }

  const input = {
    organization_id: 'org-1',
    id: 'carer-sub-1',
    first_name: 'Amira',
    last_name: 'Khan',
    email: 'amira@example.test',
    phone: null,
    is_active: true,
  };

  it('creates a carer profile inside the current organisation when no profile exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.carer.findUnique.mockResolvedValue(null);
    prisma.carer.create.mockResolvedValue({ id: input.id, organization_id: input.organization_id });

    await repository.upsertById(input);

    expect(prisma.carer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: input.id,
          organization_id: 'org-1',
        }),
      }),
    );
    expect(prisma.carer.update).not.toHaveBeenCalled();
  });

  it('updates a carer profile only when it already belongs to the current organisation', async () => {
    const { prisma, repository } = createRepository();
    prisma.carer.findUnique.mockResolvedValue({ id: input.id, organization_id: 'org-1' });
    prisma.carer.update.mockResolvedValue({ id: input.id, organization_id: 'org-1' });

    await repository.upsertById(input);

    expect(prisma.carer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.id },
        data: expect.objectContaining({
          organization_id: 'org-1',
        }),
      }),
    );
  });

  it('blocks moving an existing carer profile into another organisation', async () => {
    const { prisma, repository } = createRepository();
    prisma.carer.findUnique.mockResolvedValue({ id: input.id, organization_id: 'org-2' });

    await expect(repository.upsertById(input)).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.carer.update).not.toHaveBeenCalled();
    expect(prisma.carer.create).not.toHaveBeenCalled();
  });

  it('rejects creating a carer profile without tenant ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.carer.findUnique.mockResolvedValue(null);

    await expect(
      repository.upsertById({
        ...input,
        organization_id: '   ',
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.carer.create).not.toHaveBeenCalled();
    expect(prisma.carer.update).not.toHaveBeenCalled();
  });
});
