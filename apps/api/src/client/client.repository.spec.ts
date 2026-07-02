import { ClientRepository } from './client.repository';

describe('ClientRepository tenant write safety', () => {
  function createRepository() {
    const prisma = {
      client: {
        create: jest.fn(),
      },
    } as any;

    return {
      prisma,
      repository: new ClientRepository(prisma),
    };
  }

  it('rejects client creation without tenant ownership', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.create({
        organization_id: '',
        full_name: 'Synthetic Person',
        address_line1: '1 Test Street',
        city: 'London',
        postcode: 'TE1 1ST',
      }),
    ).rejects.toThrow('Organization context is required');

    expect(prisma.client.create).not.toHaveBeenCalled();
  });
});
