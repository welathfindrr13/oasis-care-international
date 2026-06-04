import { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'

// Mark page as dynamic since it uses searchParams
export const dynamic = 'force-dynamic'
import { FilterBar } from '../../components/oasis/FilterBar'
import { StatusChip } from '../../components/oasis/StatusChip'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { authOptions } from '../api/auth/[...nextauth]/authOptions'
import { query } from '../../lib/graphql/client'
import { 
  VISITS_QUERY, 
  DEFAULT_PAGE_SIZE, 
  getSkipFromPage,
  type VisitsQueryResponse,
  type Visit 
} from '../../lib/graphql/queries'
import { formatTime, formatDate } from '../../lib/time'

export const metadata: Metadata = {
  title: 'Schedule - Oasis Care',
  description: 'Manage and track care visits',
}

interface VisitsPageProps {
  searchParams: {
    date?: string;
    carerId?: string;
    clientId?: string;
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
      clientId: searchParams.clientId || undefined,
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
        No care visits found
      </h3>
      <p className="text-text-secondary mb-4">
        Try adjusting your filters or check back later.
      </p>
      {isAdmin && (
        <Button asChild variant="primary">
          <Link href="/schedule/new">
            Schedule care visit
          </Link>
        </Button>
      )}
    </div>
  )
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const session = await getServerSession(authOptions)
  const roles = Array.isArray((session as any)?.roles) ? (session as any).roles : []
  const isAdmin = roles.some((role: unknown) => String(role).toLowerCase() === 'admin')
  const todayKey = new Date().toISOString().slice(0, 10)
  const showTodayHeading = searchParams.date === todayKey

  const { visits, total } = await getVisits(searchParams);
  const hasVisits = visits.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Schedule
          </h1>
          <p className="text-slate-500 mt-1">
            Manage care visits, assignments, exceptions, and completion status for people supported.
          </p>
        </div>

        <FilterBar className="mb-6" />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  {showTodayHeading ? "Today's Visits" : 'Visits'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {hasVisits ? `${visits.length} of ${total} visits` : 'No visits found'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/shift">My Shift</Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild variant="primary" size="sm">
                    <Link href="/schedule/new">
                      Schedule care visit
                    </Link>
                  </Button>
                )}
              </div>
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
                                {visit.client?.fullName || 'Unknown person'}
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
                              {visit.clientId ? (
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/people/${visit.clientId}`}>
                                    Person
                                  </Link>
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-500 px-2">No client</span>
                              )}
                              {isAdmin && (
                                <>
                                  <Button asChild variant="ghost" size="sm">
                                    <Link href={`/schedule/${visit.id}`}>
                                      View
                                    </Link>
                                  </Button>
                                  {visit.clientId && (
                                    <Button asChild variant="ghost" size="sm">
                                      <Link href={`/schedule/new?clientId=${visit.clientId}`}>
                                        Reschedule
                                      </Link>
                                    </Button>
                                  )}
                                </>
                              )}
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
