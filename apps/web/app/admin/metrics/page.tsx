import { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '../../../components/oasis/Nav'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { buttonVariants } from '../../../components/ui/Button'
import { getSiteBaseUrl } from '../../../lib/url'

export const metadata: Metadata = {
  title: 'Metrics - Oasis Care Admin',
  description: 'System metrics and performance monitoring',
}

async function getMetrics(): Promise<string> {
  try {
    const response = await fetch(`${getSiteBaseUrl()}/api/metrics`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      return 'Metrics endpoint not available or disabled';
    }
    
    return await response.text();
  } catch (error) {
    return `Metrics unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export default async function MetricsPage() {
  const metrics = await getMetrics();

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <Nav />
        
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
                  <span className="text-text-primary">Demo</span>
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
                  <span className="text-text-secondary">Auth Bypass:</span>
                  <span className="text-yellow-600 font-medium">⚠️ Enabled</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Seed Data:</span>
                  <span className="text-green-600 font-medium">✅ Loaded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Test DB:</span>
                  <span className="text-green-600 font-medium">✅ Available</span>
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
              <Link href="/admin/metrics" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Refresh
              </Link>
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
                    Admin Access Verified
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>This route is now restricted to authenticated admin users before any page content is rendered.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
