import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '../../../../../../components/oasis/Header'
import { buttonVariants } from '../../../../../../components/ui/Button'
import { query } from '../../../../../../lib/graphql/client'
import {
  CLIENT_PRESCRIPTIONS_QUERY,
  CLIENT_QUERY,
  type ClientPrescriptionsQueryResponse,
  type ClientQueryResponse,
} from '../../../../../../lib/graphql/queries'
import PrescriptionAssignmentForm from '../../new/PrescriptionAssignmentForm'

export const dynamic = 'force-dynamic'

interface EditPrescriptionPageProps {
  params: {
    id: string
    prescriptionId: string
  }
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id })
    return response.client
  } catch (error) {
    console.error('Failed to fetch client for prescription edit:', error)
    return null
  }
}

async function getClientPrescription(clientId: string, prescriptionId: string) {
  try {
    const response = await query<ClientPrescriptionsQueryResponse>(CLIENT_PRESCRIPTIONS_QUERY, {
      clientId,
    })

    return response.clientPrescriptions.find((prescription) => prescription.id === prescriptionId) || null
  } catch (error) {
    console.error('Failed to fetch prescription for edit:', error)
    return null
  }
}

export default async function EditPrescriptionPage({ params }: EditPrescriptionPageProps) {
  const [client, prescription] = await Promise.all([
    getClient(params.id),
    getClientPrescription(params.id, params.prescriptionId),
  ])

  if (!client || !prescription) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
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
            <li>
              <Link href={`/clients/${client.id}/prescriptions`} className="text-slate-500 hover:text-slate-700">
                Prescriptions
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900">Edit Prescription</li>
          </ol>
        </nav>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Edit Prescription</h1>
            <p className="mt-1 text-slate-500">
              Manage the live medication schedule for {client.fullName} without rewriting recorded care history.
            </p>
          </div>
          <Link href={`/clients/${client.id}/prescriptions`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to prescriptions
          </Link>
        </div>

        <PrescriptionAssignmentForm
          clientId={client.id}
          clientName={client.fullName}
          mode="edit"
          prescription={prescription}
        />
      </main>
    </div>
  )
}
