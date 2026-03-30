'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StatusChip } from '../../../components/oasis/StatusChip'
import { buttonVariants } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import { formatDateTime } from '../../../lib/time'
import { cn } from '../../../lib/utils'
import {
  UPDATE_VISIT_MUTATION,
  type UpdateVisitMutationResponse,
  type Visit,
  type VisitTask,
} from '../../../lib/graphql/queries'

interface VisitOperationalPanelProps {
  canEdit: boolean
  visit: Pick<Visit, 'id' | 'status' | 'scheduledStart' | 'scheduledEnd' | 'actualStart' | 'actualEnd' | 'updatedAt'> & {
    tasks: Array<Pick<VisitTask, 'id' | 'isCompleted'>>
  }
}

function getTaskProgress(tasks: VisitOperationalPanelProps['visit']['tasks']) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.isCompleted).length
  return { total, completed, remaining: Math.max(total - completed, 0) }
}

export function VisitOperationalPanel({ canEdit, visit }: VisitOperationalPanelProps) {
  const router = useRouter()
  const [currentVisit, setCurrentVisit] = useState(visit)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<'start' | 'complete' | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setCurrentVisit(visit)
  }, [visit])

  const taskProgress = useMemo(() => getTaskProgress(currentVisit.tasks), [currentVisit.tasks])
  const hasStarted = Boolean(currentVisit.actualStart)
  const hasCompleted = Boolean(currentVisit.actualEnd) || currentVisit.status === 'COMPLETED'
  const canStart = canEdit && !hasStarted && currentVisit.status === 'SCHEDULED'
  const canComplete = canEdit && !hasCompleted && (currentVisit.status === 'IN_PROGRESS' || hasStarted)

  const runUpdate = (
    action: 'start' | 'complete',
    input: {
      status: 'IN_PROGRESS' | 'COMPLETED'
      actualStart?: string
      actualEnd?: string
    }
  ) => {
    setError(null)
    setMessage(null)
    setActiveAction(action)

    startTransition(async () => {
      try {
        const data = await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, {
          input: {
            id: currentVisit.id,
            ...input,
          },
        })

        setCurrentVisit((existing) => ({
          ...existing,
          status: data.updateVisit.status,
          actualStart: data.updateVisit.actualStart ?? existing.actualStart,
          actualEnd: data.updateVisit.actualEnd ?? existing.actualEnd,
          updatedAt: data.updateVisit.updatedAt,
        }))
        setMessage(action === 'start' ? 'Visit started.' : 'Visit marked as completed.')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update visit')
      } finally {
        setActiveAction(null)
      }
    })
  }

  const startVisit = () => {
    const now = new Date().toISOString()
    runUpdate('start', {
      status: 'IN_PROGRESS',
      actualStart: now,
    })
  }

  const completeVisit = () => {
    const now = new Date().toISOString()
    runUpdate('complete', {
      status: 'COMPLETED',
      actualStart: currentVisit.actualStart ?? now,
      actualEnd: now,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary font-heading">Visit operations</h2>
          <p className="text-sm text-text-secondary">
            {canEdit
              ? 'Record when the visit starts and finishes so timings and downstream oversight stay reliable.'
              : 'Review the current visit state and recorded timing evidence.'}
          </p>
        </div>
        <StatusChip
          status={
            currentVisit.status.toLowerCase() as 'scheduled' | 'in_progress' | 'completed'
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Scheduled window</p>
          <p className="mt-2 text-sm text-text-primary">
            {formatDateTime(currentVisit.scheduledStart)} to {formatDateTime(currentVisit.scheduledEnd)}
          </p>
        </div>
        <div className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Task progress</p>
          <p className="mt-2 text-sm text-text-primary">
            {taskProgress.total > 0
              ? `${taskProgress.completed} of ${taskProgress.total} tasks complete`
              : 'No tasks attached to this visit'}
          </p>
          {taskProgress.total > 0 && taskProgress.remaining > 0 && (
            <p className="mt-1 text-xs text-text-secondary">
              {taskProgress.remaining} still need attention before the visit is fully wrapped up.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Actual start</p>
            <p className="mt-1 text-sm text-text-primary">
              {currentVisit.actualStart ? formatDateTime(currentVisit.actualStart) : 'Not recorded'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Actual end</p>
            <p className="mt-1 text-sm text-text-primary">
              {currentVisit.actualEnd ? formatDateTime(currentVisit.actualEnd) : 'Not recorded'}
            </p>
          </div>
        </div>

        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canStart && (
              <button
                type="button"
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
                onClick={startVisit}
                disabled={isPending}
              >
                {isPending && activeAction === 'start' ? 'Starting…' : 'Start visit now'}
              </button>
            )}

            {canComplete && (
              <button
                type="button"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                onClick={completeVisit}
                disabled={isPending}
              >
                {isPending && activeAction === 'complete' ? 'Completing…' : 'Finish visit'}
              </button>
            )}

            {!canStart && !canComplete && (
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-text-secondary">
                Visit timing evidence has already been recorded for the current workflow state.
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-text-secondary">
            Coordinators can review timing evidence here. Carers record timing from this panel on their own assigned visits.
          </p>
        )}

        {taskProgress.total > 0 && canComplete && taskProgress.remaining > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Some tasks are still open. You can still finish the visit if care is complete, but the remaining tasks will stay visible for follow-up.
          </p>
        )}

        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && (
          <p className={cn('mt-3 text-sm text-red-600')} role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Last visit update {formatDateTime(currentVisit.updatedAt)}
        </p>
      </div>
    </div>
  )
}
