'use client'

import { useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Oasis Dashboard
          </h1>
          <p className="text-text-secondary">
            Overview of today&apos;s care activities and alerts
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <h2 className="text-xl font-semibold text-text-primary font-heading">
              Something went wrong
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-text-secondary">
                We encountered an error while loading the dashboard. This might be due to a temporary issue with our servers.
              </p>
              
              <div className="space-y-2">
                <Button 
                  onClick={reset}
                  className="w-full"
                  aria-describedby="retry-description"
                >
                  Try again
                </Button>
                <p id="retry-description" className="text-sm text-text-secondary">
                  Click to reload the dashboard
                </p>
              </div>
              
              {error.digest && (
                <details className="mt-4">
                  <summary className="text-sm text-text-secondary cursor-pointer">
                    Technical details
                  </summary>
                  <p className="text-xs text-text-secondary mt-2 font-mono">
                    Error ID: {error.digest}
                  </p>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
