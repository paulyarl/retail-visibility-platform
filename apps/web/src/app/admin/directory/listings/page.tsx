'use client';

import { useState } from 'react';
import { useAdminDirectoryListings } from '@/hooks/admin/useAdminDirectoryListings';
import DirectoryListingsTable from '@/components/admin/directory/DirectoryListingsTable';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminDirectoryListingsPage() {
  const [filters, setFilters] = useState({
    status: undefined as 'published' | 'draft' | 'featured' | undefined,
    search: '',
  });

  const { listings, loading, error, featureListing, unfeatureListing } = useAdminDirectoryListings(filters);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const handleFeature = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    // For now, feature for 30 days with priority 5
    const until = new Date();
    until.setDate(until.getDate() + 30);
    
    try {
      await featureListing(tenantId, until, 5);
    } catch (err) {
      console.error('Failed to feature listing:', err);
    }
  };

  const handleUnfeature = async (tenantId: string) => {
    try {
      await unfeatureListing(tenantId);
    } catch (err) {
      console.error('Failed to unfeature listing:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          All Directory Listings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View and manage directory listings across all tenants
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by business name or tenant..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as any || undefined })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="featured">Featured</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <DirectoryListingsTable
          listings={listings}
          onFeature={handleFeature}
          onUnfeature={handleUnfeature}
        />
      )}
    </div>
  );
}
