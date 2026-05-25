import { Reflector } from '@nestjs/core';
import { ApiRolesGuard } from './api-roles.guard';

describe('ApiRolesGuard organization resolution', () => {
  function createGuard() {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;
    const prisma = {
      organizationIdentity: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      carer: {
        findMany: jest.fn(),
      },
      whereNotDeleted: jest.fn((where) => where),
    } as any;

    const guard = new ApiRolesGuard(reflector as Reflector, prisma);
    return { guard, prisma, reflector };
  }

  it('resolves organization by unique email domain and persists the identity map', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'boss-123',
      email: 'boss@yourdomain.com',
      organizationId: null,
    };

    prisma.organizationIdentity.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ organization_id: 'org-123' }]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBe('org-123');
    expect(prisma.organizationIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organization_id: 'org-123',
          normalized_email: 'boss@yourdomain.com',
        }),
      }),
    );
  });

  it('falls back to direct carer lookup when no identity mapping exists', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'carer-123',
      email: 'carer@yourdomain.com',
      organizationId: null,
    };

    prisma.organizationIdentity.findMany.mockResolvedValue([]);
    prisma.carer.findMany
      .mockResolvedValueOnce([{ organization_id: 'org-789' }])
      .mockResolvedValueOnce([]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBe('org-789');
    expect(prisma.carer.findMany).toHaveBeenCalled();
  });

  it('leaves organization unset when no unique resolution path exists', async () => {
    const { guard, prisma } = createGuard();
    const user = {
      id: 'unknown-123',
      email: 'unknown@mixed-domain.com',
      organizationId: null,
    };

    prisma.organizationIdentity.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { organization_id: 'org-1' },
        { organization_id: 'org-2' },
      ]);
    prisma.carer.findMany.mockResolvedValue([]);

    await (guard as any).enrichOrganizationContext(user);

    expect(user.organizationId).toBeNull();
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
