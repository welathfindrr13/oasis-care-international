import Link from 'next/link'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { StatusChip } from '../../../components/oasis/StatusChip'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { authOptions } from '../../../lib/auth/auth-options'
import { hasRole } from '../../../lib/auth/roles'
import { query } from '../../../lib/graphql/client'
import {
  LIST_VISIT_MEDICATIONS_QUERY,
  VISIT_QUERY,
  type MedicationAdministration,
  type VisitMedicationsQueryResponse,
  type VisitQueryResponse,
} from '../../../lib/graphql/queries'
import { formatDateTime } from '../../../lib/time'
import { getVisitReviewSummary } from '../queue-state'
import { buildVisitTimelineGroups } from '../timeline'
import { VisitCareLogPanel } from './VisitCareLogPanel'
import { VisitCareGuidancePanel } from './VisitCareGuidancePanel'
import { VisitMedicationPanel } from './VisitMedicationPanel'
import { VisitOperationalPanel } from './VisitOperationalPanel'
import { VisitReconciliationPanel } from './VisitReconciliationPanel'

export const metadata: Metadata = {
  title: 'Visit Details - Oasis Care',
  description: 'Review visit timings, notes, and task progress',
}

export const dynamic = 'force-dynamic'

interface VisitDetailPageProps {
  params: {
    id: string
  }
}

async function getVisit(id: string) {
  try {
    const data = await query<VisitQueryResponse>(VISIT_QUERY, { id })
    return data.visit
  } catch (error) {
    console.error('Failed to load visit detail:', error)
    return null
  }
}

async function getMedicationContext(visitId: string): Promise<MedicationAdministration[]> {
  try {
    const data = await query<VisitMedicationsQueryResponse>(LIST_VISIT_MEDICATIONS_QUERY, { visitId })
    return data.listVisitMedications
  } catch (error) {
    console.error('Failed to load medication context:', error)
    return []
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:gap-4">
      <div className="text-sm font-medium text-text-secondary">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  )
}

export default async function VisitDetailPage({ params }: VisitDetailPageProps) {
  const session = await getServerSession(authOptions)
  const visit = await getVisit(params.id)

  if (!visit) {
    notFound()
  }

  const medications = await getMedicationContext(visit.id)
  const timeline = buildVisitTimelineGroups(visit, medications)
  const reviewSummary = getVisitReviewSummary(visit, new Date())

  const isAdmin = hasRole((session as any)?.roles, 'admin')
  const canActAsCarer = hasRole((session as any)?.roles, 'carer') && !isAdmin
  const showReconciliationPanel =
    isAdmin &&
    visit.status === 'SCHEDULED' &&
    reviewSummary.queueState === 'needs_review'

  const clientAddress = [visit.client?.addressLine1, visit.client?.addressLine2, visit.client?.city, visit.client?.postcode]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-text-secondary">Visit detail</p>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              {visit.client?.fullName ?? 'Visit'}
            </h1>
            <p className="mt-1 text-slate-500">
              Planned window, recorded care delivery, and active guidance in one place for this visit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href={`/visits/${visit.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
                Edit visit
              </Link>
            )}
            <Link href="/visits" className={buttonVariants({ variant: 'ghost' })}>
              Back to visits
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary font-heading">Planned and recorded timing</h2>
                  <p className="text-sm text-text-secondary">What was planned for the visit and what timing evidence was actually recorded.</p>
                </div>
                <StatusChip status={visit.status.toLowerCase() as 'scheduled' | 'in_progress' | 'completed' | 'cancelled'} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Scheduled start" value={formatDateTime(visit.scheduledStart)} />
              <DetailRow label="Scheduled end" value={formatDateTime(visit.scheduledEnd)} />
              <DetailRow label="Actual start" value={visit.actualStart ? formatDateTime(visit.actualStart) : 'Not recorded'} />
              <DetailRow label="Actual end" value={visit.actualEnd ? formatDateTime(visit.actualEnd) : 'Not recorded'} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {showReconciliationPanel && (
              <Card>
                <CardContent className="pt-6">
                  <VisitReconciliationPanel
                    visitId={visit.id}
                    hasActualStart={reviewSummary.hasActualStart}
                    hasActualEnd={reviewSummary.hasActualEnd}
                    completedTaskCount={reviewSummary.completedTaskCount}
                    totalTaskCount={reviewSummary.totalTaskCount}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <VisitOperationalPanel
                  canEdit={canActAsCarer}
                  visit={{
                    id: visit.id,
                    status: visit.status,
                    scheduledStart: visit.scheduledStart,
                    scheduledEnd: visit.scheduledEnd,
                    actualStart: visit.actualStart,
                    actualEnd: visit.actualEnd,
                    updatedAt: visit.updatedAt,
                    tasks: visit.tasks.map((task) => ({
                      id: task.id,
                      isCompleted: task.isCompleted,
                    })),
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary font-heading">People</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailRow label="Client" value={visit.client?.fullName ?? 'Unknown client'} />
                <DetailRow label="Address" value={clientAddress || 'No address recorded'} />
                <DetailRow
                  label="Carer"
                  value={visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Unassigned'}
                />
                <DetailRow label="Carer email" value={visit.carer?.email ?? 'Not recorded'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary font-heading">Care guidance</h2>
                <p className="text-sm text-text-secondary">
                  Read-only guidance that governed the care delivery for this visit.
                </p>
              </CardHeader>
              <CardContent>
                <VisitCareGuidancePanel
                  carePlan={visit.carePlan}
                  clientId={visit.client?.id}
                  isAdmin={isAdmin}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary font-heading">Medication context</h2>
              </CardHeader>
              <CardContent>
                <VisitMedicationPanel canEdit={canActAsCarer} medications={medications} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary font-heading">Care log</h2>
              </CardHeader>
              <CardContent>
                <VisitCareLogPanel
                  canEdit={canActAsCarer}
                  visit={{
                    id: visit.id,
                    notes: visit.notes,
                    updatedAt: visit.updatedAt,
                    tasks: visit.tasks,
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-text-primary font-heading">Care timeline</h2>
              <p className="text-sm text-text-secondary">
                Planned activity is shown first, followed by the recorded care activity for this visit.
              </p>
            </CardHeader>
            <CardContent>
              {timeline.planned.length > 0 || timeline.recorded.length > 0 ? (
                <div className="space-y-6">
                  {timeline.planned.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Planned care day</h3>
                      <ol className="mt-3 space-y-4">
                        {timeline.planned.map((event) => (
                          <li key={event.id} className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-medium text-text-primary">{event.title}</p>
                              <time className="text-sm text-text-secondary" dateTime={event.at}>
                                {formatDateTime(event.at)}
                              </time>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">{event.detail}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {timeline.recorded.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recorded activity</h3>
                      <ol className="mt-3 space-y-4">
                        {timeline.recorded.map((event) => (
                          <li key={event.id} className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-medium text-text-primary">{event.title}</p>
                              <time className="text-sm text-text-secondary" dateTime={event.at}>
                                {formatDateTime(event.at)}
                              </time>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">{event.detail}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
                  No derived care timeline events are available for this visit yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
