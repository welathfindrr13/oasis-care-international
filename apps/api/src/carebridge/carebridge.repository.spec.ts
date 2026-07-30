import {
  CarebridgeContentStatus,
  CareRoomMembershipStatus,
  CareRoomStatus,
  ConcernEventType,
} from '@oasis/db';
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
          client: {
            organization_id: 'org-1',
            deleted_at: null,
          },
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
          client: {
            organization_id: 'org-1',
            deleted_at: null,
          },
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

    await repository.listFamilySafePublishedStoriesByRoomId(
      'room-1',
      'org-1',
    );

    expect(prisma.verifiedVisitStory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          care_room_id: 'room-1',
          care_room: {
            organization_id: 'org-1',
            status: CareRoomStatus.ACTIVE,
            client: {
              organization_id: 'org-1',
              deleted_at: null,
            },
          },
          status: 'PUBLISHED',
          family_safe_version: 1,
          visit: { status: 'COMPLETED', deleted_at: null },
        }),
        orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('serializes generation and treats only draft or published visit stories as active', async () => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      verifiedVisitStory: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new CarebridgeRepository({} as any);

    await repository.acquireVerifiedVisitStoryGenerationLock(
      'org-1',
      'visit-1',
      transaction as any,
    );
    await repository.findActiveVerifiedVisitStoryForVisit(
      'org-1',
      'visit-1',
      transaction as any,
    );

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw.mock.calls[0][0].join('')).toContain(
      'pg_advisory_xact_lock(hashtextextended(',
    );
    expect(transaction.$executeRaw.mock.calls[0][1]).toBe(
      'verified-visit-story:org-1:visit-1',
    );
    expect(transaction.verifiedVisitStory.findFirst).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        visit_id: 'visit-1',
        status: {
          in: [
            CarebridgeContentStatus.DRAFT,
            CarebridgeContentStatus.PUBLISHED,
          ],
        },
      },
      select: { id: true, status: true },
    });
  });

  it('selects only exact-tenant, room, and raising-membership concern status fields', async () => {
    const prisma = {
      concern: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.listFamilyConcernsForMembership({
      organizationId: 'org-1',
      careRoomId: 'room-1',
      membershipId: 'membership-1',
    });

    expect(prisma.concern.findMany).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        care_room_id: 'room-1',
        raised_by_membership_id: 'membership-1',
        care_room: {
          organization_id: 'org-1',
          status: CareRoomStatus.ACTIVE,
          client: {
            organization_id: 'org-1',
            deleted_at: null,
          },
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        created_at: true,
        events: {
          where: {
            event_type: {
              in: [
                ConcernEventType.RAISED,
                ConcernEventType.ACKNOWLEDGED,
                ConcernEventType.RESPONDED,
                ConcernEventType.RESOLVED,
                ConcernEventType.REOPENED,
                ConcernEventType.ESCALATED,
              ],
            },
          },
          select: {
            event_type: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    const selection = prisma.concern.findMany.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty('description');
    expect(selection).not.toHaveProperty('messages');
    expect(selection).not.toHaveProperty('priority');
    expect(selection).not.toHaveProperty('client_id');
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
        'org-1',
        'Care visit update',
        'Safe family body',
        'admin-1',
      ),
    ).resolves.toBeNull();
    expect(prisma.verifiedVisitStory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'story-1',
          organization_id: 'org-1',
          status: 'DRAFT',
          care_room: {
            organization_id: 'org-1',
            status: CareRoomStatus.ACTIVE,
            client: {
              organization_id: 'org-1',
              deleted_at: null,
            },
          },
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
