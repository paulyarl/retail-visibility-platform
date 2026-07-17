'use client';

import { useState } from 'react';
import { useAdminDirectoryListings } from '@/hooks/admin/useAdminDirectoryListings';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import DirectoryListingsTable from '@/components/admin/directory/DirectoryListingsTable';
import FeatureListingModal from '@/components/admin/directory/FeatureListingModal';
import { clientLogger } from '@/lib/client-logger';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminDirectoryListingsPage() {
  const [filters, setFilters] = useState({
    status: undefined as 'published' | 'draft' | 'featured' | undefined,
    tier: undefined as 'google_only' | 'starter' | 'discovery' | 'commitment' | 'storefront' | 'professional' | 'enterprise' | 'chain_starter' | 'chain_pro' | 'chain_enterprise' | undefined,
    quality: undefined as 'low' | 'medium' | 'high' | undefined,
    search: '',
  });
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedTenantName, setSelectedTenantName] = useState<string>('');

  const { listings, loading, error, featureListing, unfeatureListing } = useAdminDirectoryListings(filters);

  const handleFeature = async (tenantId: string, tenantName: string) => {
    setSelectedTenantId(tenantId);
    setSelectedTenantName(tenantName);
    setFeatureModalOpen(true);
  };

  const handleFeatureConfirm = async (until: Date, priority: number) => {
    try {
      await featureListing(selectedTenantId, until, priority);
      setFeatureModalOpen(false);
      setSelectedTenantId('');
      setSelectedTenantName('');
    } catch (err) {
      clientLogger.error('Failed to feature listing:', { detail: err });
    }
  };

  const handleUnfeature = async (tenantId: string) => {
    try {
      await unfeatureListing(tenantId);
    } catch (err) {
      clientLogger.error('Failed to unfeature listing:', { detail: err });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="All Directory Listings"
        description="View and manage directory listings across all tenants"
        actions={
          <Link href="/settings/admin/directory" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            ← Directory Panel
          </Link>
        }
      />

      <div className="mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by business name or tenant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
        
        {/* Filter Buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Status Filters */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
            {[
              { value: undefined, label: 'All', color: 'gray' },
              { value: 'published', label: 'Published', color: 'green' },
              { value: 'draft', label: 'Draft', color: 'yellow' },
              { value: 'featured', label: 'Featured', color: 'blue' }
            ].map(({ value, label, color }) => (
              <button
                key={label}
                onClick={() => setFilters({ ...filters, status: value as any })}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  filters.status === value
                    ? color === 'gray' ? 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                    : color === 'green' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
                    : color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700'
                    : color === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700'
                    : ''
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tier Filters */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tier:</span>
            {[
              { value: undefined, label: 'All' },
              { value: 'google_only', label: 'Google Only' },
              { value: 'starter', label: 'Starter' },
              { value: 'discovery', label: 'Discovery' },
              { value: 'commitment', label: 'Commitment' },
              { value: 'storefront', label: 'Storefront' },
              { value: 'professional', label: 'Professional' },
              { value: 'enterprise', label: 'Enterprise' },
              { value: 'chain_starter', label: 'Chain Starter' },
              { value: 'chain_pro', label: 'Chain Pro' },
              { value: 'chain_enterprise', label: 'Chain Enterprise' }
            ].map(({ value, label }) => (
              <button
                key={label}
                onClick={() => setFilters({ ...filters, tier: value as any })}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  filters.tier === value
                    ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quality Filters */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quality:</span>
            {[
              { value: undefined, label: 'All' },
              { value: 'low', label: 'Low (0-50)' },
              { value: 'medium', label: 'Medium (51-100)' },
              { value: 'high', label: 'High (101+)' }
            ].map(({ value, label }) => (
              <button
                key={label}
                onClick={() => setFilters({ ...filters, quality: value as any })}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  filters.quality === value
                    ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>)}
          </div>
        </div>
      ) : (
        <>
          <DirectoryListingsTable listings={listings} onFeature={handleFeature} onUnfeature={handleUnfeature} />
          
          <FeatureListingModal
            isOpen={featureModalOpen}
            onClose={() => setFeatureModalOpen(false)}
            onConfirm={handleFeatureConfirm}
            loading={loading}
            tenantName={selectedTenantName}
          />
        </>
      )}
    </div>
  );
}
