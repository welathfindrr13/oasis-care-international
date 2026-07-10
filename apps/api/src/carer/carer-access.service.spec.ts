import { ForbiddenException } from '@nestjs/common';
import { CarerAccessService, requireOperationalActor, VerifiedCarerPrincipal } from './carer-access.service';

describe('CarerAccessService', () => {
  function createService() {
    const prisma = {
      organizationMembership: {
        findMany: jest.fn(),
      },
    } as any;

    return {
      prisma,
      service: new CarerAccessService(prisma),
    };
  }

  const principal: VerifiedCarerPrincipal = {
    organizationMembershipId: 'membership-1',
    organizationId: 'org-1',
    authSubject: 'provider-subject-1',
  };

  const activeLink = {
    id: 'membership-1',
    organization_id: 'org-1',
    auth_subject: 'provider-subject-1',
    role: 'carer',
    status: 'ACTIVE',
    carer_id: 'domain-carer-1',
    carer: {
      id: 'domain-carer-1',
      organization_id: 'org-1',
      is_active: true,
      deleted_at: null,
    },
  };

  it.each(['carer', 'staff'])('resolves an ACTIVE same-tenant %s membership to its domain Carer', async (role) => {
    const { prisma, service } = createService();
    prisma.organizationMembership.findMany.mockResolvedValue([{ ...activeLink, role }]);

    await expect(service.requireCarerIdentity(principal)).resolves.toEqual({
      carerId: 'domain-carer-1',
      authSubject: 'provider-subject-1',
    });

    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          auth_subject: 'provider-subject-1',
          status: 'ACTIVE',
          revoked_at: null,
        },
        take: 2,
      }),
    );
    expect(JSON.stringify(prisma.organizationMembership.findMany.mock.calls[0][0])).not.toMatch(/email/i);
  });

  it.each([
    ['missing carer link', { carer_id: null, carer: null }],
    ['inactive membership', { status: 'SUSPENDED' }],
    ['revoked membership', { status: 'REVOKED' }],
    ['different auth subject', { auth_subject: 'different-subject' }],
    ['cross-tenant membership', { organization_id: 'org-2' }],
    ['cross-tenant Carer', { carer: { ...activeLink.carer, organization_id: 'org-2' } }],
    ['mismatched Carer identity', { carer: { ...activeLink.carer, id: 'domain-carer-2' } }],
    ['inactive Carer', { carer: { ...activeLink.carer, is_active: false } }],
    ['deleted Carer', { carer: { ...activeLink.carer, deleted_at: new Date() } }],
  ])('denies %s with a sanitized forbidden response', async (_label, overrides) => {
    const { prisma, service } = createService();
    prisma.organizationMembership.findMany.mockResolvedValue([{ ...activeLink, ...overrides }]);

    await expect(service.requireCarerIdentity(principal)).rejects.toEqual(
      new ForbiddenException('Active carer membership link is required'),
    );
  });

  it.each(['family', 'user', 'client', 'admin', 'manager', 'care_manager'])(
    'does not implicitly resolve the raw %s role as a Carer',
    async (role) => {
      const { prisma, service } = createService();
      prisma.organizationMembership.findMany.mockResolvedValue([{ ...activeLink, role }]);

      await expect(service.requireCarerIdentity(principal)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('fails closed before database access when verified principal fields are missing', async () => {
    const { prisma, service } = createService();

    await expect(
      service.requireCarerIdentity({
        organizationMembershipId: ' ',
        organizationId: 'org-1',
        authSubject: 'subject',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.organizationMembership.findMany).not.toHaveBeenCalled();
  });

  it('never uses email to resolve a duplicate identity', async () => {
    const { prisma, service } = createService();
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        ...activeLink,
        normalized_email: 'duplicate@example.test',
      },
    ]);

    await expect(service.requireCarerIdentity(principal)).resolves.toEqual({
      carerId: 'domain-carer-1',
      authSubject: 'provider-subject-1',
    });
    expect(JSON.stringify(prisma.organizationMembership.findMany.mock.calls[0][0])).not.toMatch(/email/i);
  });

  it('denies missing and ambiguous membership results', async () => {
    const { prisma, service } = createService();
    prisma.organizationMembership.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activeLink, { ...activeLink, id: 'membership-2', organization_id: 'org-2' }]);

    await expect(service.requireCarerIdentity(principal)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requireCarerIdentity(principal)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not fall back to matching Carer.id with the auth subject', async () => {
    const { prisma, service } = createService();
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        ...activeLink,
        carer_id: null,
        carer: {
          ...activeLink.carer,
          id: principal.authSubject,
        },
      },
    ]);

    await expect(service.requireCarerIdentity(principal)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['carer', 'staff'])(
    'uses the linked domain Carer id for a raw %s operational actor',
    (organizationMembershipRole) => {
      expect(
        requireOperationalActor({
          id: 'provider-subject-1',
          organizationId: 'org-1',
          organizationMembershipRole,
          carerId: 'domain-carer-1',
        }),
      ).toEqual({
        userId: 'domain-carer-1',
        userRole: 'carer',
        organizationId: 'org-1',
        authSubject: 'provider-subject-1',
      });
    },
  );

  it('preserves the verified raw role and subject for a non-carer operational actor', () => {
    expect(
      requireOperationalActor({
        id: 'manager-subject-1',
        organizationId: 'org-1',
        organizationMembershipRole: 'manager',
        role: 'carer',
      }),
    ).toEqual({
      userId: 'manager-subject-1',
      userRole: 'manager',
      organizationId: 'org-1',
      authSubject: 'manager-subject-1',
    });
  });

  it('fails closed when a carer actor was not enriched with a linked Carer id', () => {
    expect(() =>
      requireOperationalActor({
        id: 'provider-subject-1',
        organizationId: 'org-1',
        organizationMembershipRole: 'carer',
      }),
    ).toThrow(new ForbiddenException('Active carer membership link is required'));
  });
});
