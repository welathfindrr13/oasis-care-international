import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { DeleteClientButton } from '../../../components/oasis/DeleteClientButton'
import { getServerAuthContext } from '../../../lib/auth/server-auth'
import { query } from '../../../lib/graphql/client'
import { formatDateTime, formatDate, formatTime } from '../../../lib/time'
import {
  CARE_PLANNING_QUERY,
  CLIENT_QUERY,
  VISITS_QUERY,
  type CarePlanningQueryResponse,
  type ClientQueryResponse,
  type VisitsQueryResponse,
} from '../../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

async function getClient(id: string) {
  try {
    const data = await query<ClientQueryResponse>(CLIENT_QUERY, { id })
    return data.client
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('not found')) {
      return null
    }
    throw error
  }
}

async function getClientSafe(id: string) {
  try {
    return { client: await getClient(id), error: null as string | null }
  } catch (error: any) {
    return {
      client: null,
      error: error?.message || 'Failed to load client details',
    }
  }
}

async function getRecentVisits(clientId: string) {
  const data = await query<VisitsQueryResponse>(VISITS_QUERY, {
    clientId,
    take: 5,
    skip: 0,
  })
  return data.visits.items
}

async function getRecentVisitsSafe(clientId: string) {
  try {
    return { visits: await getRecentVisits(clientId), error: null as string | null }
  } catch (error: any) {
    return {
      visits: [] as VisitsQueryResponse['visits']['items'],
      error: error?.message || 'Failed to load recent visits',
    }
  }
}

async function getCarePlanningSafe(clientId: string) {
  try {
    return await query<CarePlanningQueryResponse>(CARE_PLANNING_QUERY, { clientId, take: 20 })
  } catch {
    return null
  }
}

function formatAddress(client: {
  addressLine1: string
  addressLine2?: string | null
  city: string
  postcode: string
}) {
  return [client.addressLine1, client.addressLine2, `${client.city}, ${client.postcode}`]
    .filter(Boolean)
    .join(', ')
}

function formatShortDateTime(value?: string | null): string {
  if (!value) return 'Not set'
  return formatDateTime(value, { weekday: 'short' })
}

function formatShortDate(value?: string | null): string {
  if (!value) return 'Not set'
  return formatDate(value)
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const { client } = await getClientSafe(params.id)
  return {
    title: client ? `${client.fullName} - Oasis Care` : 'Person not found - Oasis Care',
    description: client ? `Care details for ${client.fullName}` : 'Person not found',
  }
}

