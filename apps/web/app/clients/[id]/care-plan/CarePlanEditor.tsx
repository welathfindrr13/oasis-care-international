'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '../../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card';
import { clientQuery } from '../../../../lib/graphql/client-side';
import {
  type CarePlanAuditEntry,
  type CarePlan,
  type CarePlanContent,
  type CarePlanRiskAndRedFlagItem,
  type CarePlanVersion,
  type Client,
} from '../../../../lib/graphql/queries';
import {
  EMPTY_CARE_PLAN_CONTENT,
  formatCarePlanAuditAction,
  formatCarePlanChangedSections,
  formatCarePlanDate,
  getCarePlanHighlights,
  listToMultiline,
  multilineToList,
  toDateInputValue,
} from '../../../../lib/care-plan';
import { formatDateTime } from '../../../../lib/time';

const SAVE_CARE_PLAN_DRAFT_MUTATION = `
  mutation SaveCarePlanDraft($input: SaveCarePlanDraftInput!) {
    saveCarePlanDraft(input: $input) {
      id
      carePlanId
      versionNumber
      status
      reviewDueAt
      effectiveFrom
    }
  }
`;

const PUBLISH_CARE_PLAN_DRAFT_MUTATION = `
  mutation PublishCarePlanDraft($carePlanId: ID!) {
    publishCarePlanDraft(carePlanId: $carePlanId) {
      id
      carePlanId
      versionNumber
      status
      approvedAt
    }
  }
`;

const DISCARD_CARE_PLAN_DRAFT_MUTATION = `
  mutation DiscardCarePlanDraft($carePlanId: ID!) {
    discardCarePlanDraft(carePlanId: $carePlanId) {
      id
    }
  }
`;

interface CarePlanEditorProps {
  client: Client;
  carePlan: CarePlan | null;
  history: CarePlanVersion[];
  auditHistory: CarePlanAuditEntry[];
}

function cloneEmptyContent(): CarePlanContent {
  return JSON.parse(JSON.stringify(EMPTY_CARE_PLAN_CONTENT)) as CarePlanContent;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500';
}

function textareaClassName() {
  return `${inputClassName()} min-h-[96px]`;
}

