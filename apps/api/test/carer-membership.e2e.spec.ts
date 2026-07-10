import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { StartedTestContainer } from 'testcontainers';
import { CarerAccessService } from '../src/carer/carer-access.service';
import { CarerMembershipService } from '../src/carer/carer-membership.service';
import { startPostgres } from './utils/test-container';
import { AccessContextService } from '../src/auth/access-context.service';

describe('Carer membership database integration', () => {
  let container: StartedTestContainer;
  let prisma: PrismaService;
  let accessService: CarerAccessService;
  let canonicalAccessService: AccessContextService;
  let membershipService: CarerMembershipService;

  const organizationId = 'org-membership-e2e';
  const otherOrganizationId = 'org-membership-other';
  const adminSubject = 'provider-admin-subject';
  const workerSubject = 'provider-worker-subject';

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.AUTH_IDENTITY_PROVIDER = 'cognito';

    prisma = new PrismaService();
    await prisma.$connect();
    accessService = new CarerAccessService();
    canonicalAccessService = new AccessContextService(prisma);
    membershipService = new CarerMembershipService(prisma);
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: 'Membership E2E' },
        { id: otherOrganizationId, name: 'Membership E2E Other' },
      ],
    });
  });

  async function createLinkedPrincipal(
    overrides: {
      membershipStatus?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
      revokedAt?: Date | null;
      membershipOrganizationId?: string;
      carerOrganizationId?: string;
      carerActive?: boolean;
      carerDeletedAt?: Date | null;
      linked?: boolean;
      subject?: string;
    } = {},
  ) {
    const subject = overrides.subject ?? workerSubject;
    const carerOrganizationId = overrides.carerOrganizationId ?? organizationId;
    const membershipOrganizationId = overrides.membershipOrganizationId ?? organizationId;
    const carer = await prisma.carer.create({
      data: {
        organization_id: carerOrganizationId,
        first_name: 'Linked',
        last_name: 'Worker',
        email: `${subject}-${carerOrganizationId}@example.test`,
        is_active: overrides.carerActive ?? true,
        deleted_at: overrides.carerDeletedAt ?? null,
      },
    });
    const membership = await prisma.organizationMembership.create({
      data: {
        organization_id: membershipOrganizationId,
        identity_provider: 'cognito',
        auth_subject: subject,
        normalized_email: `${subject}@example.test`,
        role: 'carer',
        status: overrides.membershipStatus ?? 'ACTIVE',
        revoked_at: overrides.revokedAt ?? null,
        carer_id: overrides.linked === false || carerOrganizationId !== membershipOrganizationId ? null : carer.id,
      },
    });

    return {
      carer,
      membership,
      principal: {
        sub: subject,
        organizationId: membershipOrganizationId,
      },
    };
  }

  it('resolves the authenticated subject through its active link to a different domain Carer UUID', async () => {
    const { carer, principal } = await createLinkedPrincipal();

    expect(carer.id).not.toBe(workerSubject);
    const accessContext = await canonicalAccessService.resolve(principal);
    await expect(accessService.requireCarerIdentity({ accessContext })).resolves.toEqual({
      carerId: carer.id,
      authSubject: workerSubject,
    });
  });

  it.each([
    ['unlinked membership', { linked: false }],
    ['suspended membership', { membershipStatus: 'SUSPENDED' as const }],
    ['revoked membership status', { membershipStatus: 'REVOKED' as const }],
    ['revoked timestamp', { revokedAt: new Date('2026-01-01T00:00:00Z') }],
    ['inactive Carer', { carerActive: false }],
    ['deleted Carer', { carerDeletedAt: new Date('2026-01-01T00:00:00Z') }],
  ])('fails closed for a real %s row', async (_label, overrides) => {
    const { principal } = await createLinkedPrincipal(overrides);

    const accessContext = await canonicalAccessService.resolve(principal);
    await expect(accessService.requireCarerIdentity({ accessContext })).rejects.toEqual(
      new ForbiddenException('Active carer membership link is required'),
    );
  });

  it('fails closed when the verified principal tenant does not match the linked membership', async () => {
    const { principal } = await createLinkedPrincipal();

    await expect(
      canonicalAccessService
        .resolve({ ...principal, organizationId: otherOrganizationId })
        .then((accessContext) => accessService.requireCarerIdentity({ accessContext })),
    ).rejects.toEqual(new ForbiddenException('Active carer membership link is required'));
  });

  it('prevents one subject from receiving active memberships in multiple tenants', async () => {
    await createLinkedPrincipal();
    await expect(
      createLinkedPrincipal({
        membershipOrganizationId: otherOrganizationId,
        carerOrganizationId: otherOrganizationId,
        subject: workerSubject,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('atomically links exactly one Carer under concurrent duplicate submissions', async () => {
    const [adminMembership, workerMembership] = await Promise.all([
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: 'cognito',
          auth_subject: adminSubject,
          normalized_email: 'admin@example.test',
          role: 'admin',
          status: 'ACTIVE',
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: 'cognito',
          auth_subject: workerSubject,
          normalized_email: 'worker@example.test',
          role: 'carer',
          status: 'ACTIVE',
        },
      }),
    ]);
    const principal = {
      organizationId,
      organizationMembershipId: adminMembership.id,
      authSubject: adminSubject,
    };
    const input = {
      membershipId: workerMembership.id,
      firstName: 'Amira',
      lastName: 'Khan',
      phone: '07000000000',
    };

    const outcomes = await Promise.allSettled([
      membershipService.createAndLinkCarer(input, principal),
      membershipService.createAndLinkCarer(input, principal),
    ]);
    const fulfilled = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<any> => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(String(rejected[0].reason.message)).not.toContain('worker@example.test');

    const [carers, linkedMembership, audits] = await Promise.all([
      prisma.carer.findMany({ where: { organization_id: organizationId } }),
      prisma.organizationMembership.findUniqueOrThrow({
        where: { id: workerMembership.id },
      }),
      prisma.auditLog.findMany({
        where: {
          organization_id: organizationId,
          action: 'CARER_MEMBERSHIP_LINKED',
        },
      }),
    ]);

    expect(carers).toHaveLength(1);
    expect(linkedMembership.carer_id).toBe(carers[0].id);
    expect(audits).toHaveLength(1);
    expect(audits[0].resource_id).toBe(carers[0].id);
    expect(audits[0].new_values).toEqual({
      carerId: carers[0].id,
      membershipId: workerMembership.id,
    });

    await expect(membershipService.createAndLinkCarer(input, principal)).rejects.toEqual(
      new ConflictException('Selected workforce membership is no longer eligible'),
    );
    await expect(prisma.carer.count({ where: { organization_id: organizationId } })).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          organization_id: organizationId,
          action: 'CARER_MEMBERSHIP_LINKED',
        },
      }),
    ).resolves.toBe(1);
  });
});
