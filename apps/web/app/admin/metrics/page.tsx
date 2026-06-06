import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { hasRole } from '../../../lib/auth/roles'
import { getServerAuthContext } from '../../../lib/auth/server-auth'

export const metadata: Metadata = {
  title: 'Metrics - Oasis Care Admin',
  description: 'System metrics and performance monitoring',
}

async function getMetrics(): Promise<string> {
  try {
    const { accessToken } = await getServerAuthContext()
    if (!accessToken) {
      return 'Metrics unavailable: missing access token'
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
  } catch (error) {
    return `Metrics unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
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
            System Metrics
          </h1>
          <p className="text-text-secondary">
            Application performance and monitoring data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                API Status
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status:</span>
                  <span className="text-green-600 font-medium">✅ Online</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Port:</span>
                  <span className="text-text-primary font-mono">4000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Environment:</span>
                  <span className="text-text-primary">{process.env.NODE_ENV || 'unknown'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Database
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status:</span>
                  <span className="text-green-600 font-medium">✅ Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Type:</span>
                  <span className="text-text-primary">PostgreSQL + pgvector</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Port:</span>
                  <span className="text-text-primary font-mono">5434</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Demo Mode
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Auth Mode:</span>
                  <span className="text-green-600 font-medium">✅ JWT + RBAC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Metrics Endpoint:</span>
                  <span className="text-text-primary">/metrics</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Access:</span>
                  <span className="text-green-600 font-medium">✅ Admin only</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Raw Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary font-heading">
                  Raw Metrics Data
                </h2>
                <p className="text-sm text-text-secondary">
                  Prometheus-style metrics from the API server
                </p>
              </div>
              <Button variant="ghost" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-base-gray-50 border border-base-gray-200 rounded-sm p-4 overflow-auto max-h-96">
              <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap">
                {metrics}
              </pre>
            </div>

            {/* Info Notice */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Admin Access Required
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>This page shows system metrics and is typically restricted to administrators. In demo mode, some metrics may be unavailable or simulated.</p>
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
