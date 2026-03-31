import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { requireAdminSession } from '../../../lib/auth/require-admin'
import { formatCarePlanDate, getCarePlanSummary } from '../../../lib/care-plan'
import { query } from '../../../lib/graphql/client'
import {
  CLIENT_CARE_PLAN_QUERY,
  CLIENT_QUERY,
  CLIENT_PRESCRIPTIONS_QUERY,
  VISITS_QUERY,
  type CarePlan,
  type ClientCarePlanQueryResponse,
  type ClientQueryResponse,
  type ClientPrescriptionsQueryResponse,
  type Prescription,
  type Visit,
  type VisitsQueryResponse,
} from '../../../lib/graphql/queries'
import { formatDateTime, formatTime } from '../../../lib/time'

export const dynamic = 'force-dynamic'

interface ClientDetailPageProps {
  params: {
    id: string;
  };
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id });
    return response.client;
  } catch (error) {
    console.error('Failed to fetch client:', error);
    return null;
  }
}

async function getClientCarePlan(clientId: string): Promise<CarePlan | null> {
  try {
    const response = await query<ClientCarePlanQueryResponse>(CLIENT_CARE_PLAN_QUERY, { clientId });
    return response.clientCarePlan;
  } catch (error) {
    console.error('Failed to fetch client care plan:', error);
    return null;
  }
}

async function getClientVisits(clientId: string): Promise<Visit[]> {
  try {
    const response = await query<VisitsQueryResponse>(VISITS_QUERY, {
      clientId,
      take: 5,
      skip: 0,
    });

    return response.visits.items;
  } catch (error) {
    console.error('Failed to fetch client visits:', error);
    return [];
  }
}

async function getClientPrescriptions(clientId: string): Promise<Prescription[]> {
  try {
    const response = await query<ClientPrescriptionsQueryResponse>(CLIENT_PRESCRIPTIONS_QUERY, {
      clientId,
      activeOnly: true,
    })
    return response.clientPrescriptions
  } catch (error) {
    console.error('Failed to fetch client prescriptions:', error)
    return []
  }
}

