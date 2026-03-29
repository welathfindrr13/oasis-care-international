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

interface VisitActionCellProps {
  isAdmin: boolean
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

export function VisitActionCell({ isAdmin, visit }: VisitActionCellProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const taskSummary = getTaskSummary(visit.tasks)

  if (isAdmin) {
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm text-text-secondary">
          {taskSummary.total > 0
            ? `${taskSummary.completed} of ${taskSummary.total} tasks recorded`
            : 'Review visit detail for notes, tasks, and medication context'}
        </span>
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
        {visit.status === 'SCHEDULED' &&
          (taskSummary.total > 0
            ? `${taskSummary.total} tasks queued for this visit`
            : 'Ready to start and record care detail')}
        {visit.status === 'IN_PROGRESS' &&
          (taskSummary.total > 0
            ? `${taskSummary.completed} of ${taskSummary.total} tasks complete`
            : 'Visit in progress')}
        {visit.status === 'COMPLETED' &&
          (taskSummary.remaining > 0
            ? `${taskSummary.remaining} tasks still open for follow-up`
            : 'Visit already completed')}
        {visit.status === 'CANCELLED' && 'Visit cancelled'}
      </span>
      {visit.status === 'SCHEDULED' && (
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
          onClick={() => runUpdate('IN_PROGRESS')}
          disabled={isPending}
        >
          {isPending ? 'Starting…' : 'Start Visit'}
        </button>
      )}
      {visit.status === 'IN_PROGRESS' && (
        <button
          type="button"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          onClick={() => runUpdate('COMPLETED')}
          disabled={isPending}
        >
          {isPending ? 'Completing…' : 'Complete Visit'}
        </button>
      )}
      {visit.status !== 'SCHEDULED' && visit.status !== 'IN_PROGRESS' && (
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
