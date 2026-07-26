'use client'

import { useEffect, useMemo, useState } from 'react'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  EVIDENCE_SOURCE_CANDIDATES_QUERY,
  type EvidenceSourceCandidatesQueryResponse,
  type InspectionSourceCandidate,
  type OperationalInspectionSourceType,
} from '../../lib/graphql/queries'
import { inspectionRecordTypeLabel } from '../../lib/inspection-records'
import { formatDateTime, getOrganizationDateUtcRange } from '../../lib/time'
import { Button } from '../ui/Button'
import { StatePanel } from '../ui/StatePanel'
import { StatusLabel } from '../ui/StatusLabel'

interface InspectionRecordSourcePickerProps {
  clientId: string
  periodStart: string
  periodEnd: string
  selectedSources: InspectionSourceCandidate[]
  onSelectedSourcesChange: (sources: InspectionSourceCandidate[]) => void
  onReadinessChange: (ready: boolean) => void
  disabled?: boolean
}

const SOURCE_FILTERS: Array<{
  value: OperationalInspectionSourceType
  label: string
}> = [
  { value: 'VISIT', label: 'Visits' },
  { value: 'CARE_LOG', label: 'Care notes' },
  { value: 'CONCERN', label: 'Concerns' },
]

function sourceKey(
  source: Pick<InspectionSourceCandidate, 'sourceType' | 'id'>,
): string {
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
  return value ? formatDateTime(value, { year: undefined }) : 'Not dated'
}

export function InspectionRecordSourcePicker({
  clientId,
  periodStart,
  periodEnd,
  selectedSources,
  onSelectedSourcesChange,
  onReadinessChange,
  disabled = false,
}: InspectionRecordSourcePickerProps) {
  const [enabledSourceTypes, setEnabledSourceTypes] = useState<
    OperationalInspectionSourceType[]
  >(SOURCE_FILTERS.map((filter) => filter.value))
  const [candidates, setCandidates] = useState<InspectionSourceCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const selectedKeys = useMemo(
    () => new Set(selectedSources.map(sourceKey)),
    [selectedSources],
  )

  useEffect(() => {
    if (!periodStart || !periodEnd || enabledSourceTypes.length === 0) {
      setCandidates([])
      setError(false)
      setLoading(false)
      onReadinessChange(enabledSourceTypes.length === 0)
      return
    }

    let ignore = false
    setLoading(true)
    setError(false)
    onReadinessChange(false)

    clientQuery<EvidenceSourceCandidatesQueryResponse>(
      EVIDENCE_SOURCE_CANDIDATES_QUERY,
      {
        input: {
          clientId,
          periodStart: toIsoDateStart(periodStart),
          periodEnd: toIsoDateEnd(periodEnd),
          sourceTypes: enabledSourceTypes,
          take: 100,
        },
      },
    )
      .then((data) => {
        if (ignore) return
        const safeCandidates = (data.evidenceSourceCandidates ?? []).filter(
          (candidate): candidate is InspectionSourceCandidate =>
            SOURCE_FILTERS.some(
              (filter) => filter.value === String(candidate.sourceType),
            ),
        )
        setCandidates(safeCandidates)
        onReadinessChange(true)
      })
      .catch(() => {
        if (!ignore) {
          setCandidates([])
          setError(true)
          onSelectedSourcesChange([])
          onReadinessChange(false)
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [
    clientId,
    periodStart,
    periodEnd,
    enabledSourceTypes,
    onReadinessChange,
    onSelectedSourcesChange,
  ])

  function toggleFilter(sourceType: OperationalInspectionSourceType) {
    const next = enabledSourceTypes.includes(sourceType)
      ? enabledSourceTypes.filter((item) => item !== sourceType)
      : SOURCE_FILTERS.map((filter) => filter.value).filter(
          (item) => item === sourceType || enabledSourceTypes.includes(item),
        )
    setEnabledSourceTypes(next)
    onSelectedSourcesChange(
      selectedSources.filter((source) => next.includes(source.sourceType)),
    )
  }

  function toggleSource(candidate: InspectionSourceCandidate) {
    const key = sourceKey(candidate)
    onSelectedSourcesChange(
      selectedKeys.has(key)
        ? selectedSources.filter((source) => sourceKey(source) !== key)
        : [...selectedSources, candidate],
    )
  }

  return (
    <fieldset
      className="mt-5 rounded-md border border-oasis-border bg-base-gray-50 p-4"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-semibold text-oasis-ink">
        Visits, care notes, and concerns
      </legend>
      <p className="mt-1 text-sm leading-6 text-oasis-muted">
        Choose recorded items by type, date, and state. Raw notes and Family
        content are not shown or copied into the inspection record.
      </p>

      <div
        className="mt-3 flex flex-wrap gap-2"
        aria-label="Record type filters"
      >
        {SOURCE_FILTERS.map((filter) => {
          const active = enabledSourceTypes.includes(filter.value)
          return (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              aria-pressed={active}
              onClick={() => toggleFilter(filter.value)}
            >
              {filter.label}
            </Button>
          )
        })}
      </div>

      {loading ? (
        <StatePanel
          className="mt-4"
          kind="loading"
          title="Loading recorded items"
        >
          Recorded items for this client and period are being loaded.
        </StatePanel>
      ) : null}

      {error && !loading ? (
        <StatePanel
          className="mt-4"
          kind="unavailable"
          title="Recorded items are unavailable"
        >
          No inspection record can be created until the recorded items load.
          Check your connection and change the period to try again.
        </StatePanel>
      ) : null}

      {!loading &&
      !error &&
      enabledSourceTypes.length > 0 &&
      candidates.length === 0 ? (
        <StatePanel className="mt-4" title="No recorded items in this period">
          Change the dates or record types if you expected to find an item.
        </StatePanel>
      ) : null}

      {!loading && !error && candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          {candidates.map((candidate) => {
            const key = sourceKey(candidate)
            const selected = selectedKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSource(candidate)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-oasis-border bg-white px-3 py-2 text-left text-sm text-oasis-ink focus-visible:outline-none"
              >
                <span>
                  <span className="font-semibold">
                    {inspectionRecordTypeLabel(candidate.sourceType)}
                  </span>
                  <span className="ml-2 text-oasis-muted">
                    {formatDate(candidate.occurredAt)}
                  </span>
                </span>
                <StatusLabel tone={selected ? 'success' : 'neutral'}>
                  {selected ? 'Included' : (candidate.status ?? 'Available')}
                </StatusLabel>
              </button>
            )
          })}
        </div>
      ) : null}

      <p
        className="mt-4 text-sm font-medium text-oasis-ink"
        role="status"
        aria-live="polite"
      >
        {selectedSources.length}{' '}
        {selectedSources.length === 1 ? 'record' : 'records'} selected
      </p>
    </fieldset>
  )
}