export default async function ClientDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { roles } = await getServerAuthContext()
  const isAdmin = roles.some((role: unknown) => String(role).toLowerCase() === 'admin')
  const entityLabel = isAdmin ? 'client' : 'person'
  const entityLabelPlural = isAdmin ? 'Clients' : 'People'

  const { client, error: clientError } = await getClientSafe(params.id)

  if (clientError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Unable to load {entityLabel}
            </h1>
            <p className="text-slate-600 mb-4">{clientError}</p>
            <Button asChild variant="primary">
              <Link href="/clients">Back to {entityLabelPlural}</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {isAdmin ? 'Client' : 'Person'} not found
            </h1>
            <p className="text-slate-600 mb-4">
              The {entityLabel} you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild variant="primary">
              <Link href="/clients">Back to {entityLabelPlural}</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const { visits: recentVisits } = await getRecentVisitsSafe(client.id)
  const carePlanning = isAdmin ? await getCarePlanningSafe(client.id) : null
  const nextVisit = recentVisits.find((visit) => new Date(visit.scheduledStart) > new Date())
  const assessments = carePlanning?.assessments ?? []
  const carePlans = carePlanning?.carePlans ?? []
  const evidencePacks = carePlanning?.evidencePacks ?? []
  const completedAssessments = assessments.filter((assessment) => assessment.status === 'COMPLETED')
  const inProgressAssessments = assessments.length - completedAssessments.length
  const activeCarePlan = carePlans.find((plan) => plan.status === 'ACTIVE')
  const draftCarePlans = carePlans.filter((plan) => plan.status === 'DRAFT')
  const reviewDueDate = activeCarePlan?.reviewDueAt ?? assessments.find((assessment) => assessment.reviewDueAt)?.reviewDueAt ?? null
  const latestEvidencePack = evidencePacks[0]
  const latestPackSourceTypes = new Set((latestEvidencePack?.items ?? []).map((item) => item.sourceType))
  const hasAssessmentEvidence = latestPackSourceTypes.has('ASSESSMENT')
  const hasCarePlanEvidence = latestPackSourceTypes.has('CARE_PLAN')
  const scheduleVisitHref = `/visits/new?${new URLSearchParams({ clientId: client.id }).toString()}`
  const profileTabs = [
    { label: 'Overview', href: `/clients/${client.id}` },
    { label: 'Care Notes', href: `/clients/${client.id}/care-logs` },
    ...(isAdmin
      ? [
          { label: 'Schedule', href: `/schedule?clientId=${client.id}` },
          { label: 'Family access', href: `/clients/${client.id}/carebridge` },
          { label: 'Care planning', href: `/care-planning?clientId=${client.id}` },
          { label: 'Inspection records', href: `/evidence?clientId=${client.id}` },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/clients" className="text-slate-500 hover:text-slate-700">
                {entityLabelPlural}
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="text-slate-900 font-medium">{client.fullName}</li>
          </ol>
        </nav>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              {client.fullName}
            </h1>
            <p className="text-slate-500 mt-1">
              {isAdmin ? 'Client details' : 'Person details'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            {isAdmin && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/clients/${client.id}/carebridge`}>Family access</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/clients/${client.id}/summary`}>AI Health Summary</Link>
                </Button>
              </>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/clients/${client.id}/care-logs`}>Care Notes</Link>
            </Button>
            {isAdmin && (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/clients/${client.id}/edit`}>Edit</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <a href={scheduleVisitHref}>
                    Schedule care visit
                  </a>
                </Button>
              </>
            )}
            {isAdmin && <DeleteClientButton clientId={client.id} clientName={client.fullName} />}
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className={`grid gap-3 ${isAdmin ? 'md:grid-cols-4' : ''}`}>
            <div className="rounded-2xl bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Next visit</p>
              <p className="mt-2 text-sm font-semibold text-teal-950">
                {nextVisit
                  ? formatShortDateTime(nextVisit.scheduledStart)
                  : 'No upcoming visit'}
              </p>
            </div>
            {isAdmin && (
              <>
                <div className="rounded-2xl bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Assessments</p>
                  <p className="mt-2 text-sm font-semibold text-sky-950">
                    {assessments.length > 0
                      ? `${completedAssessments.length} completed · ${inProgressAssessments} in progress`
                      : 'No assessments recorded'}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Active care plan</p>
                  <p className="mt-2 text-sm font-semibold text-amber-950">
                    {activeCarePlan
                      ? `${activeCarePlan.title} · v${activeCarePlan.version}`
                      : draftCarePlans.length > 0
                        ? `${draftCarePlans.length} draft ${draftCarePlans.length === 1 ? 'plan' : 'plans'}`
                        : 'No active or draft plan'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Review due</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatShortDate(reviewDueDate)}</p>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 pb-1">
            {profileTabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isAdmin ? 'Client details' : 'Person details'}
                </h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Address</dt>
                    <dd className="text-slate-900">{formatAddress(client)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">City</dt>
                    <dd className="text-slate-900">{client.city}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Postcode</dt>
                    <dd className="text-slate-900">{client.postcode}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Recent visits</h2>
                  <Link
                    href={`/visits?clientId=${client.id}`}
                    className="text-sm font-medium text-oasis-teal-dark hover:text-oasis-ink"
                  >
                    View all →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentVisits.length === 0 ? (
                  <p className="text-slate-500">
                    No visits found for this {entityLabel} yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentVisits.map((visit) => {
                      const durationMin = Math.round(
                        (new Date(visit.scheduledEnd).getTime() - new Date(visit.scheduledStart).getTime()) / 60000
                      )
                      const carerName = visit.carer
                        ? `${visit.carer.firstName} ${visit.carer.lastName}`
                        : 'Unassigned'

                      return (
                        <div key={visit.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {formatDateTime(visit.scheduledStart, {
                                weekday: 'short',
                              })}
                            </p>
                            <p className="text-sm text-slate-500">Carer: {carerName}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">{durationMin} min</span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {visit.status.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Next Visit</h2>
              </CardHeader>
              <CardContent>
                {nextVisit ? (
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-lg font-semibold text-teal-900">
                      {formatDate(nextVisit.scheduledStart, {
                        weekday: 'long',
                        month: 'long',
                      })}
                    </p>
                    <p className="text-teal-700">
                      {formatTime(nextVisit.scheduledStart)}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No upcoming visit scheduled.</p>
                )}
              </CardContent>
            </Card>

            {isAdmin && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-900">Evidence packs</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Coverage</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {evidencePacks.length > 0
                          ? `${evidencePacks.length} packs · latest includes ${latestEvidencePack?.items.length ?? 0} items`
                          : 'No evidence packs created'}
                      </p>
                      {latestEvidencePack && (
                        <p className="mt-2 text-xs text-slate-600">
                          Assessment evidence: {hasAssessmentEvidence ? 'Included' : 'Not included'} · Care plan evidence:{' '}
                          {hasCarePlanEvidence ? 'Included' : 'Not included'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                        <Link href={`/clients/${client.id}/carebridge`}>Family Updates room</Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                        <Link href={`/clients/${client.id}/summary`}>AI Health Summary</Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full justify-start rounded-xl px-4 py-3 text-left text-slate-700">
                        <Link href={`/clients/${client.id}/care-logs`}>Care Notes</Link>
                      </Button>
                      <Button asChild variant="primary" className="w-full justify-start rounded-xl px-4 py-3 text-left">
                        <a href={scheduleVisitHref}>
                          Schedule care visit
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
