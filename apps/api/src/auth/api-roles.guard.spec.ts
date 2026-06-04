import { Reflector } from '@nestjs/core';
import { ApiRolesGuard } from './api-roles.guard';

describe('ApiRolesGuard organization resolution', () => {
  function createGuard() {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;
    const prisma = {
      organizationMembership: {
        findMany: jest.fn(),
      },
      organizationIdentity: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      organization: {
        findFirst: jest.fn(),
      },
      carer: {
        findMany: jest.fn(),
      },
      whereNotDeleted: jest.fn((where) => where),
    } as any;

    const guard = new ApiRolesGuard(reflector as Reflector, prisma);
    return { guard, prisma, reflector };
  }

  it('resolves organization by an active explicit membership and applies tenant-scoped role', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'boss-123',
      email: 'boss@yourdomain.com',
      organizationId: null,
      role: 'user',
      realm_access: { roles: ['user'] },
    };

    prisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: 'membership-1',
        organization_id: 'org-123',
        role: 'admin',
        status: 'ACTIVE',
      },
    ]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBe('org-123');
    expect(user.role).toBe('admin');
    expect(user.realm_access.roles[0]).toBe('admin');
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auth_subject: 'boss-123',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(prisma.organizationIdentity.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing explicit membership when tenant membership is required', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'carer-123',
      email: 'carer@yourdomain.com',
      organizationId: null,
    };

    const previous = process.env.TENANT_MEMBERSHIP_REQUIRED;
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Active organization membership is required',
    );

    expect(prisma.organizationIdentity.findMany).not.toHaveBeenCalled();
    expect(prisma.carer.findMany).not.toHaveBeenCalled();
    process.env.TENANT_MEMBERSHIP_REQUIRED = previous;
  });

  it('does not use email-domain inference when tenant membership is required', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'unknown-123',
      email: 'unknown@yourdomain.com',
      organizationId: null,
    };

    const previous = process.env.TENANT_MEMBERSHIP_REQUIRED;
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Active organization membership is required',
    );

    expect(user.organizationId).toBeNull();
    expect(prisma.organizationIdentity.findMany).not.toHaveBeenCalled();
    process.env.TENANT_MEMBERSHIP_REQUIRED = previous;
  });

  it('keeps legacy carer lookup available outside the SaaS membership gate', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'carer-123',
      email: 'carer@yourdomain.com',
      organizationId: null,
    };

    prisma.organizationMembership.findMany.mockResolvedValue([]);
    prisma.organizationIdentity.findMany.mockResolvedValue([]);
    prisma.carer.findMany
      .mockResolvedValueOnce([{ organization_id: 'org-789' }])
      .mockResolvedValueOnce([]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBe('org-789');
  });

  it('blocks external users when legacy operational metadata is enabled', () => {
    const { guard, reflector } = createGuard();
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(() =>
      (guard as any).enforceLegacyOperationalAccess(
        {
          getHandler: jest.fn(),
          getClass: jest.fn(),
        },
        {
          role: 'user',
          realm_access: { roles: ['client'] },
        },
      ),
    ).toThrow('Legacy operational GraphQL access is restricted to staff');
  });

  it('allows staff users when legacy operational metadata is enabled', () => {
    const { guard, reflector } = createGuard();
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(() =>
      (guard as any).enforceLegacyOperationalAccess(
        {
          getHandler: jest.fn(),
          getClass: jest.fn(),
        },
        {
          role: 'carer',
          realm_access: { roles: ['carer'] },
        },
      ),
    ).not.toThrow();
  });
});
