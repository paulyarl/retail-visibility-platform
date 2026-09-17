'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';

interface BatchEntry {
  id: string;
  nicheCategory: string;
  city: string;
  state: string | null;
  intelligenceFocus: string;
  profileId: string;
  profileVersion: number | null;
  sortOrder: number;
}

interface BatchDetail {
  id: string;
  batchSlug: string;
  nicheCategory: string;
  intelligenceFocus: string;
  cities: string[];
  campaignIds: string[];
  status: string;
  createdAt: string;
  completedAt: string | null;
  entries?: BatchEntry[];
  metrics: {
    totalProspects: number;
    totalSeeds: number;
    publishedSeeds: number;
    invitedSeeds: number;
    claimedSeeds: number;
  };
  perCity: Array<{
    city: string;
    prospects: number;
    seeds: number;
    published: number;
    invited: number;
    claimed: number;
  }>;
}

export default function BatchDetailClient() {
  const params = useParams();
  const batchId = params?.id as string;

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await directoryPresenceAdminService.getSeekBatch(batchId);
      setBatch(result);
    } catch (err: any) {
      setError(err?.message || 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      await directoryPresenceAdminService.launchSeekBatch(batchId);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to launch batch.');
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500">Loading batch...</p></div>;
  }
  if (error || !batch) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{error || 'Batch not found'}</p>
        <Link href="/settings/admin/directory/batches" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to Batch Operations
        </Link>
      </div>
    );
  }

  const statusColor =
    batch.status === 'completed' ? 'bg-green-50 text-green-700' :
    batch.status === 'running' ? 'bg-blue-50 text-blue-700' :
    batch.status === 'draft' ? 'bg-gray-50 text-gray-700' :
    'bg-red-50 text-red-700';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{batch.batchSlug}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {batch.nicheCategory} · {(batch.cities || []).join(', ') || '—'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {batch.status === 'draft' && (
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {launching ? 'Launching...' : 'Launch Batch'}
            </button>
          )}
          <Link href="/settings/admin/directory/batches" className="text-sm text-blue-600 hover:underline">
            ← Back to Batches
          </Link>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {batch.status}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            batch.intelligenceFocus === 'competitive' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {batch.intelligenceFocus || 'emerging'}
          </span>
          <span className="text-xs text-gray-500">
            Created {new Date(batch.createdAt).toLocaleDateString()}
            {batch.completedAt && ` · Completed ${new Date(batch.completedAt).toLocaleDateString()}`}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div><div className="text-xl font-semibold text-gray-900">{batch.metrics.totalProspects}</div><div className="text-xs text-gray-500">Prospects</div></div>
          <div><div className="text-xl font-semibold text-gray-900">{batch.metrics.totalSeeds}</div><div className="text-xs text-gray-500">Seeds</div></div>
          <div><div className="text-xl font-semibold text-gray-900">{batch.metrics.publishedSeeds}</div><div className="text-xs text-gray-500">Published</div></div>
          <div><div className="text-xl font-semibold text-gray-900">{batch.metrics.invitedSeeds}</div><div className="text-xs text-gray-500">Invited</div></div>
          <div><div className="text-xl font-semibold text-gray-900">{batch.metrics.claimedSeeds}</div><div className="text-xs text-gray-500">Claimed</div></div>
        </div>
      </div>

      {/* Entries */}
      {batch.entries && batch.entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">Entries</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-2 px-4 font-medium">Category</th>
                <th className="py-2 px-4 font-medium">Scope</th>
                <th className="py-2 px-4 font-medium">Focus</th>
                <th className="py-2 px-4 font-medium">Profile</th>
              </tr>
            </thead>
            <tbody>
              {batch.entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="py-2 px-4 text-gray-900">{e.nicheCategory}</td>
                  <td className="py-2 px-4 text-gray-700">
                    {e.city ? `${e.city}${e.state ? `, ${e.state}` : ''}` : e.state ? `${e.state} (statewide)` : 'Nationwide'}
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.intelligenceFocus === 'competitive' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {e.intelligenceFocus}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-gray-500 text-xs font-mono">
                    {e.profileId}{e.profileVersion ? ` v${e.profileVersion}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-city breakdown */}
      {batch.perCity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">Per-City Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-2 px-4 font-medium">City</th>
                <th className="py-2 px-4 font-medium">Prospects</th>
                <th className="py-2 px-4 font-medium">Seeds</th>
                <th className="py-2 px-4 font-medium">Published</th>
                <th className="py-2 px-4 font-medium">Invited</th>
                <th className="py-2 px-4 font-medium">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {batch.perCity.map((c) => (
                <tr key={c.city || 'unknown'} className="border-b border-gray-100">
                  <td className="py-2 px-4 text-gray-900">{c.city || '—'}</td>
                  <td className="py-2 px-4 text-gray-700">{c.prospects}</td>
                  <td className="py-2 px-4 text-gray-700">{c.seeds}</td>
                  <td className="py-2 px-4 text-gray-700">{c.published}</td>
                  <td className="py-2 px-4 text-gray-700">{c.invited}</td>
                  <td className="py-2 px-4 text-gray-700">{c.claimed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaigns */}
      {batch.campaignIds.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Campaigns ({batch.campaignIds.length})</h2>
          <div className="space-y-1">
            {batch.campaignIds.map((id) => (
              <Link
                key={id}
                href={`/settings/admin/marketing-ops/campaigns/${id}`}
                className="block font-mono text-xs text-blue-600 hover:underline"
              >
                {id}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
