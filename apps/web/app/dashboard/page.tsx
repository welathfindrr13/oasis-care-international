import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'
import { Button } from '../../components/ui/Button'
import { authOptions } from '../api/auth/[...nextauth]/authOptions'
import { getSiteBaseUrl } from '../../lib/url'
import { query } from '../../lib/graphql/client'
import {
  CAREBRIDGE_CONCERN_INBOX_QUERY,
  CARE_PLANNING_QUERY,
  CLIENTS_QUERY,
  MY_ACTIVE_SHIFT_QUERY,
  SHIFT_ANALYTICS_QUERY,
  VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY,
  VISITS_QUERY,
  type CarePlanningQueryResponse,
  type CarebridgeConcernInboxQueryResponse,
  type ClientsQueryResponse,
  type MyActiveShiftQueryResponse,
  type ShiftAnalyticsQueryResponse,
  type Visit,
  type VisitsQueryResponse,
  type VerifiedVisitStoryApprovalQueueQueryResponse,
} from '../../lib/graphql/queries'

// Mark page as dynamic since it uses cookies/headers
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Today - Oasis Care',
  description: 'Today Command Centre for visits, people, family updates, and care exceptions',
}

interface TodayStats {
  booked: number;
  finished: number;
}

interface ShiftDashboardData {
  activeCarersNow: number;
}

interface TodayVisitsData {
  visits: Visit[];
}

interface CareSpineSignalData {
  assessmentsNeedingCompletion: number;
  assessmentsPeopleCount: number;
  carePlanReviewsDueSoon: number;
  overdueCarePlanReviews: number;
  evidenceGaps: number;
}

interface CareLogCountResponse {
  careLogs: {
    total: number;
  };
}

type MedicationStatus = 'SCHEDULED' | 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'CANCELLED';

interface MedicationAdministrationForToday {
  id: string;
  status: MedicationStatus;
  scheduledTime: string;
}

interface TodayMedicationResponse {
  getTodaysMedicationsByClient: MedicationAdministrationForToday[];
}

interface RecentActivityItem {
  id: string;
  time: string;
  client: string;
  carer: string;
  action: string;
  status: 'completed' | 'in_progress' | 'scheduled' | 'cancelled';
}

interface UpcomingVisitItem {
  id: string;
  time: string;
  client: string;
  type: string;
}

function formatVisitTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function mapVisitStatusToActivity(visit: Visit): RecentActivityItem['status'] {
  switch (visit.status) {
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

function mapVisitStatusAction(visit: Visit): string {
  switch (visit.status) {
    case 'COMPLETED':
      return 'Visit completed';
    case 'IN_PROGRESS':
      return 'Visit in progress';
    case 'CANCELLED':
      return 'Visit cancelled';
    default:
      return 'Visit scheduled';
  }
}

function buildRecentActivity(visits: Visit[]): RecentActivityItem[] {
  return visits
    .slice()
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime())
    .slice(0, 5)
    .map((visit) => ({
      id: visit.id,
      time: formatVisitTime(visit.scheduledStart),
      client: visit.client?.fullName || 'Unknown client',
      carer: visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Unassigned',
      action: mapVisitStatusAction(visit),
      status: mapVisitStatusToActivity(visit),
    }));
}

function buildUpcomingVisits(visits: Visit[]): UpcomingVisitItem[] {
  const now = Date.now();
  return visits
    .filter((visit) => new Date(visit.scheduledStart).getTime() >= now && visit.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
    .slice(0, 3)
    .map((visit) => ({
      id: visit.id,
      time: formatVisitTime(visit.scheduledStart),
      client: visit.client?.fullName || 'Unknown client',
      type: visit.notes?.trim() ? 'Planned Care Visit' : 'Home Visit',
    }));
}

function calculateAttentionCount(visits: Visit[]): number {
  const now = Date.now();
  return visits.filter((visit) => {
    const start = new Date(visit.scheduledStart).getTime();
    return visit.status === 'SCHEDULED' && start < now;
  }).length;
}

async function getClientTotal(): Promise<number> {
  try {
    const response = await query<ClientsQueryResponse>(CLIENTS_QUERY, {
      take: 1,
      skip: 0,
    })
    return response.clients.total
  } catch {
    return 0
  }
}

async function getTodayStats(): Promise<TodayStats> {
  try {
    const baseUrl = getSiteBaseUrl();
    const cookie = cookies().toString();
    const response = await fetch(`${baseUrl}/api/activity/today`, {
      cache: 'no-store',
      headers: { cookie }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch today stats:', response.status);
      return { booked: 0, finished: 0 };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching today stats:', error);
    return { booked: 0, finished: 0 };
  }
}

async function getShiftDashboardData(isAdmin: boolean): Promise<ShiftDashboardData> {
  if (isAdmin) {
    try {
      const response = await query<ShiftAnalyticsQueryResponse>(SHIFT_ANALYTICS_QUERY)
      return { activeCarersNow: response.shiftAnalytics.activeCarersNow }
    } catch {
      return { activeCarersNow: 0 }
    }
  }

  try {
    const response = await query<MyActiveShiftQueryResponse>(MY_ACTIVE_SHIFT_QUERY)
    return { activeCarersNow: response.myActiveShift?.isActive ? 1 : 0 }
  } catch {
    return { activeCarersNow: 0 }
  }
}

async function getTodayVisits(): Promise<TodayVisitsData> {
  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const response = await query<VisitsQueryResponse>(VISITS_QUERY, {
      scheduledStartFrom: start.toISOString(),
      scheduledStartTo: end.toISOString(),
      take: 100,
      skip: 0,
    });

    return { visits: response.visits.items || [] };
  } catch {
    return { visits: [] };
  }
}

async function getFamilyUpdateReviewCount(): Promise<number> {
  try {
    const response = await query<VerifiedVisitStoryApprovalQueueQueryResponse>(
      VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY,
      {},
    );
    return response.verifiedVisitStoryApprovalQueue.length;
  } catch {
    return 0;
  }
}

async function getOpenConcernCount(): Promise<number> {
  try {
    const response = await query<CarebridgeConcernInboxQueryResponse>(
      CAREBRIDGE_CONCERN_INBOX_QUERY,
      {},
    );
    return response.carebridgeConcernInbox.filter(
      (concern) => concern.status !== 'RESOLVED' && concern.status !== 'CLOSED',
    ).length;
  } catch {
    return 0;
  }
}

const CARE_LOG_COUNT_BY_VISIT_QUERY = `
  query CareLogCountByVisit($visitId: ID!, $skip: Int, $take: Int) {
    careLogs(visitId: $visitId, skip: $skip, take: $take) {
      total
    }
  }
`;

const TODAY_MEDICATIONS_QUERY = `
  query TodayMedications($date: String!) {
    getTodaysMedicationsByClient(date: $date) {
      id
      status
      scheduledTime
    }
  }
`;

async function getMissingCareNoteCount(visits: Visit[]): Promise<number> {
  const completedVisits = visits.filter((visit) => visit.status === 'COMPLETED');
  if (completedVisits.length === 0) {
    return 0;
  }

  const results = await Promise.all(
    completedVisits.map(async (visit) => {
      try {
        const response = await query<CareLogCountResponse>(CARE_LOG_COUNT_BY_VISIT_QUERY, {
          visitId: visit.id,
          skip: 0,
          take: 1,
        });
        return response.careLogs.total === 0 ? 1 : 0;
      } catch {
        return 0;
      }
    }),
  );

  return results.reduce<number>((total, item) => total + item, 0);
}

async function getMedicationExceptionCount(): Promise<number> {
  try {
    const response = await query<TodayMedicationResponse>(TODAY_MEDICATIONS_QUERY, {
      date: new Date().toISOString(),
    });
    const now = Date.now();
    return (response.getTodaysMedicationsByClient ?? []).filter((administration) => {
      if (administration.status === 'MISSED' || administration.status === 'REFUSED') {
        return true;
      }
      return administration.status === 'SCHEDULED' && new Date(administration.scheduledTime).getTime() < now;
    }).length;
  } catch {
    return 0;
  }
}

function isFiniteDate(value?: string | null): value is string {
  if (!value) {
    return false;
  }
  return Number.isFinite(new Date(value).getTime());
}

async function getCareSpineSignalData(): Promise<CareSpineSignalData> {
  const safeFallback: CareSpineSignalData = {
    assessmentsNeedingCompletion: 0,
    assessmentsPeopleCount: 0,
    carePlanReviewsDueSoon: 0,
    overdueCarePlanReviews: 0,
    evidenceGaps: 0,
  };

  try {
    const clientsResponse = await query<ClientsQueryResponse>(CLIENTS_QUERY, {
      take: 50,
      skip: 0,
    });
    const clients = clientsResponse.clients.items ?? [];
    if (clients.length === 0) {
      return safeFallback;
    }

    const now = Date.now();
    const dueSoonBoundary = now + 30 * 24 * 60 * 60 * 1000;

    const carePlanningByClient = await Promise.all(
      clients.map(async (client) => {
        try {
          return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, {
            clientId: client.id,
            take: 50,
          });
        } catch {
          return null;
        }
      }),
    );

    let assessmentsNeedingCompletion = 0;
    let carePlanReviewsDueSoon = 0;
    let overdueCarePlanReviews = 0;
    const clientsWithAssessmentNeeds = new Set<string>();
    const clientsWithEvidenceGaps = new Set<string>();

    for (let index = 0; index < carePlanningByClient.length; index += 1) {
      const clientData = carePlanningByClient[index];
      if (!clientData) {
        continue;
      }

      const clientId = clients[index]?.id;
      if (!clientId) {
        continue;
      }

      const assessments = clientData.assessments ?? [];
      for (const assessment of assessments) {
        if (assessment.status === 'DRAFT' || assessment.status === 'IN_REVIEW') {
          assessmentsNeedingCompletion += 1;
          clientsWithAssessmentNeeds.add(clientId);
        }
      }

      const activeCarePlans = (clientData.carePlans ?? []).filter((plan) => plan.status === 'ACTIVE');
      for (const plan of activeCarePlans) {
        if (!isFiniteDate(plan.reviewDueAt)) {
          continue;
        }
        const reviewDueAtMs = new Date(plan.reviewDueAt).getTime();
        if (reviewDueAtMs <= dueSoonBoundary) {
          carePlanReviewsDueSoon += 1;
          if (reviewDueAtMs < now) {
            overdueCarePlanReviews += 1;
          }
        }
      }

      const evidencePacks = clientData.evidencePacks ?? [];
      if (activeCarePlans.length > 0) {
        const activePlanIds = new Set(activeCarePlans.map((plan) => plan.id));
        const hasEvidenceForActivePlan = evidencePacks.some(
          (pack) => {
            if (!pack.carePlanId) {
              return false;
            }
            return activePlanIds.has(pack.carePlanId);
          },
        );
        if (!hasEvidenceForActivePlan) {
          clientsWithEvidenceGaps.add(clientId);
        }
      } else if (evidencePacks.length === 0) {
        clientsWithEvidenceGaps.add(clientId);
      }
    }

    return {
      assessmentsNeedingCompletion,
      assessmentsPeopleCount: clientsWithAssessmentNeeds.size,
      carePlanReviewsDueSoon,
      overdueCarePlanReviews,
      evidenceGaps: clientsWithEvidenceGaps.size,
    };
  } catch {
    return safeFallback;
  }
}

const statusConfig = {
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'In Progress' },
  scheduled: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Scheduled' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Cancelled' },
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const roles = Array.isArray((session as any)?.roles) ? (session as any).roles : []
  const isAdmin = roles.some((role: unknown) => String(role).toLowerCase() === 'admin')

  const [stats, activeClientTotal, shiftData, todayVisitsData, familyUpdateReviewCount, openConcernCount, careSpineSignalData, medicationExceptionCount] = await Promise.all([
    getTodayStats(),
    getClientTotal(),
    getShiftDashboardData(isAdmin),
    getTodayVisits(),
    getFamilyUpdateReviewCount(),
    getOpenConcernCount(),
    getCareSpineSignalData(),
    getMedicationExceptionCount(),
  ]);
  const recentActivity = buildRecentActivity(todayVisitsData.visits);
  const upcomingVisits = buildUpcomingVisits(todayVisitsData.visits);
  const attentionCount = calculateAttentionCount(todayVisitsData.visits);
  const missingCareNoteCount = await getMissingCareNoteCount(todayVisitsData.visits);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const commandCentreCards = [
    {
      label: 'Visits at risk',
      count: attentionCount,
      detail: attentionCount > 0 ? 'Scheduled care visits are overdue.' : 'No overdue scheduled visits.',
      href: '/schedule',
      tone: attentionCount > 0 ? 'amber' : 'slate',
    },
    {
      label: 'Starting soon',
      count: upcomingVisits.length,
      detail: "Upcoming care visits from today's schedule.",
      href: '/schedule',
      tone: 'teal',
    },
    {
      label: 'Missing care notes',
      count: missingCareNoteCount,
      detail: missingCareNoteCount > 0
        ? 'Completed care visits without a Care Note recorded should be reviewed.'
        : 'Every completed care visit today has a Care Note recorded.',
      href: '/schedule',
      tone: missingCareNoteCount > 0 ? 'amber' : 'slate',
    },
    {
      label: 'Medication exceptions',
      count: medicationExceptionCount,
      detail: medicationExceptionCount > 0
        ? 'Missed, refused, or overdue scheduled medication support needs review.'
        : 'No missed, refused, or overdue scheduled medication support found today.',
      href: '/medication',
      tone: medicationExceptionCount > 0 ? 'rose' : 'slate',
    },
    {
      label: 'Family updates to review',
      count: familyUpdateReviewCount,
      detail: 'Verified Visit Updates awaiting staff approval.',
      href: '/family-updates/approvals',
      tone: familyUpdateReviewCount > 0 ? 'sky' : 'slate',
    },
    {
      label: 'Concerns needing response',
      count: openConcernCount,
      detail: 'Open Concern Cases in the resolution tracker.',
      href: '/family-updates/concerns',
      tone: openConcernCount > 0 ? 'rose' : 'slate',
    },
    {
      label: 'Care plan reviews due soon',
      count: careSpineSignalData.carePlanReviewsDueSoon,
      detail: careSpineSignalData.carePlanReviewsDueSoon > 0
        ? `${careSpineSignalData.overdueCarePlanReviews} overdue; review active care plans with due dates in the next 30 days.`
        : 'No active care-plan reviews due in the next 30 days.',
      href: '/care-planning',
      tone: careSpineSignalData.carePlanReviewsDueSoon > 0 ? 'amber' : 'slate',
    },
    {
      label: 'Assessments needing completion',
      count: careSpineSignalData.assessmentsNeedingCompletion,
      detail: careSpineSignalData.assessmentsNeedingCompletion > 0
        ? `${careSpineSignalData.assessmentsPeopleCount} people have draft or in-review assessments needing completion.`
        : 'No draft or in-review assessments need completion right now.',
      href: '/care-planning',
      tone: careSpineSignalData.assessmentsNeedingCompletion > 0 ? 'sky' : 'slate',
    },
    {
      label: 'Evidence gaps',
      count: careSpineSignalData.evidenceGaps,
      detail: careSpineSignalData.evidenceGaps > 0
        ? 'People with active plans lacking evidence packs, or no packs yet, need evidence follow-up.'
        : 'No immediate evidence-pack gaps detected for people in scope.',
      href: '/evidence',
      tone: careSpineSignalData.evidenceGaps > 0 ? 'rose' : 'slate',
    },
  ];

  const toneClasses: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    teal: 'border-teal-200 bg-teal-50 text-teal-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header notificationCount={2} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Today Command Centre
          </h1>
          <p className="text-slate-500 mt-1">
            Start with today&apos;s care risks, review queues, family concerns, and operational exceptions.
          </p>
          <p className="text-sm text-slate-400 mt-2">{currentDate}</p>
        </div>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-slate-900">Start here</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The fastest way to move through today&apos;s care operations without hunting through the app.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                Daily workflow
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Link
                href="/schedule"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
              >
                <p className="text-sm font-semibold text-slate-900">Schedule</p>
                <p className="mt-1 text-sm text-slate-600">Review schedules, delays, and completions.</p>
              </Link>
              <Link
                href="/people"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
              >
                <p className="text-sm font-semibold text-slate-900">People</p>
                <p className="mt-1 text-sm text-slate-600">Find person profiles, Care Notes, and visit context.</p>
              </Link>
              <Link
                href="/family-updates"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-sky-200 hover:bg-sky-50"
              >
                <p className="text-sm font-semibold text-slate-900">Family Updates</p>
                <p className="mt-1 text-sm text-slate-600">Approve proof-of-care updates and resolve concerns.</p>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Need attention today</h2>
            <p className="mt-2 text-sm text-slate-600">
              {attentionCount > 0
                ? `${attentionCount} scheduled visit${attentionCount === 1 ? ' is' : 's are'} now overdue and should be checked first.`
                : 'No overdue scheduled visits right now. You can focus on the rest of today’s workload.'}
            </p>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-slate-900">Action lanes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Every card has a destination. Empty lanes explain what will become active as the frontier modules land.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commandCentreCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses[card.tone]}`}
              >
                <p className="text-sm font-semibold">{card.label}</p>
                <p className="mt-2 text-3xl font-black">{card.count}</p>
                <p className="mt-2 text-xs leading-5 opacity-75">{card.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Care visits today */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Care visits today</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.booked}</p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                {stats.finished} completed
              </span>
            </div>
          </div>

          {/* People supported */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">People supported</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{activeClientTotal}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-slate-500">Organization-scoped total</span>
            </div>
          </div>

          {/* Care team on shift */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Care team on shift</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{shiftData.activeCarersNow}</p>
              </div>
              <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {isAdmin ? (
                <span className="text-sm text-slate-500">Live workforce coverage</span>
              ) : (
                <span className="text-sm text-slate-500">
                  {shiftData.activeCarersNow > 0 ? 'You are on shift' : 'You are off shift'}
                </span>
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-amber-100">Needs Attention</p>
                <p className="text-3xl font-bold text-white mt-1">{attentionCount}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-amber-100">
                {attentionCount > 0 ? 'Scheduled visits now overdue' : 'No overdue scheduled visits'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-slate-900">
                    Recent Activity
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Latest updates from your care team
                  </p>
                </div>
                <Link href="/activity" className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                  View All →
                </Link>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No visit activity recorded for today yet.</div>
              ) : (
                recentActivity.map((activity) => {
                  const config = statusConfig[activity.status]
                  return (
                    <div
                      key={activity.id}
                      className="p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-2 h-2 rounded-full mt-2 ${config.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{activity.client}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 text-sm">{activity.carer}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{activity.action}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                            {config.label}
                          </span>
                          <time className="text-sm text-slate-400 tabular-nums">
                            {activity.time}
                          </time>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {isAdmin ? (
                  <>
                    <Button asChild variant="ghost" className="w-full justify-start rounded-xl bg-teal-50 px-4 py-3 text-left text-teal-700 hover:bg-teal-100">
                      <Link href="/visits/new">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Schedule Visit
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                      <Link href="/clients/new">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Add person
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                      <Link href="/family-updates">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8m-8 0a3 3 0 100 6h1m7-6a3 3 0 110 6h-1M8 12a3 3 0 110-6h1m7 6a3 3 0 100-6h-1" />
                        </svg>
                        Review Family Updates
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                      <Link href="/admin/analytics">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18m4-12v12m4-6v6M7 13v8M3 21h18" />
                        </svg>
                        Workforce Analytics
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="ghost" className="w-full justify-start rounded-xl bg-teal-50 px-4 py-3 text-left text-teal-700 hover:bg-teal-100">
                    <Link href="/shift">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {shiftData.activeCarersNow > 0 ? 'Clock Out' : 'Clock In'}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                  <Link href="/activity">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Reports
                  </Link>
                </Button>
              </div>
            </div>

            {/* AI Summaries Card */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="font-heading font-semibold">AI Health Summaries</h3>
              </div>
              <p className="text-violet-100 text-sm mb-4">
                Review current client summaries and approvals
              </p>
              <Link href="/people" className="block text-center w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 font-medium transition-colors">
                Review Summaries
              </Link>
            </div>

            {/* Today's Schedule Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-4">Upcoming</h3>
              <div className="space-y-3">
                {upcomingVisits.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 text-sm text-slate-500">
                    No upcoming visits today.
                  </div>
                ) : (
                  upcomingVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                      <div className="text-sm font-mono font-medium text-slate-600 w-12">
                        {visit.time}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 text-sm">{visit.client}</p>
                        <p className="text-xs text-slate-500">{visit.type}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
