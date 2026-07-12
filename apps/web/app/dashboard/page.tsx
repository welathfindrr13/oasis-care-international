import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '../../components/oasis/Header'
import { Button } from '../../components/ui/Button'
import { resolveAuthoritativeRoute } from '../../lib/auth/access'
import type { AuthoritativeAccessSnapshot } from '../../lib/auth/access-snapshot'
import { hasAccessCapability } from '../../lib/auth/capabilities'
import { getServerAuthContext } from '../../lib/auth/server-auth'
import { query } from '../../lib/graphql/client'
import {
  SHIFT_ANALYTICS_QUERY,
  VISITS_QUERY,
  type ShiftAnalyticsQueryResponse,
  type Visit,
  type VisitsQueryResponse,
} from '../../lib/graphql/queries'
import { formatLondonLongDate, formatTime, getLondonDayUtcRange } from '../../lib/time'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Today - Oasis Care',
  description: 'Today’s visits, staffing, and urgent operational exceptions',
}

interface CareLogCountResponse {
  careLogs: { total: number }
}

type AdminTodayData = {
  visits: Visit[]
  activeCarersNow: number
  incompleteRecordCount: number
}

const CARE_LOG_COUNT_BY_VISIT_QUERY = `
  query CareLogCountByVisit($visitId: ID!, $skip: Int, $take: Int) {
    careLogs(visitId: $visitId, skip: $skip, take: $take) { total }
  }
`

function visitStatusLabel(visit: Visit, now = Date.now()): string {
  if (visit.status === 'IN_PROGRESS') return 'In progress'
  if (visit.status === 'COMPLETED') return 'Completed'
  if (visit.status === 'CANCELLED') return 'Cancelled'
  return new Date(visit.scheduledStart).getTime() < now ? 'Late' : 'Scheduled'
}

function visitStatusClass(visit: Visit, now = Date.now()): string {
  const label = visitStatusLabel(visit, now)
  if (label === 'Completed') return 'bg-emerald-50 text-emerald-800'
  if (label === 'In progress') return 'bg-blue-50 text-blue-800'
  if (label === 'Late') return 'bg-rose-50 text-rose-800'
  if (label === 'Cancelled') return 'bg-slate-100 text-slate-700'
  return 'bg-amber-50 text-amber-800'
}

function carerName(visit: Visit): string {
  return visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Unassigned'
}

async function getIncompleteRecordCount(visits: Visit[]): Promise<number> {
  const results = await Promise.all(
    visits.filter((visit) => visit.status === 'COMPLETED').map(async (visit) => {
      const response = await query<CareLogCountResponse>(CARE_LOG_COUNT_BY_VISIT_QUERY, {
        visitId: visit.id,
        skip: 0,
        take: 1,
      })
      return response.careLogs.total === 0 ? 1 : 0
    }),
  )
  return results.reduce<number>((total, value) => total + value, 0)
}

async function loadAdminTodayData(): Promise<AdminTodayData> {
  const range = getLondonDayUtcRange()
  const inclusiveEnd = new Date(new Date(range.end).getTime() - 1).toISOString()
  const [visitsResponse, shiftResponse] = await Promise.all([
    query<VisitsQueryResponse>(VISITS_QUERY, {
      scheduledStartFrom: range.start,
      scheduledStartTo: inclusiveEnd,
      take: 100,
      skip: 0,
    }),
    query<ShiftAnalyticsQueryResponse>(SHIFT_ANALYTICS_QUERY),
  ])
  const visits = [...(visitsResponse.visits.items ?? [])].sort(
    (left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime(),
  )
  return {
    visits,
    activeCarersNow: shiftResponse.shiftAnalytics.activeCarersNow,
    incompleteRecordCount: await getIncompleteRecordCount(visits),
  }
}

function AdminTodayUnavailable() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-slate-950">
          <h1 className="font-heading text-2xl font-bold">Today&apos;s operations are unavailable</h1>
          <p className="mt-2 leading-6 text-slate-700">
            Oasis could not load the visit and staffing information needed for a safe overview. No totals or all-clear
            messages are being shown.
          </p>
          <Button asChild className="mt-5"><Link href="/today">Try again</Link></Button>
        </div>
      </main>
    </div>
  )
}

