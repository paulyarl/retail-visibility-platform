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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    daysBack: 30 as (typeof WINDOW_OPTIONS)[number],
    category: '',
    city: '',
    state: '',
    status: '',
    seedBatch: '',
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
      const data = await directoryPresenceAdminService.getTrafficDashboard({
        daysBack: filters.daysBack,
        ...cleanFilters,
      });
      if (!data) {
        setError('Failed to load directory traffic.');
        setDashboard(null);
        return;
      }
      setDashboard(data);
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
      const detail = await directoryPresenceAdminService.getSeedTraffic(seed.seedId, filters.daysBack);
      setSeedTraffic(detail);
    } finally {
      setSeedLoading(false);
    }
  };

  const resetFilters = () =>
    setFilters({ daysBack: 30, category: '', city: '', state: '', status: '', seedBatch: '' });

  const totals = dashboard?.totals;
  const avgViewsPerSeed =
    totals && totals.seedsWithTraffic > 0
      ? Math.round((totals.views / totals.seedsWithTraffic) * 10) / 10
      : 0;

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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
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
                  <th className="py-2 px-4" />
                </tr>
              </thead>
              <tbody>
                {dashboard.topSeeds.map((seed, index) => {
                  const isSelected = selectedSeed?.seedId === seed.seedId;
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
              </div>
            </div>
          )}
        </section>
      )}

      {/* Category breakdown + all-seeds trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-3">
      <div className="text-lg font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function TimeseriesBars({ points }: { points: Array<{ day: string; views: number; uniqueSessions: number }> }) {
  const max = Math.max(...points.map((p) => p.views), 1);
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

function deviceIcon(deviceType: string) {
  const cls = 'w-3.5 h-3.5 text-gray-400';
  if (deviceType === 'mobile') return <Smartphone className={cls} />;
  if (deviceType === 'tablet') return <Tablet className={cls} />;
  if (deviceType === 'desktop') return <Monitor className={cls} />;
  return <HelpCircle className={cls} />;
}
