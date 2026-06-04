'use client'

import { useState } from 'react'
import { Button } from '../ui/Button'
import type { CarebridgeConcern } from '../../lib/graphql/queries'
import { ConcernSlaBadge } from './ConcernSlaBadge'

interface ConcernResolutionTrackerProps {
  concern: CarebridgeConcern
  busy?: boolean
  onAcknowledge: (concernId: string) => Promise<void>
  onResolve: (concernId: string, resolutionNote: string) => Promise<void>
}

function latestMessage(concern: CarebridgeConcern) {
  return concern.messages[concern.messages.length - 1] ?? null
}

export function ConcernResolutionTracker({
  concern,
  busy = false,
  onAcknowledge,
  onResolve,
}: ConcernResolutionTrackerProps) {
  const [showResolve, setShowResolve] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const lastMessage = latestMessage(concern)
  const isResolved = concern.status === 'RESOLVED'
  const isAcknowledged = concern.status === 'ACKNOWLEDGED' || isResolved

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resolution Tracker</p>
          <h3 className="mt-2 font-heading text-xl font-semibold text-slate-900">{concern.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {concern.description || 'No additional family context was supplied for this concern.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {concern.status}
          </span>
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {concern.severity}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ConcernSlaBadge label="Acknowledge by" dueAt={concern.acknowledgementDueAt} resolved={isAcknowledged} />
        <ConcernSlaBadge label="Resolve by" dueAt={concern.resolutionDueAt} resolved={isResolved} />
      </div>

      {lastMessage ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest update</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{lastMessage.actorLabel}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{lastMessage.body}</p>
        </div>
      ) : null}

      {showResolve ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor={`resolve-${concern.id}`}>
            Resolution note
          </label>
          <textarea
            id={`resolve-${concern.id}`}
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            placeholder="Summarise what was done and what the family should know next."
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || resolutionNote.trim().length === 0}
              onClick={async () => {
                await onResolve(concern.id, resolutionNote.trim())
                setShowResolve(false)
                setResolutionNote('')
              }}
            >
              Mark resolved
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setShowResolve(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {!isAcknowledged ? (
          <Button type="button" disabled={busy} onClick={() => onAcknowledge(concern.id)}>
            Acknowledge concern
          </Button>
        ) : null}
        {!isResolved ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => setShowResolve((current) => !current)}>
            Resolve with outcome
          </Button>
        ) : null}
      </div>
    </article>
  )
}
