'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  DirectoryPresenceSeedSummary,
} from '@/services/DirectoryPresenceAdminService';
import { List, Plus, Send, CheckCircle, Eye, MapPin, Tag, Clock, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-blue-100 text-blue-700',
  invited: 'bg-amber-100 text-amber-700',
  claimed: 'bg-green-100 text-green-700',
  suppressed: 'bg-red-100 text-red-700',
};

export default function DirectoryPresenceSeedsPage() {
  const [seeds, setSeeds] = useState<DirectoryPresenceSeedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('');
  const [filterCategoryFit, setFilterCategoryFit] = useState('');
  const [filterClaimToken, setFilterClaimToken] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<{ seedId: string; token: string } | null>(null);

  const fetchSeeds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await directoryPresenceAdminService.listSeeds({
        seedBatch: filterBatch || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        city: filterCity || undefined,
        state: filterState || undefined,
        identityConfidence: filterConfidence || undefined,
        categoryFit: filterCategoryFit || undefined,
        hasClaimToken: filterClaimToken || undefined,
      });
      setSeeds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presence seeds');
    } finally {
      setLoading(false);
    }
  }, [
    filterBatch,
    filterStatus,
    filterCategory,
    filterCity,
    filterState,
    filterConfidence,
    filterCategoryFit,
    filterClaimToken,
  ]);

  useEffect(() => {
    fetchSeeds();
  }, [fetchSeeds]);

  const handlePublish = async (seedId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await directoryPresenceAdminService.publishSeed(seedId);
      setActionSuccess('Listing published successfully.');
      fetchSeeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish listing');
    }
  };

  const handleInvite = async (seedId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setInviteToken(null);
    try {
      const result = await directoryPresenceAdminService.inviteSeed(seedId);
      setInviteToken({ seedId, token: result.token });
      setActionSuccess('Claim token generated. Share the link below with the business owner.');
      fetchSeeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate invite');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory Presence Seeds"
        description="Manage unclaimed directory listings seeded from public information."
        icon={<List className="w-6 h-6" />}
        actions={
          <Link
            href="/settings/admin/directory/presence-seeds/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Seed
          </Link>
        }
      />

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {actionSuccess}
        </div>
      )}
      {inviteToken && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-1">Claim Link</p>
          <p className="text-sm text-blue-700 break-all font-mono">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/place/claim/${inviteToken.token}`
              : `/place/claim/${inviteToken.token}`}
          </p>
          <button
            className="mt-2 text-xs text-blue-600 underline"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                const link = `${window.location.origin}/place/claim/${inviteToken.token}`;
                navigator.clipboard.writeText(link);
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seed Batch</label>
            <input
              type="text"
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              placeholder="e.g. indianapolis-african-grocery-2026"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="invited">Invited</option>
              <option value="claimed">Claimed</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              placeholder="e.g. African Grocery"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="e.g. Indianapolis"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              placeholder="e.g. IN"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identity Confidence</label>
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Fit</label>
            <select
              value={filterCategoryFit}
              onChange={(e) => setFilterCategoryFit(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="probable">Probable</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claim Token</label>
            <select
              value={filterClaimToken}
              onChange={(e) => setFilterClaimToken(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="yes">Has active token</option>
              <option value="no">No active token</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={fetchSeeds}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Filter
          </button>
          <Link
            href="/place"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            title="Open the public directory presence page in a new tab"
          >
            <ExternalLink className="w-4 h-4" /> View Public Directory
          </Link>
        </div>
      </div>

      {/* Seeds table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading seeds...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      ) : seeds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No presence seeds found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-3 px-4 font-medium">Business</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Location</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Confidence</th>
                <th className="py-3 px-4 font-medium">SNAP/EBT</th>
                <th className="py-3 px-4 font-medium">Claim Token</th>
                <th className="py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => (
                <tr key={seed.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/settings/admin/directory/presence-seeds/${seed.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {seed.businessName}
                    </Link>
                    <div className="text-xs text-gray-500">{seed.seedBatch}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{seed.category}</td>
                  <td className="py-3 px-4 text-gray-700">
                    {seed.city}, {seed.state}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[seed.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {seed.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs ${
                        seed.identityConfidence === 'high'
                          ? 'text-green-600 font-medium'
                          : 'text-amber-600 font-medium'
                      }`}
                    >
                      {seed.identityConfidence}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {seed.snapEbtReported ? (
                      <span className="text-xs text-green-600 font-medium">Reported</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {seed.hasClaimToken ? (
                      <span className="text-xs text-amber-600">
                        <Clock className="inline w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {seed.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(seed.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          title="Publish listing"
                        >
                          <CheckCircle className="inline w-4 h-4" />
                        </button>
                      )}
                      {(seed.status === 'published' || seed.status === 'invited') &&
                        !seed.hasClaimToken && (
                          <button
                            onClick={() => handleInvite(seed.id)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            title="Generate claim invite"
                          >
                            <Send className="inline w-4 h-4" />
                          </button>
                        )}
                      <Link
                        href={`/settings/admin/directory/presence-seeds/${seed.id}`}
                        className="text-xs text-gray-600 hover:text-gray-800"
                        title="View details"
                      >
                        <Eye className="inline w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
