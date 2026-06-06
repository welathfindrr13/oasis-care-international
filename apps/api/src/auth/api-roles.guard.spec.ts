import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '@oasis/auth';
import { ApiRolesGuard } from './api-roles.guard';

describe('ApiRolesGuard organization resolution', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createGuard() {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
      get: jest.fn(),
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

  function createContext(user: Record<string, unknown>) {
    const request = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
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

    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Active organization membership is required',
    );

    expect(prisma.organizationIdentity.findMany).not.toHaveBeenCalled();
    expect(prisma.carer.findMany).not.toHaveBeenCalled();
  });

  it('does not use email-domain inference when tenant membership is required', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'unknown-123',
      email: 'unknown@yourdomain.com',
      organizationId: null,
    };

    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Active organization membership is required',
    );

    expect(user.organizationId).toBeNull();
    expect(prisma.organizationIdentity.findMany).not.toHaveBeenCalled();
  });

  it('requires explicit membership for Clerk even in development', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'user_clerk_123',
      email: 'member@example.org',
      organizationId: 'org_clerk_external',
      role: 'admin',
    };

    process.env.NODE_ENV = 'development';
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    delete process.env.TENANT_MEMBERSHIP_REQUIRED;
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Active organization membership is required',
    );
  });

  it('resolves Clerk membership through external organization id from token org claim', async () => {
    const { guard, prisma } = createGuard();
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';

    const user: any = {
      id: 'user_clerk_123',
      email: 'manager@example.org',
      organizationId: 'org_clerk_external',
      role: 'user',
      realm_access: { roles: ['user'] },
    };

    prisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: 'membership-clerk-1',
        organization_id: 'org_internal_123',
        role: 'admin',
        status: 'ACTIVE',
      },
    ]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBe('org_internal_123');
    expect(user.organizationMembershipId).toBe('membership-clerk-1');
    expect(user.role).toBe('admin');
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          identity_provider: 'clerk',
          auth_subject: 'user_clerk_123',
          status: 'ACTIVE',
          OR: [
            { organization_id: 'org_clerk_external' },
            { external_organization_id: 'org_clerk_external' },
          ],
        }),
      }),
    );
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

  it.each([
    ['org:member', 'carer', 'carer'],
    ['org:member', 'admin', 'admin'],
  ])(
    'does not authorize raw Clerk %s as %s unless verified membership role is %s',
    async (_tokenRole, requiredRole, membershipRole) => {
      const { guard, prisma, reflector } = createGuard();
      const user: any = {
        id: 'user_clerk_123',
        organizationId: 'org_clerk_external',
        role: 'user',
        realm_access: { roles: ['user', 'org:member'] },
        authMode: 'clerk',
      };
      const context = createContext(user);

      process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
      process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
      reflector.get.mockReturnValue([requiredRole]);
      prisma.organizationMembership.findMany.mockResolvedValueOnce([
        {
          id: 'membership-clerk-1',
          organization_id: 'org-internal',
          role: membershipRole,
          status: 'ACTIVE',
        },
      ]);
      jest.spyOn(RolesGuard.prototype, 'canActivate').mockResolvedValueOnce(true);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(user.role).toBe(requiredRole);
    },
  );

  it('rejects a raw Clerk member when verified membership is not staff-authoritative', async () => {
    const { guard, prisma, reflector } = createGuard();
    const user: any = {
      id: 'user_clerk_123',
      organizationId: 'org_clerk_external',
      role: 'user',
      realm_access: { roles: ['user', 'org:member'] },
      authMode: 'clerk',
    };
    const context = createContext(user);

    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    reflector.get.mockReturnValue(['carer']);
    prisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: 'membership-clerk-1',
        organization_id: 'org-internal',
        role: 'user',
        status: 'ACTIVE',
      },
    ]);
    jest.spyOn(RolesGuard.prototype, 'canActivate').mockResolvedValueOnce(true);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a raw Clerk admin when verified membership is not admin-authoritative', async () => {
    const { guard, prisma, reflector } = createGuard();
    const user: any = {
      id: 'user_clerk_123',
      organizationId: 'org_clerk_external',
      role: 'admin',
      realm_access: { roles: ['admin', 'org:admin'] },
      authMode: 'clerk',
    };
    const context = createContext(user);

    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    reflector.get.mockReturnValue(['admin']);
    prisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: 'membership-clerk-1',
        organization_id: 'org-internal',
        role: 'user',
        status: 'ACTIVE',
      },
    ]);
    jest.spyOn(RolesGuard.prototype, 'canActivate').mockResolvedValueOnce(true);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(user.realm_access.roles).toEqual(['user']);
  });

  it('fails closed when an active membership has an unsupported role', async () => {
    const { guard, prisma } = createGuard();
    const user: any = {
      id: 'user_clerk_123',
      organizationId: 'org_clerk_external',
      role: 'user',
      authMode: 'clerk',
    };

    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.TENANT_MEMBERSHIP_REQUIRED = 'true';
    prisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: 'membership-clerk-1',
        organization_id: 'org-internal',
        role: 'billing',
        status: 'ACTIVE',
      },
    ]);

    await expect((guard as any).enrichOrganizationContext(user)).rejects.toThrow(
      'Unsupported organization membership role',
    );
  });
});
