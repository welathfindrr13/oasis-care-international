import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { query } from '../../../lib/graphql/client'
import {
  CARERS_QUERY,
  ELIGIBLE_CARER_MEMBERSHIPS_QUERY,
  SHIFT_ANALYTICS_QUERY,
  type CarersQueryResponse,
  type EligibleCarerMembershipsQueryResponse,
  type ShiftAnalyticsQueryResponse,
} from '../../../lib/graphql/queries'
import { CarerMembershipLinkForm } from './CarerMembershipLinkForm'

export const dynamic = 'force-dynamic'

async function getCarers() {
  try {
    const response = await query<CarersQueryResponse>(CARERS_QUERY)
    return { carers: response.carers, error: null as string | null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load carers'
    return { carers: [], error: message }
  }
}

async function getShiftAnalytics() {
  try {
    const response = await query<ShiftAnalyticsQueryResponse>(SHIFT_ANALYTICS_QUERY)
    return response.shiftAnalytics
  } catch {
    return {
      activeCarersNow: 0,
      openShiftCount: 0,
      clockIns: 0,
      clockOuts: 0,
      averageShiftMinutes: 0,
      clockInMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
      clockOutMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
    }
  }
}

async function getEligibleMemberships() {
  try {
    const response = await query<EligibleCarerMembershipsQueryResponse>(
      ELIGIBLE_CARER_MEMBERSHIPS_QUERY,
    )
    return { memberships: response.eligibleCarerMemberships, error: null as string | null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workforce logins'
    return { memberships: [], error: message }
  }
}

export default async function AdminCarersPage() {
  const [{ carers, error }, analytics, eligible] = await Promise.all([
    getCarers(),
    getShiftAnalytics(),
    getEligibleMemberships(),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              Carer Directory
            </h1>
            <p className="text-slate-500 mt-1">
              Create trusted workforce records and explicitly link them to authenticated staff logins.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/analytics">Workforce Analytics</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/schedule">View Schedule</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Active carers now" value={analytics.activeCarersNow} />
          <MetricCard label="Open shifts" value={analytics.openShiftCount} />
          <MetricCard label="Carers in directory" value={carers.length} />
        </div>

        <CarerMembershipLinkForm
          initialMemberships={eligible.memberships}
          initialError={eligible.error}
        />

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900 font-heading">
              Operational note
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Carer identities must stay aligned with authenticated workforce accounts so visit assignment,
              RBAC, and shift history remain trustworthy.
            </p>
            <p>
              Only active, unlinked carer or staff memberships appear in the linking form. Login identity is
              selected explicitly; profile email is never used to choose or match an account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 font-heading">Carers</h2>
                <p className="text-sm text-slate-500">
                  Live records available to scheduling and shift workflows.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : carers.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No carers are available in this organization yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                      <th className="py-3 pr-4 font-medium">Carer</th>
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="py-3 pr-4 font-medium">Phone</th>
                      <th className="py-3 font-medium">Identity reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carers.map((carer) => (
                      <tr key={carer.id} className="border-b border-slate-100 align-top">
                        <td className="py-4 pr-4">
                          <div className="font-medium text-slate-900">
                            {carer.firstName} {carer.lastName}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-600">{carer.email}</td>
                        <td className="py-4 pr-4 text-sm text-slate-600">{carer.phone || '—'}</td>
                        <td className="py-4 text-sm text-slate-500 font-mono">{carer.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate-500">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
