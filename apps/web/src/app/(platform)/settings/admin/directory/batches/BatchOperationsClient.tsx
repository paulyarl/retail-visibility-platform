'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import marketingOpsService from '@/services/MarketingOpsService';
import type { IntelligenceProfile, IntelligenceFocus } from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';

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
  const [focus, setFocus] = useState<IntelligenceFocus | ''>('');
  const [selectedCity, setSelectedCity] = useState('');
  const [state, setState] = useState('');
  // Queue of tightly-coupled (category, city, profile, focus) entries
  const [queue, setQueue] = useState<Array<{
    profileId: string;
    profileVersion?: number;
    nicheCategory: string;
    city: string;
    state?: string;
    intelligenceFocus: string;
    profileLabel: string;
  }>>([]);
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
      if (city) setSelectedCity(city);
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
        })
        .catch(() => {
          setLauncherError('Failed to load intelligence profiles.');
        })
        .finally(() => setProfilesLoading(false));
    }
  }, [showLauncher, profiles, profilesLoading]);

  // Derived option lists from all profiles
  const availableCategories = Array.from(
    new Set(profiles.map((p) => p.category_name || p.category_key).filter(Boolean)),
  ).sort();

  // Scope-aware geographic options derived from profiles for the selected
  // category. Each option encodes a (city, state) tuple so the profile
  // filter and queue entry can be scope-accurate:
  //   - City-scoped profiles → { label: "Atlanta, GA", value: "atlanta|GA" }
  //   - State-scoped profiles → { label: "Georgia (statewide)", value: "state:GA" }
  //   - Nationwide profiles → { label: "Nationwide", value: "nationwide" }
  // The selected value is stored in `selectedCity` (kept as string for
  // minimal diff) and decoded via decodeScopeOption() below.
  const availableScopeOptions = useMemo(() => {
    const matching = profiles.filter(
      (p) => !nicheCategory || (p.category_name || p.category_key) === nicheCategory,
    );
    const seen = new Set<string>();
    const options: Array<{ label: string; value: string; city: string; state: string }> = [];
    // City-scoped options first (most specific)
    for (const p of matching) {
      if (p.reference_city) {
        const value = `${p.reference_city}|${p.reference_state ?? ''}`;
        if (seen.has(value)) continue;
        seen.add(value);
        const cityLabel = p.reference_city.charAt(0).toUpperCase() + p.reference_city.slice(1);
        options.push({
          label: p.reference_state ? `${cityLabel}, ${p.reference_state}` : cityLabel,
          value,
          city: p.reference_city,
          state: p.reference_state ?? '',
        });
      }
    }
    // State-scoped options (city null, state set)
    for (const p of matching) {
      if (!p.reference_city && p.reference_state) {
        const value = `state:${p.reference_state}`;
        if (seen.has(value)) continue;
        seen.add(value);
        options.push({
          label: `${p.reference_state} (statewide)`,
          value,
          city: '',
          state: p.reference_state,
        });
      }
    }
    // Nationwide option (both null) — at most one entry
    if (matching.some((p) => !p.reference_city && !p.reference_state)) {
      options.push({
        label: 'Nationwide',
        value: 'nationwide',
        city: '',
        state: '',
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [profiles, nicheCategory]);

  // Decode the selected scope value into (city, state) for filtering + queue.
  const selectedScope = useMemo(() => {
    const opt = availableScopeOptions.find((o) => o.value === selectedCity);
    if (opt) return { city: opt.city, state: opt.state };
    // Fallback: raw city name (legacy URL param or unencoded value)
    return { city: selectedCity, state: '' };
  }, [availableScopeOptions, selectedCity]);

  // Resolve a raw city name from URL params to a scope option once profiles
  // load. The URL passes a plain city name (e.g. "atlanta") but the scope
  // dropdown uses encoded values (e.g. "atlanta|GA"). This effect finds the
  // matching scope option and updates selectedCity to the encoded value.
  useEffect(() => {
    if (!showLauncher || profiles.length === 0 || !selectedCity) return;
    if (availableScopeOptions.some((o) => o.value === selectedCity)) return;
    const match = availableScopeOptions.find(
      (o) => o.city.toLowerCase() === selectedCity.toLowerCase(),
    );
    if (match) {
      setSelectedCity(match.value);
    }
  }, [showLauncher, profiles, selectedCity, availableScopeOptions]);

  // Profiles filtered by selected category + scope (tight coupling).
  // A nationwide or state-scoped profile is valid for any city selection
  // (it applies broadly). A city-scoped profile is only valid when the
  // selected scope matches its city.
  const availableProfiles = profiles.filter((p) => {
    if (nicheCategory && (p.category_name || p.category_key) !== nicheCategory) return false;
    if (selectedScope.city) {
      // City-scoped selection: include city-matching profiles + nationwide/state profiles
      if (p.reference_city && p.reference_city !== selectedScope.city) return false;
      // If state is also set on the scope, prefer state-matching but allow nationwide
      if (selectedScope.state && p.reference_state && p.reference_state !== selectedScope.state && !p.reference_city) return false;
      return true;
    }
    if (selectedScope.state) {
      // State-scoped selection: include state-matching + nationwide profiles
      if (p.reference_city) return false; // city-scoped profiles don't match a state-only selection
      if (p.reference_state && p.reference_state !== selectedScope.state) return false;
      return true;
    }
    if (selectedCity === 'nationwide') {
      // Nationwide selection: only nationwide profiles
      return !p.reference_city && !p.reference_state;
    }
    // No scope selected: show all profiles for the category
    return true;
  });

  // When category changes, reset scope + profile if they no longer match
  useEffect(() => {
    if (selectedCity && !availableScopeOptions.some((o) => o.value === selectedCity)) {
      setSelectedCity('');
      setProfileId('');
    }
  }, [nicheCategory, selectedCity, availableScopeOptions]);

  // When city changes, reset profile if it no longer matches
  useEffect(() => {
    if (profileId) {
      const stillValid = availableProfiles.find((p) => p.id === profileId);
      if (!stillValid) {
        setProfileId('');
        setFocus('');
      }
    }
  }, [selectedCity, profileId, availableProfiles]);

  // When profile is selected, derive focus + state from it. State prefers
  // the profile's reference_state, falling back to the selected scope's state
  // (e.g. when a state-scoped selection is made but the profile is nationwide).
  const handleProfileSelect = (id: string) => {
    setProfileId(id);
    const p = profiles.find((pr) => pr.id === id);
    setFocus(p?.intelligence_focus || '');
    setState(p?.reference_state || selectedScope.state || '');
  };

  // Check if current (category, scope, profile) is already in the queue.
  // Duplicate = same category + same geographic scope (city + state).
  const isDuplicateEntry = queue.some(
    (q) =>
      q.nicheCategory === nicheCategory
      && q.city === selectedScope.city
      && (q.state || '') === (selectedScope.state || ''),
  );

  const canAddToQueue = Boolean(
    nicheCategory.trim() && selectedCity.trim() && profileId && !isDuplicateEntry,
  );

  const handleAddToQueue = () => {
    if (!canAddToQueue) return;
    const p = profiles.find((pr) => pr.id === profileId);
    if (!p) return;
    const focusValue = (p.intelligence_focus || 'emerging') as IntelligenceFocus;
    const focusLabel = focusValue.charAt(0).toUpperCase() + focusValue.slice(1);
    // Build a scope-aware label for the queue entry. For city-scoped
    // selections, show "City, State". For state-scoped, "State (statewide)".
    // For nationwide, "Nationwide".
    const scopeLabel = selectedScope.city
      ? `${selectedScope.city.charAt(0).toUpperCase() + selectedScope.city.slice(1)}${selectedScope.state ? `, ${selectedScope.state}` : ''}`
      : selectedScope.state
      ? `${selectedScope.state} (statewide)`
      : 'Nationwide';
    const profileLabel = [
      p.category_name || p.category_key || p.id,
      scopeLabel,
      focusLabel,
      p.version ? `v${p.version}` : '',
    ].filter(Boolean).join(' - ');

    setQueue((prev) => [
      ...prev,
      {
        profileId: p.id,
        profileVersion: p.version,
        nicheCategory,
        city: selectedScope.city,
        state: (selectedScope.state || state || '').trim() || undefined,
        intelligenceFocus: focusValue,
        profileLabel,
      },
    ]);
    // Reset scope + profile for next entry (keep category for rapid multi-scope queueing)
    setSelectedCity('');
    setProfileId('');
    setFocus('');
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLauncherError(null);
    setCreatedBatch(null);

    if (queue.length === 0) {
      setLauncherError('Please add at least one entry to the queue.');
      return;
    }
    if (queue.length > 20) {
      setLauncherError('Maximum 20 entries per batch.');
      return;
    }

    setCreating(true);
    try {
      const batch = await directoryPresenceAdminService.createSeekBatch({
        // Summary fields (derived from first entry by backend)
        profileId: queue[0].profileId,
        profileVersion: queue[0].profileVersion,
        nicheCategory: queue[0].nicheCategory,
        intelligenceFocus: queue[0].intelligenceFocus,
        cities: Array.from(new Set(queue.map((q) => q.city))),
        state: queue[0].state,
        // Queue-based entries — source of truth at launch time
        entries: queue.map((q) => ({
          profileId: q.profileId,
          profileVersion: q.profileVersion,
          nicheCategory: q.nicheCategory,
          city: q.city,
          state: q.state,
          intelligenceFocus: q.intelligenceFocus,
        })),
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
            Build a batch by queueing tightly-coupled (category, city, profile) entries.
            Select a category, then a city, then a profile — each entry is locked to its
            own profile to prevent spillover. Add multiple entries to the queue, then
            click Create Batch.
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
                    setFocus('');
                    setSelectedCity('');
                    setProfileId('');
                    setState('');
                    setQueue([]);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateBatch} className="space-y-5">
              {/* Step 1: Niche Category (top of funnel) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1. Niche Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={nicheCategory}
                  onChange={(e) => setNicheCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select a category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Start with the niche. City and profile options narrow to profiles
                  that have this category.
                </p>
              </div>

              {/* Step 2: Geographic Scope (filtered by category) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. Geographic Scope <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!nicheCategory}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">
                    {nicheCategory ? 'Select a scope...' : 'Select a category first'}
                  </option>
                  {availableScopeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  City, state, or nationwide scopes with a matching profile for the selected category.
                </p>
                {nicheCategory && availableScopeOptions.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No scopes found with a profile for this category.
                  </p>
                )}
              </div>

              {/* Step 3: Intelligence Profile (filtered by category + city) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  3. Intelligence Profile <span className="text-red-500">*</span>
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
                    onChange={(e) => handleProfileSelect(e.target.value)}
                    disabled={!selectedCity}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">
                      {selectedCity ? 'Select a profile...' : 'Select a scope first'}
                    </option>
                    {availableProfiles.map((p) => {
                      const focusLabel = p.intelligence_focus
                        ? p.intelligence_focus.charAt(0).toUpperCase() + p.intelligence_focus.slice(1)
                        : '';
                      const scope = profileScopeLabel(p);
                      const label = [
                        p.category_name || p.category_key || p.id,
                        scope.label,
                        focusLabel,
                        p.version ? `v${p.version}` : '',
                      ].filter(Boolean).join(' - ');
                      return (
                        <option key={p.id} value={p.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  The intelligence profile defines the seek prompts and analysis scope.
                  Focus is derived from the selected profile.
                </p>
                {selectedCity && availableProfiles.length === 0 && !profilesLoading && (
                  <p className="text-xs text-amber-600 mt-1">
                    No profiles found for this category + scope combination.
                  </p>
                )}
              </div>

              {/* Derived Focus (read-only display) */}
              {focus && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Focus (derived from profile):</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    focus === 'competitive'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {focus.charAt(0).toUpperCase() + focus.slice(1)}
                  </span>
                </div>
              )}

              {/* Derived State (read-only display, derived from profile + scope) */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">State (derived from profile + scope):</span>
                {state ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    {state}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    Nationwide — no state set
                  </span>
                )}
              </div>

              {/* Add to Queue button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  disabled={!canAddToQueue}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add to Queue
                </button>
                {isDuplicateEntry && (
                  <span className="text-xs text-amber-600">
                    This category + city is already in the queue.
                  </span>
                )}
              </div>

              {/* Queue display */}
              {queue.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">
                      Batch Queue ({queue.length} {queue.length === 1 ? 'entry' : 'entries'})
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600 bg-white">
                        <th className="py-2 px-4 font-medium">Category</th>
                        <th className="py-2 px-4 font-medium">Scope</th>
                        <th className="py-2 px-4 font-medium">Focus</th>
                        <th className="py-2 px-4 font-medium">Profile</th>
                        <th className="py-2 px-4 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((q, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-gray-900">{q.nicheCategory}</td>
                          <td className="py-2 px-4 text-gray-900">
                            {q.city
                              ? `${q.city.charAt(0).toUpperCase() + q.city.slice(1)}${q.state ? `, ${q.state}` : ''}`
                              : q.state
                              ? `${q.state} (statewide)`
                              : 'Nationwide'}
                          </td>
                          <td className="py-2 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              q.intelligenceFocus === 'competitive'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {q.intelligenceFocus}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-gray-600 text-xs font-mono">
                            {q.profileLabel}
                          </td>
                          <td className="py-2 px-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromQueue(i)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={creating || queue.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : `Create Batch (${queue.length} ${queue.length === 1 ? 'entry' : 'entries'})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLauncher(false);
                    setQueue([]);
                  }}
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
                <th className="py-3 px-4 font-medium">Focus</th>
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
                  <td colSpan={10} className="py-8 text-center text-gray-400">
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
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.intelligenceFocus === 'competitive'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {b.intelligenceFocus || 'emerging'}
                      </span>
                    </td>
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
