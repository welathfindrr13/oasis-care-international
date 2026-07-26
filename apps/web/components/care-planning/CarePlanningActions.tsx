'use client'

import { useRef, useState } from 'react'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  APPROVE_CARE_PLAN_MUTATION,
  ARCHIVE_CARE_PLAN_MUTATION,
  COMPLETE_ASSESSMENT_MUTATION,
  CREATE_ASSESSMENT_MUTATION,
  CREATE_CARE_PLAN_MUTATION,
  type ApproveCarePlanInput,
  type ArchiveCarePlanInput,
  type AssessmentRecord,
  type CarePlanRecord,
  type CompleteAssessmentInput,
  type CreateAssessmentInput,
  type CreateCarePlanInput,
} from '../../lib/graphql/queries'
import { getOrganizationDateUtcRange } from '../../lib/time'
import { runConfirmedAction, runSingleFlightAction } from '../../lib/consequential-actions'

type CarePlanningAssessment = Pick<AssessmentRecord, 'id' | 'title' | 'status'>
type CarePlanningPlan = Pick<
  CarePlanRecord,
  'id' | 'title' | 'status' | 'version'
>

interface CarePlanningActionsProps {
  clientId: string
  assessments: CarePlanningAssessment[]
  carePlans: CarePlanningPlan[]
  onCompleteRedirectPath: string
}

function toIsoDateEnd(value: string): string {
  const range = getOrganizationDateUtcRange(value)
  return new Date(new Date(range.end).getTime() - 1).toISOString()
}

const controlClassName =
  'mt-1 min-h-11 w-full rounded-md border border-oasis-control-border bg-white px-3 py-2 text-sm text-oasis-ink focus-visible:outline-none'