export default async function DashboardPage({
  accessSnapshot: suppliedAccessSnapshot,
}: {
  accessSnapshot?: AuthoritativeAccessSnapshot
} = {}) {
  const accessSnapshot = suppliedAccessSnapshot ?? (await getServerAuthContext()).accessSnapshot
  const routeDecision = resolveAuthoritativeRoute('/dashboard', accessSnapshot)
  if (routeDecision.action === 'redirect') redirect(routeDecision.destination)
  if (!hasAccessCapability(accessSnapshot.capabilities, 'TENANT_ADMIN')) redirect('/access/unavailable')

  let data: AdminTodayData
  try {
    data = await loadAdminTodayData()
  } catch {
    return <AdminTodayUnavailable />
  }

  const now = Date.now()
  const lateVisits = data.visits.filter(
    (visit) => visit.status === 'SCHEDULED' && new Date(visit.scheduledStart).getTime() < now,
  )
  const unassignedVisits = data.visits.filter((visit) => visit.status !== 'CANCELLED' && !visit.carer)
  const completedVisits = data.visits.filter((visit) => visit.status === 'COMPLETED')
  const inProgressVisits = data.visits.filter((visit) => visit.status === 'IN_PROGRESS')
  const urgentCount = lateVisits.length + unassignedVisits.length + data.incompleteRecordCount
  const attentionItems = [
    {
      label: 'Late or missed visits',
      count: lateVisits.length,
      detail: lateVisits.length === 0 ? 'No scheduled visits are overdue.' : 'Check visits that should already have started.',
    },
    {
      label: 'Unassigned visits',
      count: unassignedVisits.length,
      detail: unassignedVisits.length === 0 ? 'Every active visit has a Carer.' : 'Assign a Carer before these visits start.',
    },
    {
      label: 'Incomplete visit records',
      count: data.incompleteRecordCount,
      detail: data.incompleteRecordCount === 0 ? 'Completed visits have a care note.' : 'Completed visits are missing a care note.',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{formatLondonLongDate(new Date())}</p>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-950">Today</h1>
            <p className="mt-2 text-slate-600">See what is happening now and resolve visit problems first.</p>
          </div>
          <Button asChild size="lg"><Link href="/schedule">Open today&apos;s schedule</Link></Button>
        </div>

        <section aria-labelledby="today-summary" className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 id="today-summary" className="sr-only">Today&apos;s operational summary</h2>
          <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
            {[
              ['Visits today', data.visits.length],
              ['In progress', inProgressVisits.length],
              ['Completed', completedVisits.length],
              ['Carers on shift', data.activeCarersNow],
            ].map(([label, count]) => (
              <div key={label} className="p-4 sm:p-5">
                <dt className="text-sm font-medium text-slate-600">{label}</dt>
                <dd className="mt-1 text-3xl font-bold text-slate-950">{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="attention-heading" className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 id="attention-heading" className="font-heading text-xl font-bold text-slate-950">Needs attention</h2>
              <p className="mt-1 text-sm text-slate-600">
                {urgentCount === 0 ? 'No urgent visit exceptions right now.' : `${urgentCount} visit exceptions need action.`}
              </p>
            </div>
            <Link href="/schedule" className="text-sm font-semibold text-teal-800 hover:text-teal-900">Review schedule</Link>
          </div>
          <ul className="divide-y divide-slate-200">
            {attentionItems.map((item) => (
              <li key={item.label} className="flex items-start gap-4 p-5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${item.count > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
                  {item.count}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">{item.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="schedule-heading" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 id="schedule-heading" className="font-heading text-xl font-bold text-slate-950">Today&apos;s visits</h2>
              <p className="mt-1 text-sm text-slate-600">Visit times, assignments, and current status.</p>
            </div>
            <Link href="/visits/new" className="text-sm font-semibold text-teal-800 hover:text-teal-900">Schedule a visit</Link>
          </div>

          {data.visits.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="font-semibold text-slate-950">No visits scheduled today</h3>
              <p className="mt-2 text-sm text-slate-600">Create a visit or check another date in the schedule.</p>
              <Button asChild className="mt-4"><Link href="/visits/new">Schedule a visit</Link></Button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200 md:hidden">
                {data.visits.map((visit) => (
                  <li key={visit.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-teal-800">{formatTime(visit.scheduledStart)}–{formatTime(visit.scheduledEnd)}</p>
                        <h3 className="mt-1 font-semibold text-slate-950">{visit.client?.fullName || 'Person unavailable'}</h3>
                        <p className="mt-1 text-sm text-slate-600">{carerName(visit)}</p>
                      </div>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${visitStatusClass(visit, now)}`}>{visitStatusLabel(visit, now)}</span>
                    </div>
                    <Link href={`/schedule/${visit.id}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-800">Open visit</Link>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Time</th>
                      <th className="px-5 py-3 font-semibold">Person</th>
                      <th className="px-5 py-3 font-semibold">Carer</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.visits.map((visit) => (
                      <tr key={visit.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">{formatTime(visit.scheduledStart)}–{formatTime(visit.scheduledEnd)}</td>
                        <td className="px-5 py-4 font-semibold text-slate-950">{visit.client?.fullName || 'Person unavailable'}</td>
                        <td className={`px-5 py-4 ${visit.carer ? 'text-slate-700' : 'font-semibold text-amber-800'}`}>{carerName(visit)}</td>
                        <td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${visitStatusClass(visit, now)}`}>{visitStatusLabel(visit, now)}</span></td>
                        <td className="px-5 py-4 text-right"><Link href={`/schedule/${visit.id}`} className="font-semibold text-teal-800 hover:text-teal-900">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
