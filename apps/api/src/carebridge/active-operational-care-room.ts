import {
  CareRoomStatus,
  Prisma,
} from '@oasis/db';

export function activeOperationalCareRoomWhere(
  organizationId: string,
): Prisma.CareRoomWhereInput {
  return {
    organization_id: organizationId,
    status: CareRoomStatus.ACTIVE,
    client: {
      organization_id: organizationId,
      deleted_at: null,
    },
  };
}

export async function acquireClientCareRoomLifecycleLock(
  tx: Prisma.TransactionClient,
  organizationId: string,
  clientId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`client-care-room-lifecycle:${organizationId}:${clientId}`}, 0))`;
  // A SERIALIZABLE invitation may have taken its snapshot before waiting on
  // the advisory lock. Locking the tenant-owned client row forces that stale
  // transaction to retry if an archive changed the row while it waited.
  await tx.$queryRaw`SELECT id FROM "client" WHERE id = ${clientId} AND organization_id = ${organizationId} FOR UPDATE`;
}
