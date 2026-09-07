'use client';

import { useState } from 'react';
import { useAdminDirectoryListings } from '@/hooks/admin/useAdminDirectoryListings';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import DirectoryListingsTable from '@/components/admin/directory/DirectoryListingsTable';
import FeatureListingModal from '@/components/admin/directory/FeatureListingModal';
import { clientLogger } from '@/lib/client-logger';
import { Rocket, X, AlertTriangle } from 'lucide-react';

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

  // Spawn campaign modal state
  const [spawnModalOpen, setSpawnModalOpen] = useState(false);
  const [spawnTenantId, setSpawnTenantId] = useState<string>('');
  const [spawnTenantName, setSpawnTenantName] = useState<string>('');
  const [spawnCategory, setSpawnCategory] = useState<string>('');
  const [spawnNotes, setSpawnNotes] = useState<string>('');
  const [spawning, setSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnSuccess, setSpawnSuccess] = useState<string | null>(null);

  const { listings, loading, error, featureListing, unfeatureListing, spawnCampaign } = useAdminDirectoryListings(filters);

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

  const handleSpawnCampaign = (tenantId: string, tenantName: string, category?: string) => {
    setSpawnTenantId(tenantId);
    setSpawnTenantName(tenantName);
    setSpawnCategory(category || '');
    setSpawnNotes('');
    setSpawnError(null);
    setSpawnSuccess(null);
    setSpawnModalOpen(true);
  };

  const handleSpawnConfirm = async () => {
    setSpawnError(null);
    setSpawnSuccess(null);
    try {
      setSpawning(true);
      const campaign = await spawnCampaign(spawnTenantId, {
        category: spawnCategory.trim() || undefined,
        notes: spawnNotes.trim() || undefined,
      });
      setSpawnSuccess(
        `Campaign "${campaign?.business_name || campaign?.id || spawnTenantName}" spawned successfully. ` +
        `View it in Marketing Ops.`
      );
      setSpawnModalOpen(false);
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : 'Failed to spawn campaign');
    } finally {
      setSpawning(false);
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
          {spawnSuccess && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">{spawnSuccess}</p>
            </div>
          )}

          <DirectoryListingsTable
            listings={listings}
            onFeature={handleFeature}
            onUnfeature={handleUnfeature}
            onSpawnCampaign={handleSpawnCampaign}
          />

          <FeatureListingModal
            isOpen={featureModalOpen}
            onClose={() => setFeatureModalOpen(false)}
            onConfirm={handleFeatureConfirm}
            loading={loading}
            tenantName={selectedTenantName}
          />

          {/* Spawn Campaign Modal */}
          {spawnModalOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Spawn a campaign</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Creates a new business-scope marketing campaign from this tenant&apos;s
                      directory listing NAP.
                    </p>
                  </div>
                  <button
                    onClick={() => setSpawnModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Business name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{spawnTenantName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={spawnCategory}
                      onChange={(e) => setSpawnCategory(e.target.value)}
                      placeholder="Leave blank to use listing category"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Override the marketing niche category if the directory category
                      doesn&apos;t match. Leave blank to inherit.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={spawnNotes}
                      onChange={(e) => setSpawnNotes(e.target.value)}
                      placeholder="Defaults to a tenant-listing-origin note."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="inline w-4 h-4 mr-1" />
                    The campaign starts at the <strong>seek</strong> stage (triage). If an
                    active campaign with the same business-scope signature already exists, the
                    structural-duplicate guardrail will block creation.
                  </div>
                  {spawnError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                      {spawnError}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSpawnModalOpen(false)}
                    disabled={spawning}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSpawnConfirm}
                    disabled={spawning}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    <Rocket className="w-4 h-4" />
                    {spawning ? 'Spawning...' : 'Spawn Campaign'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
