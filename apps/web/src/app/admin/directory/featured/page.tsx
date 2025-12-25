'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { useAdminDirectoryListings } from '@/hooks/admin/useAdminDirectoryListings';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminFeaturedDirectoryPage() {
  const { listings, loading, error } = useAdminDirectoryListings({ status: 'featured' });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Featured Directory Listings"
        description="Manage featured placements and priorities in the public directory"
        actions={
          <Link
            href="/admin/directory"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← Back to Directory
          </Link>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No featured listings
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Featured listings will appear here when tenants upgrade to eligible tiers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {listing.businessName}
                      </h3>
                      <Badge variant="warning">
                        ⭐ Featured
                      </Badge>
                      <Badge variant="default">
                        Quality: {listing.qualityScore}%
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        🏷️ {listing.tenant.subscriptionTier}
                      </span>
                      <span>
                        📦 {listing.itemCount} items
                      </span>
                      {listing.primaryCategory && (
                        <span>
                          🏪 {listing.primaryCategory}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/t/${listing.tenant_id}/settings/directory`}
                      className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
