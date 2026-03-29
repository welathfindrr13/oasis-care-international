import { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'
import { StatusChip } from '../../components/oasis/StatusChip'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { buttonVariants } from '../../components/ui/Button'
import { VisitActionCell } from './VisitActionCell'
import { VisitsToolbar } from './VisitsToolbar'
import { authOptions } from '../../lib/auth/auth-options'
import { hasRole } from '../../lib/auth/roles'
import { query } from '../../lib/graphql/client'
import { 
  CARERS_QUERY,
  VISITS_QUERY, 
  DEFAULT_PAGE_SIZE, 
  getSkipFromPage,
  type CarersQueryResponse,
  type VisitsQueryResponse,
  type Visit 
} from '../../lib/graphql/queries'
import { formatDate, formatDateInputValueInLondon, formatDateTime, formatTime, getLondonDayRange } from '../../lib/time'
import { getVisitQueueState, sortVisitsForQueue, type VisitQueueState } from './queue-state'

export const metadata: Metadata = {
  title: 'Visits - Oasis Care',
  description: 'Manage and track care visits',
}

export const dynamic = 'force-dynamic'

interface VisitsPageProps {
  searchParams: {
    date?: string;
    carerId?: string;
    status?: string;
    page?: string;
  };
}

const VALID_DATE_FILTER = /^\d{4}-\d{2}-\d{2}$/;

function getActiveQueueDate(rawDate?: string) {
  return rawDate && VALID_DATE_FILTER.test(rawDate) ? rawDate : formatDateInputValueInLondon();
}

function formatQueueDateLabel(dateInput: string) {
  return formatDate(`${dateInput}T12:00:00Z`);
}

function getTaskProgress(visit: Visit) {
  const total = visit.tasks.length;
  const completed = visit.tasks.filter((task) => task.isCompleted).length;

  return {
    total,
    completed,
    remaining: Math.max(total - completed, 0),
  };
}

function buildQueueSummary(visits: Visit[], now: Date) {
  return visits.reduce(
    (summary, visit) => {
      const queueState = getVisitQueueState(visit, now)

      if (queueState === 'needs_action_now') summary.needsActionNow += 1
      if (queueState === 'overdue') summary.overdue += 1
      if (queueState === 'upcoming') summary.upcoming += 1
      if (queueState === 'needs_review') summary.needsReview += 1
      if (queueState === 'in_progress') summary.inProgress += 1
      if (queueState === 'completed') summary.completed += 1
      if (queueState === 'cancelled') summary.cancelled += 1
      return summary;
    },
    {
      needsActionNow: 0,
      overdue: 0,
      upcoming: 0,
      needsReview: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    }
  )
}

async function getVisits(
  searchParams: VisitsPageProps['searchParams'],
  now: Date
): Promise<{ visits: Visit[]; total: number }> {
  try {
    const page = parseInt(searchParams.page || '1', 10);
    const skip = getSkipFromPage(page);
    const queueDate = getActiveQueueDate(searchParams.date);
    const { start: scheduledStartFrom, end: scheduledStartTo } = getLondonDayRange(queueDate);

    const variables = {
      scheduledStartFrom,
      scheduledStartTo,
      carerId: searchParams.carerId || undefined,
      status: searchParams.status || undefined,
      take: DEFAULT_PAGE_SIZE,
      skip,
    };

    const response = await query<VisitsQueryResponse>(VISITS_QUERY, variables);
    
    return {
      visits: sortVisitsForQueue(response.visits.items, now),
      total: response.visits.total,
    };
  } catch (error) {
    console.error('Failed to fetch visits:', error);
    return { visits: [], total: 0 };
  }
}

async function getCarersForFilter() {
  try {
    const response = await query<CarersQueryResponse>(CARERS_QUERY, { activeOnly: true });
    return response.carers;
  } catch (error) {
    console.error('Failed to fetch carers for visits filter:', error);
    return [];
  }
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-base-gray-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-1 text-sm text-text-secondary">{hint}</p>
    </div>
  )
}

