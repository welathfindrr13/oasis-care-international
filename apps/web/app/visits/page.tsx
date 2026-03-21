import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'
import { FilterBar } from '../../components/oasis/FilterBar'
import { StatusChip } from '../../components/oasis/StatusChip'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { buttonVariants } from '../../components/ui/Button'
import { authOptions } from '../../lib/auth/auth-options'
import { hasRole } from '../../lib/auth/roles'
import { query } from '../../lib/graphql/client'
import { 
  VISITS_QUERY, 
  DEFAULT_PAGE_SIZE, 
  getSkipFromPage,
  type VisitsQueryResponse,
  type Visit 
} from '../../lib/graphql/queries'
import { formatTime } from '../../lib/time'

export const metadata: Metadata = {
  title: 'Visits - Oasis Care',
  description: 'Manage and track care visits',
}

export const dynamic = 'force-dynamic'

interface VisitsPageProps {
  searchParams: {
    date?: string;
    carerId?: string;
    status?: string;
    page?: string;
  };
}

async function getVisits(searchParams: VisitsPageProps['searchParams']): Promise<{ visits: Visit[]; total: number }> {
  try {
    const page = parseInt(searchParams.page || '1', 10);
    const skip = getSkipFromPage(page);

    // Convert date to date range (start of day to end of day)
    let scheduledStartFrom: string | undefined;
    let scheduledStartTo: string | undefined;
    if (searchParams.date) {
      const dateObj = new Date(searchParams.date);
      scheduledStartFrom = new Date(dateObj.setHours(0, 0, 0, 0)).toISOString();
      scheduledStartTo = new Date(dateObj.setHours(23, 59, 59, 999)).toISOString();
    }

    const variables = {
      scheduledStartFrom,
      scheduledStartTo,
      carerId: searchParams.carerId || undefined,
      status: searchParams.status || undefined,
      take: DEFAULT_PAGE_SIZE,
      skip,
    };

    const response = await query<VisitsQueryResponse>(VISITS_QUERY, variables);
    
    return {
      visits: response.visits.items,
      total: response.visits.total,
    };
  } catch (error) {
    console.error('Failed to fetch visits:', error);
    return { visits: [], total: 0 };
  }
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="text-center py-12">
      <div className="mb-4">
        <div className="w-24 h-24 mx-auto bg-base-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg 
            className="w-12 h-12 text-base-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-4 8.5V17m0-8.5v4m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" 
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        No visits found
      </h3>
      <p className="text-text-secondary mb-4">
        {isAdmin
          ? 'Try adjusting your filters or check back later.'
          : 'Your scheduled visits will appear here when they are assigned.'}
      </p>
      {isAdmin && (
        <Link href="/visits/new" className={buttonVariants({ variant: 'primary' })}>
          Schedule New Visit
        </Link>
      )}
    </div>
  )
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const session = await getServerSession(authOptions);
  const { visits, total } = await getVisits(searchParams);
  const hasVisits = visits.length > 0;
  const isAdmin = hasRole((session as any)?.roles, 'admin');
  const pageTitle = isAdmin ? 'Visits' : 'Your Visits';
  const pageSubtitle = isAdmin
    ? 'Manage and track care visits for all clients'
    : 'Review your schedule and stay on top of today’s care visits';
  const sectionTitle = isAdmin ? "Today's Visits" : 'Assigned Visits';

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-slate-500 mt-1">
            {pageSubtitle}
          </p>
        </div>

        <Suspense fallback={<div className="mb-6 h-20 rounded-sm border border-base-gray-300 bg-background-secondary" />}>
          <FilterBar className="mb-6" />
        </Suspense>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  {sectionTitle}
                </h2>
                <p className="text-sm text-text-secondary">
                  {hasVisits ? `${visits.length} of ${total} visits` : 'No visits found'}
                </p>
              </div>
              {isAdmin && (
                <Link href="/visits/new" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                  Add Visit
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {hasVisits ? (
              <div className="overflow-x-auto">
                <table 
                  className="w-full"
                  role="table"
                  aria-label="Visits schedule"
                >
                  <thead>
                    <tr className="border-b border-base-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Time
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Client
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Carer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Duration
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((visit) => {
                      const startTime = new Date(visit.scheduledStart);
                      const endTime = new Date(visit.scheduledEnd);
                      const durationMs = endTime.getTime() - startTime.getTime();
                      const durationMin = Math.round(durationMs / (1000 * 60));
                      
                      return (
                        <tr 
                          key={visit.id}
                          className="border-b border-base-gray-100 hover:bg-background-accent transition-colors"
                        >
                          <td className="py-3 px-4">
                            <time 
                              className="font-medium text-text-primary"
                              dateTime={visit.scheduledStart}
                            >
                              {formatTime(visit.scheduledStart)}
                            </time>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-text-primary">
                                {visit.client?.fullName || 'Unknown Client'}
                              </div>
                              <div className="text-sm text-text-secondary">
                                {visit.client && (
                                  `${visit.client.addressLine1}${visit.client.addressLine2 ? ', ' + visit.client.addressLine2 : ''}`
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-text-primary">
                              {visit.carer ? `${visit.carer.firstName} ${visit.carer.lastName}` : 'Unassigned'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-text-secondary">
                              {durationMin} min
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <StatusChip status={visit.status.toLowerCase() as any} />
                          </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                              <button className={buttonVariants({ variant: 'ghost', size: 'sm' })} type="button">
                                View
                              </button>
                              <button className={buttonVariants({ variant: 'ghost', size: 'sm' })} type="button">
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState isAdmin={isAdmin} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
