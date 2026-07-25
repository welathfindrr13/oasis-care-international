'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import type { VerifiedVisitStory } from '../../lib/graphql/queries'
import { SourceRefList } from './SourceRefList'
import { VerifiedVisitStoryCard } from './VerifiedVisitStoryCard'
import { restoreActionFocus, runSingleFlightAction } from '../../lib/consequential-actions'

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
  const [showApproveConfirmation, setShowApproveConfirmation] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(story.rejectionReason || '')
  const approveTriggerRef = useRef<HTMLButtonElement>(null)
  const approveConfirmRef = useRef<HTMLButtonElement>(null)
  const approvalStartedRef = useRef(false)
  const hasFamilyPreview = Boolean(story.familySafeTitle && story.familySafeBody && story.familySafeVersion === 1)

  useEffect(() => {
    if (showApproveConfirmation) {
      approveConfirmRef.current?.focus()
    }
  }, [showApproveConfirmation])

  function cancelApprove() {
    setShowApproveConfirmation(false)
    restoreActionFocus(approveTriggerRef.current)
  }

  return (
    <VerifiedVisitStoryCard
      story={story}
      footer={
        <div className="space-y-4">
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-label="Family preview">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Exact family preview
            </p>
            {hasFamilyPreview ? (
              <div className="mt-2 text-sm leading-6 text-slate-700">
                <h4 className="font-semibold text-slate-900">{story.familySafeTitle}</h4>
                <p className="mt-1">{story.familySafeBody}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                This older draft has no family-safe preview and cannot be approved.
              </p>
            )}
          </section>

          {showApproveConfirmation ? (
            <section
              className="rounded-2xl border border-oasis-attention bg-amber-50 p-4"
              role="alertdialog"
              aria-labelledby={`approve-title-${story.id}`}
              aria-describedby={`approve-preview-${story.id}`}
            >
              <h4 id={`approve-title-${story.id}`} className="font-semibold text-slate-950">
                Publish this exact Family update?
              </h4>
              <div id={`approve-preview-${story.id}`} className="mt-2 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-slate-900">{story.familySafeTitle}</p>
                <p className="mt-1">{story.familySafeBody}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  ref={approveConfirmRef}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await runSingleFlightAction(approvalStartedRef, async () => {
                      setShowApproveConfirmation(false)
                      await onApprove(story.id)
                    })
                  }}
                >
                  Confirm and publish
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={cancelApprove}>
                  Cancel
                </Button>
              </div>
            </section>
          ) : null}

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
            <Button
              ref={approveTriggerRef}
              type="button"
              disabled={busy || !hasFamilyPreview || showApproveConfirmation}
              onClick={() => setShowApproveConfirmation(true)}
            >
              Approve exact family preview
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
