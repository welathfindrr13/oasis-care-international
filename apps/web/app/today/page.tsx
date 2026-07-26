import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardPage from '../dashboard/page'
import { Header } from '../../components/oasis/Header'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { hasAccessCapability } from '../../lib/auth/capabilities'
import { resolveAuthoritativeRoute } from '../../lib/auth/access'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { query } from '../../lib/graphql/client'
import {
  MY_ACTIVE_SHIFT_QUERY,
  VISITS_QUERY,
  type CarerShift,
  type MyActiveShiftQueryResponse,
  type Visit,
  type VisitsQueryResponse,
} from '../../lib/graphql/queries'
import {
  formatLondonLongDate,
  formatTime,
  getLondonDayUtcRange,
} from '../../lib/time'
import { todayShiftAction } from '../shift/shiftPresentation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Today - Oasis Care',
  description: 'Your work for today in Oasis Care',
}

type CarerTodayData = {
  visits: Visit[]
  activeShift: CarerShift | null
  shiftUnavailable: boolean
}

async function loadCarerTodayData(
  canViewShift: boolean,
): Promise<CarerTodayData> {
  const range = getLondonDayUtcRange()
  const inclusiveEnd = new Date(new Date(range.end).getTime() - 1).toISOString()
  const [visitsResult, shiftResult] = await Promise.allSettled([
    query<VisitsQueryResponse>(VISITS_QUERY, {
      scheduledStartFrom: range.start,
      scheduledStartTo: inclusiveEnd,
      skip: 0,
      take: 50,
    }),
    canViewShift
      ? query<MyActiveShiftQueryResponse>(MY_ACTIVE_SHIFT_QUERY)
      : Promise.resolve({ myActiveShift: null }),
  ])

  if (visitsResult.status === 'rejected') throw visitsResult.reason
  return {
    visits: [...visitsResult.value.visits.items].sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() -
        new Date(b.scheduledStart).getTime(),
    ),
    activeShift:
      shiftResult.status === 'fulfilled'
        ? shiftResult.value.myActiveShift
        : null,
    shiftUnavailable: canViewShift && shiftResult.status === 'rejected',
  }
}

function statusLabel(status: Visit['status']): string {
  return status === 'IN_PROGRESS'
    ? 'In progress'
    : status === 'COMPLETED'
      ? 'Completed'
      : status === 'CANCELLED'
        ? 'Cancelled'
        : 'Scheduled'
}

function statusClass(status: Visit['status']): string {
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800'
  if (status === 'COMPLETED') return 'bg-green-100 text-green-800'
  if (status === 'CANCELLED') return 'bg-slate-200 text-slate-700'
  return 'bg-amber-100 text-amber-800'
}

function addressFor(visit: Visit): string {
  const client = visit.client
  if (!client) return 'Address unavailable'
  return [
    client.addressLine1,
    client.addressLine2,
    client.city,
    client.postcode,
  ]
    .filter(Boolean)
    .join(', ')
}

