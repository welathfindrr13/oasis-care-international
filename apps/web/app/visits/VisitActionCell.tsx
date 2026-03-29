'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { buttonVariants } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  UPDATE_VISIT_MUTATION,
  type UpdateVisitMutationResponse,
  type Visit,
  type VisitTask,
} from '../../lib/graphql/queries'
import type { VisitQueueState } from './queue-state'

interface VisitActionCellProps {
  isAdmin: boolean
  queueState: VisitQueueState
  visit: Pick<Visit, 'id' | 'status' | 'actualStart' | 'actualEnd'> & {
    tasks: Array<Pick<VisitTask, 'id' | 'isCompleted'>>
  }
}

function getTaskSummary(tasks: VisitActionCellProps['visit']['tasks']) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.isCompleted).length

  return {
    total,
    completed,
    remaining: Math.max(total - completed, 0),
  }
}

export function VisitActionCell({
  isAdmin,
  queueState,
  visit,
}: VisitActionCellProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const taskSummary = getTaskSummary(visit.tasks)

  if (isAdmin) {
    const adminSummary =
      queueState === 'needs_review'
        ? 'Recorded evidence exists on this scheduled visit'
        : taskSummary.total > 0
          ? `${taskSummary.completed} of ${taskSummary.total} tasks recorded`
          : 'Review visit detail for notes, tasks, and medication context'

    return (
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm text-text-secondary">{adminSummary}</span>
        <Link
          href={`/visits/${visit.id}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Review visit
        </Link>
      </div>
    )
  }

  const runUpdate = (nextStatus: 'IN_PROGRESS' | 'COMPLETED') => {
    const input: Record<string, string> = { id: visit.id, status: nextStatus }
    const now = new Date().toISOString()

    if (nextStatus === 'IN_PROGRESS') {
      input.actualStart = visit.actualStart ?? now
    }

    if (nextStatus === 'COMPLETED') {
      input.actualStart = visit.actualStart ?? now
      input.actualEnd = now
    }

    setError(null)
    startTransition(async () => {
      try {
        await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, { input })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update visit')
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-sm text-text-secondary">
        {queueState === 'upcoming' &&
          (taskSummary.total > 0
            ? `${taskSummary.total} tasks queued for this visit`
            : 'Ready to start and record care detail')}
        {queueState === 'needs_action_now' &&
          (taskSummary.total > 0
            ? `${taskSummary.remaining} tasks still need attention`
            : 'Scheduled window is live and ready to start')}
        {queueState === 'overdue' &&
          (taskSummary.total > 0
            ? `${taskSummary.remaining} tasks still need attention`
            : 'Scheduled window has passed without recorded care evidence')}
        {queueState === 'needs_review' &&
          'Recorded evidence exists; review before taking further action'}
        {queueState === 'in_progress' &&
          (taskSummary.total > 0
            ? `${taskSummary.completed} of ${taskSummary.total} tasks complete`
            : 'Visit in progress')}
        {queueState === 'completed' &&
          (taskSummary.remaining > 0
            ? `${taskSummary.remaining} tasks still open for follow-up`
            : 'Visit already completed')}
        {queueState === 'cancelled' && 'Visit cancelled'}
      </span>
      {(queueState === 'upcoming' || queueState === 'needs_action_now') && (
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
          onClick={() => runUpdate('IN_PROGRESS')}
          disabled={isPending}
        >
          {isPending ? 'Starting…' : 'Start Visit'}
        </button>
      )}
      {queueState === 'overdue' && (
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
          onClick={() => runUpdate('IN_PROGRESS')}
          disabled={isPending}
        >
          {isPending ? 'Starting…' : 'Start overdue visit'}
        </button>
      )}
      {queueState === 'in_progress' && (
        <button
          type="button"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          onClick={() => runUpdate('COMPLETED')}
          disabled={isPending}
        >
          {isPending ? 'Completing…' : 'Complete Visit'}
        </button>
      )}
      {queueState === 'needs_review' && (
        <span className="text-sm text-text-secondary">Review in workspace</span>
      )}
      {queueState !== 'upcoming' &&
        queueState !== 'needs_action_now' &&
        queueState !== 'overdue' &&
        queueState !== 'in_progress' &&
        queueState !== 'needs_review' && (
        <span className="text-sm text-text-secondary">No action needed</span>
      )}
      <Link
        href={`/visits/${visit.id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        Open workspace
      </Link>
      {error && (
        <p className={cn('text-xs text-red-600')} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
