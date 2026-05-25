'use client'

import type { CarebridgeConcern } from '../../lib/graphql/queries'
import { ConcernResolutionTracker } from './ConcernResolutionTracker'

interface ConcernInboxListProps {
  concerns: CarebridgeConcern[]
  busyConcernId?: string | null
  onAcknowledge: (concernId: string) => Promise<void>
  onResolve: (concernId: string, resolutionNote: string) => Promise<void>
}

export function ConcernInboxList({
  concerns,
  busyConcernId = null,
  onAcknowledge,
  onResolve,
}: ConcernInboxListProps) {
  if (concerns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="font-heading text-2xl font-semibold text-slate-900">No concerns in this view</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          When families raise worries or request a call, they will appear here with clear response deadlines.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {concerns.map((concern) => (
        <ConcernResolutionTracker
          key={concern.id}
          concern={concern}
          busy={busyConcernId === concern.id}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
        />
      ))}
    </div>
  )
}