function VisitCard({
  visit,
  prominent = false,
}: {
  visit: Visit
  prominent?: boolean
}) {
  const completedTasks = visit.tasks.filter((task) => task.isCompleted).length
  return (
    <article
      className={`rounded-xl border bg-white p-5 ${
        prominent ? 'border-teal-300 shadow-sm' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-800">
            {formatTime(visit.scheduledStart)}–{formatTime(visit.scheduledEnd)}
          </p>
          <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">
            {visit.client?.fullName || 'Person supported'}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(visit.status)}`}
        >
          {statusLabel(visit.status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {addressFor(visit)}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {visit.tasks.length === 0
          ? 'No care actions listed'
          : `${completedTasks} of ${visit.tasks.length} care actions done`}
      </p>
      <Button
        asChild
        className="mt-5 w-full sm:w-auto"
        size={prominent ? 'lg' : 'md'}
      >
        <Link href={`/schedule/${visit.id}`}>
          {visit.status === 'IN_PROGRESS' ? 'Continue visit' : 'Open visit'}
        </Link>
      </Button>
    </article>
  )
}

function CarerTodayUnavailable() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card className="border-red-200">
          <CardHeader>
            <h1 className="font-heading text-2xl font-bold text-slate-950">
              Today&apos;s visits are unavailable
            </h1>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              We could not load your assigned visits. Try again before starting
              care.
            </p>
            <Button asChild className="mt-5">
              <Link href="/today">Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function CarerTodayBoundary({
  data,
  canViewShift,
}: {
  data: CarerTodayData
  canViewShift: boolean
}) {
  const today = formatLondonLongDate(new Date())
  const currentOrNext =
    data.visits.find((visit) => visit.status === 'IN_PROGRESS') ||
    data.visits.find((visit) => visit.status === 'SCHEDULED') ||
    null
  const remainingVisits = currentOrNext
    ? data.visits.filter((visit) => visit.id !== currentOrNext.id)
    : data.visits

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm font-medium text-slate-500">{today}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-slate-950">
          Today
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Your assigned care visits for today.
        </p>

        {canViewShift && (
          <section
            aria-labelledby="today-shift-heading"
            className="mt-6 border border-oasis-border border-l-4 border-l-oasis-teal bg-white p-5"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="today-shift-heading"
                  className="text-lg font-bold text-oasis-ink"
                >
                  My shift
                </h2>
                <p className="mt-2 text-base font-semibold text-oasis-ink">
                  {data.shiftUnavailable
                    ? 'Shift status unavailable'
                    : data.activeShift
                      ? `Shift started at ${formatTime(data.activeShift.clockInAt)}`
                      : 'You are not clocked in'}
                </p>
                <p className="mt-1 text-sm leading-6 text-oasis-muted">
                  {data.shiftUnavailable
                    ? 'Open My shift to try loading your status again.'
                    : data.activeShift
                      ? 'Your shift is active. Open it when you are ready to clock out.'
                      : 'Clock in when you are ready to start work.'}
                </p>
              </div>
              <Button asChild className="w-full shrink-0 sm:w-auto" size="lg">
                <Link href="/shift">
                  {todayShiftAction({
                    active: Boolean(data.activeShift?.isActive),
                    unavailable: data.shiftUnavailable,
                  })}
                </Link>
              </Button>
            </div>
          </section>
        )}

        {data.visits.length === 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <h2 className="font-heading text-2xl font-bold text-slate-950">
                No visits assigned today
              </h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                There are no care visits on your list for today. Check My visits
                for other dates.
              </p>
              <Button asChild className="mt-5" variant="secondary">
                <Link href="/visits">Open my visits</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-8">
            {currentOrNext && (
              <section aria-labelledby="current-visit-heading">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                  {currentOrNext.status === 'IN_PROGRESS'
                    ? 'Current visit'
                    : 'Next visit'}
                </p>
                <h2 id="current-visit-heading" className="sr-only">
                  {currentOrNext.status === 'IN_PROGRESS'
                    ? 'Current visit'
                    : 'Next visit'}
                </h2>
                <div className="mt-2">
                  <VisitCard visit={currentOrNext} prominent />
                </div>
              </section>
            )}

            {remainingVisits.length > 0 && (
              <section aria-labelledby="today-visits-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2
                      id="today-visits-heading"
                      className="font-heading text-2xl font-bold text-slate-950"
                    >
                      {currentOrNext ? 'Other visits today' : 'Today’s visits'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {remainingVisits.length}{' '}
                      {remainingVisits.length === 1 ? 'visit' : 'visits'}
                    </p>
                  </div>
                  <Link
                    href="/visits"
                    className="text-sm font-semibold text-teal-800 hover:text-teal-900"
                  >
                    View all my visits
                  </Link>
                </div>
                <div className="mt-4 space-y-4">
                  {remainingVisits.map((visit) => (
                    <VisitCard key={visit.id} visit={visit} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default async function TodayPage() {
  const { accessSnapshot } = await getServerAuthContext()
  const routeDecision = resolveAuthoritativeRoute('/today', accessSnapshot)
  if (routeDecision.action === 'redirect') {
    redirect(routeDecision.destination)
  }
  if (hasAccessCapability(accessSnapshot.capabilities, 'TENANT_ADMIN')) {
    return <DashboardPage accessSnapshot={accessSnapshot} />
  }
  if (
    hasAccessCapability(
      accessSnapshot.capabilities,
      'FRONTLINE_ASSIGNED_VISITS_VIEW',
    )
  ) {
    const canViewShift = hasAccessCapability(
      accessSnapshot.capabilities,
      'FRONTLINE_SHIFT_VIEW',
    )
    try {
      const data = await loadCarerTodayData(canViewShift)
      return <CarerTodayBoundary data={data} canViewShift={canViewShift} />
    } catch (error) {
      console.error('Failed to load Carer Today:', error)
      return <CarerTodayUnavailable />
    }
  }
  redirect('/access/unavailable')
}
