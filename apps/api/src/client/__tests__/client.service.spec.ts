import { BaseHttpException } from '../../common/errors/base-http.exception';
import { ClientService } from '../client.service';
import { Logger } from '@nestjs/common';

describe('ClientService', () => {
  const clientRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const transactionClient = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    visit: { updateMany: jest.fn() },
    careRoom: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    careRoomMembership: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    accessGrant: { updateMany: jest.fn() },
    organizationMembershipInvitation: { updateMany: jest.fn() },
    client: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    client: {
      findFirst: jest.fn(),
    },
    whereNotDeleted: jest.fn((value) => value),
    auditLog: transactionClient.auditLog,
    $transaction: jest.fn(
      async (work: (tx: typeof transactionClient) => Promise<unknown>) =>
        work(transactionClient),
    ),
  };
  const familyInvitations = {
    reconcileArchivedClientInvitationCleanup: jest.fn(),
  };

  let service: ClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionClient.$queryRaw.mockResolvedValue([{ id: 'client-1' }]);
    prisma.$transaction.mockImplementation(
      async (work: (tx: typeof transactionClient) => Promise<unknown>) =>
        work(transactionClient),
    );
    transactionClient.careRoom.findMany.mockResolvedValue([]);
    transactionClient.careRoomMembership.findMany.mockResolvedValue([]);
    transactionClient.careRoom.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.careRoomMembership.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.accessGrant.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.organizationMembershipInvitation.updateMany.mockResolvedValue({ count: 0 });
    familyInvitations.reconcileArchivedClientInvitationCleanup.mockResolvedValue(undefined);
    service = new ClientService(
      clientRepository as any,
      prisma as any,
      familyInvitations as any,
    );
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
    expect(clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: 'org-1' }),
      transactionClient,
    );
  });

  it('rejects an audited create transaction and logs only bounded error metadata when the audit row fails', async () => {
    clientRepository.create.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_CLIENT_NAME',
      address_line1: 'PRIVATE_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_CITY',
      postcode: 'PRIVATE_POSTCODE',
    });
    const failure = Object.assign(new Error('PRIVATE_DATABASE_MESSAGE'), {
      code: 'P2002',
      meta: { target: 'PRIVATE_DATABASE_TARGET' },
    });
    transactionClient.auditLog.create.mockRejectedValueOnce(failure);
    let committed = false;
    prisma.$transaction.mockImplementationOnce(async (work) => {
      const result = await work(transactionClient);
      committed = true;
      return result;
    });
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      service.createClient(
        {
          fullName: 'PRIVATE_CLIENT_NAME',
          addressLine1: 'PRIVATE_ADDRESS',
          city: 'PRIVATE_CITY',
          postcode: 'PRIVATE_POSTCODE',
        },
        'user-1',
        'org-1',
      ),
    ).rejects.toBe(failure);

    expect(committed).toBe(false);
    expect(clientRepository.create).toHaveBeenCalledWith(
      expect.any(Object),
      transactionClient,
    );
    expect(transactionClient.auditLog.create).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Audited client creation failed',
      { errorName: 'Error', errorCode: 'P2002' },
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('PRIVATE_');
    warnSpy.mockRestore();
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
    expect(clientRepository.update).toHaveBeenCalledWith(
      'client-1',
      'org-1',
      expect.any(Object),
      transactionClient,
    );
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
    expect(
      familyInvitations.reconcileArchivedClientInvitationCleanup,
    ).toHaveBeenCalledWith([], 'org-1');
  });

  it('writes one delete audit when concurrent-style retries race on one state transition', async () => {
    const existing = {
      id: 'client-1',
      full_name: 'PRIVATE_DELETED_NAME',
      address_line1: 'PRIVATE_DELETED_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_DELETED_CITY',
      postcode: 'PRIVATE_DELETED_POSTCODE',
    };
    clientRepository.findById.mockResolvedValue(existing);
    transactionClient.client.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    transactionClient.client.findFirst.mockResolvedValue({
      ...existing,
      deleted_at: null,
    });
    transactionClient.visit.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.auditLog.create.mockResolvedValue({ id: 'audit-3' });

    const [winner, retry] = await Promise.all([
      service.deleteClient('client-1', 'user-1', 'org-1'),
      service.deleteClient('client-1', 'user-1', 'org-1'),
    ]);

    expect(winner.id).toBe('client-1');
    expect(retry.id).toBe('client-1');
    expect(transactionClient.client.updateMany).toHaveBeenCalledTimes(2);
    expect(transactionClient.visit.updateMany).toHaveBeenCalledTimes(1);
    expect(transactionClient.auditLog.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE_CLIENT',
        resource_id: 'client-1',
      }),
    });
  });

  it('atomically archives rooms and revokes client-specific Family authority without revoking organization membership', async () => {
    transactionClient.client.findFirst.mockResolvedValue({
      id: 'client-1',
      full_name: 'PRIVATE_DELETED_NAME',
      address_line1: 'PRIVATE_DELETED_ADDRESS',
      address_line2: null,
      city: 'PRIVATE_DELETED_CITY',
      postcode: 'PRIVATE_DELETED_POSTCODE',
      deleted_at: null,
    });
    transactionClient.client.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.visit.updateMany.mockResolvedValue({ count: 2 });
    transactionClient.careRoom.findMany.mockResolvedValue([
      { id: 'room-1', status: 'ACTIVE' },
    ]);
    transactionClient.careRoomMembership.findMany.mockResolvedValue([
      {
        id: 'room-membership-1',
        care_room_id: 'room-1',
        status: 'ACTIVE',
        organization_membership_invitation: {
          id: 'accepted-invitation',
          status: 'ACCEPTED',
        },
      },
      {
        id: 'room-membership-2',
        care_room_id: 'room-1',
        status: 'INVITED',
        organization_membership_invitation: {
          id: 'pending-invitation',
          status: 'PENDING',
        },
      },
    ]);
    transactionClient.careRoom.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.careRoomMembership.updateMany.mockResolvedValue({ count: 2 });
    transactionClient.accessGrant.updateMany.mockResolvedValue({ count: 3 });
    transactionClient.organizationMembershipInvitation.updateMany.mockResolvedValue({ count: 1 });

    await service.deleteClient('client-1', 'manager-subject', 'org-1');

    expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transactionClient.careRoom.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['room-1'] },
        organization_id: 'org-1',
        client_id: 'client-1',
        status: 'ACTIVE',
      },
      data: { status: 'ARCHIVED' },
    });
    expect(transactionClient.accessGrant.updateMany).toHaveBeenCalledWith({
      where: {
        care_room_membership_id: {
          in: ['room-membership-1', 'room-membership-2'],
        },
        revoked_at: null,
      },
      data: { revoked_at: expect.any(Date) },
    });
    expect(transactionClient.careRoomMembership.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['room-membership-1', 'room-membership-2'] },
        status: { in: ['INVITED', 'ACTIVE'] },
        revoked_at: null,
      },
      data: {
        status: 'REVOKED',
        revoked_at: expect.any(Date),
        revoked_by_user_id: 'manager-subject',
      },
    });
    expect(
      transactionClient.organizationMembershipInvitation.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: { in: ['pending-invitation'] },
        organization_id: 'org-1',
        intended_role: 'family',
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
        revoked_at: expect.any(Date),
        external_cleanup_required: true,
        external_cleanup_error_code: null,
        external_cleanup_completed_at: null,
      },
    });
    expect((transactionClient as any).organizationMembership).toBeUndefined();
    expect(
      familyInvitations.reconcileArchivedClientInvitationCleanup,
    ).toHaveBeenCalledWith(['pending-invitation'], 'org-1');

    const auditPayload = JSON.stringify(
      transactionClient.auditLog.create.mock.calls,
    );
    expect(auditPayload).toContain('CAREBRIDGE_ROOM_ARCHIVED');
    expect(auditPayload).toContain('FAMILY_ACCESS_REVOKED');
    expect(auditPayload).toContain('FAMILY_INVITATION_REVOKED');
    expect(auditPayload).not.toContain('PRIVATE_');
  });
});
