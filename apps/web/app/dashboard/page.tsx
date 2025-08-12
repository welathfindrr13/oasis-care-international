import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { MetricCard } from '../../components/oasis/MetricCard'
import { Nav } from '../../components/oasis/Nav'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { StatusChip } from '../../components/oasis/StatusChip'
import { Button } from '../../components/ui/Button'
import { getSiteBaseUrl } from '../../lib/url'

export const metadata: Metadata = {
  title: 'Dashboard - Oasis Care',
  description: 'Overview of today&apos;s visits, carers, and tasks',
}

interface TodayStats {
  booked: number;
  finished: number;
}

async function getTodayStats(): Promise<TodayStats> {
  try {
    const baseUrl = getSiteBaseUrl();
    const cookie = cookies().toString();
    const response = await fetch(`${baseUrl}/api/stats/today`, {
      cache: 'no-store',
      headers: { cookie }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch today stats:', response.status);
      return { booked: 0, finished: 0 };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching today stats:', error);
    return { booked: 0, finished: 0 };
  }
}

const mockRecentActivity = [
  {
    id: 1,
    time: '14:30',
    client: 'Margaret Thompson',
    carer: 'Sarah Johnson',
    action: 'Visit completed',
    status: 'completed' as const
  },
  {
    id: 2,
    time: '13:45',
    client: 'Robert Smith',
    carer: 'Mike Thompson',
    action: 'Medication administered',
    status: 'completed' as const
  },
  {
    id: 3,
    time: '13:15',
    client: 'Emily Davis',
    carer: 'Emma Wilson',
    action: 'Visit in progress',
    status: 'in_progress' as const
  },
  {
    id: 4,
    time: '12:30',
    client: 'John Williams',
    carer: 'Sarah Johnson',
    action: 'Visit scheduled',
    status: 'scheduled' as const
  },
  {
    id: 5,
    time: '11:45',
    client: 'Mary Brown',
    carer: 'Mike Thompson',
    action: 'Schedule conflict detected',
    status: 'conflict' as const
  }
]

export default async function DashboardPage() {
  const stats = await getTodayStats();

  // Real metrics from API
  const realMetrics = [
    {
      title: 'Visits Booked',
      value: stats.booked,
      trend: { value: '', direction: 'neutral' as const }
    },
    {
      title: 'Visits Finished',
      value: stats.finished,
      trend: { value: '', direction: 'neutral' as const }
    }
  ];

  // Placeholder metrics for endpoints not yet available
  const placeholderMetrics = [
    {
      title: 'Carers on Duty',
      value: '—',
      isPending: true
    },
    {
      title: 'Med Alerts',
      value: '—', 
      isPending: true
    }
  ];
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <Nav />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Oasis Dashboard
          </h1>
          <p className="text-text-secondary">
            Overview of today&apos;s care activities and alerts
          </p>
        </div>

        {/* Metrics Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          role="region"
          aria-label="Key metrics"
        >
          {realMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              trend={metric.trend}
            />
          ))}
          {placeholderMetrics.map((metric, index) => (
            <div key={`placeholder-${index}`} className="relative">
              <MetricCard
                title={metric.title}
                value={metric.value}
                trend={{ value: '', direction: 'neutral' as const }}
              />
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-sm">
                  Pending backend endpoint
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Recent Activity
                </h2>
                <p className="text-sm text-text-secondary">
                  Latest updates from your care team
                </p>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded-sm bg-background-secondary hover:bg-background-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <time 
                        className="text-sm font-medium text-text-secondary"
                        dateTime={activity.time}
                      >
                        {activity.time}
                      </time>
                      <StatusChip status={activity.status} />
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-text-primary">
                        {activity.client}
                      </span>
                      <span className="text-text-secondary mx-2">•</span>
                      <span className="text-text-secondary">
                        {activity.carer}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      {activity.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
