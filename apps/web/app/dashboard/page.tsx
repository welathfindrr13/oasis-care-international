import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { buttonVariants } from '../../components/ui/Button'
import { authOptions } from '../../lib/auth/auth-options'
import { hasRole } from '../../lib/auth/roles'
import { formatDate } from '../../lib/time'
import { getSiteBaseUrl } from '../../lib/url'

export const metadata: Metadata = {
  title: 'Dashboard - Oasis Care',
  description: 'Operational overview of today&apos;s real visit workload',
}

export const dynamic = 'force-dynamic'

interface TodayStats {
  booked: number
  finished: number
}

async function getTodayStats(): Promise<TodayStats> {
  try {
    const baseUrl = getSiteBaseUrl()
    const cookie = cookies().toString()
    const response = await fetch(`${baseUrl}/api/stats/today`, {
      cache: 'no-store',
      headers: { cookie },
    })

    if (!response.ok) {
      return { booked: 0, finished: 0 }
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching today stats:', error)
    return { booked: 0, finished: 0 }
  }
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: number
  helper: string
}) {
  return (
    <Card className="rounded-2xl border-slate-100">
      <CardContent className="mb-0 p-6">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-3 text-sm text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  )
}

function ShortcutLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  )
}

function LaunchpadLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
    >
      {label}
    </Link>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const stats = await getTodayStats()
  const isAdmin = hasRole((session as any)?.roles, 'admin')
  const isCarer = hasRole((session as any)?.roles, 'carer')
  const remainingVisits = Math.max(stats.booked - stats.finished, 0)
  const greetingName = session?.user?.name || session?.user?.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {greetingName}
            </h1>
            <p className="mt-1 text-slate-500">
              {formatDate(new Date())} • live visit totals and the quickest route into today&apos;s care day
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/visits" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open visits
            </Link>
            <Link href="/emar" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open eMAR
            </Link>
            <Link href="/activity" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Open activity
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Scheduled today"
            value={stats.booked}
            helper={isCarer ? 'Visits currently assigned to you for today.' : 'Visits scheduled for today.'}
          />
          <StatCard
            label="Completed today"
            value={stats.finished}
            helper={isCarer ? 'Visits you have finished today.' : 'Visits recorded as finished today.'}
          />
          <StatCard
            label="Remaining today"
            value={remainingVisits}
            helper="Scheduled visits still not recorded as finished."
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border-slate-100">
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Primary workflows</h2>
              <p className="text-sm text-slate-500">
                Jump into the real screens Oasis already supports operationally.
              </p>
            </CardHeader>
            <CardContent className="mb-0 grid gap-4 sm:grid-cols-2">
              {isAdmin ? (
                <>
                  <ShortcutLink
                    href="/visits/new"
                    title="Schedule a visit"
                    description="Create the next visit and assign the right carer."
                  />
                  <ShortcutLink
                    href="/clients"
                    title="Review clients"
                    description="Open client records, prescriptions, and visit history without leaving the operational flow."
                  />
                  <ShortcutLink
                    href="/admin/carers"
                    title="Review carer directory"
                    description="Check workforce status and move into visit scheduling."
                  />
                  <ShortcutLink
                    href="/admin/medications"
                    title="Manage medication library"
                    description="Create medications and keep prescription setup operational."
                  />
                </>
              ) : (
                <>
                  <ShortcutLink
                    href="/visits"
                    title="Work through visits"
                    description="Open your assigned visits and record care delivery on visit detail."
                  />
                  <ShortcutLink
                    href="/emar"
                    title="Review medication"
                    description="See medication due today and record administration outcomes from the working queue."
                  />
                  <ShortcutLink
                    href="/activity"
                    title="Check today&apos;s totals"
                    description="See the real counts behind today&apos;s operational workload."
                  />
                  <ShortcutLink
                    href="/settings"
                    title="Account and device access"
                    description="Review your session details and install access."
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-100">
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Start here today</h2>
            </CardHeader>
            <CardContent className="mb-0 space-y-4 text-sm text-slate-600">
              <p>
                {isAdmin
                  ? "Use this page as the launchpad for today's care day: move into visits, review client records, check medication execution, and open the pilot proof story when you need the big picture."
                  : 'Use this page to move quickly into the routes that matter today: your visit queue, medication work, and the totals that explain what is still outstanding.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {isAdmin ? (
                  <>
                    <LaunchpadLink href="/visits" label="Open today's visit queue" />
                    <LaunchpadLink href="/emar" label="Open eMAR" />
                    <LaunchpadLink href="/admin/pilot" label="Open pilot story" />
                  </>
                ) : (
                  <>
                    <LaunchpadLink href="/visits" label="Open your queue" />
                    <LaunchpadLink href="/emar" label="Record medication outcomes" />
                    <LaunchpadLink href="/activity" label="Check today's totals" />
                  </>
                )}
              </div>
              <p>The cards above are today&apos;s live visit totals. Use the routes here to step straight into the working screens.</p>
              {!isAdmin && !isCarer && (
                <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
                  This dashboard is primarily built for admin and carer workflows.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
