'use client';

/**
 * Directory Traffic — admin readout for the directory presence traffic
 * surface (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md).
 *
 * Layer 1: aggregates the page-view events already captured by
 * StoreViewTracker on /place/[slug] (unclaimed seeds) and /directory/[slug]
 * (claimed tenants) — answering "which directory entry is getting traffic".
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  type DirectoryTrafficDashboard,
  type DirectoryEngagementDashboard,
  type SurfaceEngagementRow,
  type SeedTrafficDetail,
  type SeedTrafficSummary,
} from '@/services/DirectoryPresenceAdminService';
import {
  Eye,
  Users,
  TrendingUp,
  RefreshCw,
  Loader2,
  ChevronRight,
  BarChart3,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  HelpCircle,
  Link2,
  MousePointerClick,
  Phone,
  Navigation,
  Clock,
  ExternalLink,
  Activity,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const WINDOW_OPTIONS = [7, 30, 90] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  invited: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  claimed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suppressed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function DirectoryTrafficPage() {
  const [dashboard, setDashboard] = useState<DirectoryTrafficDashboard | null>(null);
  const [engagement, setEngagement] = useState<DirectoryEngagementDashboard | null>(null);
  const [surfaceEngagement, setSurfaceEngagement] = useState<SurfaceEngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    daysBack: 30 as (typeof WINDOW_OPTIONS)[number],
    category: '',
    city: '',
    state: '',
    status: '',
    seedBatch: '',
    surface: '' as '' | 'place' | 'directory',
  });

  const [selectedSeed, setSelectedSeed] = useState<SeedTrafficSummary | null>(null);
  const [seedTraffic, setSeedTraffic] = useState<SeedTrafficDetail | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanFilters: Record<string, string> = {};
      if (filters.category.trim()) cleanFilters.category = filters.category.trim();
      if (filters.city.trim()) cleanFilters.city = filters.city.trim();
      if (filters.state.trim()) cleanFilters.state = filters.state.trim();
      if (filters.status) cleanFilters.status = filters.status;
      if (filters.seedBatch.trim()) cleanFilters.seedBatch = filters.seedBatch.trim();
      const [data, eng, surfaces] = await Promise.all([
        directoryPresenceAdminService.getTrafficDashboard({
          daysBack: filters.daysBack,
          surface: filters.surface || undefined,
          ...cleanFilters,
        }),
        directoryPresenceAdminService.getEngagementDashboard(filters.daysBack),
        directoryPresenceAdminService.getSurfaceEngagement(filters.daysBack),
      ]);
      if (!data) {
        setError('Failed to load directory traffic.');
        setDashboard(null);
        setEngagement(null);
        setSurfaceEngagement([]);
        return;
      }
      setDashboard(data);
      setEngagement(eng);
      setSurfaceEngagement(surfaces);
    } catch {
      setError('Failed to load directory traffic.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const loadSeedTraffic = async (seed: SeedTrafficSummary) => {
    if (selectedSeed?.seedId === seed.seedId) {
      setSelectedSeed(null);
      setSeedTraffic(null);
      return;
    }
    setSelectedSeed(seed);
    setSeedTraffic(null);
    setSeedLoading(true);
    try {
      const detail = await directoryPresenceAdminService.getSeedTraffic(
        seed.seedId,
        filters.daysBack,
        filters.surface || undefined,
      );
      setSeedTraffic(detail);
    } finally {
      setSeedLoading(false);
    }
  };

  const resetFilters = () =>
    setFilters({ daysBack: 30, category: '', city: '', state: '', status: '', seedBatch: '', surface: '' });

  const totals = dashboard?.totals;
  const avgViewsPerSeed =
    totals && totals.seedsWithTraffic > 0
      ? Math.round((totals.views / totals.seedsWithTraffic) * 10) / 10
      : 0;

  // Layer 3 — claim clicks per seed, for the claim-CTR column.
  const claimStatsBySeed = new Map<string, { claimClicks: number; views: number }>();
  engagement?.topSeeds.forEach((s) => claimStatsBySeed.set(s.seedId, { claimClicks: s.claimClicks, views: s.views }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Directory Traffic"
        description="Which directory entries are getting traffic — page views across unclaimed seeds (/place) and claimed tenants (/directory)"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/settings/admin/directory" className="text-blue-600 hover:underline">
          ← Directory Panel
        </Link>
        <span className="text-gray-400">|</span>
        <Link href="/settings/admin/directory/presence-seeds" className="text-blue-600 hover:underline">
          Presence Seeds →
        </Link>
        <span className="text-gray-400">|</span>
        <Link href="/settings/admin/directory/funnel" className="text-blue-600 hover:underline">
          Seed Funnel →
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Window</label>
            <select
              value={filters.daysBack}
              onChange={(e) =>
                setFilters({ ...filters, daysBack: Number(e.target.value) as (typeof WINDOW_OPTIONS)[number] })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
            <input
              type="text"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              placeholder="e.g. Indian Grocery"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">City</label>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              placeholder="e.g. Madison"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">State</label>
            <input
              type="text"
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              placeholder="e.g. WI"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Surface</label>
            <select
              value={filters.surface}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  surface: e.target.value as '' | 'place' | 'directory',
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All surfaces</option>
              <option value="place">Place (/place)</option>
              <option value="directory">Directory (/directory)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Any</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="invited">Invited</option>
              <option value="claimed">Claimed</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Eye className="w-5 h-5 text-blue-600" />}
          tint="bg-blue-100 dark:bg-blue-900/30"
          label={`Views · ${filters.daysBack}d`}
          value={loading ? '—' : (totals?.views ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-purple-600" />}
          tint="bg-purple-100 dark:bg-purple-900/30"
          label={`Unique sessions · ${filters.daysBack}d`}
          value={loading ? '—' : (totals?.uniqueSessions ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          tint="bg-green-100 dark:bg-green-900/30"
          label="Seeds with traffic"
          value={
            loading
              ? '—'
              : `${totals?.seedsWithTraffic ?? 0} of ${totals?.totalSeeds ?? 0}`
          }
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-cyan-600" />}
          tint="bg-cyan-100 dark:bg-cyan-900/30"
          label="Avg views / active seed"
          value={loading ? '—' : avgViewsPerSeed.toLocaleString()}
        />
      </div>

      {/* Layer 3 engagement cards */}
      {engagement && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            icon={<MousePointerClick className="w-5 h-5 text-purple-600" />}
            tint="bg-purple-100 dark:bg-purple-900/30"
            label={`Claim clicks · ${filters.daysBack}d`}
            value={engagement.totals.claimClicks.toLocaleString()}
          />
          <StatCard
            icon={<ExternalLink className="w-5 h-5 text-indigo-600" />}
            tint="bg-indigo-100 dark:bg-indigo-900/30"
            label="Storefront clicks"
            value={engagement.totals.storefrontClicks.toLocaleString()}
          />
          <StatCard
            icon={<Phone className="w-5 h-5 text-green-600" />}
            tint="bg-green-100 dark:bg-green-900/30"
            label="Call clicks"
            value={engagement.totals.callClicks.toLocaleString()}
          />
          <StatCard
            icon={<Navigation className="w-5 h-5 text-cyan-600" />}
            tint="bg-cyan-100 dark:bg-cyan-900/30"
            label="Directions clicks"
            value={engagement.totals.directionsClicks.toLocaleString()}
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            tint="bg-amber-100 dark:bg-amber-900/30"
            label="Avg session dwell"
            value={`${(engagement.totals.avgDwellMs / 1000).toFixed(1)}s`}
          />
        </div>
      )}

      {/* Top seeds */}
      <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Seeds by Views</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {dashboard?.topSeeds.length ?? 0} shown
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading traffic…</div>
        ) : !dashboard || dashboard.topSeeds.length === 0 ? (
          <div className="p-8 text-center">
            <Globe className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No seeds match the current filters. Seeds appear here once they exist — traffic fills in as
              shoppers land on their /place or /directory pages.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-4 font-medium">#</th>
                  <th className="py-2 px-4 font-medium">Business</th>
                  <th className="py-2 px-4 font-medium">Category</th>
                  <th className="py-2 px-4 font-medium">Location</th>
                  <th className="py-2 px-4 font-medium">Status</th>
                  <th className="py-2 px-4 font-medium text-right">Views</th>
                  <th className="py-2 px-4 font-medium text-right">7d</th>
                  <th className="py-2 px-4 font-medium text-right">Unique</th>
                  <th className="py-2 px-4 font-medium text-right">Claim CTR</th>
                  <th className="py-2 px-4" />
                </tr>
              </thead>
              <tbody>
                {dashboard.topSeeds.map((seed, index) => {
                  const isSelected = selectedSeed?.seedId === seed.seedId;
                  const cs = claimStatsBySeed.get(seed.seedId);
                  const ctr = cs && cs.views > 0 ? Math.round((cs.claimClicks / cs.views) * 100) : null;
                  return (
                    <tr
                      key={seed.seedId}
                      className={`border-b border-gray-100 dark:border-gray-700/60 last:border-0 ${
                        isSelected ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-gray-400">{index + 1}</td>
                      <td className="py-2 px-4">
                        <Link
                          href={`/settings/admin/directory/presence-seeds/${seed.seedId}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {seed.businessName || 'Untitled listing'}
                        </Link>
                      </td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-300">{seed.category}</td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-300">
                        {seed.city}
                        {seed.state ? `, ${seed.state}` : ''}
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            STATUS_STYLES[seed.status] ?? STATUS_STYLES.draft
                          }`}
                        >
                          {seed.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                        {seed.views.toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                        {seed.views7d.toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                        {seed.uniqueSessions.toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                        {ctr != null ? `${ctr}%` : '—'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => loadSeedTraffic(seed)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          {isSelected ? 'Hide' : 'Details'}
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-seed drill-down */}
      {selectedSeed && (
        <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedSeed.businessName || 'Untitled listing'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {selectedSeed.category} · {selectedSeed.city}
                {selectedSeed.state ? `, ${selectedSeed.state}` : ''} · window {filters.daysBack}d
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSeed(null);
                setSeedTraffic(null);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Close
            </button>
          </div>

          {seedLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading seed traffic…
            </div>
          ) : !seedTraffic ? (
            <p className="text-sm text-gray-500">No traffic data available for this seed.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MiniStat label={`Views ${filters.daysBack}d`} value={seedTraffic.views} />
                  <MiniStat label="Views 7d" value={seedTraffic.views7d} />
                  <MiniStat label="Views 30d" value={seedTraffic.views30d} />
                  <MiniStat label="Views 90d" value={seedTraffic.views90d} />
                </div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Daily views</h3>
                <TimeseriesBars points={seedTraffic.daily} />
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-gray-400" />
                    Top referrers
                  </h3>
                  {seedTraffic.topReferrers.length === 0 ? (
                    <p className="text-xs text-gray-400">No referrer data.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {seedTraffic.topReferrers.map((ref) => (
                        <li key={ref.referrer} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-300 truncate max-w-[180px]">
                            {ref.referrer}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">{ref.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device split</h3>
                  {seedTraffic.deviceSplit.length === 0 ? (
                    <p className="text-xs text-gray-400">No device data.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {seedTraffic.deviceSplit.map((d) => (
                        <li key={d.deviceType} className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 capitalize">
                            {deviceIcon(d.deviceType)}
                            {d.deviceType}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">{d.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Surface split</h3>
                  {seedTraffic.surfaceBreakdown.length === 0 ? (
                    <p className="text-xs text-gray-400">No surface data.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {seedTraffic.surfaceBreakdown.map((s) => (
                        <li key={s.surface} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-300">{surfaceLabel(s.surface)}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{s.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Aggregate claim funnel (Layer 3) */}
      {engagement && (
        <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Aggregate Claim Funnel</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            All seeds · last {filters.daysBack} days — listing viewed → claim clicked → claim accepted.
            This is the on-page CTA conversion; for invite/QR-driven cohort conversion see{' '}
            <Link href="/settings/admin/directory/funnel" className="text-blue-600 hover:underline">
              Seed Funnel
            </Link>
            .
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FunnelStage label="Views" value={engagement.funnel.views} />
            <FunnelStage
              label="Claim clicks"
              value={engagement.funnel.claimClicks}
              rate={engagement.funnel.viewToClickRate}
              rateLabel="of views"
            />
            <FunnelStage
              label="Claims accepted"
              value={engagement.funnel.claimsAccepted}
              rate={engagement.funnel.clickToAcceptRate}
              rateLabel="of clicks"
            />
          </div>
        </section>
      )}

      {/* Surface Engagement — entries AND shelves in one grid (migration 295) */}
      <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Surface Engagement</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            last {filters.daysBack} days · entries + shelves
          </span>
        </div>
        {surfaceEngagement.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No engagement events recorded in this window yet. Entry and shelf events are captured
              by useDirectoryPresenceTracking / useDirectoryShelfTracking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-4 font-medium">Surface</th>
                  <th className="py-2 px-4 font-medium text-right">Views</th>
                  <th className="py-2 px-4 font-medium text-right">Sessions</th>
                  <th className="py-2 px-4 font-medium text-right">Avg dwell</th>
                  <th className="py-2 px-4 font-medium text-right">Click-throughs</th>
                  <th className="py-2 px-4 font-medium text-right">CTR</th>
                  <th className="py-2 px-4 font-medium text-right">Filters</th>
                  <th className="py-2 px-4 font-medium text-right">CTA clicks</th>
                </tr>
              </thead>
              <tbody>
                {surfaceEngagement.map((row) => (
                  <tr
                    key={row.surface}
                    className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                  >
                    <td className="py-2 px-4 text-gray-900 dark:text-white">
                      {surfaceKeyLabel(row.surface)}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {row.views.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {row.sessions.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {(row.avgDwellMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {row.clickThroughs.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {row.clickThroughRate != null ? `${Math.round(row.clickThroughRate * 100)}%` : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {row.filters.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {row.ctaClicks.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Category breakdown + surface split + all-seeds trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Views by Category</h2>
          {!dashboard || dashboard.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No category data for the current filters.</p>
          ) : (
            <ul className="space-y-3">
              {dashboard.categoryBreakdown.map((row) => (
                <li key={row.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-200">{row.category}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {row.views.toLocaleString()} views · {row.seeds} seeds
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${barWidth(row.views, dashboard.categoryBreakdown[0]?.views)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Traffic by Surface</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Place (/place) vs Directory (/directory). Events recorded before migration 294 appear as untagged.
          </p>
          {!dashboard || dashboard.surfaceBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No surface data for the current filters.</p>
          ) : (
            <ul className="space-y-3">
              {dashboard.surfaceBreakdown.map((row) => (
                <li key={row.surface}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-200">{surfaceLabel(row.surface)}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {row.views.toLocaleString()} views · {row.uniqueSessions.toLocaleString()} sessions
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${barWidth(row.views, dashboard.surfaceBreakdown[0]?.views)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All-seeds daily trend
          </h2>
          {!dashboard || dashboard.daily.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No views recorded in this window.</p>
          ) : (
            <TimeseriesBars points={dashboard.daily} />
          )}
        </section>
      </div>

      {/* Shelf surfaces (category / location / home) — browse pages that are not
          entry pages. Entry filters do not apply (see service note). */}
      <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shelf Traffic</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            category · location · home browse pages · entry filters do not apply
          </span>
        </div>
        {!dashboard || dashboard.shelves.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No shelf browse events in this window. Category and location shelf views are captured
              by CategoryBrowseTracker / LocationBrowseTracker.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-4 font-medium">Shelf</th>
                  <th className="py-2 px-4 font-medium">Type</th>
                  <th className="py-2 px-4 font-medium">Surface</th>
                  <th className="py-2 px-4 font-medium text-right">Views</th>
                  <th className="py-2 px-4 font-medium text-right">Unique</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.shelves.map((s, i) => (
                  <tr
                    key={`${s.pageType}-${s.entityId}-${i}`}
                    className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                  >
                    <td className="py-2 px-4 text-gray-900 dark:text-white">{s.label}</td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-300">{shelfTypeLabel(s.pageType)}</td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-300">
                      {s.surface ? surfaceLabel(s.surface) : '—'}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {s.views.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-300">
                      {s.uniqueSessions.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Entry sources — QR / shelf / UTM */}
      <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Entry Sources</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Which channel drove the entry view — QR-encoded listing links (
          <code className="text-[11px]">?source=qr</code>), shelf links (
          <code className="text-[11px]">?shelf=</code>), cross-sell / search / storefront
          surfaces (
          <code className="text-[11px]">
            ?source=related|recent|recommendation|search|storefront|promoted
          </code>
          ), or any <code className="text-[11px]">utm_source</code>. QR scan channel metrics stay
          in QR Analytics; this counts QR as an entry <em>source</em>. Organic/direct views are
          unattributed and not listed.
        </p>
        {!dashboard || dashboard.entrySources.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No attributed entry views in this window yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {dashboard.entrySources.map((row) => (
              <li key={row.source}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-200">{sourceLabel(row.source)}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {row.views.toLocaleString()} views · {row.uniqueSessions.toLocaleString()} sessions
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${barWidth(row.views, dashboard.entrySources[0]?.views)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Shelf→entry attribution */}
      <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Referring Shelves</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Entry views attributed to the shelf the shopper came from, via the{' '}
          <code className="text-[11px]">?shelf=</code> link parameter. Only shelf→entry navigation
          captured after this feature shipped is attributed.
        </p>
        {!dashboard || dashboard.shelfReferrals.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No attributed entry views in this window yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {dashboard.shelfReferrals.map((row) => (
              <li key={row.shelf}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-200">{row.shelf}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {row.views.toLocaleString()} views · {row.uniqueSessions.toLocaleString()} sessions
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${barWidth(row.views, dashboard.shelfReferrals[0]?.views)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
      <div className={`inline-flex p-2 rounded-lg ${tint} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function FunnelStage({
  label,
  value,
  rate,
  rateLabel,
}: {
  label: string;
  value: number;
  rate?: number | null;
  rateLabel?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
      {rate != null && (
        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          {Math.round(rate * 100)}% {rateLabel}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-3">
      <div className="text-lg font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function TimeseriesBars({ points }: { points: Array<{ day: string; views: number; uniqueSessions: number }> }) {  const max = Math.max(...points.map((p) => p.views), 1);
  return (
    <div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {points.map((p) => (
          <div key={p.day} className="flex-1 min-w-[6px] flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t bg-blue-500/80 hover:bg-blue-600 transition-colors"
              style={{ height: `${Math.max((p.views / max) * 100, 2)}%` }}
              title={`${p.day}: ${p.views} views, ${p.uniqueSessions} unique`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
        <span>{points[0]?.day}</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function barWidth(value: number, max?: number): string {
  const denom = Math.max(max ?? 0, 1);
  return `${Math.max((value / denom) * 100, 2)}%`;
}

function surfaceLabel(surface: string): string {
  if (surface === 'place') return 'Place (/place)';
  if (surface === 'directory') return 'Directory (/directory)';
  return 'Untagged';
}

function shelfTypeLabel(pageType: string): string {
  if (pageType === 'directory_category') return 'Category';
  if (pageType === 'directory_location') return 'Location';
  if (pageType === 'directory_store_type') return 'Store type';
  if (pageType === 'directory_home') return 'Home';
  return pageType;
}

function sourceLabel(source: string): string {
  if (source === 'qr') return 'QR code';
  if (source === 'shelf') return 'Shelf browse';
  if (source === 'related') return 'Related stores';
  if (source === 'recent') return 'Recently viewed';
  if (source === 'recommendation') return 'Recommendations';
  if (source === 'search') return 'Search results';
  if (source === 'storefront') return 'Storefront / product page';
  if (source === 'promoted') return 'Promoted carousel';
  return source;
}

function surfaceKeyLabel(surface: string): string {
  const map: Record<string, string> = {
    place_entry: 'Place entry (/place/[slug])',
    directory_entry: 'Directory entry (/directory/[slug])',
    place_category: 'Place category shelf',
    place_city: 'Place city shelf',
    directory_category: 'Directory category shelf',
    directory_location: 'Directory location shelf',
    directory_store_type: 'Directory store-type shelf',
    directory_home: 'Directory home',
    unknown: 'Unknown',
  };
  return map[surface] ?? surface;
}

function deviceIcon(deviceType: string) {
  const cls = 'w-3.5 h-3.5 text-gray-400';
  if (deviceType === 'mobile') return <Smartphone className={cls} />;
  if (deviceType === 'tablet') return <Tablet className={cls} />;
  if (deviceType === 'desktop') return <Monitor className={cls} />;
  return <HelpCircle className={cls} />;
}
