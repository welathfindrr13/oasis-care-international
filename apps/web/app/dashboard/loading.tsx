import { Card, CardContent, CardHeader } from '../../components/ui/Card'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-7xl mx-auto p-6">
        {/* Nav skeleton */}
        <div className="mb-8">
          <div className="h-8 w-32 bg-background-accent rounded animate-pulse mb-4"></div>
        </div>
        
        <div className="mb-8">
          <div className="h-9 w-48 bg-background-accent rounded animate-pulse mb-2"></div>
          <div className="h-5 w-64 bg-background-accent rounded animate-pulse"></div>
        </div>

        {/* Metrics Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 w-20 bg-background-accent rounded animate-pulse"></div>
                  <div className="h-8 w-12 bg-background-accent rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="h-6 w-32 bg-background-accent rounded animate-pulse mb-2"></div>
                <div className="h-4 w-48 bg-background-accent rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-20 bg-background-accent rounded animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-sm bg-background-secondary"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-12 bg-background-accent rounded animate-pulse"></div>
                      <div className="h-5 w-16 bg-background-accent rounded animate-pulse"></div>
                    </div>
                    <div className="h-4 w-40 bg-background-accent rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-background-accent rounded animate-pulse"></div>
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
