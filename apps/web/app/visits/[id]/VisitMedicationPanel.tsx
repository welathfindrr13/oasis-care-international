'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  RECORD_ADMINISTRATION_MUTATION,
  type MedicationAdministration,
  type RecordAdministrationMutationResponse,
} from '../../../lib/graphql/queries'
import { formatDateTime } from '../../../lib/time'

interface VisitMedicationPanelProps {
  canEdit: boolean
  medications: MedicationAdministration[]
}

function getMedicationStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function VisitMedicationPanel({ canEdit, medications }: VisitMedicationPanelProps) {
  const router = useRouter()
  const [items, setItems] = useState(medications)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(
    Object.fromEntries(medications.map((administration) => [administration.id, administration.notes ?? '']))
  )
  const [activeMedicationId, setActiveMedicationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const updateAdministration = (administration: MedicationAdministration, status: string, notes: string) => {
    setError(null)
    setActiveMedicationId(administration.id)

    startSaving(async () => {
      try {
        const data = await clientQuery<RecordAdministrationMutationResponse>(
          RECORD_ADMINISTRATION_MUTATION,
          {
            input: {
              administrationId: administration.id,
              status,
              notes: notes.trim() || undefined,
            },
          }
        )

        const updatedAdministration = data.recordAdministration
        setItems((current) =>
          current.map((item) =>
            item.id === administration.id
              ? {
                  ...item,
                  status: updatedAdministration.status,
                  notes: updatedAdministration.notes,
                  administeredTime: updatedAdministration.administeredTime,
                  administeredBy: updatedAdministration.administeredBy,
                  updatedAt: updatedAdministration.updatedAt,
                }
              : item
          )
        )
        setNoteDrafts((current) => ({
          ...current,
          [administration.id]: updatedAdministration.notes ?? '',
        }))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update medication')
      } finally {
        setActiveMedicationId(null)
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
        No visit-linked medication records were returned for this visit.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((administration) => {
          const isBusy = isSaving && activeMedicationId === administration.id
          const noteValue = noteDrafts[administration.id] ?? ''
          const canRecordOutcome = canEdit && administration.status === 'SCHEDULED'

          return (
            <li key={administration.id} className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium text-text-primary">
                      {administration.prescription?.medication?.name || 'Medication'}
                    </p>
                    <span className="inline-flex rounded-full border border-base-gray-300 bg-base-gray-100 px-3 py-1 text-xs font-medium text-base-gray-800">
                      {getMedicationStatusLabel(administration.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {administration.prescription?.medication
                      ? `${administration.prescription.medication.dosage}${administration.prescription.medication.unit}`
                      : 'Dose not recorded'}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Scheduled {formatDateTime(administration.scheduledTime)}
                  </p>
                  {administration.administeredTime && (
                    <p className="mt-1 text-sm text-text-secondary">
                      Recorded {formatDateTime(administration.administeredTime)}
                    </p>
                  )}
                  {(administration.instructionSnapshot ||
                    administration.prescription?.specialInstructions ||
                    administration.prescription?.medication?.instructions) && (
                    <p className="mt-2 text-sm text-text-secondary">
                      {administration.instructionSnapshot ||
                        administration.prescription?.specialInstructions ||
                        administration.prescription?.medication?.instructions}
                    </p>
                  )}

                  {canEdit ? (
                    <div className="mt-3 space-y-2">
                      <label
                        htmlFor={`medication-notes-${administration.id}`}
                        className="text-xs font-medium uppercase tracking-wide text-text-secondary"
                      >
                        Medication notes
                      </label>
                      <textarea
                        id={`medication-notes-${administration.id}`}
                        value={noteValue}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [administration.id]: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-primary shadow-sm outline-none transition focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-primary/20"
                        placeholder="Capture any medication-specific detail for this visit."
                      />
                    </div>
                  ) : administration.notes ? (
                    <p className="mt-2 text-sm text-text-secondary">Notes: {administration.notes}</p>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="flex flex-col gap-2 sm:items-end">
                    {canRecordOutcome ? (
                      <>
                        <button
                          type="button"
                          className={buttonVariants({ variant: 'primary', size: 'sm', className: 'self-start' })}
                          onClick={() => updateAdministration(administration, 'ADMINISTERED', noteValue)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Saving…' : 'Mark administered'}
                        </button>
                        <button
                          type="button"
                          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'self-start' })}
                          onClick={() => updateAdministration(administration, 'MISSED', noteValue)}
                          disabled={isBusy}
                        >
                          Mark missed
                        </button>
                        <button
                          type="button"
                          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'self-start' })}
                          onClick={() => updateAdministration(administration, 'REFUSED', noteValue)}
                          disabled={isBusy}
                        >
                          Mark refused
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-text-secondary">
                        Outcome recorded for this medication.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
