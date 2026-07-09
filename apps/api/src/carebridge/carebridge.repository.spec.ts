import { CareRoomMembershipStatus, CareRoomStatus } from '@oasis/db';
import { CarebridgeRepository } from './carebridge.repository';

describe('CarebridgeRepository', () => {
  it('tenant-binds family room listing and requires active room, membership, and contact', async () => {
    const prisma = {
      careRoom: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.listRoomsForFamilyAccess({
      organizationId: 'org-1',
      authSubject: 'clerk-family-subject',
      email: 'Relative@Example.com',
    });

    expect(prisma.careRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organization_id: 'org-1',
          status: CareRoomStatus.ACTIVE,
          memberships: {
            some: {
              status: CareRoomMembershipStatus.ACTIVE,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                auth_subject: 'clerk-family-subject',
              },
            },
          },
        },
        include: expect.objectContaining({
          memberships: expect.objectContaining({
            where: {
              status: CareRoomMembershipStatus.ACTIVE,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                auth_subject: 'clerk-family-subject',
              },
            },
          }),
        }),
      }),
    );
  });

  it('forbids cross-tenant email fallback when looking up a room', async () => {
    const prisma = {
      careRoom: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.findRoomByIdForFamilyAccess('room-1', {
      organizationId: 'org-1',
      email: 'duplicate@example.com',
    });

    expect(prisma.careRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'room-1',
          organization_id: 'org-1',
          status: CareRoomStatus.ACTIVE,
          memberships: {
            some: {
              status: CareRoomMembershipStatus.ACTIVE,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                email: 'duplicate@example.com',
              },
            },
          },
        },
      }),
    );
  });
});
