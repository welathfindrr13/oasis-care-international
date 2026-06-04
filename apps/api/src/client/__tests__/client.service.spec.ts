import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ClientService } from '../client.service';

describe('ClientService', () => {
  const clientRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    client: {
      findFirst: jest.fn(),
    },
    whereNotDeleted: jest.fn((value) => value),
    auditLog: {
      create: jest.fn(),
    },
  };

  let service: ClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientService(clientRepository as any, prisma as any);
  });

  it('returns the visit-scoped client for carers when it exists', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      full_name: 'Alice Smith',
      address_line1: '1 Test Street',
      address_line2: null,
      city: 'London',
      postcode: 'E1 1AA',
    });

    const result = await service.findClientById(
      'client-1',
      'carer-sub-1',
      'carer',
      'org-1',
    );

    expect(prisma.client.findFirst).toHaveBeenCalledTimes(1);
    expect(clientRepository.findById).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'client-1',
      fullName: 'Alice Smith',
    });
  });

  it('does not fall back to the organization-scoped lookup for carers when the scoped lookup misses', async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(
      service.findClientById('client-2', 'carer-sub-2', 'carer', 'org-1'),
    ).rejects.toBeInstanceOf(BaseHttpException);

    expect(prisma.client.findFirst).toHaveBeenCalledTimes(1);
    expect(clientRepository.findById).not.toHaveBeenCalled();
  });

  it('throws when no client exists in the organization', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    clientRepository.findById.mockResolvedValue(null);

    await expect(
      service.findClientById('missing-client', 'carer-sub-3', 'carer', 'org-1'),
    ).rejects.toBeInstanceOf(BaseHttpException);
  });
});
