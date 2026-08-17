'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';

export default function BatchOperationsDashboard() {
  const [tab, setTab] = useState<'seek' | 'seed'>('seek');
  const [seekBatches, setSeekBatches] = useState<any[]>([]);
  const [seedBatches, setSeedBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeekBatches = useCallback(async () => {
    try {
      const result = await directoryPresenceAdminService.listSeekBatches();
      setSeekBatches(result);
    } catch (err: any) {
      setError(err?.message || 'failed_to_load');
    }
  }, []);

  const fetchSeedBatches = useCallback(async () => {
    try {
      const result = await directoryPresenceAdminService.listSeedBatches();
      setSeedBatches(result);
    } catch (err: any) {
      setError(err?.message || 'failed_to_load');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'seek') {
      fetchSeekBatches().finally(() => setLoading(false));
    } else {
      fetchSeedBatches().finally(() => setLoading(false));
    }
  }, [tab, fetchSeekBatches, fetchSeedBatches]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batch Operations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-city seek batches and seed batch metrics
          </p>
        </div>
        <Link
          href="/settings/admin/directory/presence-seeds"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Seeds
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setTab('seek')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 ${
              tab === 'seek'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Seek Batches ({seekBatches.length})
          </button>
          <button
            onClick={() => setTab('seed')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 ${
              tab === 'seed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Seed Batches ({seedBatches.length})
          </button>
        </nav>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Seek Batches Tab */}
      {tab === 'seek' && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-3 px-4 font-medium">Batch</th>
                <th className="py-3 px-4 font-medium">Niche</th>
                <th className="py-3 px-4 font-medium">Cities</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Prospects</th>
                <th className="py-3 px-4 font-medium">Seeds</th>
                <th className="py-3 px-4 font-medium">Published</th>
                <th className="py-3 px-4 font-medium">Claimed</th>
                <th className="py-3 px-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {seekBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No seek batches yet. Create one from the prospect queue.
                  </td>
                </tr>
              ) : (
                seekBatches.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/settings/admin/directory/batches/${b.id}`}
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        {b.batchSlug}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{b.nicheCategory}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {b.cities?.join(', ') || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.status === 'completed' ? 'bg-green-50 text-green-700' :
                        b.status === 'running' ? 'bg-blue-50 text-blue-700' :
                        b.status === 'draft' ? 'bg-gray-50 text-gray-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{b.metrics?.totalProspects ?? 0}</td>
                    <td className="py-3 px-4 text-gray-900">{b.metrics?.totalSeeds ?? 0}</td>
                    <td className="py-3 px-4 text-gray-900">{b.metrics?.publishedSeeds ?? 0}</td>
                    <td className="py-3 px-4 text-gray-900">{b.metrics?.claimedSeeds ?? 0}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Seed Batches Tab */}
      {tab === 'seed' && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-3 px-4 font-medium">Seed Batch</th>
                <th className="py-3 px-4 font-medium">Cities</th>
                <th className="py-3 px-4 font-medium">Categories</th>
                <th className="py-3 px-4 font-medium">Total</th>
                <th className="py-3 px-4 font-medium">Published</th>
                <th className="py-3 px-4 font-medium">Invited</th>
                <th className="py-3 px-4 font-medium">Claimed</th>
                <th className="py-3 px-4 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {seedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No seed batches yet. Seeds will appear here after batch creation.
                  </td>
                </tr>
              ) : (
                seedBatches.map((b) => {
                  const claimedPct = b.totalSeeds > 0 ? Math.round((b.claimedSeeds / b.totalSeeds) * 100) : 0;
                  const publishedPct = b.totalSeeds > 0 ? Math.round((b.publishedSeeds / b.totalSeeds) * 100) : 0;
                  return (
                    <tr key={b.seedBatch} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs text-gray-900">{b.seedBatch}</td>
                      <td className="py-3 px-4 text-gray-600">{b.cities?.join(', ') || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">{b.categories?.join(', ') || '—'}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{b.totalSeeds}</td>
                      <td className="py-3 px-4 text-gray-900">{b.publishedSeeds}</td>
                      <td className="py-3 px-4 text-gray-900">{b.invitedSeeds}</td>
                      <td className="py-3 px-4 text-gray-900">{b.claimedSeeds}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${publishedPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {publishedPct}% pub · {claimedPct}% claimed
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
