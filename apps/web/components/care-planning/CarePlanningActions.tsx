'use client'

import { useState } from 'react'
import { EvidenceSourcePicker } from './EvidenceSourcePicker'
import { clientQuery } from '../../lib/graphql/client-side'
import {
  APPROVE_CARE_PLAN_MUTATION,
  ARCHIVE_CARE_PLAN_MUTATION,
  COMPLETE_ASSESSMENT_MUTATION,
  CREATE_ASSESSMENT_MUTATION,
  CREATE_CARE_PLAN_MUTATION,
  CREATE_EVIDENCE_PACK_MUTATION,
  type ApproveCarePlanInput,
  type ArchiveCarePlanInput,
  type AssessmentRecord,
  type CarePlanRecord,
  type CompleteAssessmentInput,
  type CreateAssessmentInput,
  type CreateCarePlanInput,
  type CreateEvidencePackInput,
  type EvidenceSourceCandidateRecord,
} from '../../lib/graphql/queries'
import { getOrganizationDateUtcRange } from '../../lib/time'

interface CarePlanningActionsProps {
  clientId: string
  assessments: AssessmentRecord[]
  carePlans: CarePlanRecord[]
  onCompleteRedirectPath: string
}

function toIsoDateEnd(value: string): string {
  const range = getOrganizationDateUtcRange(value)
  return new Date(new Date(range.end).getTime() - 1).toISOString()
}

function toIsoDateStart(value: string): string {
  return getOrganizationDateUtcRange(value).start
}