export function CarePlanningActions({
  clientId,
  assessments,
  carePlans,
  onCompleteRedirectPath,
}: CarePlanningActionsProps) {
  const consequentialActionStartedRef = useRef(false)
  const [assessmentTitle, setAssessmentTitle] = useState('')
  const [assessmentSummary, setAssessmentSummary] = useState('')
  const [assessmentReviewDueAt, setAssessmentReviewDueAt] = useState('')
  const [carePlanTitle, setCarePlanTitle] = useState('')
  const [carePlanSafetyNotes, setCarePlanSafetyNotes] = useState('')
  const [carePlanAssessmentId, setCarePlanAssessmentId] = useState('')
  const [carePlanReviewDueAt, setCarePlanReviewDueAt] = useState('')
  const [assessmentToComplete, setAssessmentToComplete] = useState('')
  const [planToApprove, setPlanToApprove] = useState('')
  const [planToArchive, setPlanToArchive] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function refreshAfterSuccess() {
    setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
  }

  async function submitAssessment() {
    setBusyAction('assessment')
    setMessage(null)
    const input: CreateAssessmentInput = {
      clientId,
      source: 'MANUAL',
      status: 'DRAFT',
      title: assessmentTitle.trim(),
      summary: assessmentSummary.trim() || undefined,
      findings: {},
      riskFlags: {},
      recommendedActions: {},
      reviewDueAt: assessmentReviewDueAt
        ? toIsoDateEnd(assessmentReviewDueAt)
        : undefined,
    }

    try {
      await clientQuery(CREATE_ASSESSMENT_MUTATION, { input })
      setMessage({
        type: 'success',
        text: 'Assessment created. The latest assessment will now load.',
      })
      refreshAfterSuccess()
    } catch {
      setMessage({
        type: 'error',
        text: 'The assessment could not be created. Check your connection and try again.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function submitCarePlan() {
    setBusyAction('carePlan')
    setMessage(null)
    const nextVersion =
      Math.max(0, ...carePlans.map((plan) => plan.version)) + 1
    const input: CreateCarePlanInput = {
      clientId,
      assessmentId: carePlanAssessmentId || undefined,
      status: 'DRAFT',
      version: nextVersion,
      title: carePlanTitle.trim(),
      goals: {},
      interventions: {},
      safetyNotes: carePlanSafetyNotes.trim() || undefined,
      effectiveFrom: new Date().toISOString(),
      reviewDueAt: carePlanReviewDueAt
        ? toIsoDateEnd(carePlanReviewDueAt)
        : undefined,
    }

    try {
      await clientQuery(CREATE_CARE_PLAN_MUTATION, { input })
      setMessage({
        type: 'success',
        text: 'Care plan draft created. The new version will now load.',
      })
      refreshAfterSuccess()
    } catch {
      setMessage({
        type: 'error',
        text: 'The care plan draft could not be created. Check your connection and try again.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function completeAssessment() {
    if (!assessmentToComplete) return
    const assessment = assessments.find(
      (record) => record.id === assessmentToComplete,
    )

    await runSingleFlightAction(consequentialActionStartedRef, () =>
      runConfirmedAction(
        window.confirm,
        `Mark “${assessment?.title ?? 'this assessment'}” as complete?`,
        async () => {
          setBusyAction('completeAssessment')
          setMessage(null)
          const input: CompleteAssessmentInput = {
            assessmentId: assessmentToComplete,
            completedAt: new Date().toISOString(),
          }

          try {
            await clientQuery(COMPLETE_ASSESSMENT_MUTATION, { input })
            setMessage({
              type: 'success',
              text: 'Assessment marked complete. The assessment list will now refresh.',
            })
            refreshAfterSuccess()
          } catch {
            setMessage({
              type: 'error',
              text: 'The assessment could not be completed. Check your connection and try again.',
            })
          } finally {
            setBusyAction(null)
          }
        },
      ),
    )
  }

  async function approveCarePlan() {
    if (!planToApprove) return
    const plan = carePlans.find((record) => record.id === planToApprove)

    await runSingleFlightAction(consequentialActionStartedRef, () =>
      runConfirmedAction(
        window.confirm,
        `Activate “${plan?.title ?? 'this care plan'}”? Any current active plan will be superseded.`,
        async () => {
          setBusyAction('approveCarePlan')
          setMessage(null)
          const input: ApproveCarePlanInput = {
            carePlanId: planToApprove,
            approvedAt: new Date().toISOString(),
            effectiveFrom: new Date().toISOString(),
          }

          try {
            await clientQuery(APPROVE_CARE_PLAN_MUTATION, { input })
            setMessage({
              type: 'success',
              text: 'Care plan activated. Any previous active plan has been superseded.',
            })
            refreshAfterSuccess()
          } catch {
            setMessage({
              type: 'error',
              text: 'The care plan could not be activated. Check your connection and try again.',
            })
          } finally {
            setBusyAction(null)
          }
        },
      ),
    )
  }

  async function archiveCarePlan() {
    if (!planToArchive) return
    const plan = carePlans.find((record) => record.id === planToArchive)

    await runSingleFlightAction(consequentialActionStartedRef, () =>
      runConfirmedAction(
        window.confirm,
        `Archive “${plan?.title ?? 'this care plan'}”? It will remain in the version history.`,
        async () => {
          setBusyAction('archiveCarePlan')
          setMessage(null)
          const input: ArchiveCarePlanInput = {
            carePlanId: planToArchive,
            effectiveTo: new Date().toISOString(),
          }

          try {
            await clientQuery(ARCHIVE_CARE_PLAN_MUTATION, { input })
            setMessage({
              type: 'success',
              text: 'Care plan archived. The version history will now refresh.',
            })
            refreshAfterSuccess()
          } catch {
            setMessage({
              type: 'error',
              text: 'The care plan could not be archived. Check your connection and try again.',
            })
          } finally {
            setBusyAction(null)
          }
        },
      ),
    )
  }

  return (
    <section className="mt-8 space-y-8" aria-labelledby="care-planning-actions-heading">
      <div>
        <h2
          id="care-planning-actions-heading"
          className="font-heading text-xl font-bold text-oasis-ink"
        >
          Add care-planning records
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-oasis-muted">
          Add only information that has been reviewed for this client. Empty
          structured fields stay empty until they are recorded through the
          appropriate assessment or plan workflow.
        </p>
      </div>

      {message ? (
        <Alert
          tone={message.type === 'success' ? 'success' : 'danger'}
          live
        >
          {message.text}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="rounded-md border border-oasis-border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submitAssessment()
          }}
        >
          <h3 className="font-heading text-lg font-semibold text-oasis-ink">
            Create assessment
          </h3>
          <label
            htmlFor="assessment-title"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Assessment title
          </label>
          <input
            id="assessment-title"
            required
            value={assessmentTitle}
            onChange={(event) => setAssessmentTitle(event.target.value)}
            className={controlClassName}
          />
          <label
            htmlFor="assessment-summary"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Summary
          </label>
          <textarea
            id="assessment-summary"
            value={assessmentSummary}
            onChange={(event) => setAssessmentSummary(event.target.value)}
            className={controlClassName}
            rows={4}
          />
          <label
            htmlFor="assessment-review-date"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Review due
          </label>
          <input
            id="assessment-review-date"
            type="date"
            value={assessmentReviewDueAt}
            onChange={(event) => setAssessmentReviewDueAt(event.target.value)}
            className={controlClassName}
          />
          <Button
            type="submit"
            className="mt-5 w-full sm:w-auto"
            disabled={busyAction !== null || !assessmentTitle.trim()}
          >
            {busyAction === 'assessment'
              ? 'Creating assessment…'
              : 'Create assessment'}
          </Button>
        </form>

        <form
          className="rounded-md border border-oasis-border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submitCarePlan()
          }}
        >
          <h3 className="font-heading text-lg font-semibold text-oasis-ink">
            Create care plan draft
          </h3>
          <label
            htmlFor="care-plan-title"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Care plan title
          </label>
          <input
            id="care-plan-title"
            required
            value={carePlanTitle}
            onChange={(event) => setCarePlanTitle(event.target.value)}
            className={controlClassName}
          />
          <label
            htmlFor="care-plan-assessment"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Linked assessment (optional)
          </label>
          <select
            id="care-plan-assessment"
            value={carePlanAssessmentId}
            onChange={(event) => setCarePlanAssessmentId(event.target.value)}
            className={controlClassName}
          >
            <option value="">No linked assessment</option>
            {assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title} ({assessment.status.toLowerCase()})
              </option>
            ))}
          </select>
          <label
            htmlFor="care-plan-safety-notes"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Safety notes
          </label>
          <textarea
            id="care-plan-safety-notes"
            value={carePlanSafetyNotes}
            onChange={(event) => setCarePlanSafetyNotes(event.target.value)}
            className={controlClassName}
            rows={4}
          />
          <label
            htmlFor="care-plan-review-date"
            className="mt-4 block text-sm font-medium text-oasis-ink"
          >
            Review due
          </label>
          <input
            id="care-plan-review-date"
            type="date"
            value={carePlanReviewDueAt}
            onChange={(event) => setCarePlanReviewDueAt(event.target.value)}
            className={controlClassName}
          />
          <Button
            type="submit"
            className="mt-5 w-full sm:w-auto"
            disabled={busyAction !== null || !carePlanTitle.trim()}
          >
            {busyAction === 'carePlan'
              ? 'Creating care plan draft…'
              : 'Create care plan draft'}
          </Button>
        </form>
      </div>

      <section aria-labelledby="review-care-planning-heading">
        <h2
          id="review-care-planning-heading"
          className="font-heading text-xl font-bold text-oasis-ink"
        >
          Review care planning
        </h2>
        <p className="mt-2 text-sm leading-6 text-oasis-muted">
          Select the exact record before completing, activating, or archiving
          it. You will be asked to confirm the action.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-oasis-border bg-white p-4">
            <label
              htmlFor="assessment-to-complete"
              className="block text-sm font-semibold text-oasis-ink"
            >
              Complete assessment
            </label>
            <select
              id="assessment-to-complete"
              value={assessmentToComplete}
              onChange={(event) => setAssessmentToComplete(event.target.value)}
              className={controlClassName}
            >
              <option value="">Choose assessment</option>
              {assessments
                .filter((assessment) => assessment.status !== 'COMPLETED')
                .map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title} ({assessment.status.toLowerCase()})
                  </option>
                ))}
            </select>
            <Button
              type="button"
              className="mt-4 w-full"
              disabled={busyAction !== null || !assessmentToComplete}
              onClick={() => void completeAssessment()}
            >
              {busyAction === 'completeAssessment'
                ? 'Completing assessment…'
                : 'Mark complete'}
            </Button>
          </div>

          <div className="rounded-md border border-oasis-border bg-white p-4">
            <label
              htmlFor="plan-to-activate"
              className="block text-sm font-semibold text-oasis-ink"
            >
              Activate care plan
            </label>
            <select
              id="plan-to-activate"
              value={planToApprove}
              onChange={(event) => setPlanToApprove(event.target.value)}
              className={controlClassName}
            >
              <option value="">Choose care plan</option>
              {carePlans
                .filter((plan) => plan.status !== 'ARCHIVED')
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    v{plan.version} {plan.title} ({plan.status.toLowerCase()})
                  </option>
                ))}
            </select>
            <Button
              type="button"
              className="mt-4 w-full"
              disabled={busyAction !== null || !planToApprove}
              onClick={() => void approveCarePlan()}
            >
              {busyAction === 'approveCarePlan'
                ? 'Activating care plan…'
                : 'Activate care plan'}
            </Button>
          </div>

          <div className="rounded-md border border-oasis-border bg-white p-4">
            <label
              htmlFor="plan-to-archive"
              className="block text-sm font-semibold text-oasis-ink"
            >
              Archive care plan
            </label>
            <select
              id="plan-to-archive"
              value={planToArchive}
              onChange={(event) => setPlanToArchive(event.target.value)}
              className={controlClassName}
            >
              <option value="">Choose care plan</option>
              {carePlans
                .filter((plan) => plan.status !== 'ARCHIVED')
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    v{plan.version} {plan.title} ({plan.status.toLowerCase()})
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              disabled={busyAction !== null || !planToArchive}
              onClick={() => void archiveCarePlan()}
            >
              {busyAction === 'archiveCarePlan'
                ? 'Archiving care plan…'
                : 'Archive care plan'}
            </Button>
          </div>
        </div>
      </section>
    </section>
  )
}
