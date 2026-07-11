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
    });

    expect(prisma.careRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organization_id: 'org-1',
          status: CareRoomStatus.ACTIVE,
          memberships: {
            some: {
              status: CareRoomMembershipStatus.ACTIVE,
              revoked_at: null,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                auth_subject: 'clerk-family-subject',
              },
              organization_membership_invitation: expect.objectContaining({
                organization_id: 'org-1',
                intended_role: 'family',
                status: 'ACCEPTED',
                bound_auth_subject: 'clerk-family-subject',
              }),
            },
          },
        },
        include: expect.objectContaining({
          memberships: expect.objectContaining({
            where: {
              status: CareRoomMembershipStatus.ACTIVE,
              revoked_at: null,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                auth_subject: 'clerk-family-subject',
              },
              organization_membership_invitation: expect.objectContaining({
                organization_id: 'org-1',
                intended_role: 'family',
                status: 'ACCEPTED',
                bound_auth_subject: 'clerk-family-subject',
              }),
            },
          }),
        }),
      }),
    );
  });

  it('tenant-binds a direct room lookup to the verified subject', async () => {
    const prisma = {
      careRoom: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.findRoomByIdForFamilyAccess('room-1', {
      organizationId: 'org-1',
      authSubject: 'clerk-family-subject',
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
              revoked_at: null,
              family_contact: {
                organization_id: 'org-1',
                disabled_at: null,
                auth_subject: 'clerk-family-subject',
              },
              organization_membership_invitation: expect.objectContaining({
                organization_id: 'org-1',
                intended_role: 'family',
                status: 'ACCEPTED',
                bound_auth_subject: 'clerk-family-subject',
              }),
            },
          },
        },
      }),
    );
  });

  it('shows family-safe stories only while the source visit remains completed and active', async () => {
    const prisma = {
      verifiedVisitStory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.listFamilySafePublishedStoriesByRoomId('room-1');

    expect(prisma.verifiedVisitStory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          care_room_id: 'room-1',
          status: 'PUBLISHED',
          family_safe_version: 1,
          visit: { status: 'COMPLETED', deleted_at: null },
        }),
      }),
    );
  });

  it('publishes only one exact draft transition', async () => {
    const prisma = {
      verifiedVisitStory: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await expect(
      repository.publishVerifiedVisitStory(
        'story-1',
        'Care visit update',
        'Safe family body',
        'admin-1',
      ),
    ).resolves.toBeNull();
    expect(prisma.verifiedVisitStory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'story-1',
          status: 'DRAFT',
          family_safe_version: 1,
          family_safe_title: 'Care visit update',
          family_safe_body: 'Safe family body',
          visit: { status: 'COMPLETED', deleted_at: null },
        }),
      }),
    );
    expect(prisma.verifiedVisitStory.findUnique).not.toHaveBeenCalled();
  });
});
