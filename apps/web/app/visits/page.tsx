import { Metadata } from 'next'
import { Nav } from '../../components/oasis/Nav'
import { FilterBar } from '../../components/oasis/FilterBar'
import { StatusChip } from '../../components/oasis/StatusChip'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { query } from '../../lib/graphql/client'
import { 
  VISITS_QUERY, 
  DEFAULT_PAGE_SIZE, 
  getOffsetFromPage,
  type VisitsQueryResponse,
  type Visit 
} from '../../lib/graphql/queries'
import { formatTime, formatDate } from '../../lib/time'

export const metadata: Metadata = {
  title: 'Visits - Oasis Care',
  description: 'Manage and track care visits',
}

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
    const offset = getOffsetFromPage(page);

    const variables = {
      date: searchParams.date || undefined,
      carerId: searchParams.carerId || undefined,
      status: searchParams.status || undefined,
      limit: DEFAULT_PAGE_SIZE,
      offset,
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

function EmptyState() {
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
            Try adjusting your filters or check back later.
          </p>
      <Button variant="primary">
        Schedule New Visit
      </Button>
    </div>
  )
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const { visits, total } = await getVisits(searchParams);
  const hasVisits = visits.length > 0;

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <Nav />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Visits
          </h1>
          <p className="text-text-secondary">
            Manage and track care visits for all clients
          </p>
        </div>

        <FilterBar className="mb-6" />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Today&apos;s Visits
                </h2>
                <p className="text-sm text-text-secondary">
                  {hasVisits ? `${visits.length} of ${total} visits` : 'No visits found'}
                </p>
              </div>
              <Button variant="primary" size="sm">
                Add Visit
              </Button>
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
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
