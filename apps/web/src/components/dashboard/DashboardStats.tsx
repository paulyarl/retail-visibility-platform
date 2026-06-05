import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";

export interface DashboardStatsProps {
  activeItems: number;
  totalItems: number;
  categories: number;
  users: number;
  orders: number;
  syncIssues: number;
  tenantId?: string; // Optional: for specific tenant context
}

/**
 * Dashboard Stats Cards Component
 * Displays 4 key metrics in a responsive grid with capacity information
 * Now uses consolidated usage data from useTenantComplete hook
 * Reusable across platform and tenant dashboards
 */
export default function DashboardStats({ activeItems, totalItems, categories, users, orders, syncIssues, tenantId }: DashboardStatsProps) {
  // Use consolidated data directly - no redundant API calls!
  
  // Animated counts using consolidated data
  const inventoryCount = useCountUp(totalItems || 0);        // Use totalItems from consolidated data
  const listingsCount = useCountUp(activeItems || 0);        // Use activeItems from consolidated data  
  const categoriesCount = useCountUp(categories || 0);       // Use categories from consolidated data
  const usersCount = useCountUp(users || 0);                // Use users from consolidated data
  const ordersCount = useCountUp(orders || 0);               // Use orders from consolidated data
  const syncIssuesCount = useCountUp(syncIssues || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Catalog Size */}
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
          <p className="text-xs text-neutral-500 mt-2">Total items in catalog</p>
        </CardContent>
      </Card>

      {/* Live Products */}
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
          <p className="text-xs text-neutral-500 mt-2">Active listings</p>
        </CardContent>
      </Card>

      {/* Sync Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Sync Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {syncIssuesCount === 0 ? "Good" : `${syncIssuesCount} Issues`}
            </div>
            <div className={`p-3 rounded-full ${syncIssuesCount === 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <svg className={`w-6 h-6 ${syncIssuesCount === 0 ? 'text-green-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {syncIssuesCount === 0 ? "All systems synced" : "Sync issues detected"}
          </p>
        </CardContent>
      </Card>

      {/* Your Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-600">
            Your Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-neutral-900">
              {usersCount}
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">Active users/locations</p>
        </CardContent>
      </Card>
    </div>
  );
}
