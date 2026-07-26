'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '../../../components/oasis/Header';
import { useClientAccess } from '../../../components/providers/ClientAccessProvider';
import { hasAccessCapability } from '../../../lib/auth/capabilities';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { clientQuery } from '../../../lib/graphql/client-side';
import { runConfirmedAction, runSingleFlightAction } from '../../../lib/consequential-actions';
import {
  formatDateTime as formatOrganizationDateTime,
  formatOrganizationDateTimeInput,
  formatTime as formatOrganizationTime,
  organizationDateTimeInputToIso,
} from '../../../lib/time';

type VisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type TaskOutcome = 'DONE' | 'NOT_DONE' | 'REFUSED' | 'NOT_REQUIRED' | 'CONCERN_RAISED';
type CareLogCategory =
  | 'TOILETING'
  | 'NUTRITION'
  | 'HYDRATION'
  | 'SLEEP'
  | 'MOOD'
  | 'MOBILITY'
  | 'SKIN'
  | 'PAIN'
  | 'INCIDENT'
  | 'OTHER';

type VisitTask = {
  id: string;
  taskName: string;
  description?: string | null;
  isCompleted: boolean;
  hasRecordedOutcome: boolean;
  completedAt?: string | null;
  notes?: string | null;
};

type Visit = {
  id: string;
  clientId: string;
  carerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: VisitStatus;
  notes?: string | null;
  client?: {
    id: string;
    fullName: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
  carer?: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null;
  tasks: VisitTask[];
};

type CareLog = {
  id: string;
  category: CareLogCategory;
  occurredAt: string;
  notes?: string | null;
  escalated: boolean;
  escalatedTo?: string | null;
  source?: string | null;
};

const VISIT_QUERY = `
  query Visit($id: String!) {
    visit(id: $id) {
      id
      clientId
      carerId
      scheduledStart
      scheduledEnd
      actualStart
      actualEnd
      status
      notes
      client {
        id
        fullName
        addressLine1
        addressLine2
        city
        postcode
      }
      carer {
        id
        firstName
        lastName
        email
        phone
      }
      tasks {
        id
        taskName
        description
        isCompleted
        hasRecordedOutcome
        completedAt
        notes
      }
    }
  }
`;

const CARE_LOGS_QUERY = `
  query CareLogs($visitId: ID, $skip: Int, $take: Int) {
    careLogs(visitId: $visitId, skip: $skip, take: $take) {
      total
      items {
        id
        category
        occurredAt
        notes
        escalated
        escalatedTo
        source
      }
    }
  }
`;

const START_VISIT_MUTATION = `
  mutation StartVisit($visitId: String!) {
    startVisit(visitId: $visitId) {
      id
      status
      actualStart
      actualEnd
      notes
    }
  }
`;

const RECORD_TASK_OUTCOME_MUTATION = `
  mutation RecordVisitTaskOutcome($input: RecordVisitTaskOutcomeInput!) {
    recordVisitTaskOutcome(input: $input) {
      id
      isCompleted
      completedAt
      notes
    }
  }
`;

const SUBMIT_CARE_NOTE_MUTATION = `
  mutation SubmitVisitCareNote($input: SubmitVisitCareNoteInput!) {
    submitVisitCareNote(input: $input) {
      id
      category
      occurredAt
      notes
      escalated
      escalatedTo
      source
    }
  }
`;

const COMPLETE_VISIT_MUTATION = `
  mutation CompleteVisit($input: CompleteVisitInput!) {
    completeVisit(input: $input) {
      id
      status
      actualStart
      actualEnd
      notes
    }
  }
`;

const CARE_LOG_CATEGORIES: Array<{ value: CareLogCategory; label: string }> = [
  { value: 'TOILETING', label: 'Toileting' },
  { value: 'NUTRITION', label: 'Nutrition' },
  { value: 'HYDRATION', label: 'Hydration' },
  { value: 'SLEEP', label: 'Sleep' },
  { value: 'MOOD', label: 'Mood' },
  { value: 'MOBILITY', label: 'Mobility' },
  { value: 'SKIN', label: 'Skin' },
  { value: 'PAIN', label: 'Pain' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'OTHER', label: 'Other' },
];

const TASK_OUTCOME_OPTIONS: Array<{ outcome: TaskOutcome; label: string; variant: 'primary' | 'secondary' | 'outline' | 'ghost' }> = [
  { outcome: 'DONE', label: 'Mark done', variant: 'primary' },
  { outcome: 'NOT_DONE', label: 'Mark not done', variant: 'secondary' },
  { outcome: 'REFUSED', label: 'Mark refused', variant: 'secondary' },
  { outcome: 'NOT_REQUIRED', label: 'Mark not required', variant: 'outline' },
  { outcome: 'CONCERN_RAISED', label: 'Mark concern raised', variant: 'ghost' },
];

function formatDateTime(date?: string | null): string {
  if (!date) return 'Not recorded';
  return formatOrganizationDateTime(date);
}

function formatTime(date?: string | null): string {
  if (!date) return 'Not recorded';
  return formatOrganizationTime(date);
}

function nowLocalDatetime(): string {
  return formatOrganizationDateTimeInput(new Date());
}

function statusBadge(status: VisitStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800';
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

function taskOutcomeLabel(outcome: TaskOutcome): string {
  switch (outcome) {
    case 'DONE':
      return 'done';
    case 'NOT_DONE':
      return 'not done';
    case 'REFUSED':
      return 'refused';
    case 'NOT_REQUIRED':
      return 'not required';
    default:
      return 'concern raised';
  }
}

export default function VisitDetailPage() {
  const params = useParams();
  const visitId = String(params.id || '');
  const {
    authenticated,
    capabilities,
    getBearerToken,
    isAdmin,
    isStaff,
    status,
  } = useClientAccess();
  const canRunVisitWorkflow = hasAccessCapability(
    capabilities,
    'FRONTLINE_VISIT_EXECUTE',
  );
  const canLogCare = canRunVisitWorkflow;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [careLogs, setCareLogs] = useState<CareLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const startStartedRef = useRef(false);
  const careNoteStartedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const taskOutcomeStartedRef = useRef(new Set<string>());

  const [startingVisit, setStartingVisit] = useState(false);
  const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
  const [submittingCareNote, setSubmittingCareNote] = useState(false);
  const [completingVisit, setCompletingVisit] = useState(false);

  const [careNoteCategory, setCareNoteCategory] = useState<CareLogCategory>('OTHER');
  const [careNoteOccurredAt, setCareNoteOccurredAt] = useState(nowLocalDatetime());
  const [careNoteNotes, setCareNoteNotes] = useState('');
  const [careNoteEscalated, setCareNoteEscalated] = useState(false);
  const [careNoteEscalatedTo, setCareNoteEscalatedTo] = useState('');

  const [visitCompletionNotes, setVisitCompletionNotes] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!visitId) return;
    if (status === 'loading') return;

    setLoading(true);
    setError(null);

    if (!authenticated) {
      setError('Unauthorized');
      setLoading(false);
      return;
    }

    if (!isStaff) {
      setError('Forbidden');
      setLoading(false);
      return;
    }

    try {
      const [visitResult, careLogResult] = await Promise.all([
        clientQuery<{ visit: Visit }>(VISIT_QUERY, { id: visitId }, { getBearerToken }),
        clientQuery<{ careLogs: { items: CareLog[] } }>(
          CARE_LOGS_QUERY,
          { visitId, skip: 0, take: 50 },
          { getBearerToken },
        ),
      ]);

      setVisit(visitResult.visit);
      setCareLogs(
        (careLogResult.careLogs?.items || []).filter(
          (log) => log.category !== ('MEDICATION' as CareLogCategory),
        ),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load care visit');
    } finally {
      setLoading(false);
    }
  }, [authenticated, getBearerToken, isStaff, status, visitId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const completedTasks = useMemo(
    () => (visit?.tasks || []).filter((task) => task.isCompleted).length,
    [visit?.tasks],
  );

  const activityItems = useMemo(() => {
    const careLogItems = careLogs.map((log) => ({
      id: `care-log-${log.id}`,
      occurredAt: log.occurredAt,
      title: `${CARE_LOG_CATEGORIES.find((entry) => entry.value === log.category)?.label || log.category} care note recorded`,
      detail: log.notes || (log.escalated ? `Escalated to ${log.escalatedTo || 'team lead'}` : 'Care note recorded'),
      kind: 'care-log' as const,
    }));

    return careLogItems.sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }, [careLogs]);

  const hasStartedVisit = visit?.status === 'IN_PROGRESS' || visit?.status === 'COMPLETED';
  const visitIsClosed = visit?.status === 'COMPLETED' || visit?.status === 'CANCELLED';
  const hasRecordedCare =
    (visit?.tasks || []).some((task) => task.hasRecordedOutcome) ||
    careLogs.length > 0;

  async function startVisit() {
    if (!visit || !canRunVisitWorkflow || visit.status !== 'SCHEDULED') return;

    await runSingleFlightAction(startStartedRef, async () => {
      setStartingVisit(true);
      setError(null);
      setMessage(null);

      try {
        await clientQuery(
          START_VISIT_MUTATION,
          { visitId: visit.id },
          { getBearerToken },
        );
        setMessage('Visit started.');
        await loadWorkspace();
      } catch (err: any) {
        setError(err?.message || 'Failed to start visit');
      } finally {
        setStartingVisit(false);
      }
    });
  }

  async function recordCareActionOutcome(task: VisitTask, outcome: TaskOutcome) {
    if (!visit || !canRunVisitWorkflow || !hasStartedVisit || visitIsClosed) return;
    if (taskOutcomeStartedRef.current.has(task.id)) return;

    const notesByOutcome: Record<TaskOutcome, string> = {
      DONE: `Completed during visit: ${task.taskName}`,
      NOT_DONE: `Not done during visit: ${task.taskName}`,
      REFUSED: `Refused during visit: ${task.taskName}`,
      NOT_REQUIRED: `Not required during visit: ${task.taskName}`,
      CONCERN_RAISED: `Concern raised during visit: ${task.taskName}`,
    };

    taskOutcomeStartedRef.current.add(task.id);
    setRecordingTaskId(task.id);
    setError(null);
    setMessage(null);

    try {
      await clientQuery(
        RECORD_TASK_OUTCOME_MUTATION,
        {
          input: {
            taskId: task.id,
            outcome,
            notes: notesByOutcome[outcome],
          },
        },
        { getBearerToken },
      );
      setMessage(`Care action marked ${taskOutcomeLabel(outcome)}.`);
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.message || 'Failed to record care action outcome');
    } finally {
      taskOutcomeStartedRef.current.delete(task.id);
      setRecordingTaskId(null);
    }
  }

  async function handleCreateCareNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visit || !canLogCare || !hasStartedVisit || visitIsClosed) return;

    if (!careNoteNotes.trim()) {
      setError('Please add notes before recording a care note.');
      return;
    }

    const wasEscalated = careNoteEscalated;

    await runSingleFlightAction(careNoteStartedRef, async () => {
      setSubmittingCareNote(true);
      setError(null);
      setMessage(null);

      try {
        await clientQuery(
          SUBMIT_CARE_NOTE_MUTATION,
          {
            input: {
              visitId: visit.id,
              category: careNoteCategory,
              notes: careNoteNotes.trim(),
              occurredAt: careNoteOccurredAt
                ? organizationDateTimeInputToIso(careNoteOccurredAt)
                : undefined,
              escalated: careNoteEscalated,
              escalatedTo: careNoteEscalatedTo.trim() || undefined,
            },
          },
          { getBearerToken },
        );

        setCareNoteCategory('OTHER');
        setCareNoteOccurredAt(nowLocalDatetime());
        setCareNoteNotes('');
        setCareNoteEscalated(false);
        setCareNoteEscalatedTo('');
        setMessage(
          wasEscalated
            ? 'Care note recorded and marked for escalation.'
            : 'Care note recorded.',
        );
        await loadWorkspace();
      } catch (err: any) {
        setError(err?.message || 'Failed to record care note');
      } finally {
        setSubmittingCareNote(false);
      }
    });
  }

  async function completeVisit() {
    if (!visit || !canRunVisitWorkflow || !hasStartedVisit || visitIsClosed) return;
    const personName = visit.client?.fullName || 'this person';

    await runSingleFlightAction(completionStartedRef, () =>
      runConfirmedAction(
        window.confirm,
        `Complete the visit for ${personName}? Care notes will become read-only.`,
        async () => {
          setCompletingVisit(true);
          setError(null);
          setMessage(null);

          try {
            await clientQuery(
              COMPLETE_VISIT_MUTATION,
              {
                input: {
                  visitId: visit.id,
                  notes: visitCompletionNotes.trim() || undefined,
                },
              },
              { getBearerToken },
            );
            setMessage('Visit completed.');
            await loadWorkspace();
          } catch (err: any) {
            setError(err?.message || 'Failed to complete visit');
          } finally {
            setCompletingVisit(false);
          }
        },
      ),
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 pb-28 pt-8 sm:px-6 sm:pb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link href={isAdmin ? '/schedule' : '/visits'} className="text-teal-700 hover:text-teal-800">
            ← {isAdmin ? 'Back to Schedule' : 'Back to my visits'}
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              {visit?.client?.fullName || 'Care visit'}
            </h1>
            <p className="mt-1 text-slate-500">
              Follow the visit steps, record care, and finish when everything is complete.
            </p>
          </div>
          {visit && (
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(visit.status)}`}>
              {visit.status.replace('_', ' ').toLowerCase()}
            </span>
          )}
        </div>

        {loading && <div className="rounded-lg border border-slate-200 bg-white p-6">Loading care visit...</div>}

        {!loading && error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {!loading && message && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            {message}
          </div>
        )}

        {!loading && visit && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 xl:col-span-3">
              Recording visit activity requires an internet connection.
            </p>
            <div className="space-y-6 xl:col-span-2">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">
                    About {visit.client?.fullName || 'the person you support'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    The visit details you need for this assigned call.
                  </p>
                </CardHeader>
                <CardContent className="mb-0">
                  <p className="text-sm font-medium text-slate-900">
                    {[
                      visit.client?.addressLine1,
                      visit.client?.addressLine2,
                      visit.client?.city,
                      visit.client?.postcode,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Address not recorded'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Visit details</h2>
                  <p className="text-sm text-slate-500">Who you are visiting, where to go, and the planned time.</p>
                </CardHeader>
                <CardContent className="mb-0 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {isAdmin && (
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Assigned Carer</p>
                      <p className="mt-1 text-base font-medium text-slate-900">
                        {visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Not assigned'}
                      </p>
                      {visit.carer?.phone && <p className="mt-1 text-sm text-slate-600">{visit.carer.phone}</p>}
                    </div>
                  )}
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Status</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadge(visit.status)}`}>
                      {visit.status.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Scheduled timing</p>
                    <p className="mt-1 text-base font-medium text-slate-900">
                      {formatDateTime(visit.scheduledStart)} to {formatTime(visit.scheduledEnd)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Actual start</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDateTime(visit.actualStart)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Actual end</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDateTime(visit.actualEnd)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card id="start-visit">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Step 1. Start visit</h2>
                  <p className="text-sm text-slate-500">Start when you arrive before recording care actions and notes.</p>
                </CardHeader>
                <CardContent className="mb-0 space-y-3">
                  {!canRunVisitWorkflow ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      You do not have permission to start this visit from your account.
                    </p>
                  ) : hasStartedVisit ? (
                    <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                      Visit is active. Started at {formatDateTime(visit.actualStart)}.
                    </p>
                  ) : visit.status === 'CANCELLED' ? (
                    <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                      This visit is cancelled and cannot be started.
                    </p>
                  ) : (
                    <Button type="button" onClick={startVisit} disabled={startingVisit}>
                      {startingVisit ? 'Starting...' : 'Start visit'}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card id="care-actions">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Step 2. Care actions</h2>
                  <p className="text-sm text-slate-500">
                    Record outcomes for each care action completed during this visit.
                  </p>
                </CardHeader>
                <CardContent className="mb-0 space-y-4">
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {completedTasks}/{visit.tasks.length} care actions currently marked done.
                  </div>
                  {!hasStartedVisit && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      Start visit in Step 1 to record care action outcomes.
                    </p>
                  )}
                  {visit.tasks.length === 0 ? (
                    <p className="text-sm text-slate-500">No care actions are attached to this visit yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {visit.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-lg border p-4 ${task.isCompleted ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{task.taskName}</p>
                              {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
                              {task.notes && <p className="mt-2 text-xs text-slate-500">Last update: {task.notes}</p>}
                              {task.completedAt && (
                                <p className="mt-2 text-xs text-slate-500">Completed {formatDateTime(task.completedAt)}</p>
                              )}
                            </div>
                            {task.isCompleted && (
                              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                Done
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {TASK_OUTCOME_OPTIONS.map((option) => (
                              <Button
                                key={option.outcome}
                                type="button"
                                size="sm"
                                variant={option.variant}
                                disabled={
                                  recordingTaskId === task.id ||
                                  !canRunVisitWorkflow ||
                                  !hasStartedVisit ||
                                  visitIsClosed
                                }
                                onClick={() => recordCareActionOutcome(task, option.outcome)}
                              >
                                {recordingTaskId === task.id ? 'Saving...' : option.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card id="care-notes">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Step 3. Care notes</h2>
                  <p className="text-sm text-slate-500">Record the care provided and anything the team needs to follow up.</p>
                </CardHeader>
                <CardContent className="mb-0">
                  {status === 'loading' ? (
                    <p className="text-sm text-slate-500">Checking your access…</p>
                  ) : !canLogCare ? (
                    <p className="text-sm text-slate-500">You do not have permission to add care notes from this account.</p>
                  ) : !hasStartedVisit ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      Start visit in Step 1 before recording care notes.
                    </p>
                  ) : visitIsClosed ? (
                    <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                      This visit is closed. Care notes are now read-only.
                    </p>
                  ) : (
                    <form className="space-y-4" onSubmit={handleCreateCareNote}>
                      <div>
                        <label htmlFor="care-note-category" className="mb-1 block text-sm text-slate-600">
                          Category
                        </label>
                        <select
                          id="care-note-category"
                          value={careNoteCategory}
                          onChange={(event) => setCareNoteCategory(event.target.value as CareLogCategory)}
                          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                        >
                          {CARE_LOG_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="care-note-occurred-at" className="mb-1 block text-sm text-slate-600">
                          Occurred at
                        </label>
                        <input
                          id="care-note-occurred-at"
                          type="datetime-local"
                          value={careNoteOccurredAt}
                          onChange={(event) => setCareNoteOccurredAt(event.target.value)}
                          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label htmlFor="care-note-notes" className="mb-1 block text-sm text-slate-600">
                          Care note
                        </label>
                        <textarea
                          id="care-note-notes"
                          value={careNoteNotes}
                          onChange={(event) => setCareNoteNotes(event.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          placeholder="Record care delivered, person response, and any handover details."
                        />
                      </div>
                      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={careNoteEscalated}
                          onChange={(event) => setCareNoteEscalated(event.target.checked)}
                          className="h-5 w-5 shrink-0"
                        />
                        This needed escalation
                      </label>
                      {careNoteEscalated && (
                        <div>
                          <label htmlFor="care-note-escalated-to" className="mb-1 block text-sm text-slate-600">
                            Escalated to
                          </label>
                          <input
                            id="care-note-escalated-to"
                            type="text"
                            value={careNoteEscalatedTo}
                            onChange={(event) => setCareNoteEscalatedTo(event.target.value)}
                            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="Team lead, family contact, GP, district nurse..."
                          />
                        </div>
                      )}
                      <Button type="submit" disabled={submittingCareNote}>
                        {submittingCareNote ? 'Saving...' : 'Record care note'}
                      </Button>
                    </form>
                  )}

                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900">Recent care notes</h3>
                    {careLogs.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No care notes recorded on this visit yet.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {careLogs.slice(0, 6).map((log) => (
                          <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-900">
                                {CARE_LOG_CATEGORIES.find((entry) => entry.value === log.category)?.label || log.category}
                              </p>
                              <span className="text-xs text-slate-500">{formatDateTime(log.occurredAt)}</span>
                            </div>
                            {log.notes && <p className="mt-2 text-sm text-slate-600">{log.notes}</p>}
                            {log.escalated && (
                              <p className="mt-2 text-xs font-medium text-red-700">
                                Escalated to {log.escalatedTo || 'team lead'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card id="finish-visit">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Step 4. Finish visit</h2>
                  <p className="text-sm text-slate-500">Finish once care actions and notes are recorded.</p>
                </CardHeader>
                <CardContent className="mb-0 space-y-4">
                  {visit.status === 'COMPLETED' ? (
                    <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                      Visit completed at {formatDateTime(visit.actualEnd)}.
                    </p>
                  ) : visit.status === 'CANCELLED' ? (
                    <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                      This visit is cancelled and cannot be completed.
                    </p>
                  ) : !hasStartedVisit ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      Start visit in Step 1 before completing this visit.
                    </p>
                  ) : !canRunVisitWorkflow ? (
                    <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                      You do not have permission to complete this visit from your account.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="visit-completion-notes" className="mb-1 block text-sm text-slate-600">
                          Completion note
                        </label>
                        <textarea
                          id="visit-completion-notes"
                          value={visitCompletionNotes}
                          onChange={(event) => setVisitCompletionNotes(event.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                          placeholder="Add optional handover details for completion."
                        />
                      </div>
                      <p className="text-sm text-slate-600">
                        The completion time is recorded automatically when this action succeeds.
                      </p>
                      <Button type="button" onClick={completeVisit} disabled={completingVisit}>
                        {completingVisit ? 'Completing...' : 'Complete visit'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Activity timeline</h2>
                  <p className="text-sm text-slate-500">Care note activity linked to this visit.</p>
                </CardHeader>
                <CardContent className="mb-0">
                  {activityItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No visit activity has been recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activityItems.map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-900">{item.title}</p>
                            <span className="text-xs text-slate-500">{formatDateTime(item.occurredAt)}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-slate-900">Visit links</h2>
                </CardHeader>
                <CardContent className="mb-0 space-y-3">
                  {isAdmin && (
                    <>
                      <Button asChild variant="outline" className="w-full justify-center">
                        <Link href={`/clients/${visit.clientId}/care-logs`}>Open care-note records</Link>
                      </Button>
                    </>
                  )}
                  <Button asChild variant="ghost" className="w-full justify-center">
                    <Link href={isAdmin ? '/schedule' : '/visits'}>
                      {isAdmin ? 'Back to Schedule' : 'Back to my visits'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardHeader>
                    <h2 className="text-xl font-semibold text-slate-900">Admin visit oversight</h2>
                    <p className="text-sm text-slate-600">Recorded visit details are read-only on this page.</p>
                  </CardHeader>
                  <CardContent className="mb-0 space-y-3 text-sm text-slate-700">
                    <p>
                      Status:{' '}
                      <span className="font-medium text-slate-900">
                        {visit.status.replace('_', ' ').toLowerCase()}
                      </span>
                    </p>
                    <p>
                      Actual start: <span className="font-medium text-slate-900">{formatDateTime(visit.actualStart)}</span>
                    </p>
                    <p>
                      Actual end: <span className="font-medium text-slate-900">{formatDateTime(visit.actualEnd)}</span>
                    </p>
                    {visit.notes && <p className="whitespace-pre-wrap">Recorded note: {visit.notes}</p>}
                    <p className="rounded-lg bg-amber-100 p-3 text-amber-900">
                      Corrections, cancellation, reopening and on-behalf recording require a separate reviewed workflow.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {!visitIsClosed && canRunVisitWorkflow && (
              <div
                role="region"
                aria-label="Next visit action"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] sm:hidden"
              >
                <div className="mx-auto max-w-7xl">
                  {visit.status === 'SCHEDULED' ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={startVisit}
                      disabled={startingVisit}
                    >
                      {startingVisit ? 'Starting...' : 'Start visit'}
                    </Button>
                  ) : !hasRecordedCare ? (
                    <Button asChild className="w-full">
                      <a href="#care-actions">Continue recording care</a>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={completeVisit}
                      disabled={completingVisit}
                    >
                      {completingVisit ? 'Completing...' : 'Complete visit'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
