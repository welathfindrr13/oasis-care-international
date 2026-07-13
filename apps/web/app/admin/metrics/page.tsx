import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { hasRole } from '../../../lib/auth/roles'
import { getServerAuthContext } from '../../../lib/auth/server-auth'

export const metadata: Metadata = {
  title: 'Service monitoring - Oasis Care',
  description: 'Observed service monitoring response',
}

async function getMetrics(): Promise<string> {
  try {
    const { accessToken } = await getServerAuthContext()
    if (!accessToken) {
      return 'Metrics unavailable'
    }

    const fullApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql'
    const apiUrl = fullApiUrl.replace(/\/graphql$/, '')
    const response = await fetch(`${apiUrl}/metrics`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      return `Metrics unavailable (${response.status})`
    }
    
    return await response.text()
  } catch {
    return 'Metrics unavailable'
  }
}

export default async function MetricsPage() {
  const { roles } = await getServerAuthContext()
  if (!hasRole(roles, 'admin')) {
    redirect('/activity')
  }

  const metrics = await getMetrics();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Service monitoring
          </h1>
          <p className="text-text-secondary">
            Observed monitoring response from Oasis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Source
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-secondary">
                Monitoring data returned by this Oasis service. This page does not infer service health.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Environment
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-secondary">
                System environment: <span className="font-mono text-text-primary">{process.env.NODE_ENV || 'unknown'}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Access
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-secondary">
                A Manager account is required. Reload this page to request a fresh response.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Raw Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Monitoring response
                </h2>
                <p className="text-sm text-text-secondary">
                  Response returned by the monitoring service
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-base-gray-50 border border-base-gray-200 rounded-sm p-4 overflow-auto max-h-96">
              <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap">
                {metrics}
              </pre>
            </div>

            {/* Access notice */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Manager access required
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>An unavailable response is shown as unavailable. This page does not prove API or database health.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
