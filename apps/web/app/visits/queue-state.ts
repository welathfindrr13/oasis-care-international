import type { Visit, VisitTask } from '../../lib/graphql/queries'

export type VisitQueueState =
  | 'in_progress'
  | 'needs_action_now'
  | 'overdue'
  | 'upcoming'
  | 'needs_review'
  | 'completed'
  | 'cancelled'

type QueueVisit = Pick<
  Visit,
  'status' | 'scheduledStart' | 'scheduledEnd' | 'actualStart' | 'actualEnd'
> & {
  tasks: Array<Pick<VisitTask, 'isCompleted'>>
}

const queueStateOrder: Record<VisitQueueState, number> = {
  in_progress: 0,
  needs_action_now: 1,
  overdue: 2,
  upcoming: 3,
  needs_review: 4,
  completed: 5,
  cancelled: 6,
}

export function hasStrongCompletionEvidence(visit: QueueVisit) {
  return Boolean(
    visit.actualStart ||
      visit.actualEnd ||
      visit.tasks.some((task) => task.isCompleted)
  )
}

export function getVisitQueueState(
  visit: QueueVisit,
  now: Date
): VisitQueueState {
  if (visit.status === 'IN_PROGRESS') return 'in_progress'
  if (visit.status === 'COMPLETED') return 'completed'
  if (visit.status === 'CANCELLED') return 'cancelled'

  if (hasStrongCompletionEvidence(visit)) {
    return 'needs_review'
  }

  const scheduledStart = new Date(visit.scheduledStart).getTime()
  const scheduledEnd = new Date(visit.scheduledEnd).getTime()
  const currentTime = now.getTime()

  if (scheduledEnd < currentTime) return 'overdue'
  if (scheduledStart <= currentTime) return 'needs_action_now'
  return 'upcoming'
}

export function sortVisitsForQueue(visits: Visit[], now: Date) {
  return [...visits].sort((left, right) => {
    const leftQueueState = getVisitQueueState(left, now)
    const rightQueueState = getVisitQueueState(right, now)
    const queueStateDelta =
      queueStateOrder[leftQueueState] - queueStateOrder[rightQueueState]

    if (queueStateDelta !== 0) {
      return queueStateDelta
    }

    if (leftQueueState === 'completed' || leftQueueState === 'cancelled') {
      const leftCompletedAt = new Date(
        left.actualEnd ?? left.scheduledEnd
      ).getTime()
      const rightCompletedAt = new Date(
        right.actualEnd ?? right.scheduledEnd
      ).getTime()
      return rightCompletedAt - leftCompletedAt
    }

    if (leftQueueState === 'overdue') {
      return (
        new Date(left.scheduledEnd).getTime() -
        new Date(right.scheduledEnd).getTime()
      )
    }

    return (
      new Date(left.scheduledStart).getTime() -
      new Date(right.scheduledStart).getTime()
    )
  })
}
