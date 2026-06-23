import { AuditLogInterceptor } from '../audit-log.interceptor';

describe('AuditLogInterceptor', () => {
  function createInterceptor() {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };

    return {
      interceptor: new AuditLogInterceptor(prisma as any),
      prisma,
    };
  }

  const baseEntry = {
    userId: 'user_test_123',
    action: 'GraphQL Query.careRooms [SUCCESS 12ms]',
    resourceType: 'Query',
    organizationId: 'org-internal-1',
    ipAddress: '203.0.113.10',
    userAgent: 'Jest',
  };

  it('writes audit logs with a valid internal organization id', async () => {
    const { interceptor, prisma } = createInterceptor();
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' });

    await (interceptor as any).logToDatabase(baseEntry);

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user_test_123',
        organization_id: 'org-internal-1',
        action: 'GraphQL Query.careRooms [SUCCESS 12ms]',
        resource_type: 'Query',
      }),
    });
  });

  it('degrades audit logging to nullable organization id when organization FK is stale', async () => {
    const { interceptor, prisma } = createInterceptor();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fkFailure = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
      meta: {
        modelName: 'AuditLog',
        field_name: 'audit_log_organization_id_fkey (index)',
      },
    });

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockResolvedValueOnce({ id: 'audit-2' });

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        organization_id: 'org-internal-1',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        organization_id: null,
      }),
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Audit log organization FK failed; retrying without organization_id',
      expect.objectContaining({
        code: 'P2003',
        modelName: 'AuditLog',
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
