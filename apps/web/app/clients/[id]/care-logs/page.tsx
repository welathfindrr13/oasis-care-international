'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '../../../../components/oasis/Header';
import { useClientAccess } from '../../../../components/providers/ClientAccessProvider';
import { clientQuery } from '../../../../lib/graphql/client-side';
import {
  formatDateTime,
  formatOrganizationDateTimeInput,
  getOrganizationMonthUtcRange,
  organizationDateKey,
  organizationDateTimeInputToIso,
} from '../../../../lib/time';

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

type IntakeAmount = 'NONE' | 'QUARTER' | 'HALF' | 'MOST' | 'ALL';
type MoodLevel = 'VERY_LOW' | 'LOW' | 'NEUTRAL' | 'GOOD' | 'VERY_GOOD';
type StoolType = 'TYPE_1' | 'TYPE_2' | 'TYPE_3' | 'TYPE_4' | 'TYPE_5' | 'TYPE_6' | 'TYPE_7';

interface CareLog {
  id: string;
  category: CareLogCategory;
  occurredAt: string;
  notes?: string;
  painScore?: number;
  moodLevel?: MoodLevel;
  sleepQuality?: string;
  mealType?: string;
  fluidMl?: number;
  urinePassed?: boolean;
  bowelMovement?: boolean;
  stoolType?: StoolType;
  escalated: boolean;
  escalatedTo?: string;
}

interface MonthlyCategoryCount {
  category: CareLogCategory;
  count: number;
}

interface MonthlySummary {
  monthStart: string;
  monthEnd: string;
  totalCareLogs: number;
  byCategory: MonthlyCategoryCount[];
  highlights: string[];
}

const CLIENT_QUERY = `
  query ClientLite($id: ID!) {
    client(id: $id) { id fullName }
  }
`;

const CARE_LOGS_QUERY = `
  query CareLogs($clientId: ID, $occurredFrom: String, $occurredTo: String, $skip: Int, $take: Int) {
    careLogs(clientId: $clientId, occurredFrom: $occurredFrom, occurredTo: $occurredTo, skip: $skip, take: $take) {
      total
      items {
        id
        category
        occurredAt
        notes
        painScore
        moodLevel
        sleepQuality
        mealType
        fluidMl
        urinePassed
        bowelMovement
        stoolType
        escalated
        escalatedTo
      }
    }
  }
`;

const MONTHLY_SUMMARY_QUERY = `
  query MonthlyCareSummary($clientId: ID!, $year: Int!, $month: Int!) {
    monthlyCareSummary(clientId: $clientId, year: $year, month: $month) {
      monthStart
      monthEnd
      totalCareLogs
      byCategory { category count }
      highlights
    }
  }
`;

const CREATE_CARE_LOG_MUTATION = `
  mutation CreateCareLog($input: CreateCareLogInput!) {
    createCareLog(input: $input) { id }
  }
`;

function nowLocalDatetime() {
  return formatOrganizationDateTimeInput(new Date());
}

