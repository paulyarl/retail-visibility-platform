import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";

export interface DashboardStatsProps {
  totalItems: number;
  activeItems: number;
  syncIssues: number;
  locations: number;
}

/**
 * Dashboard Stats Cards Component
 * Displays 4 key metrics in a responsive grid
 * Reusable across platform and tenant dashboards
 */
export default function DashboardStats({ totalItems, activeItems, syncIssues, locations }: DashboardStatsProps) {
  // Animated counts
  const inventoryCount = useCountUp(totalItems);
  const listingsCount = useCountUp(activeItems);
  const syncIssuesCount = useCountUp(syncIssues);
  const locationsCount = useCountUp(locations);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Catalog Size
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {inventoryCount}
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-500">total products</p>
        </CardContent>
      </Card>

      {/* Active Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Live Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {listingsCount}
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-500">synced to Google</p>
        </CardContent>
      </Card>

      {/* Sync Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Sync Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {syncIssuesCount}
            </div>
            <div className={`p-3 rounded-full ${syncIssues > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
              <svg className={`w-6 h-6 ${syncIssues > 0 ? 'text-yellow-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {syncIssues === 0 ? 'everything synced' : 'items need attention'}
          </p>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Your Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {locationsCount}
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-500">managed stores</p>
        </CardContent>
      </Card>
    </div>
  );
}
