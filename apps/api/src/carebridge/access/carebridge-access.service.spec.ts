import { Test, TestingModule } from '@nestjs/testing';
import { AccessGrantScope, PrismaService } from '@oasis/db';
import { CarebridgeAccessService } from './carebridge-access.service';

describe('CarebridgeAccessService', () => {
  let service: CarebridgeAccessService;
  let prisma: {
    careRoomMembership: {
      findMany: jest.Mock;
    };
  };

  const membershipWithScopes = (scopes: AccessGrantScope[]) => ({
    id: 'membership-1',
    care_room_id: 'room-1',
    family_contact_id: 'family-1',
    status: 'ACTIVE',
    family_contact: {
      id: 'family-1',
      organization_id: 'org-1',
      auth_subject: 'auth-sub-1',
      disabled_at: null,
    },
    care_room: {
      id: 'room-1',
      organization_id: 'org-1',
      status: 'ACTIVE',
    },
    access_grants: scopes.map((scope) => ({ scope, revoked_at: null })),
  });

  const storyScopes = [
    AccessGrantScope.VIEW_UPDATES,
    AccessGrantScope.VIEW_TASK_SUMMARY,
  ];

  beforeEach(async () => {
    prisma = {
      careRoomMembership: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarebridgeAccessService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(CarebridgeAccessService);
  });

  it('requires the exact active tenant membership and one non-revoked concern scope', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes([AccessGrantScope.RAISE_CONCERNS]),
    ]);

    const membership = await service.requireFamilyScopes({
      membershipId: 'membership-1',
      careRoomId: 'room-1',
      organizationId: 'org-1',
      authSubject: 'auth-sub-1',
      requiredScopes: [AccessGrantScope.RAISE_CONCERNS],
    });

    expect(prisma.careRoomMembership.findMany).toHaveBeenCalledWith({
      where: {
        id: 'membership-1',
        care_room_id: 'room-1',
        status: 'ACTIVE',
        revoked_at: null,
        care_room: {
          status: 'ACTIVE',
          organization_id: 'org-1',
          client: {
            organization_id: 'org-1',
            deleted_at: null,
          },
        },
        family_contact: {
          organization_id: 'org-1',
          disabled_at: null,
          auth_subject: 'auth-sub-1',
        },
        organization_membership_invitation: {
          status: 'ACCEPTED',
          organization_id: 'org-1',
          intended_role: 'family',
          bound_auth_subject: 'auth-sub-1',
          activated_membership: {
            organization_id: 'org-1',
            auth_subject: 'auth-sub-1',
            role: 'family',
            status: 'ACTIVE',
            revoked_at: null,
          },
        },
      },
      include: {
        care_room: true,
        family_contact: true,
        access_grants: {
          where: { revoked_at: null },
        },
      },
      take: 2,
    });
    expect(membership.id).toBe('membership-1');
  });

  it.each([
    [AccessGrantScope.VIEW_UPDATES],
    [AccessGrantScope.VIEW_TASK_SUMMARY],
  ])('denies partial approved-update bundle %s before database access', async (scope) => {
    await expect(service.requireFamilyScopes({
      membershipId: 'membership-1',
      careRoomId: 'room-1',
      organizationId: 'org-1',
      authSubject: 'auth-sub-1',
      requiredScopes: [scope],
    })).rejects.toMatchObject({ status: 403 });

    expect(prisma.careRoomMembership.findMany).not.toHaveBeenCalled();
  });

  it('requires all requested published-story scopes', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes(storyScopes),
    ]);

    await expect(
      service.requireFamilyScopes({
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScopes: storyScopes,
      }),
    ).resolves.toMatchObject({ id: 'membership-1' });
  });

  it.each(storyScopes)(
    'denies published stories when %s is missing',
    async (missingScope) => {
      prisma.careRoomMembership.findMany.mockResolvedValue([
        membershipWithScopes(storyScopes.filter((scope) => scope !== missingScope)),
      ]);

      await expect(
        service.requireFamilyScopes({
          membershipId: 'membership-1',
          careRoomId: 'room-1',
          organizationId: 'org-1',
          authSubject: 'auth-sub-1',
          requiredScopes: storyScopes,
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('denies when any launch scope is missing or revoked', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes([AccessGrantScope.VIEW_UPDATES]),
    ]);

    await expect(
      service.requireFamilyScopes({
        membershipId: 'membership-1',
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScopes: [
          AccessGrantScope.VIEW_UPDATES,
          AccessGrantScope.VIEW_TASK_SUMMARY,
        ],
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS' },
    });
  });

  it.each([
    AccessGrantScope.VIEW_VISIT_TIMES,
    AccessGrantScope.VIEW_MEDICATION_SUPPORT_STATUS,
    AccessGrantScope.VIEW_WEEKLY_SUMMARIES,
    AccessGrantScope.REPLY_TO_CONCERNS,
    AccessGrantScope.SUBMIT_PULSE,
  ])('denies unused launch scope %s before database access', async (scope) => {
    await expect(
      service.requireFamilyScopes({
        membershipId: 'membership-1',
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScopes: [scope],
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(prisma.careRoomMembership.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when identity lookup is ambiguous', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes([AccessGrantScope.VIEW_UPDATES]),
      { ...membershipWithScopes([AccessGrantScope.VIEW_UPDATES]), id: 'membership-2' },
    ]);

    await expect(
      service.requireFamilyScopes({
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScopes: storyScopes,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['missing organization', { organizationId: '', authSubject: 'auth-sub-1', requiredScopes: [AccessGrantScope.VIEW_UPDATES] }],
    ['missing identity', { organizationId: 'org-1', requiredScopes: [AccessGrantScope.VIEW_UPDATES] }],
    ['missing scopes', { organizationId: 'org-1', authSubject: 'auth-sub-1', requiredScopes: [] }],
  ])('denies %s before database access', async (_label, invalid) => {
    await expect(
      service.requireFamilyScopes({
        membershipId: 'membership-1',
        careRoomId: 'room-1',
        ...invalid,
      } as any),
    ).rejects.toMatchObject({ status: 403 });

    expect(prisma.careRoomMembership.findMany).not.toHaveBeenCalled();
  });
});
