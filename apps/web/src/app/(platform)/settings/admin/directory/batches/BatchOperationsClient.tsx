'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import marketingOpsService from '@/services/MarketingOpsService';
import type { IntelligenceProfile } from '@/services/MarketingOpsService';

export default function BatchOperationsDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<'seek' | 'seed'>('seek');
  const [seekBatches, setSeekBatches] = useState<any[]>([]);
  const [seedBatches, setSeedBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Launcher form state
  const [showLauncher, setShowLauncher] = useState(false);
  const [profiles, setProfiles] = useState<IntelligenceProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [nicheCategory, setNicheCategory] = useState('');
  const [citiesInput, setCitiesInput] = useState('');
  const [state, setState] = useState('');
  const [creating, setCreating] = useState(false);
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [createdBatch, setCreatedBatch] = useState<any>(null);

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

  // Open launcher automatically if query params are present (from Growth Engine "Launch Seek")
  useEffect(() => {
    const category = searchParams.get('category');
    const city = searchParams.get('city');
    if (category || city) {
      setShowLauncher(true);
      if (category) setNicheCategory(category);
      if (city) setCitiesInput(city);
    }
  }, [searchParams]);

  // Load intelligence profiles when launcher opens
  useEffect(() => {
    if (showLauncher && profiles.length === 0 && !profilesLoading) {
      setProfilesLoading(true);
      marketingOpsService
        .listIntelligenceProfiles()
        .then((result) => {
          setProfiles(result || []);
          // Auto-select first profile if none selected
          if (result && result.length > 0 && !profileId) {
            setProfileId(result[0].id);
          }
        })
        .catch(() => {
          setLauncherError('Failed to load intelligence profiles.');
        })
        .finally(() => setProfilesLoading(false));
    }
  }, [showLauncher, profiles, profilesLoading, profileId]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLauncherError(null);
    setCreatedBatch(null);

    if (!profileId) {
      setLauncherError('Please select an intelligence profile.');
      return;
    }
    if (!nicheCategory.trim()) {
      setLauncherError('Please enter a niche category.');
      return;
    }
    const cities = citiesInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cities.length === 0) {
      setLauncherError('Please enter at least one city.');
      return;
    }
    if (cities.length > 10) {
      setLauncherError('Maximum 10 cities per batch.');
      return;
    }

    setCreating(true);
    try {
      const batch = await directoryPresenceAdminService.createSeekBatch({
        profileId,
        nicheCategory: nicheCategory.trim(),
        cities,
        state: state.trim() || undefined,
      });
      setCreatedBatch(batch);
      // Refresh the seek batches list
      await fetchSeekBatches();
      // Clear query params from URL
      router.replace('/settings/admin/directory/batches');
    } catch (err: any) {
      setLauncherError(err?.message || 'Failed to create batch.');
    } finally {
      setCreating(false);
    }
  };

  const handleLaunchBatch = async (batchId: string) => {
    try {
      await directoryPresenceAdminService.launchSeekBatch(batchId);
      await fetchSeekBatches();
      setCreatedBatch(null);
    } catch (err: any) {
      setLauncherError(err?.message || 'Failed to launch batch.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batch Operations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-city seek batches and seed batch metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLauncher(!showLauncher)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            {showLauncher ? 'Cancel' : '+ New Seek Batch'}
          </button>
          <Link
            href="/settings/admin/directory/presence-seeds"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Seeds
          </Link>
        </div>
      </div>

      {/* Launcher Form */}
      {showLauncher && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Seek Batch</h2>
          <p className="text-sm text-gray-500 mb-4">
            Create a multi-city seek batch. Intelligence will run across all selected cities for the chosen niche.
            After creation, click Launch to start the seek runs.
          </p>

          {launcherError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {launcherError}
            </div>
          )}

          {createdBatch ? (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">
                Batch created: <span className="font-mono">{createdBatch.batchSlug || createdBatch.id}</span>
              </p>
              <p className="text-sm text-green-700 mb-3">
                Status: <span className="font-medium">{createdBatch.status || 'draft'}</span>. Launch to start intelligence runs across {createdBatch.cities?.length || 0} cities.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleLaunchBatch(createdBatch.id)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                >
                  Launch Now
                </button>
                <button
                  onClick={() => {
                    setShowLauncher(false);
                    setCreatedBatch(null);
                    setNicheCategory('');
                    setCitiesInput('');
                    setState('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateBatch} className="space-y-4">
              {/* Intelligence Profile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intelligence Profile <span className="text-red-500">*</span>
                </label>
                {profilesLoading ? (
                  <p className="text-sm text-gray-500">Loading profiles...</p>
                ) : profiles.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    No intelligence profiles found.{' '}
                    <Link href="/settings/admin/marketing-ops/intelligence-profiles" className="underline">
                      Create one first
                    </Link>
                    .
                  </p>
                ) : (
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.category_name || p.category_key || p.id}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  The intelligence profile defines the seek prompts and analysis scope.
                </p>
              </div>

              {/* Niche Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Niche Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nicheCategory}
                  onChange={(e) => setNicheCategory(e.target.value)}
                  placeholder="e.g., African Grocery, Halal Butcher"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>

              {/* Cities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cities <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={citiesInput}
                  onChange={(e) => setCitiesInput(e.target.value)}
                  placeholder="e.g., Indianapolis, Columbus, Cincinnati (comma-separated, max 10)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Comma-separated. Each city gets its own seek run, all sharing the same batch ID.
                </p>
              </div>

              {/* State (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., IN"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || !profileId || !nicheCategory.trim() || !citiesInput.trim()}
                  className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Batch'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLauncher(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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
                    No seek batches yet. Click &quot;+ New Seek Batch&quot; to create one.
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
