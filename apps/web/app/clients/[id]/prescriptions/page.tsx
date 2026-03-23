import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '../../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card'
import { buttonVariants } from '../../../../components/ui/Button'
import { query } from '../../../../lib/graphql/client'
import {
  CLIENT_PRESCRIPTIONS_QUERY,
  CLIENT_QUERY,
  type ClientPrescriptionsQueryResponse,
  type ClientQueryResponse,
} from '../../../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

interface ClientPrescriptionsPageProps {
  params: {
    id: string
  }
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id })
    return response.client
  } catch (error) {
    console.error('Failed to fetch client for prescriptions page:', error)
    return null
  }
}

async function getClientPrescriptions(clientId: string) {
  try {
    const response = await query<ClientPrescriptionsQueryResponse>(CLIENT_PRESCRIPTIONS_QUERY, {
      clientId,
    })
    return response.clientPrescriptions
  } catch (error) {
    console.error('Failed to fetch client prescriptions:', error)
    return []
  }
}

export default async function ClientPrescriptionsPage({ params }: ClientPrescriptionsPageProps) {
  const [client, prescriptions] = await Promise.all([getClient(params.id), getClientPrescriptions(params.id)])

  if (!client) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/clients" className="text-slate-500 hover:text-slate-700">
                Clients
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li>
              <Link href={`/clients/${client.id}`} className="text-slate-500 hover:text-slate-700">
                {client.fullName}
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900">Prescriptions</li>
          </ol>
        </nav>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Prescriptions</h1>
            <p className="mt-1 text-slate-500">
              Manage medication schedules for {client.fullName}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/medications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Medication Library
            </Link>
            <Link href={`/clients/${client.id}/prescriptions/new`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              Assign Medication
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl font-semibold text-text-primary">Client medication schedules</h2>
            <p className="text-sm text-text-secondary">
              {prescriptions.length ? `${prescriptions.length} prescriptions recorded` : 'No prescriptions recorded yet'}
            </p>
          </CardHeader>
          <CardContent>
            {prescriptions.length ? (
              <div className="divide-y divide-slate-100">
                {prescriptions.map((prescription) => (
                  <div key={prescription.id} className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-medium text-slate-900">
                          {prescription.medication?.name || 'Medication'} · {prescription.medication?.dosage || '—'} {prescription.medication?.unit || ''}
                        </p>
                        <p className="text-sm text-slate-500">
                          Starts {new Date(prescription.startDate).toLocaleDateString('en-GB')}
                          {prescription.endDate ? ` · Ends ${new Date(prescription.endDate).toLocaleDateString('en-GB')}` : ''}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {prescription.frequencyPerDay} times per day at {prescription.administrationTimes.join(', ')}
                          {prescription.frequencyIntervalHours ? ` · every ${prescription.frequencyIntervalHours}h` : ''}
                        </p>
                        {prescription.specialInstructions && (
                          <p className="mt-2 text-sm text-slate-600">{prescription.specialInstructions}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span
                          className={
                            prescription.isActive
                              ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                              : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700'
                          }
                        >
                          {prescription.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <Link
                          href={`/clients/${client.id}/prescriptions/${prescription.id}/edit`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Edit schedule
                        </Link>
                        <p className="text-xs text-slate-500">Prescription ID: {prescription.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <h3 className="text-lg font-medium text-text-primary">No prescriptions yet</h3>
                <p className="mt-2 text-text-secondary">
                  Use the medication library to assign the first prescription for this client.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link href={`/clients/${client.id}/prescriptions/new`} className={buttonVariants({ variant: 'primary' })}>
                    Assign Medication
                  </Link>
                  <Link href="/admin/medications" className={buttonVariants({ variant: 'ghost' })}>
                    Medication Library
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
