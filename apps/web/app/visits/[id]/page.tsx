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
import { VISIT_QUERY, type VisitQueryResponse } from '../../../lib/graphql/queries'
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
      </main>
    </div>
  )
}
