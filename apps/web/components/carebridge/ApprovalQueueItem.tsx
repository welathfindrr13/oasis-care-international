'use client'

import { useState } from 'react'
import { Button } from '../ui/Button'
import type { VerifiedVisitStory } from '../../lib/graphql/queries'
import { SourceRefList } from './SourceRefList'
import { VerifiedVisitStoryCard } from './VerifiedVisitStoryCard'

interface ApprovalQueueItemProps {
  story: VerifiedVisitStory
  busy?: boolean
  onApprove: (storyId: string) => Promise<void>
  onReject: (storyId: string, rejectionReason: string) => Promise<void>
}

export function ApprovalQueueItem({
  story,
  busy = false,
  onApprove,
  onReject,
}: ApprovalQueueItemProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(story.rejectionReason || '')

  return (
    <VerifiedVisitStoryCard
      story={story}
      footer={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Source references
            </p>
            <SourceRefList className="mt-2" sourceRefs={story.sourceRefs} />
          </div>

          {showRejectForm ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700" htmlFor={`reject-${story.id}`}>
                Reason for returning this story
              </label>
              <textarea
                id={`reject-${story.id}`}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                placeholder="Explain what needs to change before this update is safe to share with family."
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || rejectionReason.trim().length === 0}
                  onClick={async () => {
                    await onReject(story.id, rejectionReason.trim())
                    setShowRejectForm(false)
                  }}
                >
                  Confirm return
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={() => onApprove(story.id)}>
              Approve for family
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setShowRejectForm((current) => !current)}
            >
              Return with changes
            </Button>
          </div>
        </div>
      }
    />
  )
}
