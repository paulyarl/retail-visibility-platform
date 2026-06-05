import { Card, CardHeader, CardContent } from "@/components/ui";

/**
 * Dashboard Loading Skeleton
 * Shows placeholder UI while dashboard data loads
 * Improves perceived performance
 */
export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-9 w-64 bg-neutral-200 rounded animate-pulse mb-2"></div>
          <div className="h-5 w-96 bg-neutral-200 rounded animate-pulse"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-16 bg-neutral-200 rounded animate-pulse"></div>
                  <div className="h-12 w-12 bg-neutral-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-4 w-32 bg-neutral-200 rounded animate-pulse mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-32 bg-neutral-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-neutral-200 rounded animate-pulse mb-4"></div>
                <div className="h-10 w-full bg-neutral-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