export default function ClientCareLogsPage() {
  const params = useParams();
  const clientId = String(params.id || '');
  const {
    authenticated,
    getBearerToken,
    isStaff,
    status: authStatus,
  } = useClientAccess();
  const canCreate = authenticated && isStaff;

  const [clientName, setClientName] = useState<string>('Client');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return organizationDateKey().slice(0, 7);
  });

  const [logs, setLogs] = useState<CareLog[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [occurredAt, setOccurredAt] = useState(nowLocalDatetime());
  const [category, setCategory] = useState<CareLogCategory>('MOOD');
  const [notes, setNotes] = useState('');
  const [urinePassed, setUrinePassed] = useState(false);
  const [bowelMovement, setBowelMovement] = useState(false);
  const [stoolType, setStoolType] = useState<StoolType | ''>('');
  const [mealType, setMealType] = useState('');
  const [intakeAmount, setIntakeAmount] = useState<IntakeAmount | ''>('');
  const [fluidMl, setFluidMl] = useState('');
  const [slept, setSlept] = useState(false);
  const [sleepQuality, setSleepQuality] = useState('');
  const [moodLevel, setMoodLevel] = useState<MoodLevel | ''>('');
  const [agitation, setAgitation] = useState(false);
  const [confusion, setConfusion] = useState(false);
  const [painScore, setPainScore] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [escalatedTo, setEscalatedTo] = useState('');

  const monthRange = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const range = getOrganizationMonthUtcRange(year, month);
    const start = new Date(range.start);
    const end = new Date(new Date(range.end).getTime() - 1);
    return { year, month, start, end };
  }, [selectedMonth]);

  const loadData = useCallback(async () => {
    if (!clientId) return;
    if (authStatus === 'loading') return;

    setLoading(true);
    setError(null);
    setLogsError(null);
    setSummaryError(null);

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
      const [clientResult, logsResult, monthlyResult] = await Promise.allSettled([
        clientQuery<{ client: { fullName: string } | null }>(
          CLIENT_QUERY,
          { id: clientId },
          { getBearerToken },
        ),
        clientQuery<{ careLogs: { items: CareLog[] } }>(
          CARE_LOGS_QUERY,
          {
            clientId,
            occurredFrom: monthRange.start.toISOString(),
            occurredTo: monthRange.end.toISOString(),
            skip: 0,
            take: 100,
          },
          { getBearerToken },
        ),
        clientQuery<{ monthlyCareSummary: MonthlySummary }>(
          MONTHLY_SUMMARY_QUERY,
          {
            clientId,
            year: monthRange.year,
            month: monthRange.month,
          },
          { getBearerToken },
        ),
      ]);

      if (clientResult.status === 'fulfilled') {
        setClientName(clientResult.value.client?.fullName || 'Client');
      } else {
        setClientName('Client');
      }

      if (logsResult.status === 'fulfilled') {
        setLogs(
          (logsResult.value.careLogs?.items || []).filter(
            (item) => item.category !== ('MEDICATION' as CareLogCategory),
          ),
        );
      } else {
        setLogs([]);
        setLogsError(logsResult.reason?.message || 'Failed to load care log entries');
      }

      if (monthlyResult.status === 'fulfilled') {
        setSummary(monthlyResult.value.monthlyCareSummary || null);
      } else {
        setSummary(null);
        setSummaryError(monthlyResult.reason?.message || 'Failed to load monthly summary');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load care logs page');
    } finally {
      setLoading(false);
    }
  }, [
    authenticated,
    authStatus,
    clientId,
    getBearerToken,
    isStaff,
    monthRange.end,
    monthRange.month,
    monthRange.start,
    monthRange.year,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    setSubmitting(true);
    setError(null);

    try {
      const input: Record<string, any> = {
        clientId,
        occurredAt: organizationDateTimeInputToIso(occurredAt),
        category,
        notes: notes || undefined,
        source: 'web',
      };

      if (category === 'TOILETING') {
        input.urinePassed = urinePassed;
        input.bowelMovement = bowelMovement;
        input.stoolType = stoolType || undefined;
      }

      if (category === 'NUTRITION' || category === 'HYDRATION') {
        input.mealType = mealType || undefined;
        input.intakeAmount = intakeAmount || undefined;
        input.fluidMl = fluidMl ? Number(fluidMl) : undefined;
      }

      if (category === 'SLEEP') {
        input.slept = slept;
        input.sleepQuality = sleepQuality || undefined;
      }

      if (category === 'MOOD') {
        input.moodLevel = moodLevel || undefined;
        input.agitation = agitation;
        input.confusion = confusion;
      }

      if (category === 'PAIN') {
        input.painScore = painScore ? Number(painScore) : undefined;
      }

      input.escalated = escalated;
      input.escalatedTo = escalated && escalatedTo ? escalatedTo : undefined;

      await clientQuery(CREATE_CARE_LOG_MUTATION, { input }, { getBearerToken });

      setNotes('');
      setUrinePassed(false);
      setBowelMovement(false);
      setStoolType('');
      setMealType('');
      setIntakeAmount('');
      setFluidMl('');
      setSlept(false);
      setSleepQuality('');
      setMoodLevel('');
      setAgitation(false);
      setConfusion(false);
      setPainScore('');
      setEscalated(false);
      setEscalatedTo('');

      await loadData();
    } catch (e: any) {
      setError(e?.message || 'Failed to create care log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href={`/clients/${clientId}`} className="text-sm text-teal-700 hover:text-teal-800">
            ← Back to Client
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Care Logs</h1>
            <p className="text-slate-500 mt-1">{clientName} monthly care-plan and daily observations</p>
          </div>
          <div>
            <label className="text-sm text-slate-600 mr-2">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {summaryError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            Monthly summary unavailable: {summaryError}
          </div>
        )}

        {summary && (
          <section className="mb-8 grid grid-cols-1 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Care logs this month</p>
              <p className="text-2xl font-semibold text-slate-900">{summary.totalCareLogs}</p>
            </div>
          </section>
        )}

        {summary && (
          <section className="mb-8 bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Category coverage</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {summary.byCategory.filter((row) => row.category !== ('MEDICATION' as CareLogCategory)).map((row) => (
                <div key={row.category} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">{row.category.toLowerCase()}</p>
                  <p className="text-lg font-semibold text-slate-900">{row.count}</p>
                </div>
              ))}
            </div>
            {summary.highlights?.length > 0 && (
              <ul className="mt-4 list-disc pl-5 text-sm text-slate-700 space-y-1">
                {summary.highlights.map((h, i) => (
                  <li key={`${i}-${h}`}>{h}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canCreate && (
          <section className="mb-8 bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Add Care Log Entry</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-600">Occurred At</label>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CareLogCategory)}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  {[
                    'TOILETING', 'NUTRITION', 'HYDRATION', 'SLEEP', 'MOOD',
                    'MOBILITY', 'SKIN', 'PAIN', 'INCIDENT', 'OTHER',
                  ].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {(category === 'TOILETING') && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={urinePassed} onChange={(e) => setUrinePassed(e.target.checked)} /> Urine passed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={bowelMovement} onChange={(e) => setBowelMovement(e.target.checked)} /> Bowel movement
                  </label>
                  <div>
                    <label className="text-sm text-slate-600">Stool type</label>
                    <select value={stoolType} onChange={(e) => setStoolType(e.target.value as StoolType | '')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
                      <option value="">Not recorded</option>
                      {['TYPE_1','TYPE_2','TYPE_3','TYPE_4','TYPE_5','TYPE_6','TYPE_7'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(category === 'NUTRITION' || category === 'HYDRATION') && (
                <>
                  <div>
                    <label className="text-sm text-slate-600">Meal type</label>
                    <input value={mealType} onChange={(e) => setMealType(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Breakfast/snack" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Intake amount</label>
                    <select value={intakeAmount} onChange={(e) => setIntakeAmount(e.target.value as IntakeAmount | '')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
                      <option value="">Not recorded</option>
                      {['NONE','QUARTER','HALF','MOST','ALL'].map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Fluid ml</label>
                    <input type="number" min={0} value={fluidMl} onChange={(e) => setFluidMl(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
                  </div>
                </>
              )}

              {category === 'SLEEP' && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={slept} onChange={(e) => setSlept(e.target.checked)} /> Slept
                  </label>
                  <div>
                    <label className="text-sm text-slate-600">Sleep quality</label>
                    <input value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Poor/Fair/Good" />
                  </div>
                </>
              )}

              {category === 'MOOD' && (
                <>
                  <div>
                    <label className="text-sm text-slate-600">Mood level</label>
                    <select value={moodLevel} onChange={(e) => setMoodLevel(e.target.value as MoodLevel | '')} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
                      <option value="">Not recorded</option>
                      {['VERY_LOW','LOW','NEUTRAL','GOOD','VERY_GOOD'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={agitation} onChange={(e) => setAgitation(e.target.checked)} /> Agitation
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={confusion} onChange={(e) => setConfusion(e.target.checked)} /> Confusion
                  </label>
                </>
              )}

              {category === 'PAIN' && (
                <div>
                  <label className="text-sm text-slate-600">Pain score (0-10)</label>
                  <input type="number" min={0} max={10} value={painScore} onChange={(e) => setPainScore(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-sm text-slate-600">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="What happened during care..."
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={escalated} onChange={(e) => setEscalated(e.target.checked)} /> Escalated
              </label>

              {escalated && (
                <div>
                  <label className="text-sm text-slate-600">Escalated to</label>
                  <input value={escalatedTo} onChange={(e) => setEscalatedTo(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Nurse in charge" />
                </div>
              )}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-lg bg-teal-600 text-white px-4 py-2 hover:bg-teal-700 disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save Care Log'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Entries ({logs.length})</h2>

          {logsError && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
              Entries unavailable: {logsError}
            </div>
          )}

          {loading ? (
            <p className="text-slate-500">Loading care logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-slate-500">No care logs found for this month.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{log.category}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(log.occurredAt)}</p>
                    </div>
                    {log.escalated && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Escalated</span>
                    )}
                  </div>
                  {log.notes && <p className="text-sm text-slate-700 mt-2">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
