'use client'

import { useEffect, useState } from 'react'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  EVIDENCE_SOURCE_CANDIDATES_QUERY,
  type EvidenceSourceCandidateRecord,
  type EvidenceSourceCandidatesQueryResponse,
  type OperationalEvidenceSourceType,
} from '../../lib/graphql/queries'
import { formatDateTime, getOrganizationDateUtcRange } from '../../lib/time'

interface EvidenceSourcePickerProps {
  clientId: string
  periodStart: string
  periodEnd: string
  selectedSources: EvidenceSourceCandidateRecord[]
  onSelectedSourcesChange: (sources: EvidenceSourceCandidateRecord[]) => void
  disabled?: boolean
}

const SOURCE_FILTERS: Array<{ value: OperationalEvidenceSourceType; label: string }> = [
  { value: 'VISIT', label: 'Visits' },
  { value: 'CARE_LOG', label: 'Care notes' },
  { value: 'CONCERN', label: 'Concern cases' },
]

function sourceKey(source: Pick<EvidenceSourceCandidateRecord, 'sourceType' | 'id'>): string {
  return `${source.sourceType}:${source.id}`
}

function toIsoDateStart(value: string): string {
  return getOrganizationDateUtcRange(value).start
}

function toIsoDateEnd(value: string): string {
  const range = getOrganizationDateUtcRange(value)
  return new Date(new Date(range.end).getTime() - 1).toISOString()
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not dated'

  return formatDateTime(value, { year: undefined })
}

function typeLabel(sourceType: OperationalEvidenceSourceType): string {
  return SOURCE_FILTERS.find((filter) => filter.value === sourceType)?.label ?? sourceType
}

export function EvidenceSourcePicker({
  clientId,
  periodStart,
  periodEnd,
  selectedSources,
  onSelectedSourcesChange,
  disabled = false,
}: EvidenceSourcePickerProps) {
  const [enabledSourceTypes, setEnabledSourceTypes] = useState<OperationalEvidenceSourceType[]>(
    SOURCE_FILTERS.map((filter) => filter.value),
  )
  const [candidates, setCandidates] = useState<EvidenceSourceCandidateRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedKeys = new Set(selectedSources.map(sourceKey))

  useEffect(() => {
    if (!periodStart || !periodEnd || enabledSourceTypes.length === 0) {
      setCandidates([])
      setError(null)
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)
    setError(null)

    clientQuery<EvidenceSourceCandidatesQueryResponse>(EVIDENCE_SOURCE_CANDIDATES_QUERY, {
      input: {
        clientId,
        periodStart: toIsoDateStart(periodStart),
        periodEnd: toIsoDateEnd(periodEnd),
        sourceTypes: enabledSourceTypes,
        take: 100,
      },
    })
      .then((data) => {
        if (!ignore) {
          setCandidates(data.evidenceSourceCandidates ?? [])
        }
      })
      .catch((requestError: unknown) => {
        if (!ignore) {
          setCandidates([])
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Evidence sources could not be loaded for this period.',
          )
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [clientId, periodStart, periodEnd, enabledSourceTypes])

  function toggleFilter(sourceType: OperationalEvidenceSourceType) {
    setEnabledSourceTypes((current) => {
      if (current.includes(sourceType)) {
        return current.filter((item) => item !== sourceType)
      }

      return SOURCE_FILTERS.map((filter) => filter.value).filter((item) => item === sourceType || current.includes(item))
    })
  }

  function toggleSource(candidate: EvidenceSourceCandidateRecord) {
    const key = sourceKey(candidate)
    if (selectedKeys.has(key)) {
      onSelectedSourcesChange(selectedSources.filter((source) => sourceKey(source) !== key))
      return
    }

    onSelectedSourcesChange([...selectedSources, candidate])
  }

  function removeSource(key: string) {
    onSelectedSourcesChange(selectedSources.filter((source) => sourceKey(source) !== key))
  }

  return (
    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Operational sources</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Add visits, care notes, and concern cases already recorded for this person.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {selectedSources.length} selected
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SOURCE_FILTERS.map((filter) => {
          const active = enabledSourceTypes.includes(filter.value)
          return (
            <button
              key={filter.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleFilter(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-300'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {selectedSources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedSources.map((source) => {
            const key = sourceKey(source)
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => removeSource(key)}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                title="Remove evidence source"
              >
                {typeLabel(source.sourceType)} · {source.title}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {enabledSourceTypes.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
            Choose at least one source type to find evidence.
          </p>
        )}
        {loading && (
          <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            Finding evidence sources for this period...
          </p>
        )}
        {error && !loading && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{error}</p>
        )}
        {!loading && !error && enabledSourceTypes.length > 0 && candidates.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
            No operational sources found for this person and period.
          </p>
        )}
        {!loading &&
          !error &&
          candidates.map((candidate) => {
            const key = sourceKey(candidate)
            const selected = selectedKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => toggleSource(candidate)}
                className={`w-full rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'border-emerald-400 bg-white ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-white hover:border-emerald-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {typeLabel(candidate.sourceType)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{candidate.title}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {candidate.status ?? formatDate(candidate.occurredAt)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(candidate.occurredAt)}
                  {candidate.createdBy ? ` · ${candidate.createdBy}` : ''}
                  {candidate.subtitle ? ` · ${candidate.subtitle}` : ''}
                </p>
                {candidate.previewText && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{candidate.previewText}</p>
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}
