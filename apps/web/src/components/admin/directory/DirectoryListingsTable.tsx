'use client';

import { useState } from 'react';
import { AdminDirectoryListing } from '@/hooks/admin/useAdminDirectoryListings';
import DirectoryStatusBadge from '@/components/directory/DirectoryStatusBadge';
import Link from 'next/link';
import { getTierInfo } from '@/lib/tiers';

interface DirectoryListingsTableProps {
  listings: AdminDirectoryListing[];
  onFeature: (tenantId: string, tenantName: string) => void;
  onUnfeature: (tenantId: string) => void;
  onSpawnCampaign: (tenantId: string, tenantName: string, category?: string) => void;
  onReEnrich?: (tenantId: string, tenantName: string) => void;
}

export default function DirectoryListingsTable({
  listings,
  onFeature,
  onUnfeature,
  onSpawnCampaign,
  onReEnrich,
}: DirectoryListingsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = () => {
    if (selectedIds.length === listings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(listings.map(l => l.tenant_id));
    }
  };

  const handleSelectOne = (tenantId: string) => {
    if (selectedIds.includes(tenantId)) {
      setSelectedIds(selectedIds.filter(id => id !== tenantId));
    } else {
      setSelectedIds([...selectedIds, tenantId]);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatEnrichmentTooltip = (event: AdminDirectoryListing['lastEnrichmentEvent']) => {
    if (!event) return '';
    const date = new Date(event.enrichedAt).toLocaleString();
    const profile = event.intelligenceProfileId ? `profile ${event.intelligenceProfileId}` : 'no profile';
    return `${event.triggerSource} · ${date} · ${profile}`;
  };

  const getTierBadgeColor = (tier?: string) => {
    if (!tier) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    // Use the canonical tier color from TIER_LIMITS so every tier the API
    // returns (directory_presence, omnichannel, expired_trial, trial_*, ...)
    // gets a consistent color instead of falling back to gray.
    return getTierInfo(tier).color || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const getTierLabel = (tier?: string) => {
    if (!tier) return '';
    return getTierInfo(tier).name;
  };

  if (listings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No listings found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Mobile View */}
      <div className="md:hidden">
        {listings.map((listing) => (
          <div key={listing.tenant_id} className="border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {listing.businessName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {listing.tenant?.name || listing.tenants?.name || listing.businessName}
                  </p>
              </div>
              <DirectoryStatusBadge
                isPublished={listing.is_published}
                isFeatured={listing.is_featured}
              />
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTierBadgeColor(listing.tenant?.subscriptionTier || listing.tenants?.subscription_tier)}`}>
                {getTierLabel(listing.tenant?.subscriptionTier || listing.tenants?.subscription_tier)}
              </span>
              <span className={`text-sm font-medium ${getQualityColor(listing.qualityScore)}`}>
                {listing.qualityScore}%
              </span>
              {listing.lastEnrichmentEvent && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                  title={formatEnrichmentTooltip(listing.lastEnrichmentEvent)}
                >
                  SEO enriched
                </span>
              )}
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Category:</span>{' '}
              {listing.primary_category || listing.seedCategory || '—'}
            </div>

            {listing.campaigns && listing.campaigns.length > 0 && (
              <div className="mb-2 space-y-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Campaigns</span>
                {listing.campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/settings/admin/marketing-ops/campaigns/${campaign.id}`}
                    className="block text-sm text-blue-600 hover:underline truncate"
                  >
                    {campaign.businessName || campaign.id} · {campaign.category} · {campaign.stage}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {listing.is_featured ? (
                <button
                  onClick={() => onUnfeature(listing.tenant_id)}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Unfeature
                </button>
              ) : (
                <button
                  onClick={() => onFeature(listing.tenant_id, listing.businessName)}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Feature
                </button>
              )}
              <button
                onClick={() => onSpawnCampaign(listing.tenant_id, listing.businessName, listing.primary_category || listing.seedCategory || undefined)}
                className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Spawn Campaign
              </button>
              {onReEnrich && (
                <button
                  onClick={() => onReEnrich(listing.tenant_id, listing.businessName)}
                  className="flex-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Re-enrich
                </button>
              )}
              <Link
                href={`/t/${listing.tenant_id}/settings/directory`}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-center"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === listings.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Business
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tier
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quality
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Items
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Campaign
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Enriched
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {listings.map((listing) => (
              <tr key={listing.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(listing.tenant_id)}
                    onChange={() => handleSelectOne(listing.tenant_id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {listing.businessName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {listing.tenant?.name || listing.tenants?.name || listing.businessName}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <DirectoryStatusBadge
                    isPublished={listing.is_published}
                    isFeatured={listing.is_featured}
                  />
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(listing.tenant?.subscriptionTier || listing.tenants?.subscription_tier)}`}>
                    {getTierLabel(listing.tenant?.subscriptionTier || listing.tenants?.subscription_tier)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-medium ${getQualityColor(listing.qualityScore)}`}>
                    {listing.qualityScore}%
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {listing.itemCount}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {listing.primary_category || listing.seedCategory || '-'}
                    </div>
                    {listing.secondary_categories && listing.secondary_categories.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {listing.secondary_categories.slice(0, 2).join(', ')}
                        {listing.secondary_categories.length > 2 && ` +${listing.secondary_categories.length - 2} more`}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-left text-sm">
                  {listing.campaigns && listing.campaigns.length > 0 ? (
                    <div className="space-y-1">
                      {listing.campaigns.slice(0, 2).map((campaign) => (
                        <div key={campaign.id} className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/settings/admin/marketing-ops/campaigns/${campaign.id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 truncate font-medium"
                          >
                            {campaign.businessName || campaign.id}
                          </Link>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {campaign.category}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {campaign.stage}
                          </span>
                        </div>
                      ))}
                      {listing.campaigns.length > 2 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{listing.campaigns.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-left text-sm">
                  {listing.lastEnrichmentEvent ? (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      title={formatEnrichmentTooltip(listing.lastEnrichmentEvent)}
                    >
                      SEO enriched
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                  {listing.is_featured ? (
                    <button
                      onClick={() => onUnfeature(listing.tenant_id)}
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Unfeature
                    </button>
                  ) : (
                    <button
                      onClick={() => onFeature(listing.tenant_id, listing.businessName)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      Feature
                    </button>
                  )}
                  <button
                    onClick={() => onSpawnCampaign(listing.tenant_id, listing.businessName, listing.primary_category || listing.seedCategory || undefined)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
                  >
                    Spawn Campaign
                  </button>
                  {onReEnrich && (
                    <button
                      onClick={() => onReEnrich(listing.tenant_id, listing.businessName)}
                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200"
                    >
                      Re-enrich
                    </button>
                  )}
                  <Link
                    href={`/t/${listing.tenant_id}/settings/directory`}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedIds.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
