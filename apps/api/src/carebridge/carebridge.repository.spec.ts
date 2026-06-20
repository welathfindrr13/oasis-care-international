import { CareRoomMembershipStatus } from '@oasis/db';
import { CarebridgeRepository } from './carebridge.repository';

describe('CarebridgeRepository', () => {
  it('matches family access by auth subject or email when both are present', async () => {
    const prisma = {
      careRoom: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new CarebridgeRepository(prisma as any);

    await repository.listRoomsForFamilyAccess({
      authSubject: 'clerk-family-subject',
      email: 'Relative@Example.com',
    });

    expect(prisma.careRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberships: {
            some: {
              status: CareRoomMembershipStatus.ACTIVE,
              family_contact: {
                OR: [
                  { auth_subject: 'clerk-family-subject' },
                  { email: 'relative@example.com' },
                ],
              },
            },
          },
        },
      }),
    );
  });
});