export default function CarePlanEditor({ client, carePlan, history, auditHistory }: CarePlanEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceVersion = useMemo(
    () => carePlan?.draftVersion ?? carePlan?.activeVersion ?? null,
    [carePlan]
  );

  const [reviewDueAt, setReviewDueAt] = useState(toDateInputValue(sourceVersion?.reviewDueAt));
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInputValue(sourceVersion?.effectiveFrom));
  const [content, setContent] = useState<CarePlanContent>(sourceVersion?.content ?? cloneEmptyContent());

  const hasDraft = Boolean(carePlan?.draftVersion);
  const activeVersion = carePlan?.activeVersion ?? null;
  const highlights = useMemo(() => getCarePlanHighlights(activeVersion), [activeVersion]);

  function setSection<K extends keyof CarePlanContent>(section: K, value: CarePlanContent[K]) {
    setContent((current) => ({
      ...current,
      [section]: value,
    }));
  }

  function setRiskItems(items: CarePlanRiskAndRedFlagItem[]) {
    setSection('risksAndRedFlags', { items });
  }

  async function handleSaveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await clientQuery(SAVE_CARE_PLAN_DRAFT_MUTATION, {
        input: {
          clientId: client.id,
          reviewDueAt: reviewDueAt || undefined,
          effectiveFrom: effectiveFrom || undefined,
          content,
        },
      });

      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to save the draft care plan right now.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!carePlan?.id || !hasDraft) {
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      await clientQuery(PUBLISH_CARE_PLAN_DRAFT_MUTATION, { carePlanId: carePlan.id });
      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to publish the draft care plan right now.');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDiscard() {
    if (!carePlan?.id || !hasDraft) {
      return;
    }

    setIsDiscarding(true);
    setError(null);

    try {
      await clientQuery(DISCARD_CARE_PLAN_DRAFT_MUTATION, { carePlanId: carePlan.id });
      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to discard the open draft right now.');
    } finally {
      setIsDiscarding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Care plan status</h2>
              <p className="text-sm text-slate-500">
                Published guidance stays immutable. Draft work stays separate until staff approve and publish the next version.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/clients/${client.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Back to client
              </Link>
              <Button type="submit" form="care-plan-form" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving draft...' : hasDraft ? 'Save Draft Changes' : 'Create Draft'}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!hasDraft || isPublishing} onClick={handlePublish}>
                {isPublishing ? 'Publishing...' : 'Publish Care Plan'}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={!hasDraft || isDiscarding} onClick={handleDiscard}>
                {isDiscarding ? 'Discarding...' : 'Discard Draft'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active version</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {activeVersion ? `Version ${activeVersion.versionNumber}` : 'None published'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {activeVersion?.approvedAt
                ? `Approved ${formatCarePlanDate(activeVersion.approvedAt)} and ready for visit guidance.`
                : 'Publish the first care plan when the draft is ready.'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open draft</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {carePlan?.draftVersion ? `Version ${carePlan.draftVersion.versionNumber}` : 'No draft in progress'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {carePlan?.draftVersion
                ? 'Draft edits stay internal until you publish the next approved version.'
                : 'Saving here will create the next draft without touching the active plan.'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review schedule</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{reviewDueAt ? formatCarePlanDate(reviewDueAt) : 'Not set'}</p>
            <p className="mt-1 text-sm text-slate-500">
              Effective from {effectiveFrom ? formatCarePlanDate(effectiveFrom) : 'not set'}.
            </p>
          </div>
        </CardContent>
      </Card>

      {activeVersion && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Current care guidance at a glance</h2>
            <p className="text-sm text-slate-500">
              These are the guidance themes carers will see in the visit workspace from the active version.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => (
              <div key={highlight.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{highlight.label}</p>
                <p className="mt-2 text-sm text-slate-700">{highlight.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form id="care-plan-form" onSubmit={handleSaveDraft} className="space-y-6">
        <Section title="Review dates" description="Drafts need both an effective date and a review date before they can be published.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Review due date">
              <input type="date" value={reviewDueAt} onChange={(event) => setReviewDueAt(event.target.value)} className={inputClassName()} />
            </Field>
            <Field label="Effective from">
              <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className={inputClassName()} />
            </Field>
          </div>
        </Section>

        <Section title="Overview" description="Summarise the client, their strengths, and what good support looks like day to day.">
          <Field label="Care overview">
            <textarea
              value={content.overview.summary}
              onChange={(event) => setSection('overview', { ...content.overview, summary: event.target.value })}
              className={textareaClassName()}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Strengths (one per line)">
              <textarea
                value={listToMultiline(content.overview.strengths)}
                onChange={(event) => setSection('overview', { ...content.overview, strengths: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
            <Field label="Preferences (one per line)">
              <textarea
                value={listToMultiline(content.overview.preferences)}
                onChange={(event) => setSection('overview', { ...content.overview, preferences: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Goals and outcomes" description="Keep the goals practical enough for carers and coordinators to act on.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Goals (one per line)">
              <textarea
                value={listToMultiline(content.goalsAndOutcomes.goals)}
                onChange={(event) => setSection('goalsAndOutcomes', { ...content.goalsAndOutcomes, goals: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
            <Field label="Desired outcomes (one per line)">
              <textarea
                value={listToMultiline(content.goalsAndOutcomes.desiredOutcomes)}
                onChange={(event) =>
                  setSection('goalsAndOutcomes', {
                    ...content.goalsAndOutcomes,
                    desiredOutcomes: multilineToList(event.target.value),
                  })
                }
                className={textareaClassName()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Daily routine" description="Describe the expected support across the London care day.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Morning">
              <textarea value={content.dailyRoutines.morning} onChange={(event) => setSection('dailyRoutines', { ...content.dailyRoutines, morning: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Midday">
              <textarea value={content.dailyRoutines.midday} onChange={(event) => setSection('dailyRoutines', { ...content.dailyRoutines, midday: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Evening">
              <textarea value={content.dailyRoutines.evening} onChange={(event) => setSection('dailyRoutines', { ...content.dailyRoutines, evening: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Overnight">
              <textarea value={content.dailyRoutines.overnight} onChange={(event) => setSection('dailyRoutines', { ...content.dailyRoutines, overnight: event.target.value })} className={textareaClassName()} />
            </Field>
          </div>
        </Section>

        <Section title="Personal care and mobility" description="Record hands-on support guidance without turning this into a full clinical assessment tool.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bathing">
              <textarea value={content.personalCareSupport.bathing} onChange={(event) => setSection('personalCareSupport', { ...content.personalCareSupport, bathing: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Dressing">
              <textarea value={content.personalCareSupport.dressing} onChange={(event) => setSection('personalCareSupport', { ...content.personalCareSupport, dressing: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Toileting">
              <textarea value={content.personalCareSupport.toileting} onChange={(event) => setSection('personalCareSupport', { ...content.personalCareSupport, toileting: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Grooming">
              <textarea value={content.personalCareSupport.grooming} onChange={(event) => setSection('personalCareSupport', { ...content.personalCareSupport, grooming: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Mobility summary">
              <textarea value={content.mobilityAndTransfers.mobilitySummary} onChange={(event) => setSection('mobilityAndTransfers', { ...content.mobilityAndTransfers, mobilitySummary: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Transfer guidance">
              <textarea value={content.mobilityAndTransfers.transferGuidance} onChange={(event) => setSection('mobilityAndTransfers', { ...content.mobilityAndTransfers, transferGuidance: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Equipment (one per line)">
              <textarea
                value={listToMultiline(content.mobilityAndTransfers.equipment)}
                onChange={(event) => setSection('mobilityAndTransfers', { ...content.mobilityAndTransfers, equipment: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Nutrition, hydration, and medication support" description="Keep nutrition and medication guidance operational so carers know what level of support is expected.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nutrition summary">
              <textarea value={content.nutritionAndHydration.nutritionSummary} onChange={(event) => setSection('nutritionAndHydration', { ...content.nutritionAndHydration, nutritionSummary: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Hydration support">
              <textarea value={content.nutritionAndHydration.hydrationSupport} onChange={(event) => setSection('nutritionAndHydration', { ...content.nutritionAndHydration, hydrationSupport: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Dietary needs (one per line)">
              <textarea
                value={listToMultiline(content.nutritionAndHydration.dietaryNeeds)}
                onChange={(event) => setSection('nutritionAndHydration', { ...content.nutritionAndHydration, dietaryNeeds: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
            <Field label="Medication support level">
              <textarea value={content.medicationSupport.levelOfSupport} onChange={(event) => setSection('medicationSupport', { ...content.medicationSupport, levelOfSupport: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Key medication instructions">
              <textarea value={content.medicationSupport.keyInstructions} onChange={(event) => setSection('medicationSupport', { ...content.medicationSupport, keyInstructions: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Refusal escalation">
              <textarea value={content.medicationSupport.refusalEscalation} onChange={(event) => setSection('medicationSupport', { ...content.medicationSupport, refusalEscalation: event.target.value })} className={textareaClassName()} />
            </Field>
          </div>
        </Section>

        <Section title="Communication and accessibility" description="Keep communication approach and reasonable adjustments visible to carers before they enter the home.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Communication approach">
              <textarea value={content.communicationAndAccessibility.communicationApproach} onChange={(event) => setSection('communicationAndAccessibility', { ...content.communicationAndAccessibility, communicationApproach: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Communication needs (one per line)">
              <textarea
                value={listToMultiline(content.communicationAndAccessibility.communicationNeeds)}
                onChange={(event) => setSection('communicationAndAccessibility', { ...content.communicationAndAccessibility, communicationNeeds: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
            <Field label="Accessibility adjustments (one per line)">
              <textarea
                value={listToMultiline(content.communicationAndAccessibility.accessibilityAdjustments)}
                onChange={(event) => setSection('communicationAndAccessibility', { ...content.communicationAndAccessibility, accessibilityAdjustments: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
          </div>
        </Section>

        <Section title="Risks and escalation" description="Capture the red flags carers should actively watch for and what to do next.">
          <div className="space-y-4">
            {content.risksAndRedFlags.items.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No specific risks have been listed yet.
              </div>
            )}
            {content.risksAndRedFlags.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Risk or red flag">
                    <input
                      value={item.title}
                      onChange={(event) =>
                        setRiskItems(content.risksAndRedFlags.items.map((riskItem, riskIndex) => riskIndex === index ? { ...riskItem, title: event.target.value } : riskItem))
                      }
                      className={inputClassName()}
                    />
                  </Field>
                  <Field label="Guidance">
                    <textarea
                      value={item.guidance}
                      onChange={(event) =>
                        setRiskItems(content.risksAndRedFlags.items.map((riskItem, riskIndex) => riskIndex === index ? { ...riskItem, guidance: event.target.value } : riskItem))
                      }
                      className={textareaClassName()}
                    />
                  </Field>
                  <Field label="Escalation trigger">
                    <textarea
                      value={item.escalationTrigger ?? ''}
                      onChange={(event) =>
                        setRiskItems(content.risksAndRedFlags.items.map((riskItem, riskIndex) => riskIndex === index ? { ...riskItem, escalationTrigger: event.target.value || undefined } : riskItem))
                      }
                      className={textareaClassName()}
                    />
                  </Field>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRiskItems(content.risksAndRedFlags.items.filter((_, riskIndex) => riskIndex !== index))}>
                    Remove risk
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRiskItems([...content.risksAndRedFlags.items, { title: '', guidance: '', escalationTrigger: undefined }])}>
              Add risk or red flag
            </Button>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contingency summary">
                <textarea value={content.contingencyAndEscalation.summary} onChange={(event) => setSection('contingencyAndEscalation', { ...content.contingencyAndEscalation, summary: event.target.value })} className={textareaClassName()} />
              </Field>
              <Field label="Actions (one per line)">
                <textarea
                  value={listToMultiline(content.contingencyAndEscalation.actions)}
                  onChange={(event) => setSection('contingencyAndEscalation', { ...content.contingencyAndEscalation, actions: multilineToList(event.target.value) })}
                  className={textareaClassName()}
                />
              </Field>
              <Field label="Escalation triggers (one per line)">
                <textarea
                  value={listToMultiline(content.contingencyAndEscalation.escalationTriggers)}
                  onChange={(event) => setSection('contingencyAndEscalation', { ...content.contingencyAndEscalation, escalationTriggers: multilineToList(event.target.value) })}
                  className={textareaClassName()}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Representatives and involvement" description="Capture who should be kept informed and how they are involved in ongoing care.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Representative and family involvement">
              <textarea value={content.representativesAndInvolvement.summary} onChange={(event) => setSection('representativesAndInvolvement', { ...content.representativesAndInvolvement, summary: event.target.value })} className={textareaClassName()} />
            </Field>
            <Field label="Involved people (one per line)">
              <textarea
                value={listToMultiline(content.representativesAndInvolvement.involvedPeople)}
                onChange={(event) => setSection('representativesAndInvolvement', { ...content.representativesAndInvolvement, involvedPeople: multilineToList(event.target.value) })}
                className={textareaClassName()}
              />
            </Field>
          </div>
        </Section>
      </form>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
          <p className="text-sm text-slate-500">
            Published versions stay immutable so coordinators can review exactly which guidance was active at the time of care.
          </p>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((version) => (
                <div key={version.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Version {version.versionNumber} · {version.status.toLowerCase()}
                      </p>
                      <p className="text-sm text-slate-500">
                        Effective from {formatCarePlanDate(version.effectiveFrom)} · Review due {formatCarePlanDate(version.reviewDueAt)}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {version.approvedAt ? `Approved ${formatCarePlanDate(version.approvedAt)}` : 'Awaiting approval'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No published care-plan history exists for this client yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Audit trail</h2>
          <p className="text-sm text-slate-500">
            Direct staff actions on this care plan so reviewers can see when drafts were created, updated, published, or discarded.
          </p>
        </CardHeader>
        <CardContent>
          {auditHistory.length > 0 ? (
            <div className="space-y-3">
              {auditHistory.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCarePlanAuditAction(entry.action)}
                        {entry.versionNumber ? ` · Version ${entry.versionNumber}` : ''}
                      </p>
                      <p className="text-sm text-slate-500">{formatCarePlanChangedSections(entry.changedSections)}</p>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No care-plan audit events have been recorded for this client yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
