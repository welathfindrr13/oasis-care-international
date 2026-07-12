import type { Visit } from '../../lib/graphql/queries'

export function getRemainingVisitPageOffsets(total: number, pageSize: number): number[] {
  if (total <= pageSize) return []
  return Array.from(
    { length: Math.ceil(total / pageSize) - 1 },
    (_, index) => (index + 1) * pageSize,
  )
}

export function getAssignmentNotReadyVisits(
  visits: Visit[],
  readyCarerIds: readonly string[],
): Visit[] {
  const ready = new Set(readyCarerIds)
  return visits.filter(
    (visit) =>
      visit.status !== 'COMPLETED' &&
      visit.status !== 'CANCELLED' &&
      !ready.has(visit.carerId),
  )
}
