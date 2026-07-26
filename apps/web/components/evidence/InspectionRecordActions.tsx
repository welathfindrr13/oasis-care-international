'use client'

import { useRef, useState } from 'react'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  CREATE_EVIDENCE_PACK_MUTATION,
  type CreateEvidencePackInput,
  type InspectionAssessmentRecord,
  type InspectionCarePlanRecord,
  type InspectionSourceCandidate,
} from '../../lib/graphql/queries'
import {
  buildInspectionRecordItems,
  type InspectionRecordValidationErrors,
  validateInspectionRecordForm,
} from '../../lib/inspection-records'
import { organizationDateKeyToStoredDateIso } from '../../lib/time'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { FieldError } from '../ui/FieldError'
import { InspectionRecordSourcePicker } from './InspectionRecordSourcePicker'

interface InspectionRecordActionsProps {
  clientId: string
  assessments: InspectionAssessmentRecord[]
  carePlans: InspectionCarePlanRecord[]
  onCompleteRedirectPath: string
}

const controlClassName =
  'mt-1 min-h-11 w-full rounded-md border border-oasis-control-border bg-white px-3 py-2 text-sm text-oasis-ink focus-visible:outline-none'

export function InspectionRecordActions({
  clientId,
  assessments,
  carePlans,
  onCompleteRedirectPath,
}: InspectionRecordActionsProps) {
  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const sourceGroupRef = useRef<HTMLFieldSetElement>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [linkedCarePlanId, setLinkedCarePlanId] = useState('')
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([])
  const [selectedCarePlanIds, setSelectedCarePlanIds] = useState<string[]>([])
  const [selectedOperationalSources, setSelectedOperationalSources] = useState<
    InspectionSourceCandidate[]
  >([])
  const [errors, setErrors] = useState<InspectionRecordValidationErrors>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function toggleSelection(
    id: string,
    selectedIds: string[],
    setSelectedIds: (next: string[]) => void,
  ) {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    )
  }

  function focusFirstError(nextErrors: InspectionRecordValidationErrors) {
    if (nextErrors.periodStart) {
      periodStartRef.current?.focus()
    } else if (nextErrors.periodEnd) {
      periodEndRef.current?.focus()
    } else if (nextErrors.sources) {
      sourceGroupRef.current?.focus()
    }
  }

  async function submitInspectionRecord() {
    const selectedAssessments = assessments.filter((assessment) =>
      selectedAssessmentIds.includes(assessment.id),
    )
    const planIds = Array.from(
      new Set(
        [linkedCarePlanId, ...selectedCarePlanIds].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    )
    const selectedCarePlans = carePlans.filter((plan) =>
      planIds.includes(plan.id),
    )
    const items = buildInspectionRecordItems({
      assessments: selectedAssessments,
      carePlans: selectedCarePlans,
      operationalSources: selectedOperationalSources,
    })
    const nextErrors = validateInspectionRecordForm({
      periodStart,
      periodEnd,
      selectedSourceCount: items.length,
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    setBusy(true)
    setMessage(null)
    const input: CreateEvidencePackInput = {
      clientId,
      carePlanId: linkedCarePlanId || undefined,
      status: 'DRAFT',
      kind: 'INSPECTION',
      periodStart: organizationDateKeyToStoredDateIso(periodStart),
      periodEnd: organizationDateKeyToStoredDateIso(periodEnd),
      items,
    }

    try {
      await clientQuery(CREATE_EVIDENCE_PACK_MUTATION, { input })
      setMessage({
        type: 'success',
        text: 'Inspection record created. The record list will now refresh.',
      })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch {
      setMessage({
        type: 'error',
        text: 'The inspection record could not be created. Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8" aria-labelledby="create-inspection-record-heading">
      <h2
        id="create-inspection-record-heading"
        className="font-heading text-xl font-bold text-oasis-ink"
      >
        Create inspection record
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-oasis-muted">
        Choose the period and recorded items to include. Raw care notes, Family
        content, actor details, and internal identifiers are not copied into the
        record or its download.
      </p>

      {message ? (
        <Alert
          className="mt-4"
          tone={message.type === 'success' ? 'success' : 'danger'}
          live
        >
          {message.text}
        </Alert>
      ) : null}

      <form
        className="mt-5 rounded-md border border-oasis-border bg-white p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submitInspectionRecord()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="inspection-period-start"
              className="block text-sm font-medium text-oasis-ink"
            >
              Period start
            </label>
            <input
              ref={periodStartRef}
              id="inspection-period-start"
              type="date"
              value={periodStart}
              aria-invalid={Boolean(errors.periodStart)}
              aria-describedby={
                errors.periodStart ? 'inspection-period-start-error' : undefined
              }
              onChange={(event) => {
                setPeriodStart(event.target.value)
                setErrors((current) => ({ ...current, periodStart: undefined }))
              }}
              className={controlClassName}
            />
            {errors.periodStart ? (
              <FieldError id="inspection-period-start-error">
                {errors.periodStart}
              </FieldError>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="inspection-period-end"
              className="block text-sm font-medium text-oasis-ink"
            >
              Period end
            </label>
            <input
              ref={periodEndRef}
              id="inspection-period-end"
              type="date"
              value={periodEnd}
              aria-invalid={Boolean(errors.periodEnd)}
              aria-describedby={
                errors.periodEnd ? 'inspection-period-end-error' : undefined
              }
              onChange={(event) => {
                setPeriodEnd(event.target.value)
                setErrors((current) => ({ ...current, periodEnd: undefined }))
              }}
              className={controlClassName}
            />
            {errors.periodEnd ? (
              <FieldError id="inspection-period-end-error">
                {errors.periodEnd}
              </FieldError>
            ) : null}
          </div>
        </div>

        <label
          htmlFor="inspection-linked-care-plan"
          className="mt-4 block text-sm font-medium text-oasis-ink"
        >
          Linked care plan (optional)
        </label>
        <select
          id="inspection-linked-care-plan"
          value={linkedCarePlanId}
          onChange={(event) => {
            const nextId = event.target.value
            setLinkedCarePlanId(nextId)
            if (nextId && !selectedCarePlanIds.includes(nextId)) {
              setSelectedCarePlanIds([...selectedCarePlanIds, nextId])
            }
          }}
          className={controlClassName}
        >
          <option value="">No linked care plan</option>
          {carePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              v{plan.version} {plan.title} ({plan.status.toLowerCase()})
            </option>
          ))}
        </select>

        <fieldset
          ref={sourceGroupRef}
          tabIndex={-1}
          aria-invalid={Boolean(errors.sources)}
          aria-describedby={errors.sources ? 'inspection-sources-error' : undefined}
          className="mt-5 rounded-md border border-oasis-border bg-base-gray-50 p-4 focus-visible:outline-none"
        >
          <legend className="px-1 text-sm font-semibold text-oasis-ink">
            Care-planning records
          </legend>
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-oasis-ink">
                Assessments
              </h3>
              {assessments.length === 0 ? (
                <p className="mt-2 text-sm text-oasis-muted">
                  No assessments are available.
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  {assessments.map((assessment) => (
                    <label
                      key={assessment.id}
                      className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-oasis-ink"
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-oasis-control-border text-oasis-teal"
                        checked={selectedAssessmentIds.includes(assessment.id)}
                        onChange={() => {
                          toggleSelection(
                            assessment.id,
                            selectedAssessmentIds,
                            setSelectedAssessmentIds,
                          )
                          setErrors((current) => ({
                            ...current,
                            sources: undefined,
                          }))
                        }}
                      />
                      <span>
                        {assessment.title} ({assessment.status.toLowerCase()})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-oasis-ink">
                Care plans
              </h3>
              {carePlans.length === 0 ? (
                <p className="mt-2 text-sm text-oasis-muted">
                  No care plans are available.
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  {carePlans.map((plan) => (
                    <label
                      key={plan.id}
                      className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-oasis-ink"
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-oasis-control-border text-oasis-teal"
                        checked={selectedCarePlanIds.includes(plan.id)}
                        onChange={() => {
                          toggleSelection(
                            plan.id,
                            selectedCarePlanIds,
                            setSelectedCarePlanIds,
                          )
                          setErrors((current) => ({
                            ...current,
                            sources: undefined,
                          }))
                        }}
                      />
                      <span>
                        v{plan.version} {plan.title} ({plan.status.toLowerCase()})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {periodStart && periodEnd ? (
          <InspectionRecordSourcePicker
            clientId={clientId}
            periodStart={periodStart}
            periodEnd={periodEnd}
            selectedSources={selectedOperationalSources}
            onSelectedSourcesChange={(sources) => {
              setSelectedOperationalSources(sources)
              setErrors((current) => ({ ...current, sources: undefined }))
            }}
            disabled={busy}
          />
        ) : null}

        {errors.sources ? (
          <FieldError id="inspection-sources-error" className="mt-3">
            {errors.sources}
          </FieldError>
        ) : null}

        <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={busy}>
          {busy ? 'Creating inspection record…' : 'Create inspection record'}
        </Button>
      </form>
    </section>
  )
}
