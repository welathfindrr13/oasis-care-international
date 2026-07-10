import { ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { CarerMembershipService } from './carer-membership.service';

describe('CarerMembershipService', () => {
  const adminPrincipal = {
    organizationId: 'org-1',
    organizationMembershipId: 'admin-membership-1',
    authSubject: 'admin-subject-1',
  };
  const input = {
    membershipId: '11111111-1111-4111-8111-111111111111',
    firstName: 'Amira',
    lastName: 'Khan',
    phone: '07000000000',
  };
  const adminMembership = { id: 'admin-membership-1' };
  const eligibleMembership = {
    id: input.membershipId,
    role: 'carer',
    status: 'ACTIVE',
    identity_provider: 'clerk',
    auth_subject: 'worker-subject-1',
    normalized_email: 'worker@example.test',
    revoked_at: null,
    carer_id: null,
  };

  beforeEach(() => {
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
  });

  function createHarness() {
    const tx = {
      organizationMembership: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      carer: {
        create: jest.fn(async ({ data }: any) => ({
          ...data,
          phone: data.phone ?? null,
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as any;

    return {
      prisma,
      tx,
      service: new CarerMembershipService(prisma),
    };
  }

  it('lists only unlinked ACTIVE same-tenant carer and staff memberships', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst.mockResolvedValue(adminMembership);
    tx.organizationMembership.findMany.mockResolvedValue([
      {
        id: input.membershipId,
        identity_provider: 'clerk',
        auth_subject: 'worker-subject-1',
        role: 'carer',
        normalized_email: 'worker@example.test',
      },
    ]);

    await expect(service.listEligibleMemberships(adminPrincipal)).resolves.toEqual([
      {
        id: input.membershipId,
        identityProvider: 'clerk',
        role: 'carer',
        loginEmail: 'worker@example.test',
      },
    ]);

    expect(tx.organizationMembership.findMany).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        identity_provider: 'clerk',
        auth_subject: { not: '' },
        status: 'ACTIVE',
        revoked_at: null,
        role: { in: ['carer', 'staff'] },
        carer_id: null,
        normalized_email: { not: null },
      },
      select: {
        id: true,
        identity_provider: true,
        auth_subject: true,
        role: true,
        normalized_email: true,
      },
      orderBy: [{ normalized_email: 'asc' }, { created_at: 'asc' }],
    });
  });

  it('requires an ACTIVE raw admin membership before listing candidates', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst.mockResolvedValue(null);

    await expect(service.listEligibleMemberships(adminPrincipal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organizationMembership.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'admin-membership-1',
        organization_id: 'org-1',
        auth_subject: 'admin-subject-1',
        identity_provider: 'clerk',
        status: 'ACTIVE',
        revoked_at: null,
        role: 'admin',
      },
      select: { id: true },
    });
    expect(tx.organizationMembership.findMany).not.toHaveBeenCalled();
  });

  it('denies missing verified organization context before database access', async () => {
    const { service, tx, prisma } = createHarness();

    await expect(
      service.createAndLinkCarer(input, {
        ...adminPrincipal,
        organizationId: ' ',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organizationMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['family', 'user', 'client', 'carer', 'staff', 'manager', 'care_manager'])(
    'does not authorize a raw %s membership as the admin actor',
    async () => {
      const { service, tx } = createHarness();
      tx.organizationMembership.findFirst.mockResolvedValue(null);

      await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.carer.create).not.toHaveBeenCalled();
    },
  );

  it('creates a domain UUID and links the selected membership atomically', async () => {
    const { service, tx, prisma } = createHarness();
    tx.organizationMembership.findFirst
      .mockResolvedValueOnce(adminMembership)
      .mockResolvedValueOnce(eligibleMembership);
    tx.organizationMembership.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.createAndLinkCarer(input, adminPrincipal);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const createArgs = tx.carer.create.mock.calls[0][0];
    expect(createArgs.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(createArgs.data.id).not.toBe(adminPrincipal.authSubject);
    expect(createArgs.data.id).not.toBe(input.membershipId);
    expect(createArgs.data.organization_id).toBe('org-1');
    expect(result).toEqual({
      carer: {
        id: createArgs.data.id,
        firstName: 'Amira',
        lastName: 'Khan',
        email: 'worker@example.test',
        phone: '07000000000',
      },
      membershipId: input.membershipId,
    });

    expect(tx.organizationMembership.updateMany).toHaveBeenCalledWith({
      where: {
        id: input.membershipId,
        organization_id: 'org-1',
        identity_provider: 'clerk',
        auth_subject: 'worker-subject-1',
        status: 'ACTIVE',
        revoked_at: null,
        role: { in: ['carer', 'staff'] },
        carer_id: null,
      },
      data: { carer_id: createArgs.data.id },
    });
  });

  it('records an organization-stamped IDs-only audit event', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst
      .mockResolvedValueOnce(adminMembership)
      .mockResolvedValueOnce(eligibleMembership);
    tx.organizationMembership.updateMany.mockResolvedValue({ count: 1 });

    await service.createAndLinkCarer(input, adminPrincipal);

    const carerId = tx.carer.create.mock.calls[0][0].data.id;
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organization_id: 'org-1',
        user_id: 'admin-subject-1',
        action: 'CARER_MEMBERSHIP_LINKED',
        resource_type: 'Carer',
        resource_id: carerId,
        old_values: {},
        new_values: {
          carerId,
          membershipId: input.membershipId,
        },
      },
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain(eligibleMembership.normalized_email);
  });

  it('denies a cross-tenant membership without creating a Carer', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst.mockResolvedValueOnce(adminMembership).mockResolvedValueOnce(null);

    await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.carer.create).not.toHaveBeenCalled();
    expect(tx.organizationMembership.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['SUSPENDED', 'carer', null],
    ['REVOKED', 'carer', null],
    ['ACTIVE', 'family', null],
    ['ACTIVE', 'user', null],
    ['ACTIVE', 'client', null],
    ['ACTIVE', 'admin', null],
    ['ACTIVE', 'manager', null],
    ['ACTIVE', 'care_manager', null],
    ['ACTIVE', 'carer', 'existing-carer-id'],
  ])('fails closed for an ineligible selected membership', async (status, role, carerId) => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst.mockResolvedValueOnce(adminMembership).mockResolvedValueOnce({
      ...eligibleMembership,
      status,
      role,
      carer_id: carerId,
    });

    await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.carer.create).not.toHaveBeenCalled();
  });

  it('rolls back when the membership becomes linked or inactive before the conditional update', async () => {
    const { service, tx, prisma } = createHarness();
    tx.organizationMembership.findFirst
      .mockResolvedValueOnce(adminMembership)
      .mockResolvedValueOnce(eligibleMembership);
    tx.organizationMembership.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('maps a profile constraint failure to a tenant-safe generic conflict', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst
      .mockResolvedValueOnce(adminMembership)
      .mockResolvedValueOnce(eligibleMembership);
    tx.carer.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toEqual(
      new ConflictException('Selected workforce membership could not be linked'),
    );
    expect(tx.organizationMembership.updateMany).not.toHaveBeenCalled();
  });

  it('maps unexpected infrastructure failures to a sanitized server error', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst.mockRejectedValue(new Error('postgresql://user:secret@private-host/internal'));

    await expect(service.createAndLinkCarer(input, adminPrincipal)).rejects.toEqual(
      new InternalServerErrorException('Unable to create and link the Carer profile'),
    );
  });

  it('never accepts browser-supplied email or auth subject identity', async () => {
    const { service, tx } = createHarness();
    tx.organizationMembership.findFirst
      .mockResolvedValueOnce(adminMembership)
      .mockResolvedValueOnce(eligibleMembership);
    tx.organizationMembership.updateMany.mockResolvedValue({ count: 1 });

    await service.createAndLinkCarer(input, adminPrincipal);

    expect(Object.keys(input)).not.toContain('authSubject');
    expect(Object.keys(input)).not.toContain('email');
  });
});
