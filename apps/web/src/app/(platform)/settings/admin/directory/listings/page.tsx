'use client';

import { useState } from 'react';
import { useAdminDirectoryListings } from '@/hooks/admin/useAdminDirectoryListings';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import DirectoryListingsTable from '@/components/admin/directory/DirectoryListingsTable';
import FeatureListingModal from '@/components/admin/directory/FeatureListingModal';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import { clientLogger } from '@/lib/client-logger';
import { Rocket, X, AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { getTierInfo } from '@/lib/tiers';

const DISCLOSURE_SENTENCE = ' Listed on VisibleShelf from public information (address, phone). Claim this listing to verify and update details.';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminDirectoryListingsPage() {
  const [filters, setFilters] = useState({
    status: undefined as 'published' | 'draft' | 'featured' | undefined,
    tier: undefined as string | undefined,
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
  const [spawnedCampaign, setSpawnedCampaign] = useState<{ id: string; businessName?: string; category: string } | null>(null);
  const [reEnrichSuccess, setReEnrichSuccess] = useState<string | null>(null);

  // Edit SEO modal state
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [seoTenantId, setSeoTenantId] = useState('');
  const [seoTenantName, setSeoTenantName] = useState('');
  const [seoState, setSeoState] = useState<any | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoResetDescription, setSeoResetDescription] = useState(false);
  const [seoResetKeywords, setSeoResetKeywords] = useState(false);

  const { listings, loading, error, availableTiers, featureListing, unfeatureListing, spawnCampaign, reEnrich } = useAdminDirectoryListings(filters);

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
    setSpawnedCampaign(null);
    setSpawnModalOpen(true);
  };

  const handleSpawnConfirm = async () => {
    setSpawnError(null);
    setSpawnedCampaign(null);
    try {
      setSpawning(true);
      const campaign = await spawnCampaign(spawnTenantId, {
        category: spawnCategory.trim() || undefined,
        notes: spawnNotes.trim() || undefined,
      });
      setSpawnedCampaign(campaign ? {
        id: campaign.id,
        businessName: campaign.business_name,
        category: campaign.category,
      } : null);
      setSpawnModalOpen(false);
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : 'Failed to spawn campaign');
    } finally {
      setSpawning(false);
    }
  };

  const handleReEnrich = async (tenantId: string, tenantName: string) => {
    try {
      setReEnrichSuccess(null);
      await reEnrich(tenantId);
      setReEnrichSuccess(`Market enrichment re-run for ${tenantName}.`);
    } catch (err) {
      clientLogger.error('Failed to re-enrich listing:', { detail: err });
    }
  };

  const openSeoModal = async (tenantId: string, tenantName: string) => {
    setSeoTenantId(tenantId);
    setSeoTenantName(tenantName);
    setSeoModalOpen(true);
    setSeoError(null);
    setSeoLoading(true);
    try {
      const state = await directoryPresenceAdminService.getTenantSeoState(tenantId);
      setSeoState(state);
      const currentDesc = state?.current?.seoDescription
        ? stripDisclosure(state.current.seoDescription)
        : '';
      setSeoDescription(currentDesc);
      setSeoKeywords((state?.current?.seoKeywords || []).join(', '));
      setSeoResetDescription(false);
      setSeoResetKeywords(false);
    } catch (err) {
      setSeoError(err instanceof Error ? err.message : 'Failed to load SEO state');
    } finally {
      setSeoLoading(false);
    }
  };

  const closeSeoModal = () => {
    setSeoModalOpen(false);
    setSeoState(null);
    setSeoError(null);
  };

  const handleSaveSeo = async () => {
    setSeoError(null);
    try {
      setSeoSaving(true);
      const keywordsArray = seoKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const payload: any = {};
      if (seoResetDescription) {
        payload.reset_description = true;
      } else if (seoDescription.trim()) {
        payload.seo_description = seoDescription.trim();
      } else {
        payload.seo_description = '';
      }
      if (seoResetKeywords) {
        payload.reset_keywords = true;
      } else if (seoKeywords.trim()) {
        payload.seo_keywords = keywordsArray;
      } else {
        payload.seo_keywords = [];
      }
      const state = await directoryPresenceAdminService.overrideTenantSeo(seoTenantId, payload);
      setSeoState(state);
      const currentDesc = state?.current?.seoDescription
        ? stripDisclosure(state.current.seoDescription)
        : '';
      setSeoDescription(currentDesc);
      setSeoKeywords((state?.current?.seoKeywords || []).join(', '));
      setSeoResetDescription(false);
      setSeoResetKeywords(false);
      setReEnrichSuccess(`SEO updated for ${seoTenantName}.`);
      closeSeoModal();
    } catch (err) {
      setSeoError(err instanceof Error ? err.message : 'Failed to update SEO');
    } finally {
      setSeoSaving(false);
    }
  };

  function stripDisclosure(text: string): string {
    return text.endsWith(DISCLOSURE_SENTENCE) ? text.slice(0, -DISCLOSURE_SENTENCE.length) : text;
  }

  const isOwnerDescription = !!seoState?.ownerAuthored?.description;
  const isOwnerKeywords = !!seoState?.ownerAuthored?.keywords;
  const previewDescription = (seoDescription.trim() ? seoDescription.trim() : seoState?.composed?.description || '') + DISCLOSURE_SENTENCE;

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

          {/* Tier Filters — options are derived dynamically from the API
              response (availableTiers) so the filter always reflects the
              subscription_tier values that actually exist in the data
              (directory_presence, omnichannel, expired_trial, trial_*, ...). */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tier:</span>
            <button
              onClick={() => setFilters({ ...filters, tier: undefined })}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filters.tier === undefined
                  ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {availableTiers.map((value) => {
              const label = getTierInfo(value).name;
              return (
                <button
                  key={value}
                  onClick={() => setFilters({ ...filters, tier: value })}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.tier === value
                      ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
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
          {spawnedCampaign && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">
                Campaign &quot;{spawnedCampaign.businessName || spawnedCampaign.id}&quot; spawned successfully.{' '}
                Category: <span className="font-medium">{spawnedCampaign.category}</span>.{' '}
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${spawnedCampaign.id}`}
                  className="underline font-medium hover:text-green-900 dark:hover:text-green-100"
                >
                  View campaign
                </Link>
              </p>
            </div>
          )}

          {reEnrichSuccess && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">{reEnrichSuccess}</p>
            </div>
          )}

          <DirectoryListingsTable
            listings={listings}
            onFeature={handleFeature}
            onUnfeature={handleUnfeature}
            onSpawnCampaign={handleSpawnCampaign}
            onReEnrich={handleReEnrich}
            onEditSeo={openSeoModal}
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

          {/* Edit SEO Modal */}
          {seoModalOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit SEO</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{seoTenantName}</p>
                  </div>
                  <button onClick={closeSeoModal} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {seoLoading ? (
                    <div className="text-sm text-gray-500">Loading SEO state…</div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Composed description (read-only)
                        </label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
                          {seoState?.composed?.description || '—'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Override description (≤ 500 chars)
                          </label>
                          <div className="flex items-start gap-2">
                            <textarea
                              rows={4}
                              value={seoDescription}
                              onChange={(e) => setSeoDescription(e.target.value)}
                              disabled={seoResetDescription || isOwnerDescription}
                              maxLength={500}
                              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                            <label className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap mt-2">
                              <input
                                type="checkbox"
                                checked={seoResetDescription}
                                onChange={(e) => setSeoResetDescription(e.target.checked)}
                                disabled={isOwnerDescription}
                              />
                              <RotateCcw className="w-3 h-3" /> Reset
                            </label>
                          </div>
                          {isOwnerDescription && (
                            <p className="text-xs text-amber-600 mt-1">
                              Owner-edited description is locked. Reset is disabled.
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">{seoDescription.length}/500 characters</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Live preview (with disclosure)
                          </label>
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 min-h-[104px]">
                            {previewDescription}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Override keywords (comma-separated, ≤ 10)
                        </label>
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={seoKeywords}
                            onChange={(e) => setSeoKeywords(e.target.value)}
                            disabled={seoResetKeywords || isOwnerKeywords}
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            placeholder="african grocery, west african foods"
                          />
                          <label className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap mt-2">
                            <input
                              type="checkbox"
                              checked={seoResetKeywords}
                              onChange={(e) => setSeoResetKeywords(e.target.checked)}
                              disabled={isOwnerKeywords}
                            />
                            <RotateCcw className="w-3 h-3" /> Reset
                          </label>
                        </div>
                        {isOwnerKeywords && (
                          <p className="text-xs text-amber-600 mt-1">
                            Owner-edited keywords are locked. Reset is disabled.
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {seoKeywords.split(',').map((k) => k.trim()).filter(Boolean).length} keywords
                        </p>
                      </div>

                      {seoError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                          {seoError}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
                  <button
                    onClick={closeSeoModal}
                    disabled={seoSaving}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSeo}
                    disabled={seoLoading || seoSaving || (isOwnerDescription && isOwnerKeywords)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {seoSaving ? 'Saving...' : 'Save SEO'}
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
