import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ClientService } from '../client.service';

describe('ClientService', () => {
  const clientRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const transactionClient = {
    visit: { updateMany: jest.fn() },
    client: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const prisma = {
    client: {
      findFirst: jest.fn(),
    },
    whereNotDeleted: jest.fn((value) => value),
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(
      async (work: (tx: typeof transactionClient) => Promise<unknown>) =>
        work(transactionClient),
    ),
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

  it('stores only the client identifier when creating a client audit event', async () => {
    clientRepository.create.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_CLIENT_NAME',
      address_line1: 'PRIVATE_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_CITY',
      postcode: 'PRIVATE_POSTCODE',
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await service.createClient(
      {
        fullName: 'PRIVATE_CLIENT_NAME',
        addressLine1: 'PRIVATE_ADDRESS',
        city: 'PRIVATE_CITY',
        postcode: 'PRIVATE_POSTCODE',
      },
      'user-1',
      'org-1',
    );

    const auditData = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditData.new_values).toEqual({ id: 'client-1' });
    expect(JSON.stringify(auditData)).not.toContain('PRIVATE_');
  });

  it('stores only old and new identifiers when updating a client audit event', async () => {
    clientRepository.findById.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_OLD_NAME',
      city: 'PRIVATE_OLD_CITY',
      postcode: 'PRIVATE_OLD_POSTCODE',
    });
    clientRepository.update.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_NEW_NAME',
      address_line1: 'PRIVATE_NEW_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_NEW_CITY',
      postcode: 'PRIVATE_NEW_POSTCODE',
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    await service.updateClient(
      'client-1',
      {
        fullName: 'PRIVATE_NEW_NAME',
        addressLine1: 'PRIVATE_NEW_ADDRESS',
        city: 'PRIVATE_NEW_CITY',
        postcode: 'PRIVATE_NEW_POSTCODE',
      },
      'user-1',
      'org-1',
    );

    const auditData = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditData.old_values).toEqual({ id: 'client-1' });
    expect(auditData.new_values).toEqual({ id: 'client-1' });
    expect(JSON.stringify(auditData)).not.toContain('PRIVATE_');
  });

  it('does not duplicate personal fields or deletion time in client deletion audit metadata', async () => {
    clientRepository.findById.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_DELETED_NAME',
      city: 'PRIVATE_DELETED_CITY',
      postcode: 'PRIVATE_DELETED_POSTCODE',
    });
    transactionClient.visit.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.client.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.client.findFirst.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_DELETED_NAME',
      address_line1: 'PRIVATE_DELETED_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_DELETED_CITY',
      postcode: 'PRIVATE_DELETED_POSTCODE',
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-3' });

    await service.deleteClient('client-1', 'user-1', 'org-1');

    const auditData = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditData.old_values).toEqual({ id: 'client-1' });
    expect(auditData.new_values).toEqual({ id: 'client-1' });
    expect(auditData.new_values).not.toHaveProperty('deletedAt');
    expect(JSON.stringify(auditData)).not.toContain('PRIVATE_');
  });
});
