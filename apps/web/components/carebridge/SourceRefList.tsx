import { cn } from '../../lib/utils'

interface SourceRefListProps {
  sourceRefs: Array<Record<string, unknown>> | null | undefined
  className?: string
}

function formatRefLabel(ref: Record<string, unknown>) {
  const type = String(ref.type || 'Record')
  const id = String(ref.id || '').slice(0, 8)
  return id ? `${type} · ${id}` : type
}

export function SourceRefList({ sourceRefs, className }: SourceRefListProps) {
  const refs = Array.isArray(sourceRefs) ? sourceRefs : []

  if (refs.length === 0) {
    return (
      <p className={cn('text-xs text-slate-500', className)}>
        No source references attached.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {refs.map((ref, index) => (
        <span
          key={`${String(ref.type || 'ref')}-${String(ref.id || index)}`}
          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
        >
          {formatRefLabel(ref)}
        </span>
      ))}
    </div>
  )
}
