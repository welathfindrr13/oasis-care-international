function formatDue(value?: string | null) {
  if (!value) return 'No deadline set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No deadline set'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface ConcernSlaBadgeProps {
  label: string
  dueAt?: string | null
  resolved?: boolean
}

export function ConcernSlaBadge({ label, dueAt, resolved = false }: ConcernSlaBadgeProps) {
  const dueDate = dueAt ? new Date(dueAt) : null
  const isOverdue = Boolean(dueDate && !resolved && dueDate.getTime() < Date.now())

  const tone = resolved
    ? 'bg-slate-100 text-slate-600 border-slate-200'
    : isOverdue
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}: {resolved ? 'Complete' : isOverdue ? `Overdue · ${formatDue(dueAt)}` : formatDue(dueAt)}
    </span>
  )
}
