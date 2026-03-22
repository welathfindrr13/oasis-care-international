import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { query } from '../../../lib/graphql/client'
import {
  CARERS_QUERY,
  type Carer,
  type CarersQueryResponse,
  type CarersQueryVariables,
} from '../../../lib/graphql/queries'

export const metadata: Metadata = {
  title: 'Carers - Oasis Care',
  description: 'Review carers, workload, and current availability',
}

export const dynamic = 'force-dynamic'

interface AdminCarersPageProps {
  searchParams: {
    search?: string
    activeOnly?: string
  }
}

async function getCarers(searchParams: AdminCarersPageProps['searchParams']): Promise<Carer[]> {
  try {
    const activeOnly = searchParams.activeOnly !== 'false'
    const variables: CarersQueryVariables = {
      activeOnly,
      search: searchParams.search?.trim() || undefined,
    }
    const response = await query<CarersQueryResponse>(CARERS_QUERY, variables)
    return response.carers
  } catch (error) {
    console.error('Failed to fetch carers:', error)
    return []
  }
}

function formatHireDate(hireDate?: string) {
  if (!hireDate) {
    return 'Not recorded'
  }

  return new Date(hireDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function EmptyState({ searchApplied }: { searchApplied: boolean }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-base-gray-100">
        <svg
          className="h-12 w-12 text-base-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-medium text-text-primary">No carers found</h2>
      <p className="text-text-secondary">
        {searchApplied
          ? 'Try a different name or email search.'
          : 'No carers are available for the selected filter yet.'}
      </p>
    </div>
  )
}

export default async function AdminCarersPage({ searchParams }: AdminCarersPageProps) {
  const carers = await getCarers(searchParams)
  const searchApplied = Boolean(searchParams.search?.trim())
  const activeOnly = searchParams.activeOnly !== 'false'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Carers</h1>
          <p className="mt-1 text-slate-500">
            Review your care team, current workload, and scheduling entry points.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-heading text-xl font-semibold text-text-primary">Carers directory</h2>
                <p className="text-sm text-text-secondary">
                  {carers.length > 0 ? `${carers.length} carers shown` : 'No carers match this filter'}
                </p>
              </div>

              <form method="get" action="/admin/carers" className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="search"
                  name="search"
                  defaultValue={searchParams.search || ''}
                  placeholder="Search carers by name or email..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-72"
                />
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    name="activeOnly"
                    value="true"
                    defaultChecked={activeOnly}
                    className="h-4 w-4 rounded border-slate-300 text-brand-blue-primary focus:ring-brand-blue-primary"
                  />
                  Active only
                </label>
                <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Apply
                </button>
              </form>
            </div>
          </CardHeader>

          <CardContent>
            {carers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full" role="table" aria-label="Carers directory">
                  <thead>
                    <tr className="border-b border-base-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Carer</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Contact</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Hire date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Upcoming visits</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Completed today</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carers.map((carer) => (
                      <tr key={carer.id} className="border-b border-base-gray-100 hover:bg-background-accent transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-text-primary">
                              {carer.firstName} {carer.lastName}
                            </div>
                            <div className="text-sm text-text-secondary">ID: {carer.id.slice(0, 8)}...</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          <div>{carer.email}</div>
                          <div>{carer.phone || 'No phone recorded'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={carer.isActive ? 'text-sm font-medium text-green-700' : 'text-sm font-medium text-amber-700'}
                          >
                            {carer.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{formatHireDate(carer.hireDate)}</td>
                        <td className="px-4 py-3 text-sm text-text-primary">{carer.upcomingVisitsCount}</td>
                        <td className="px-4 py-3 text-sm text-text-primary">{carer.completedTodayCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/visits?carerId=${carer.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                              View visits
                            </Link>
                            <Link href={`/visits/new?carerId=${carer.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                              Schedule visit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState searchApplied={searchApplied} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
