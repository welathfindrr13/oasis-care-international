import { ShiftRepository } from './shift.repository';

describe('ShiftRepository tenant write safety', () => {
  function createRepository() {
    const transactionClient = {
      carerShift: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const prisma = {
      ...transactionClient,
      whereNotDeleted: jest.fn((where) => ({ ...where, deleted_at: null })),
      $transaction: jest.fn((callback) => callback(transactionClient)),
    } as any;

    return {
      prisma,
      transactionClient,
      repository: new ShiftRepository(prisma),
    };
  }

  const audit = {
    authSubject: 'subject-1',
    membershipId: 'membership-1',
    actorRole: 'carer',
    requestFingerprint: 'a'.repeat(64),
    fingerprintKeyId: 'shift-current',
    fingerprintVersion: 3,
    notesProvided: true,
  };

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

  it('locates an exact shift only inside the carer and organization boundary', async () => {
    const { prisma, repository } = createRepository();
    prisma.carerShift.findFirst.mockResolvedValue(null);

    await repository.findShiftByIdForCarer('shift-1', 'carer-1', 'org-1');

    expect(prisma.carerShift.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'shift-1',
        carer_id: 'carer-1',
        organization_id: 'org-1',
        deleted_at: null,
      },
    });
  });

  it('closes only an open shift and reports whether this request won the update', async () => {
    const { prisma, transactionClient, repository } = createRepository();
    const persisted = {
      id: 'shift-1',
      organization_id: 'org-1',
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
    };
    transactionClient.carerShift.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.carerShift.findFirst.mockResolvedValue(persisted);

    await expect(
      repository.closeShift(
        'shift-1',
        {
          clockOutMethod: 'MANUAL' as any,
          clockOutSource: 'web',
          notes: 'Finished',
        },
        'carer-1',
        'org-1',
        audit,
      ),
    ).resolves.toEqual({
      applied: true,
      shift: persisted,
      requestProof: {
        hmac: audit.requestFingerprint,
        keyId: audit.fingerprintKeyId,
        version: audit.fingerprintVersion,
      },
    });

    expect(transactionClient.carerShift.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'shift-1',
          carer_id: 'carer-1',
          organization_id: 'org-1',
          clock_out_at: null,
          deleted_at: null,
        },
      }),
    );
    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'subject-1',
        action: 'SHIFT_CLOCKED_OUT',
        resource_type: 'CarerShift',
        resource_id: 'shift-1',
        old_values: { state: 'OPEN' },
        new_values: {
          state: 'CLOSED',
          membershipId: 'membership-1',
          actorRole: 'carer',
          requestFingerprint: audit.requestFingerprint,
          fingerprintKeyId: 'shift-current',
          fingerprintVersion: 3,
          notesProvided: true,
        },
      }),
    });
    expect(JSON.stringify(transactionClient.auditLog.create.mock.calls[0][0])).not.toContain(
      'Finished',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns the original request proof when the open-shift predicate loses', async () => {
    const { transactionClient, repository } = createRepository();
    const persisted = {
      id: 'shift-1',
      organization_id: 'org-1',
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
    };
    transactionClient.carerShift.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.carerShift.findFirst.mockResolvedValue(persisted);
    transactionClient.auditLog.findFirst.mockResolvedValue({
      new_values: {
        requestFingerprint: audit.requestFingerprint,
        fingerprintKeyId: audit.fingerprintKeyId,
        fingerprintVersion: 3,
      },
    });

    await expect(
      repository.closeShift(
        'shift-1',
        { clockOutMethod: 'MANUAL' as any },
        'carer-1',
        'org-1',
        audit,
      ),
    ).resolves.toEqual({
      applied: false,
      shift: persisted,
      requestProof: {
        hmac: audit.requestFingerprint,
        keyId: audit.fingerprintKeyId,
        version: audit.fingerprintVersion,
      },
    });
    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it('fails closed for a legacy closed shift without canonical request proof', async () => {
    const { transactionClient, repository } = createRepository();
    const persisted = {
      id: 'shift-1',
      organization_id: 'org-1',
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
    };
    transactionClient.carerShift.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.carerShift.findFirst.mockResolvedValue(persisted);
    transactionClient.auditLog.findFirst.mockResolvedValue(null);

    await expect(
      repository.closeShift(
        'shift-1',
        { clockOutMethod: 'MANUAL' as any },
        'carer-1',
        'org-1',
        audit,
      ),
    ).resolves.toEqual({ applied: false, shift: persisted, requestProof: null });
  });

  it('rejects malformed proof metadata from an older audit row', async () => {
    const { transactionClient, repository } = createRepository();
    const persisted = {
      id: 'shift-1',
      organization_id: 'org-1',
      clock_out_at: new Date('2026-07-13T10:00:00.000Z'),
    };
    transactionClient.carerShift.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.carerShift.findFirst.mockResolvedValue(persisted);
    transactionClient.auditLog.findFirst.mockResolvedValue({
      new_values: {
        requestFingerprint: audit.requestFingerprint,
        fingerprintKeyId: 'INVALID KEY',
        fingerprintVersion: 1,
      },
    });

    await expect(
      repository.closeShift(
        'shift-1',
        { clockOutMethod: 'MANUAL' as any },
        'carer-1',
        'org-1',
        audit,
      ),
    ).resolves.toEqual({ applied: false, shift: persisted, requestProof: null });
  });
});
