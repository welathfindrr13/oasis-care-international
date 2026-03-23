import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '../../../../../components/oasis/Header'
import { buttonVariants } from '../../../../../components/ui/Button'
import { query } from '../../../../../lib/graphql/client'
import {
  CLIENT_QUERY,
  MEDICATIONS_QUERY,
  type ClientQueryResponse,
  type MedicationsQueryResponse,
} from '../../../../../lib/graphql/queries'
import PrescriptionAssignmentForm from './PrescriptionAssignmentForm'

export const dynamic = 'force-dynamic'

interface NewPrescriptionPageProps {
  params: {
    id: string
  }
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id })
    return response.client
  } catch (error) {
    console.error('Failed to fetch client for prescription setup:', error)
    return null
  }
}

async function getMedicationLibrary() {
  try {
    const response = await query<MedicationsQueryResponse>(MEDICATIONS_QUERY, {
      take: 200,
      skip: 0,
    })
    return response.medications.items
  } catch (error) {
    console.error('Failed to fetch medications for prescription setup:', error)
    return []
  }
}

export default async function NewPrescriptionPage({ params }: NewPrescriptionPageProps) {
  const [client, medications] = await Promise.all([getClient(params.id), getMedicationLibrary()])

  if (!client) {
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
            <li className="font-medium text-slate-900">Assign Medication</li>
          </ol>
        </nav>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Assign Medication</h1>
            <p className="mt-1 text-slate-500">
              Add a prescription schedule for {client.fullName} using the shared medication library.
            </p>
          </div>
          <Link href={`/clients/${client.id}/prescriptions`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to prescriptions
          </Link>
        </div>

        {medications.length ? (
          <PrescriptionAssignmentForm clientId={client.id} clientName={client.fullName} medications={medications} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">Medication library is empty</h2>
            <p className="mt-2 text-slate-600">
              Add a medication to the shared library before assigning a prescription to this client.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/admin/medications/new" className={buttonVariants({ variant: 'primary' })}>
                Add Medication
              </Link>
              <Link href={`/clients/${client.id}/prescriptions`} className={buttonVariants({ variant: 'ghost' })}>
                Back
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
