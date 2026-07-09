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
    AccessGrantScope.VIEW_VISIT_TIMES,
    AccessGrantScope.VIEW_TASK_SUMMARY,
    AccessGrantScope.VIEW_MEDICATION_SUPPORT_STATUS,
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

  it('requires the exact active tenant membership and one non-revoked scope', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes([AccessGrantScope.VIEW_UPDATES]),
    ]);

    const membership = await service.requireFamilyScopes({
      membershipId: 'membership-1',
      careRoomId: 'room-1',
      organizationId: 'org-1',
      authSubject: 'auth-sub-1',
      email: 'ignored@example.com',
      requiredScopes: [AccessGrantScope.VIEW_UPDATES],
    });

    expect(prisma.careRoomMembership.findMany).toHaveBeenCalledWith({
      where: {
        id: 'membership-1',
        care_room_id: 'room-1',
        status: 'ACTIVE',
        care_room: {
          status: 'ACTIVE',
          organization_id: 'org-1',
        },
        family_contact: {
          organization_id: 'org-1',
          disabled_at: null,
          auth_subject: 'auth-sub-1',
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

  it('requires all requested published-story scopes', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes(storyScopes),
    ]);

    await expect(
      service.requireFamilyScopes({
        careRoomId: 'room-1',
        organizationId: 'org-1',
        email: 'Relative@Example.com',
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

  it('denies when any required scope is missing or revoked', async () => {
    prisma.careRoomMembership.findMany.mockResolvedValue([
      membershipWithScopes([AccessGrantScope.SUBMIT_PULSE]),
    ]);

    await expect(
      service.requireFamilyScopes({
        membershipId: 'membership-1',
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScopes: [
          AccessGrantScope.SUBMIT_PULSE,
          AccessGrantScope.RAISE_CONCERNS,
        ],
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS' },
    });
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
        email: 'shared@example.com',
        requiredScopes: [AccessGrantScope.VIEW_UPDATES],
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
