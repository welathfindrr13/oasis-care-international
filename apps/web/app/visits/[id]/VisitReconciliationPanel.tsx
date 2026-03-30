'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import { cn } from '../../../lib/utils'
import {
  UPDATE_VISIT_MUTATION,
  type UpdateVisitMutationResponse,
} from '../../../lib/graphql/queries'

interface VisitReconciliationPanelProps {
  visitId: string
  hasActualStart: boolean
  hasActualEnd: boolean
  completedTaskCount: number
  totalTaskCount: number
}

export function VisitReconciliationPanel({
  visitId,
  hasActualStart,
  hasActualEnd,
  completedTaskCount,
  totalTaskCount,
}: VisitReconciliationPanelProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<'in_progress' | 'completed' | null>(null)
  const [isPending, startTransition] = useTransition()

  const canMarkInProgress = hasActualStart && !hasActualEnd
  const canMarkCompleted = hasActualStart || hasActualEnd || completedTaskCount > 0

  const runUpdate = (status: 'IN_PROGRESS' | 'COMPLETED') => {
    setError(null)
    setMessage(null)
    setActiveAction(status === 'IN_PROGRESS' ? 'in_progress' : 'completed')

    startTransition(async () => {
      try {
        await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, {
          input: {
            id: visitId,
            status,
          },
        })
        setMessage(
          status === 'IN_PROGRESS'
            ? 'Visit status reconciled to in progress.'
            : 'Visit status reconciled to completed.'
        )
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reconcile visit')
      } finally {
        setActiveAction(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary font-heading">Coordinator reconciliation</h2>
        <p className="mt-1 text-sm text-text-secondary">
          This scheduled visit already has recorded evidence. Reconcile the workflow state so the record matches what has already been captured.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Recorded evidence on this scheduled visit</p>
        <ul className="mt-3 space-y-2 text-sm text-amber-900">
          <li>{hasActualStart ? 'Actual start has been recorded.' : 'No actual start time has been recorded.'}</li>
          <li>{hasActualEnd ? 'Actual end has been recorded.' : 'Actual end has not been recorded.'}</li>
          <li>
            {totalTaskCount > 0
              ? `${completedTaskCount} of ${totalTaskCount} visit tasks are completed.`
              : 'No tasks are attached to this visit.'}
          </li>
        </ul>
        <p className="mt-3 text-xs text-amber-800">
          Reconciling this visit updates workflow state only. It does not recreate missing timings or remove existing notes, tasks, medication records, or timeline evidence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canMarkInProgress && (
          <button
            type="button"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            onClick={() => runUpdate('IN_PROGRESS')}
            disabled={isPending}
          >
            {isPending && activeAction === 'in_progress' ? 'Updating…' : 'Mark in progress'}
          </button>
        )}
        {canMarkCompleted && (
          <button
            type="button"
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
            onClick={() => runUpdate('COMPLETED')}
            disabled={isPending}
          >
            {isPending && activeAction === 'completed' ? 'Updating…' : 'Mark completed'}
          </button>
        )}
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && (
        <p className={cn('text-sm text-red-600')} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
