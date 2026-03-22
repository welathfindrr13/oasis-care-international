import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '../../components/oasis/Header'
import { authOptions } from '../../lib/auth/auth-options'
import { hasRole } from '../../lib/auth/roles'
import { getSiteBaseUrl } from '../../lib/url'

export const metadata: Metadata = {
  title: 'Dashboard - Oasis Care',
  description: 'Overview of today&apos;s visits, carers, and tasks',
}

export const dynamic = 'force-dynamic'

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

const statusConfig = {
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'In Progress' },
  scheduled: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Scheduled' },
  conflict: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Needs Attention' },
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const stats = await getTodayStats();
  const isAdmin = hasRole((session as any)?.roles, 'admin');
  const remainingVisits = Math.max(stats.booked - stats.finished, 0);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Good afternoon
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? currentDate : `${currentDate} • here’s your schedule and medication overview`}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Visits Today */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Visits Today</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.booked}</p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                {stats.finished} completed
              </span>
            </div>
          </div>

          {isAdmin ? (
            <>
              {/* Active Clients */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Active Clients</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">24</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-slate-500">+2 this week</span>
                </div>
              </div>

              {/* Carers on Shift */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Carers on Shift</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">8</p>
                  </div>
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['S', 'M', 'E', 'J'].map((initial, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                        {initial}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">+4 more</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Completed Today</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stats.finished}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-slate-500">Visits you have already wrapped up</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Remaining Today</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{remainingVisits}</p>
                  </div>
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-slate-500">Planned visits still ahead of you</span>
                </div>
              </div>
            </>
          )}

          {/* Alerts */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-amber-100">Needs Attention</p>
                <p className="text-3xl font-bold text-white mt-1">3</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-amber-100">1 medication alert</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-slate-900">
                    Recent Activity
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Latest updates from your care team
                  </p>
                </div>
                <Link href="/activity" className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                  View All →
                </Link>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {mockRecentActivity.map((activity) => {
                const config = statusConfig[activity.status]
                return (
                  <div 
                    key={activity.id}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-2 h-2 rounded-full mt-2 ${config.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{activity.client}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 text-sm">{activity.carer}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{activity.action}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                          {config.label}
                        </span>
                        <time className="text-sm text-slate-400 tabular-nums">
                          {activity.time}
                        </time>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {isAdmin && (
                  <>
                    <Link
                      href="/visits/new"
                      className="w-full flex items-center gap-3 px-4 py-3 bg-teal-50 hover:bg-teal-100 rounded-xl text-teal-700 font-medium transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Schedule Visit
                    </Link>
                    <Link
                      href="/clients/new"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Add Client
                    </Link>
                  </>
                )}
                {isAdmin ? (
                  <Link href="/admin/metrics" className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium transition-colors text-left">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Metrics
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/visits"
                      className="w-full flex items-center gap-3 px-4 py-3 bg-teal-50 hover:bg-teal-100 rounded-xl text-teal-700 font-medium transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Check Today&apos;s Visits
                    </Link>
                    <Link
                      href="/emar"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl text-slate-700 font-medium transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a4 4 0 00-5.656 0l-7.07 7.07a2 2 0 102.828 2.829l7.07-7.071a4 4 0 000-5.657l-1.414-1.414a4 4 0 00-5.657 0L9.272 12.44" />
                      </svg>
                      Open eMAR
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* AI Summaries Card */}
            {isAdmin ? (
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="font-heading font-semibold">Client Reviews</h3>
                </div>
                <p className="text-violet-100 text-sm mb-4">
                  Open the client directory to review care records and upcoming work.
                </p>
                <Link href="/clients" className="block w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 font-medium transition-colors text-center">
                  Open Clients
                </Link>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="font-heading font-semibold">Medication Overview</h3>
                </div>
                <p className="text-violet-100 text-sm mb-4">
                  Review today&apos;s scheduled medications and administration status.
                </p>
                <Link href="/emar" className="block w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 font-medium transition-colors text-center">
                  Open Medication Record
                </Link>
              </div>
            )}

            {/* Today's Schedule Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-4">
                {isAdmin ? 'Upcoming' : 'Your Upcoming Visits'}
              </h3>
              <div className="space-y-3">
                {[
                  { time: '15:00', client: 'David Wilson', type: 'Home Visit' },
                  { time: '16:30', client: 'Susan Taylor', type: 'Medication Check' },
                  { time: '17:00', client: 'James Brown', type: 'Home Visit' },
                ].map((visit, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="text-sm font-mono font-medium text-slate-600 w-12">
                      {visit.time}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{visit.client}</p>
                      <p className="text-xs text-slate-500">{visit.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
