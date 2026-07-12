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
import { formatLondonLongDate } from '../../lib/time'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Today - Oasis Care',
  description: 'Your work for today in Oasis Care',
}

function CarerTodayBoundary({ canViewShift }: { canViewShift: boolean }) {
  const today = formatLondonLongDate(new Date())

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm font-medium text-slate-500">{today}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-slate-950">Today</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Open the visits assigned to you{canViewShift ? ' and check your shift' : ''}.
        </p>

        <Card className="mt-6 border-teal-200">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Start here
            </p>
            <h2 className="font-heading text-2xl font-bold text-slate-950">
              Your assigned visits
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              View today&apos;s visits, their scheduled times, and the care tasks you need to complete.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/visits">View my visits</Link>
              </Button>
              {canViewShift && (
                <Button asChild variant="secondary">
                  <Link href="/shift">Check my shift</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
    return (
      <CarerTodayBoundary
        canViewShift={hasAccessCapability(
          accessSnapshot.capabilities,
          'FRONTLINE_SHIFT_VIEW',
        )}
      />
    )
  }
  redirect('/access/unavailable')
}
