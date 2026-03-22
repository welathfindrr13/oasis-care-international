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
  LIST_DUE_MEDS_QUERY,
  VISIT_QUERY,
  type DueMedsQueryResponse,
  type MedicationAdministration,
  type VisitQueryResponse,
} from '../../../lib/graphql/queries'
import { formatDateTime } from '../../../lib/time'
import { VisitCareLogPanel } from './VisitCareLogPanel'

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
    const data = await query<DueMedsQueryResponse>(LIST_DUE_MEDS_QUERY, { visitId })
    return data.listDueMeds
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

function getMedicationStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function deriveTimeline(visit: Awaited<ReturnType<typeof getVisit>>, medications: MedicationAdministration[]) {
  if (!visit) {
    return []
  }

  const events = [
    {
      id: `${visit.id}-scheduled`,
      at: visit.scheduledStart,
      title: 'Visit scheduled',
      detail: `Scheduled to start at ${formatDateTime(visit.scheduledStart)}`,
    },
    ...(visit.actualStart
      ? [
          {
            id: `${visit.id}-actual-start`,
            at: visit.actualStart,
            title: 'Visit started',
            detail: `Carer started the visit at ${formatDateTime(visit.actualStart)}`,
          },
        ]
      : []),
    ...(visit.actualEnd
      ? [
          {
            id: `${visit.id}-actual-end`,
            at: visit.actualEnd,
            title: 'Visit completed',
            detail: `Visit finished at ${formatDateTime(visit.actualEnd)}`,
          },
        ]
      : []),
    ...(visit.notes?.trim()
      ? [
          {
            id: `${visit.id}-notes`,
            at: visit.updatedAt,
            title: 'Care log updated',
            detail: 'Visit notes were last updated on this record.',
          },
        ]
      : []),
    ...visit.tasks.flatMap((task) => {
      const items = []
      if (task.completedAt) {
        items.push({
          id: `${task.id}-completed`,
          at: task.completedAt,
          title: `Task completed: ${task.taskName}`,
          detail: task.notes?.trim() || 'Task marked as completed.',
        })
      } else if (task.notes?.trim()) {
        items.push({
          id: `${task.id}-notes`,
          at: task.updatedAt,
          title: `Task updated: ${task.taskName}`,
          detail: task.notes,
        })
      }
      return items
    }),
    ...medications.map((administration) => ({
      id: administration.id,
      at: administration.administeredTime || administration.scheduledTime,
      title:
        administration.status === 'ADMINISTERED'
          ? `Medication administered: ${administration.prescription?.medication?.name || 'Medication'}`
          : `Medication ${administration.status.toLowerCase()}: ${administration.prescription?.medication?.name || 'Medication'}`,
      detail:
        administration.notes?.trim() ||
        administration.prescription?.specialInstructions ||
        administration.prescription?.medication?.instructions ||
        'No extra medication notes recorded.',
    })),
  ]

  return events
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
}

export default async function VisitDetailPage({ params }: VisitDetailPageProps) {
  const session = await getServerSession(authOptions)
  const visit = await getVisit(params.id)

  if (!visit) {
    notFound()
  }

  const medications = await getMedicationContext(visit.id)
  const timeline = deriveTimeline(visit, medications)

  const isAdmin = hasRole((session as any)?.roles, 'admin')
  const canEditCareLog = hasRole((session as any)?.roles, 'carer') && !isAdmin

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
              Scheduled for {formatDateTime(visit.scheduledStart)}
            </p>
          </div>
          <Link href="/visits" className={buttonVariants({ variant: 'ghost' })}>
            Back to visits
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary font-heading">Visit timeline</h2>
                  <p className="text-sm text-text-secondary">Scheduled and actual timings for this visit</p>
                </div>
                <StatusChip status={visit.status.toLowerCase() as 'scheduled' | 'in_progress' | 'completed'} />
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
                <h2 className="text-lg font-semibold text-text-primary font-heading">Medication context</h2>
              </CardHeader>
              <CardContent>
                {medications.length > 0 ? (
                  <ul className="space-y-3">
                    {medications.map((administration) => (
                      <li key={administration.id} className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-text-primary">
                              {administration.prescription?.medication?.name || 'Medication'}
                            </p>
                            <p className="text-sm text-text-secondary">
                              {administration.prescription?.medication
                                ? `${administration.prescription.medication.dosage}${administration.prescription.medication.unit}`
                                : 'Dose not recorded'}
                            </p>
                          </div>
                          <span className="inline-flex rounded-full border border-base-gray-300 bg-base-gray-100 px-3 py-1 text-xs font-medium text-base-gray-800">
                            {getMedicationStatusLabel(administration.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">
                          Scheduled {formatDateTime(administration.scheduledTime)}
                        </p>
                        {administration.administeredTime && (
                          <p className="mt-1 text-sm text-text-secondary">
                            Administered {formatDateTime(administration.administeredTime)}
                          </p>
                        )}
                        {(administration.notes || administration.prescription?.specialInstructions) && (
                          <p className="mt-2 text-sm text-text-secondary">
                            {administration.notes || administration.prescription?.specialInstructions}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
                    No visit-linked medication records were returned for this visit.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary font-heading">Care log</h2>
              </CardHeader>
              <CardContent>
                <VisitCareLogPanel
                  canEdit={canEditCareLog}
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
                A derived history from visit timings, task updates, and medication records.
              </p>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <ol className="space-y-4">
                  {timeline.map((event) => (
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