function formatVisitStatus(status: Visit['status']) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusClasses(status: Visit['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700';
    case 'IN_PROGRESS':
      return 'bg-amber-50 text-amber-700';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export async function generateMetadata({ params }: ClientDetailPageProps): Promise<Metadata> {
  const client = await getClient(params.id);

  return {
    title: client ? `${client.fullName} - Oasis Care` : 'Client Not Found - Oasis Care',
    description: client ? `Client profile for ${client.fullName}` : 'Client not found',
  };
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requireAdminSession();

  const client = await getClient(params.id);

  if (!client) {
    notFound();
  }

  const [visits, prescriptions, carePlan] = await Promise.all([
    getClientVisits(client.id),
    getClientPrescriptions(client.id),
    getClientCarePlan(client.id),
  ]);
  const now = Date.now();
  const upcomingVisits = [...visits]
    .filter((visit) => new Date(visit.scheduledStart).getTime() >= now)
    .sort((left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime());
  const recentCareActivity = [...visits]
    .filter((visit) => new Date(visit.scheduledStart).getTime() < now)
    .sort((left, right) => new Date(right.scheduledStart).getTime() - new Date(left.scheduledStart).getTime())
    .slice(0, 3);
  const nextVisit = upcomingVisits[0];
  const activeCarePlan = carePlan?.activeVersion ?? null;
  const draftCarePlan = carePlan?.draftVersion ?? null;
  const carePlanSummary = getCarePlanSummary(activeCarePlan);
  const clientAddress = [client.addressLine1, client.addressLine2, `${client.city}, ${client.postcode}`]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/clients" className="text-slate-500 hover:text-slate-700">
                Clients
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="text-slate-900 font-medium">{client.fullName}</li>
          </ol>
        </nav>

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              {client.fullName}
            </h1>
            <p className="text-slate-500 mt-1">
              {client.preferredName ? `Preferred name: ${client.preferredName} · ` : ''}
              {clientAddress}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next scheduled visit</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {nextVisit ? formatDateTime(nextVisit.scheduledStart) : 'None scheduled'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active prescriptions</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {prescriptions.length} {prescriptions.length === 1 ? 'active prescription' : 'active prescriptions'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent care activity</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {recentCareActivity.length
                    ? `${recentCareActivity.length} recent visit${recentCareActivity.length === 1 ? '' : 's'} loaded`
                    : 'No past visits loaded'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/clients/${client.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Edit Profile
            </Link>
            <Link href={`/clients/${client.id}/care-plan`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {draftCarePlan ? 'Continue Care Plan' : activeCarePlan ? 'Open Care Plan' : 'Create Care Plan'}
            </Link>
            <Link href={`/visits/new?clientId=${client.id}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Schedule Visit
            </Link>
            <Link href={`/visits?clientId=${client.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Client Queue
            </Link>
            <Link href={`/clients/${client.id}/prescriptions`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Open Prescriptions
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Operational profile</h2>
                    <p className="text-sm text-slate-500">
                      Keep the client profile current before drafting or updating care guidance.
                    </p>
                  </div>
                  <Link href={`/clients/${client.id}/edit`} className="text-sm text-teal-600 hover:text-teal-700">
                    Edit profile →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-slate-500">Full name</dt>
                    <dd className="text-slate-900">{client.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Preferred name</dt>
                    <dd className="text-slate-900">{client.preferredName || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Pronouns</dt>
                    <dd className="text-slate-900">{client.pronouns || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Date of birth</dt>
                    <dd className="text-slate-900">
                      {client.dateOfBirth
                        ? formatDateTime(client.dateOfBirth, { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'Not recorded'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Preferred language</dt>
                    <dd className="text-slate-900">{client.preferredLanguage || 'Not recorded'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Address</dt>
                    <dd className="text-slate-900">
                      <div>{client.addressLine1}</div>
                      {client.addressLine2 && <div>{client.addressLine2}</div>}
                      <div>{client.city}, {client.postcode}</div>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Communication needs</dt>
                    <dd className="text-slate-900">{client.communicationNeeds || 'Not recorded'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Accessibility adjustments</dt>
                    <dd className="text-slate-900">{client.accessibilityAdjustments || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Representative</dt>
                    <dd className="text-slate-900">{client.representativeName || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Relationship</dt>
                    <dd className="text-slate-900">{client.representativeRelationship || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Representative phone</dt>
                    <dd className="text-slate-900">{client.representativePhone || 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Representative email</dt>
                    <dd className="text-slate-900">{client.representativeEmail || 'Not recorded'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Active care plan</h2>
                    <p className="text-sm text-slate-500">
                      Structured guidance that will appear read-only inside the visit workspace.
                    </p>
                  </div>
                  <Link href={`/clients/${client.id}/care-plan`} className="text-sm text-teal-600 hover:text-teal-700">
                    {draftCarePlan ? 'Continue draft →' : activeCarePlan ? 'View history →' : 'Create draft →'}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {activeCarePlan ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">Version {activeCarePlan.versionNumber}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{formatCarePlanDate(activeCarePlan.approvedAt)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review due</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{formatCarePlanDate(activeCarePlan.reviewDueAt)}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {carePlanSummary.map((line) => (
                        <p key={line} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                          {line}
                        </p>
                      ))}
                      {draftCarePlan && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          Draft version {draftCarePlan.versionNumber} is open and can be updated before it replaces the active plan.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">No active care plan has been published yet.</p>
                    <p className="mt-2 text-sm text-amber-800">
                      Draft and publish structured care guidance before relying on visit notes alone for ongoing care.
                    </p>
                    {draftCarePlan && (
                      <p className="mt-2 text-sm text-amber-800">
                        Draft version {draftCarePlan.versionNumber} is open and ready for review.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Active Prescriptions</h2>
                    <p className="text-sm text-slate-500">
                      {prescriptions.length ? `${prescriptions.length} active prescriptions recorded` : 'No active prescriptions recorded yet'}
                    </p>
                  </div>
                  <Link href={`/clients/${client.id}/prescriptions`} className="text-sm text-teal-600 hover:text-teal-700">
                    Open prescriptions →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {prescriptions.length ? (
                  <div className="divide-y divide-slate-100">
                    {prescriptions.slice(0, 4).map((prescription) => (
                      <div key={prescription.id} className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {prescription.medication?.name || 'Medication'} · {prescription.medication?.dosage || '—'} {prescription.medication?.unit || ''}
                            </p>
                            <p className="text-sm text-slate-500">
                              {prescription.administrationTimes.join(', ')} · {prescription.frequencyPerDay} times per day
                            </p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            Active
                          </span>
                        </div>
                        {prescription.specialInstructions && (
                          <p className="mt-2 text-sm text-slate-600">{prescription.specialInstructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No medication prescriptions have been assigned to this client yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Visit snapshot</h2>
                    <p className="text-sm text-slate-500">
                      {visits.length ? `${visits.length} visits loaded for this client` : 'No visits loaded for this client yet'}
                    </p>
                  </div>
                  <Link href={`/visits?clientId=${client.id}`} className="text-sm text-teal-600 hover:text-teal-700">
                    Open Queue →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {visits.length ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming visits</h3>
                      <div className="mt-3 divide-y divide-slate-100">
                        {upcomingVisits.length ? upcomingVisits.slice(0, 3).map((visit) => (
                          <div key={visit.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {formatDateTime(visit.scheduledStart)}
                              </p>
                              <p className="text-sm text-slate-500">
                                Scheduled to finish at {formatTime(visit.scheduledEnd)}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses(visit.status)}`}>
                                {formatVisitStatus(visit.status)}
                              </span>
                              <Link href={`/visits/${visit.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                                Open visit
                              </Link>
                            </div>
                          </div>
                        )) : (
                          <p className="py-4 text-sm text-slate-500">No future visits are currently scheduled.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent care activity</h3>
                      <div className="mt-3 divide-y divide-slate-100">
                        {recentCareActivity.length ? recentCareActivity.map((visit) => (
                          <div key={visit.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {formatDateTime(visit.scheduledStart)}
                              </p>
                              <p className="text-sm text-slate-500">
                                {visit.actualStart
                                  ? `Actual: ${formatDateTime(visit.actualStart)}${visit.actualEnd ? ` - ${formatTime(visit.actualEnd)}` : ''}`
                                  : 'No actual timing was recorded on this visit'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses(visit.status)}`}>
                                {formatVisitStatus(visit.status)}
                              </span>
                              <Link href={`/visits/${visit.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                                Open visit
                              </Link>
                            </div>
                          </div>
                        )) : (
                          <p className="py-4 text-sm text-slate-500">No past visit activity is loaded for this client yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">No visits are available for this client yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Next care checkpoint</h2>
              </CardHeader>
              <CardContent>
                {nextVisit ? (
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-lg font-semibold text-teal-900">
                      {formatDateTime(nextVisit.scheduledStart)}
                    </p>
                    <p className="text-teal-700">
                      Ends at {formatTime(nextVisit.scheduledEnd)}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No future visits are currently scheduled.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Record reference</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client ID</p>
                    <p className="mt-2 break-all text-sm text-slate-700">{client.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link
                    href={`/clients/${client.id}/care-plan`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {draftCarePlan ? 'Continue care-plan draft' : activeCarePlan ? 'Open care-plan history' : 'Create care plan'}
                  </Link>
                  <Link
                    href={`/clients/${client.id}/edit`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Edit operational profile
                  </Link>
                  <Link
                    href={`/clients/${client.id}/prescriptions`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Open prescriptions
                  </Link>
                  <Link
                    href={`/visits?clientId=${client.id}`}
                    className="block w-full rounded-xl px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Open client queue
                  </Link>
                  <Link
                    href={`/visits/new?clientId=${client.id}`}
                    className="block w-full rounded-xl bg-teal-50 px-4 py-3 text-left font-medium text-teal-700 transition-colors hover:bg-teal-100"
                  >
                    Schedule visit
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
