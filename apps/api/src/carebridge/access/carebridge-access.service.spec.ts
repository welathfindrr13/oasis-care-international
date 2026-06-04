import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@oasis/db';
import { CarebridgeAccessService } from './carebridge-access.service';

describe('CarebridgeAccessService', () => {
  let service: CarebridgeAccessService;
  let prisma: {
    careRoomMembership: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      careRoomMembership: {
        findFirst: jest.fn(),
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

  it('returns the active membership when the family contact has the required scope', async () => {
    prisma.careRoomMembership.findFirst.mockResolvedValue({
      id: 'membership-1',
      care_room_id: 'room-1',
      family_contact_id: 'family-1',
      status: 'ACTIVE',
      family_contact: {
        id: 'family-1',
        auth_subject: 'auth-sub-1',
      },
      care_room: {
        id: 'room-1',
        organization_id: 'org-1',
      },
      access_grants: [
        {
          scope: 'VIEW_UPDATES',
          revoked_at: null,
        },
      ],
    });

    const membership = await service.requireFamilyScope({
      careRoomId: 'room-1',
      organizationId: 'org-1',
      authSubject: 'auth-sub-1',
      requiredScope: 'VIEW_UPDATES' as any,
    });

    expect(prisma.careRoomMembership.findFirst).toHaveBeenCalled();
    expect(membership.id).toBe('membership-1');
  });

  it('enforces active room membership and non-revoked grants for family access', async () => {
    prisma.careRoomMembership.findFirst.mockResolvedValue({
      id: 'membership-1',
      care_room_id: 'room-1',
      family_contact_id: 'family-1',
      status: 'ACTIVE',
      family_contact: {
        id: 'family-1',
        email: 'relative@example.com',
      },
      care_room: {
        id: 'room-1',
        organization_id: 'org-1',
        status: 'ACTIVE',
      },
      access_grants: [
        {
          scope: 'VIEW_UPDATES',
          revoked_at: null,
        },
      ],
    });

    await service.requireFamilyScope({
      careRoomId: 'room-1',
      organizationId: 'org-1',
      email: 'Relative@Example.com',
      requiredScope: 'VIEW_UPDATES' as any,
    });

    expect(prisma.careRoomMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          care_room_id: 'room-1',
          status: 'ACTIVE',
          care_room: expect.objectContaining({
            status: 'ACTIVE',
            organization_id: 'org-1',
          }),
          family_contact: expect.objectContaining({
            disabled_at: null,
            OR: [{ email: 'relative@example.com' }],
          }),
          access_grants: {
            some: {
              scope: 'VIEW_UPDATES',
              revoked_at: null,
            },
          },
        }),
        include: expect.objectContaining({
          access_grants: {
            where: {
              revoked_at: null,
            },
          },
        }),
      }),
    );
  });

  it('throws when the family contact is missing the required scope', async () => {
    prisma.careRoomMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.requireFamilyScope({
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScope: 'VIEW_UPDATES' as any,
      }),
    ).rejects.toMatchObject({
      response: { code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS' },
    });
  });

  it('throws when access was revoked or membership is no longer active', async () => {
    prisma.careRoomMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.requireFamilyScope({
        careRoomId: 'room-1',
        organizationId: 'org-1',
        authSubject: 'auth-sub-1',
        requiredScope: 'VIEW_UPDATES' as any,
      }),
    ).rejects.toMatchObject({
      response: { code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS' },
    });
  });
});