function EmptyState({ isAdmin, queueDateLabel }: { isAdmin: boolean; queueDateLabel: string }) {
  return (
    <div className="text-center py-12">
      <div className="mb-4">
        <div className="w-24 h-24 mx-auto bg-base-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg 
            className="w-12 h-12 text-base-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-4 8.5V17m0-8.5v4m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" 
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        No visits found
      </h3>
      <p className="text-text-secondary mb-4">
        {isAdmin
          ? `No visits are currently queued for ${queueDateLabel}.`
          : `No visits are currently assigned to you for ${queueDateLabel}.`}
      </p>
      {isAdmin && (
        <Link href="/visits/new" className={buttonVariants({ variant: 'primary' })}>
          Schedule a visit
        </Link>
      )}
    </div>
  )
}

function formatRecordedWindow(actualStart?: string, actualEnd?: string) {
  if (actualStart && actualEnd) {
    return `Actual: ${formatDateTime(actualStart)} - ${formatTime(actualEnd)}`
  }

  if (actualStart) {
    return `Started: ${formatDateTime(actualStart)}`
  }

  if (actualEnd) {
    return `Completed: ${formatDateTime(actualEnd)}`
  }

  return null
}

function getQueueStateLabel(queueState: VisitQueueState) {
  switch (queueState) {
    case 'needs_action_now':
      return 'Needs action now'
    case 'overdue':
      return 'Overdue visit'
    case 'upcoming':
      return 'Upcoming visit'
    case 'needs_review':
      return 'Needs review'
    case 'in_progress':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
  }
}

function getQueueStateTone(queueState: VisitQueueState) {
  switch (queueState) {
    case 'needs_action_now':
      return 'text-brand-blue-primary bg-brand-blue-light/15 border-brand-blue-light'
    case 'overdue':
      return 'text-orange-700 bg-orange-50 border-orange-200'
    case 'upcoming':
      return 'text-slate-700 bg-slate-100 border-slate-200'
    case 'needs_review':
      return 'text-amber-800 bg-amber-50 border-amber-200'
    case 'in_progress':
      return 'text-brand-blue-primary bg-brand-blue-light/15 border-brand-blue-light'
    case 'completed':
      return 'text-brand-iris-100 bg-brand-iris-60 border-brand-iris-80'
    case 'cancelled':
      return 'text-base-gray-700 bg-base-gray-100 border-base-gray-300'
  }
}

