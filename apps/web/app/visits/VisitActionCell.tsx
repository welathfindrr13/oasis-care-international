'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { buttonVariants } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
import { clientQuery } from '../../lib/graphql/client-side'
import { UPDATE_VISIT_MUTATION, type UpdateVisitMutationResponse, type Visit } from '../../lib/graphql/queries'

interface VisitActionCellProps {
  isAdmin: boolean
  visit: Pick<Visit, 'id' | 'status' | 'actualStart' | 'actualEnd'>
}

export function VisitActionCell({ isAdmin, visit }: VisitActionCellProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (isAdmin) {
    return <span className="text-sm text-text-secondary">No inline actions</span>
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
      {error && (
        <p className={cn('text-xs text-red-600')} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