export function CarePlanningActions({ clientId, assessments, carePlans, onCompleteRedirectPath }: CarePlanningActionsProps) {
  const [assessmentTitle, setAssessmentTitle] = useState('')
  const [assessmentSummary, setAssessmentSummary] = useState('')
  const [assessmentReviewDueAt, setAssessmentReviewDueAt] = useState('')
  const [carePlanTitle, setCarePlanTitle] = useState('')
  const [carePlanSafetyNotes, setCarePlanSafetyNotes] = useState('')
  const [carePlanAssessmentId, setCarePlanAssessmentId] = useState('')
  const [carePlanReviewDueAt, setCarePlanReviewDueAt] = useState('')
  const [evidenceKind, setEvidenceKind] = useState('INSPECTION')
  const [evidencePeriodStart, setEvidencePeriodStart] = useState('')
  const [evidencePeriodEnd, setEvidencePeriodEnd] = useState('')
  const [evidencePlanId, setEvidencePlanId] = useState('')
  const [selectedEvidenceAssessmentIds, setSelectedEvidenceAssessmentIds] = useState<string[]>([])
  const [selectedEvidenceCarePlanIds, setSelectedEvidenceCarePlanIds] = useState<string[]>([])
  const [selectedOperationalEvidenceSources, setSelectedOperationalEvidenceSources] = useState<EvidenceSourceCandidateRecord[]>([])
  const [assessmentToComplete, setAssessmentToComplete] = useState('')
  const [planToApprove, setPlanToApprove] = useState('')
  const [planToArchive, setPlanToArchive] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function toggleSelection(id: string, selectedIds: string[], setSelectedIds: (next: string[]) => void) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((itemId) => itemId !== id) : [...selectedIds, id])
  }

  function buildEvidenceItems(): CreateEvidencePackInput['items'] {
    const items: CreateEvidencePackInput['items'] = []
    const planIds = Array.from(new Set([evidencePlanId, ...selectedEvidenceCarePlanIds].filter(Boolean)))
    const selectedPlans = carePlans.filter((plan) => planIds.includes(plan.id))
    const selectedAssessmentIds = new Set(selectedEvidenceAssessmentIds)

    selectedPlans.forEach((selectedPlan) => {
      items.push({
        sourceType: 'CARE_PLAN',
        sourceId: selectedPlan.id,
        occurredAt: selectedPlan.approvedAt ?? selectedPlan.effectiveFrom ?? selectedPlan.createdAt,
        headline: `Care plan evidence: ${selectedPlan.title}`,
        detail: `Version ${selectedPlan.version} care plan captured as a governed evidence source.`,
        metadata: {
          status: selectedPlan.status,
          version: selectedPlan.version,
          reviewDueAt: selectedPlan.reviewDueAt,
        },
      })
      if (selectedPlan.assessmentId) {
        selectedAssessmentIds.add(selectedPlan.assessmentId)
      }
    })

    Array.from(selectedAssessmentIds)
      .map((assessmentId) => assessments.find((assessment) => assessment.id === assessmentId))
      .filter((assessment): assessment is AssessmentRecord => Boolean(assessment))
      .forEach((assessment) => {
        items.push({
          sourceType: 'ASSESSMENT',
          sourceId: assessment.id,
          occurredAt: assessment.completedAt ?? assessment.createdAt,
          headline: `Assessment evidence: ${assessment.title}`,
          detail: assessment.summary ?? 'Selected assessment captured as governed evidence source.',
          metadata: {
            status: assessment.status,
            source: assessment.source,
            reviewDueAt: assessment.reviewDueAt,
          },
        })
      })

    selectedOperationalEvidenceSources.forEach((source) => {
      items.push({
        sourceType: source.sourceType,
        sourceId: source.id,
        occurredAt: source.occurredAt,
        headline: source.title,
        detail: [source.subtitle, source.previewText].filter(Boolean).join(' · ') || undefined,
        metadata: {
          source: 'evidence-source-picker',
          status: source.status,
          createdBy: source.createdBy,
          sourceType: source.sourceType,
        },
      })
    })

    items.push({
      sourceType: 'MANUAL_NOTE',
      headline: selectedPlans.length
        ? 'Evidence pack created with selected care-planning sources'
        : 'Evidence pack created from care planning dashboard',
      detail:
        selectedOperationalEvidenceSources.length > 0
          ? 'Evidence pack includes selected operational sources from the staff-only evidence source picker.'
          : 'Evidence pack created from care planning dashboard. Add operational sources when recorded evidence is available.',
      metadata: {
        source: 'care-planning-ui',
        selectedCarePlanId: evidencePlanId || null,
        selectedCarePlanIds: planIds,
        selectedAssessmentIds: Array.from(selectedAssessmentIds),
        selectedOperationalSources: selectedOperationalEvidenceSources.map((source) => ({
          id: source.id,
          sourceType: source.sourceType,
        })),
      },
    })

    return items
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
      findings: { baseline: 'Initial assessment created from care planning workspace.' },
      riskFlags: {},
      recommendedActions: {},
      reviewDueAt: assessmentReviewDueAt ? toIsoDateEnd(assessmentReviewDueAt) : undefined,
    }

    try {
      await clientQuery(CREATE_ASSESSMENT_MUTATION, { input })
      setMessage({ type: 'success', text: 'Assessment created. Refreshing to load the latest record.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Assessment could not be created yet: ${error.message}`
            : 'Assessment could not be created yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function submitCarePlan() {
    setBusyAction('carePlan')
    setMessage(null)
    const input: CreateCarePlanInput = {
      clientId,
      assessmentId: carePlanAssessmentId || undefined,
      status: 'DRAFT',
      version: 1,
      title: carePlanTitle.trim(),
      goals: { primaryGoal: 'Draft goals captured for manager review.' },
      interventions: { initialIntervention: 'Care actions to be refined before activation.' },
      safetyNotes: carePlanSafetyNotes.trim() || undefined,
      effectiveFrom: new Date().toISOString(),
      reviewDueAt: carePlanReviewDueAt ? toIsoDateEnd(carePlanReviewDueAt) : undefined,
    }

    try {
      await clientQuery(CREATE_CARE_PLAN_MUTATION, { input })
      setMessage({ type: 'success', text: 'Care plan draft created. Refreshing to show version state.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Care plan could not be created yet: ${error.message}`
            : 'Care plan could not be created yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function submitEvidencePack() {
    setBusyAction('evidencePack')
    setMessage(null)
    const input: CreateEvidencePackInput = {
      clientId,
      carePlanId: evidencePlanId || undefined,
      status: 'DRAFT',
      kind: evidenceKind.trim() || 'INSPECTION',
      periodStart: toIsoDateStart(evidencePeriodStart),
      periodEnd: toIsoDateEnd(evidencePeriodEnd),
      sourceRefs: { source: 'care-planning-ui' },
      summary: { note: 'Inspection-ready evidence pack draft.' },
      items: buildEvidenceItems(),
    }

    try {
      await clientQuery(CREATE_EVIDENCE_PACK_MUTATION, { input })
      setMessage({ type: 'success', text: 'Evidence pack draft created. Refreshing dashboard now.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Evidence pack could not be created yet: ${error.message}`
            : 'Evidence pack could not be created yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function completeAssessment() {
    if (!assessmentToComplete) return

    setBusyAction('completeAssessment')
    setMessage(null)
    const input: CompleteAssessmentInput = {
      assessmentId: assessmentToComplete,
      completedAt: new Date().toISOString(),
    }

    try {
      await clientQuery(COMPLETE_ASSESSMENT_MUTATION, { input })
      setMessage({ type: 'success', text: 'Assessment marked complete. Refreshing care spine.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Assessment could not be completed yet: ${error.message}`
            : 'Assessment could not be completed yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function approveCarePlan() {
    if (!planToApprove) return

    setBusyAction('approveCarePlan')
    setMessage(null)
    const input: ApproveCarePlanInput = {
      carePlanId: planToApprove,
      approvedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
    }

    try {
      await clientQuery(APPROVE_CARE_PLAN_MUTATION, { input })
      setMessage({ type: 'success', text: 'Care plan approved and activated. Previous active plans are superseded.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Care plan could not be approved yet: ${error.message}`
            : 'Care plan could not be approved yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function archiveCarePlan() {
    if (!planToArchive) return

    setBusyAction('archiveCarePlan')
    setMessage(null)
    const input: ArchiveCarePlanInput = {
      carePlanId: planToArchive,
      effectiveTo: new Date().toISOString(),
    }

    try {
      await clientQuery(ARCHIVE_CARE_PLAN_MUTATION, { input })
      setMessage({ type: 'success', text: 'Care plan archived. Refreshing version history.' })
      setTimeout(() => window.location.assign(onCompleteRedirectPath), 700)
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? `Care plan could not be archived yet: ${error.message}`
            : 'Care plan could not be archived yet.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-bold text-slate-950">Assess, Plan, Prove actions</h2>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Person-scoped actions</p>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Create assessment records, draft care plans, and evidence packs from this person context. This creates
        inspection-ready evidence records and does not guarantee compliance outcomes.
      </p>
      {message && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Assess</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">Assessment title</label>
          <input value={assessmentTitle} onChange={(e) => setAssessmentTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="mt-3 block text-sm font-medium text-slate-700">Summary</label>
          <textarea value={assessmentSummary} onChange={(e) => setAssessmentSummary(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
          <label className="mt-3 block text-sm font-medium text-slate-700">Review due</label>
          <input type="date" value={assessmentReviewDueAt} onChange={(e) => setAssessmentReviewDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button disabled={busyAction !== null || !assessmentTitle.trim()} onClick={submitAssessment} className="mt-4 w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busyAction === 'assessment' ? 'Creating...' : 'Create assessment'}
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Plan</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">Care-plan title</label>
          <input value={carePlanTitle} onChange={(e) => setCarePlanTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="mt-3 block text-sm font-medium text-slate-700">Linked assessment (optional)</label>
          <input value={carePlanAssessmentId} onChange={(e) => setCarePlanAssessmentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Assessment ID" />
          <label className="mt-3 block text-sm font-medium text-slate-700">Safety notes</label>
          <textarea value={carePlanSafetyNotes} onChange={(e) => setCarePlanSafetyNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
          <label className="mt-3 block text-sm font-medium text-slate-700">Review due</label>
          <input type="date" value={carePlanReviewDueAt} onChange={(e) => setCarePlanReviewDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button disabled={busyAction !== null || !carePlanTitle.trim()} onClick={submitCarePlan} className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busyAction === 'carePlan' ? 'Creating...' : 'Create care plan draft'}
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Prove</p>
          <label className="mt-3 block text-sm font-medium text-slate-700">Pack kind</label>
          <input value={evidenceKind} onChange={(e) => setEvidenceKind(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="mt-3 block text-sm font-medium text-slate-700">Linked care plan (optional)</label>
          <select
            value={evidencePlanId}
            onChange={(e) => {
              const nextPlanId = e.target.value
              setEvidencePlanId(nextPlanId)
              if (nextPlanId && !selectedEvidenceCarePlanIds.includes(nextPlanId)) {
                setSelectedEvidenceCarePlanIds([...selectedEvidenceCarePlanIds, nextPlanId])
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">No linked care plan</option>
            {carePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                v{plan.version} {plan.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Linking a care plan anchors this pack to care-planning governance and includes that plan as evidence.
          </p>
          <fieldset className="mt-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Include care-plan versions</legend>
            <div className="mt-2 max-h-28 space-y-2 overflow-y-auto pr-1">
              {carePlans.length === 0 ? (
                <p className="text-xs text-slate-500">No care plans available yet.</p>
              ) : (
                carePlans.map((plan) => (
                  <label key={plan.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedEvidenceCarePlanIds.includes(plan.id)}
                      onChange={() => toggleSelection(plan.id, selectedEvidenceCarePlanIds, setSelectedEvidenceCarePlanIds)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span>
                      v{plan.version} {plan.title} ({plan.status.toLowerCase()})
                    </span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
          <fieldset className="mt-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Include assessments</legend>
            <div className="mt-2 max-h-28 space-y-2 overflow-y-auto pr-1">
              {assessments.length === 0 ? (
                <p className="text-xs text-slate-500">No assessments available yet.</p>
              ) : (
                assessments.map((assessment) => (
                  <label key={assessment.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedEvidenceAssessmentIds.includes(assessment.id)}
                      onChange={() =>
                        toggleSelection(assessment.id, selectedEvidenceAssessmentIds, setSelectedEvidenceAssessmentIds)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span>
                      {assessment.title} ({assessment.status.toLowerCase()})
                    </span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-slate-500">
            Visits, care notes, medication exceptions, and concerns will be added in the source picker once those list
            queries are wired.
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">Period start</label>
          <input type="date" value={evidencePeriodStart} onChange={(e) => setEvidencePeriodStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="mt-3 block text-sm font-medium text-slate-700">Period end</label>
          <input type="date" value={evidencePeriodEnd} onChange={(e) => setEvidencePeriodEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          {evidencePeriodStart && evidencePeriodEnd && (
            <EvidenceSourcePicker
              clientId={clientId}
              periodStart={evidencePeriodStart}
              periodEnd={evidencePeriodEnd}
              selectedSources={selectedOperationalEvidenceSources}
              onSelectedSourcesChange={setSelectedOperationalEvidenceSources}
              disabled={busyAction !== null}
            />
          )}
          <button disabled={busyAction !== null || !evidencePeriodStart || !evidencePeriodEnd} onClick={submitEvidencePack} className="mt-4 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busyAction === 'evidencePack' ? 'Creating...' : 'Create evidence pack'}
          </button>
        </article>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Review</p>
          <h3 className="mt-1 font-semibold text-slate-950">Complete assessment</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Mark a draft or in-review assessment as complete before it informs care-plan approval.
          </p>
          <select
            value={assessmentToComplete}
            onChange={(event) => setAssessmentToComplete(event.target.value)}
            className="mt-3 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Choose assessment</option>
            {assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title} ({assessment.status.toLowerCase()})
              </option>
            ))}
          </select>
          <button
            disabled={busyAction !== null || !assessmentToComplete}
            onClick={completeAssessment}
            className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'completeAssessment' ? 'Completing...' : 'Mark complete'}
          </button>
        </article>

        <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Approve</p>
          <h3 className="mt-1 font-semibold text-slate-950">Activate care plan</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Approving a plan makes it active and supersedes any previous active plan for this person.
          </p>
          <select
            value={planToApprove}
            onChange={(event) => setPlanToApprove(event.target.value)}
            className="mt-3 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
          <button
            disabled={busyAction !== null || !planToApprove}
            onClick={approveCarePlan}
            className="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'approveCarePlan' ? 'Approving...' : 'Approve and activate'}
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Archive</p>
          <h3 className="mt-1 font-semibold text-slate-950">Archive care plan</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Archive plans that are no longer used while preserving version history for evidence.
          </p>
          <select
            value={planToArchive}
            onChange={(event) => setPlanToArchive(event.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
          <button
            disabled={busyAction !== null || !planToArchive}
            onClick={archiveCarePlan}
            className="mt-3 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'archiveCarePlan' ? 'Archiving...' : 'Archive plan'}
          </button>
        </article>
      </div>
    </section>
  )
}
