import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { query } from '../../../lib/graphql/client'
import {
  MEDICATIONS_QUERY,
  type Medication,
  type MedicationsQueryResponse,
  type MedicationQueryVariables,
} from '../../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

interface MedicationLibraryPageProps {
  searchParams: {
    search?: string
  }
}

async function getMedications(searchParams: MedicationLibraryPageProps['searchParams']): Promise<{ items: Medication[]; total: number }> {
  try {
    const variables: MedicationQueryVariables = {
      name: searchParams.search?.trim() || undefined,
      take: 100,
      skip: 0,
    }
    const response = await query<MedicationsQueryResponse>(MEDICATIONS_QUERY, variables)
    return response.medications
  } catch (error) {
    console.error('Failed to fetch medication library:', error)
    return { items: [], total: 0 }
  }
}

export default async function MedicationLibraryPage({ searchParams }: MedicationLibraryPageProps) {
  const medicationLibrary = await getMedications(searchParams)
  const medications = medicationLibrary.items
  const searchApplied = Boolean(searchParams.search?.trim())

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Medication Library</h1>
            <p className="mt-1 text-slate-500">
              Create and review reusable medication records before assigning them to clients.
            </p>
          </div>
          <Link href="/admin/medications/new" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            Add Medication
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-heading text-xl font-semibold text-text-primary">Available medications</h2>
                <p className="text-sm text-text-secondary">
                  {medications.length ? `${medications.length} of ${medicationLibrary.total} medications shown` : 'No medications match this view'}
                </p>
              </div>

              <form method="get" action="/admin/medications" className="flex items-center gap-2">
                <input
                  type="search"
                  name="search"
                  defaultValue={searchParams.search || ''}
                  placeholder="Search medication name..."
                  className="w-72 rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Search
                </button>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {medications.length ? (
              <div className="overflow-x-auto">
                <table className="w-full" role="table" aria-label="Medication library">
                  <thead>
                    <tr className="border-b border-base-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Medication</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Dose</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Instructions</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((medication) => (
                      <tr key={medication.id} className="border-b border-base-gray-100 hover:bg-background-accent transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">{medication.name}</div>
                          <div className="text-sm text-text-secondary">ID: {medication.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {medication.dosage} {medication.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {medication.instructions || 'No instructions recorded'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {new Date(medication.updatedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <h2 className="mb-2 text-lg font-medium text-text-primary">No medications found</h2>
                <p className="text-text-secondary">
                  {searchApplied
                    ? 'Try a different search term or add the medication to your library.'
                    : 'Add your first medication so it can be assigned to a client prescription.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
