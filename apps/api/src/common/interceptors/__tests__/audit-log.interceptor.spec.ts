import { AuditLogInterceptor } from '../audit-log.interceptor';
import { of, lastValueFrom } from 'rxjs';

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

  it('degrades audit logging for Prisma target-array organization FK metadata', async () => {
    const { interceptor, prisma } = createInterceptor();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fkFailure = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
      meta: {
        modelName: 'AuditLog',
        target: ['organization_id'],
      },
    });

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockResolvedValueOnce({ id: 'audit-3' });

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        organization_id: null,
      }),
    });

    warnSpy.mockRestore();
  });

  it('does not retry generic audit log write errors', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    prisma.auditLog.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    errorSpy.mockRestore();
  });

  it('does not retry P2003 errors for a different model', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fkFailure = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
      meta: {
        modelName: 'CareLog',
        field_name: 'care_log_organization_id_fkey (index)',
      },
    });

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not retry P2003 errors without organization FK metadata', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fkFailure = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
      meta: {
        modelName: 'AuditLog',
        field_name: 'audit_log_user_id_fkey (index)',
      },
    });

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not retry when organization id is already nullable', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fkFailure = Object.assign(new Error('Foreign key constraint failed'), {
      code: 'P2003',
      meta: {
        modelName: 'AuditLog',
        field_name: 'audit_log_organization_id_fkey (index)',
      },
    });

    prisma.auditLog.create.mockRejectedValueOnce(fkFailure);

    await expect(
      (interceptor as any).logToDatabase({
        ...baseEntry,
        organizationId: null,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('catches and logs retry failures without throwing into the request path', async () => {
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
    const retryFailure = new Error('retry failed');

    prisma.auditLog.create
      .mockRejectedValueOnce(fkFailure)
      .mockRejectedValueOnce(retryFailure);

    await expect((interceptor as any).logToDatabase(baseEntry)).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('does not let audit write failures change the HTTP response observable', async () => {
    const { interceptor, prisma } = createInterceptor();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.auditLog.create.mockRejectedValueOnce(new Error('audit sink unavailable'));

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/test',
          user: {
            id: 'user_test_123',
            organizationId: 'org-internal-1',
          },
          ip: '203.0.113.10',
          headers: {
            'user-agent': 'Jest',
          },
        }),
      }),
    };
    const next = {
      handle: () => of({ ok: true }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next as any)),
    ).resolves.toEqual({ ok: true });

    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({
        name: 'Error',
      }),
    );

    errorSpy.mockRestore();
  });

  it('does not inspect or persist request arguments for manually audited handlers', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const interceptor = new AuditLogInterceptor(prisma as any, reflector as any);
    const next = { handle: jest.fn(() => of({ accepted: true })) };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => {
          throw new Error('manual audit should bypass request body access');
        },
      }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context as any, next as any)),
    ).resolves.toEqual({ accepted: true });
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