function getQueueStateMessage(queueState: VisitQueueState, isAdmin: boolean) {
  switch (queueState) {
    case 'needs_action_now':
      return isAdmin
        ? 'Scheduled window is live and this visit should be underway.'
        : 'This visit is due now and needs care delivery attention.'
    case 'overdue':
      return isAdmin
        ? 'Scheduled end time has passed and no completion evidence is recorded.'
        : 'This visit is overdue and still needs care evidence recorded.'
    case 'upcoming':
      return isAdmin
        ? 'Scheduled later in the care day with no recorded evidence yet.'
        : 'Upcoming work later in the care day.'
    case 'needs_review':
      return 'Recorded evidence exists on a scheduled visit. Review before taking further action.'
    case 'in_progress':
      return 'Care delivery is actively in progress.'
    case 'completed':
      return 'Visit has recorded completion evidence.'
    case 'cancelled':
      return 'This visit has been cancelled.'
  }
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = hasRole((session as any)?.roles, 'admin');
  const activeDate = getActiveQueueDate(searchParams.date);
  const queueDateLabel = formatQueueDateLabel(activeDate);
  const queueNow = new Date()
  const [{ visits, total }, carers] = await Promise.all([
    getVisits({ ...searchParams, date: activeDate }, queueNow),
    isAdmin ? getCarersForFilter() : Promise.resolve([]),
  ]);
  const hasVisits = visits.length > 0;
  const summary = buildQueueSummary(visits, queueNow);
  const pageTitle = isAdmin ? 'Visits' : 'Your Visits';
  const pageSubtitle = isAdmin
    ? 'Run the operational queue for the current care day and move into visit detail when needed.'
    : 'Work from your assigned queue and move into visit detail when it is time to deliver care.';
  const sectionTitle = isAdmin
    ? `Care queue for ${queueDateLabel}`
    : `Your queue for ${queueDateLabel}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-slate-500 mt-1">
            {pageSubtitle}
          </p>
        </div>

        <VisitsToolbar
          isAdmin={isAdmin}
          carers={carers}
          selectedDate={activeDate}
          selectedStatus={searchParams.status}
          selectedCarerId={searchParams.carerId}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  {sectionTitle}
                </h2>
                <p className="text-sm text-text-secondary">
                  {hasVisits ? `${visits.length} of ${total} visits in the active queue` : `No visits queued for ${queueDateLabel}`}
                </p>
                {summary.needsReview > 0 && (
                  <p className="mt-1 text-sm text-amber-700">
                    {summary.needsReview} scheduled {summary.needsReview === 1 ? 'visit already has' : 'visits already have'} recorded evidence and should be reviewed.
                  </p>
                )}
              </div>
              {isAdmin && (
                <Link href="/visits/new" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                  Add visit
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <SummaryTile
                label="Needs Action Now"
                value={summary.needsActionNow}
                hint={isAdmin ? 'Visits due in the current care window.' : 'Visits that need attention right now.'}
              />
              <SummaryTile
                label="Overdue"
                value={summary.overdue}
                hint="Scheduled visits with no completion evidence after their window."
              />
              <SummaryTile
                label="Upcoming"
                value={summary.upcoming}
                hint={isAdmin ? 'Still due later in the day.' : 'Upcoming visits still to deliver today.'}
              />
              <SummaryTile
                label="Needs Review"
                value={summary.needsReview}
                hint="Scheduled visits with recorded evidence that should be reviewed."
              />
              <SummaryTile
                label="Completed"
                value={summary.completed}
                hint="Visits with recorded completion evidence."
              />
              <SummaryTile
                label="In Progress"
                value={summary.inProgress}
                hint={isAdmin ? 'Visits currently under way.' : 'Visits you should actively be working through.'}
              />
            </div>

            {hasVisits ? (
              <div className="overflow-x-auto">
                <table 
                  className="w-full"
                  role="table"
                  aria-label="Visits schedule"
                >
                  <thead>
                    <tr className="border-b border-base-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Visit
                      </th>
                      {isAdmin && (
                        <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                          Carer
                        </th>
                      )}
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Queue state
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        {isAdmin ? 'Actions' : 'Visit Progress'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((visit) => {
                      const taskProgress = getTaskProgress(visit)
                      const queueState = getVisitQueueState(visit, queueNow)
                      
                      return (
                        <tr 
                          key={visit.id}
                          className="border-b border-base-gray-100 align-top hover:bg-background-accent transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="font-medium text-text-primary">
                                {visit.client?.fullName || 'Unknown Client'}
                              </div>
                              <div className="text-sm text-text-secondary">
                                {visit.client && (
                                  `${visit.client.addressLine1}${visit.client.addressLine2 ? ', ' + visit.client.addressLine2 : ''}`
                                )}
                              </div>
                              <div className="text-sm text-text-primary">
                                {formatTime(visit.scheduledStart)} to {formatTime(visit.scheduledEnd)}
                              </div>
                              <time 
                                className="text-xs text-text-secondary"
                                dateTime={visit.scheduledStart}
                              >
                                Scheduled {formatDateTime(visit.scheduledStart)}
                              </time>
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="font-medium text-text-primary">
                                  {visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Unassigned'}
                                </div>
                                <div className="text-sm text-text-secondary">
                                  {visit.carer?.email ?? 'No email recorded'}
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusChip status={visit.status.toLowerCase() as any} />
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getQueueStateTone(queueState)}`}
                                >
                                  {getQueueStateLabel(queueState)}
                                </span>
                              </div>
                              {formatRecordedWindow(visit.actualStart, visit.actualEnd) ? (
                                <div className="text-xs text-brand-blue-primary">
                                  {formatRecordedWindow(visit.actualStart, visit.actualEnd)}
                                </div>
                              ) : (
                                <div className="text-xs text-text-secondary">
                                  Timing evidence not recorded yet
                                </div>
                              )}
                              <div className="text-sm text-text-secondary">
                                {taskProgress.total > 0
                                  ? `${taskProgress.completed} of ${taskProgress.total} tasks complete`
                                  : 'No tasks attached to this visit'}
                              </div>
                              <div className="text-xs text-text-secondary">
                                {getQueueStateMessage(queueState, isAdmin)}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <VisitActionCell
                              isAdmin={isAdmin}
                              queueState={queueState}
                              visit={{
                                id: visit.id,
                                status: visit.status,
                                actualStart: visit.actualStart,
                                actualEnd: visit.actualEnd,
                                tasks: visit.tasks.map((task) => ({
                                  id: task.id,
                                  isCompleted: task.isCompleted,
                                })),
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState isAdmin={isAdmin} queueDateLabel={queueDateLabel} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
