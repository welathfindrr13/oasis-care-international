import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import type { VerifiedVisitStory } from '../../lib/graphql/queries'

interface VerifiedVisitStoryCardProps {
  story: VerifiedVisitStory
  audience?: 'staff' | 'family'
  className?: string
  footer?: ReactNode
}

function getStatusTone(status: string) {
  switch (status.toUpperCase()) {
    case 'PUBLISHED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200'
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VerifiedVisitStoryCard({
  story,
  audience = 'staff',
  className,
  footer,
}: VerifiedVisitStoryCardProps) {
  const title = audience === 'family'
    ? story.approvedTitle || story.draftTitle
    : story.draftTitle
  const body = audience === 'family'
    ? story.approvedBody || story.draftBody
    : story.draftBody

  return (
    <article className={cn('rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verified Visit Story
          </p>
          <h3 className="mt-2 font-heading text-xl font-semibold text-slate-900">
            {title}
          </h3>
        </div>
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide', getStatusTone(story.status))}>
          {story.status}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-600">
        {body}
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        {story.approvedAt && <span>Approved {formatTimestamp(story.approvedAt)}</span>}
        {story.publishedAt && <span>Published {formatTimestamp(story.publishedAt)}</span>}
        {story.rejectedAt && <span>Rejected {formatTimestamp(story.rejectedAt)}</span>}
      </div>

      {story.rejectionReason && audience === 'staff' && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Returned for changes:</span> {story.rejectionReason}
        </div>
      )}

      {footer ? <div className="mt-5">{footer}</div> : null}
    </article>
  )
}
