'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Eye, MousePointerClick,
  ShoppingCart, DollarSign, Package, RefreshCw, ArrowLeft, Award, Store,
} from 'lucide-react';
import Link from 'next/link';
import BadgeAnalyticsService, {
  type BadgeAnalyticsDashboard,
  type BadgeAnalyticsSummary,
  type PeriodType,
  type BadgeTimeSeriesPoint,
} from '@/services/BadgeAnalyticsService';
import { FeaturedPlacementAnalyticsService, type PlacementAnalyticsResult } from '@/services/FeaturedPlacementAnalyticsService';

interface BadgeAnalyticsClientProps {
  tenantId: string;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-300',
  green: 'bg-green-100 text-green-700 border-green-300',
  red: 'bg-red-100 text-red-700 border-red-300',
  orange: 'bg-orange-100 text-orange-700 border-orange-300',
  purple: 'bg-purple-100 text-purple-700 border-purple-300',
  amber: 'bg-amber-100 text-amber-700 border-amber-300',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  teal: 'bg-teal-100 text-teal-700 border-teal-300',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  pink: 'bg-pink-100 text-pink-700 border-pink-300',
};

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const DAYS_BACK_OPTIONS = [7, 14, 30, 60, 90];

export default function BadgeAnalyticsClient({ tenantId }: BadgeAnalyticsClientProps) {
  const [dashboard, setDashboard] = useState<BadgeAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('day');
  const [daysBack, setDaysBack] = useState(30);
  const [aggregating, setAggregating] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [timeseries, setTimeseries] = useState<BadgeTimeSeriesPoint[]>([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'badges' | 'placements'>('badges');
  const [placementAnalytics, setPlacementAnalytics] = useState<PlacementAnalyticsResult | null>(null);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await BadgeAnalyticsService.getDashboard(tenantId, period, daysBack);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [tenantId, period, daysBack]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAggregate = async () => {
    setAggregating(true);
    try {
      await BadgeAnalyticsService.triggerAggregation(tenantId, period);
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message || 'Aggregation failed');
    } finally {
      setAggregating(false);
    }
  };

  const fetchPlacementAnalytics = useCallback(async () => {
    setPlacementLoading(true);
    setPlacementError(null);
    try {
      const data = await FeaturedPlacementAnalyticsService.getPlacementAnalytics(tenantId);
      setPlacementAnalytics(data);
    } catch (err: any) {
      setPlacementError(err.message || 'Failed to load placement analytics');
    } finally {
      setPlacementLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (activeTab === 'placements' && !placementAnalytics && !placementLoading) {
      fetchPlacementAnalytics();
    }
  }, [activeTab, placementAnalytics, placementLoading, fetchPlacementAnalytics]);

  const handleBadgeClick = async (badgeKey: string) => {
    if (selectedBadge === badgeKey) {
      setSelectedBadge(null);
      setTimeseries([]);
      return;
    }
    setSelectedBadge(badgeKey);
    setTimeseriesLoading(true);
    try {
      const data = await BadgeAnalyticsService.getTimeSeries(tenantId, badgeKey, period, daysBack);
      setTimeseries(data);
    } catch {
      setTimeseries([]);
    } finally {
      setTimeseriesLoading(false);
    }
  };

  const fmt = BadgeAnalyticsService;
  const totals = dashboard?.totals;
  const badges = dashboard?.badges ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/t/${tenantId}/settings/products/badges`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Badges
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Badge Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Measure badge effectiveness — views, clicks, conversions, and revenue lift
              </p>
            </div>
            <button
              onClick={activeTab === 'badges' ? handleAggregate : fetchPlacementAnalytics}
              disabled={activeTab === 'badges' ? aggregating : placementLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${(activeTab === 'badges' ? aggregating : placementLoading) ? 'animate-spin' : ''}`} />
              {(activeTab === 'badges' ? aggregating : placementLoading) ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('badges')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'badges'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award className="w-4 h-4" />
            Badge Performance
          </button>
          <button
            onClick={() => setActiveTab('placements')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'placements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Store className="w-4 h-4" />
            Placement Store
          </button>
        </div>

        {activeTab === 'badges' && (
        <>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Range:</label>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {DAYS_BACK_OPTIONS.map((d) => (
                <option key={d} value={d}>Last {d} days</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : !dashboard || badges.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data yet</h3>
            <p className="text-sm text-gray-500">
              Badge analytics are computed from storefront events and order data.
              Click &quot;Refresh Data&quot; to run aggregation, or wait for the scheduled job.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <SummaryCard
                icon={<Eye className="w-5 h-5" />}
                label="Total Views"
                value={fmt.formatNumber(totals?.totalViews || 0)}
                color="blue"
              />
              <SummaryCard
                icon={<MousePointerClick className="w-5 h-5" />}
                label="Total Clicks"
                value={fmt.formatNumber(totals?.totalClicks || 0)}
                color="purple"
              />
              <SummaryCard
                icon={<ShoppingCart className="w-5 h-5" />}
                label="Add to Cart"
                value={fmt.formatNumber(totals?.addToCartCount || 0)}
                color="teal"
              />
              <SummaryCard
                icon={<Package className="w-5 h-5" />}
                label="Orders"
                value={fmt.formatNumber(totals?.orderCount || 0)}
                color="indigo"
              />
              <SummaryCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Revenue"
                value={fmt.formatCurrency(totals?.revenueCents || 0)}
                color="green"
              />
              <SummaryCard
                icon={<Award className="w-5 h-5" />}
                label="Active Badges"
                value={String(totals?.activeBadgeCount || 0)}
                color="amber"
              />
            </div>

            {/* Badge Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Per-Badge Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Badge</th>
                      <th className="px-4 py-3 font-medium text-right">Products</th>
                      <th className="px-4 py-3 font-medium text-right">Views</th>
                      <th className="px-4 py-3 font-medium text-right">Clicks</th>
                      <th className="px-4 py-3 font-medium text-right">CTR</th>
                      <th className="px-4 py-3 font-medium text-right">Orders</th>
                      <th className="px-4 py-3 font-medium text-right">Conv. Rate</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue Lift</th>
                      <th className="px-4 py-3 font-medium text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {badges.map((badge) => (
                      <BadgeRow
                        key={badge.badgeKey}
                        badge={badge}
                        isSelected={selectedBadge === badge.badgeKey}
                        onClick={() => handleBadgeClick(badge.badgeKey)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time Series Chart for Selected Badge */}
            {selectedBadge && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Time Series: {badges.find(b => b.badgeKey === selectedBadge)?.badgeLabel || selectedBadge}
                </h2>
                {timeseriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                ) : timeseries.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No time series data available</p>
                ) : (
                  <TimeSeriesChart data={timeseries} />
                )}
              </div>
            )}
          </>
        )}
        </>
        )}

        {activeTab === 'placements' && (
          <PlacementStoreTab
            tenantId={tenantId}
            analytics={placementAnalytics}
            loading={placementLoading}
            error={placementError}
            onRefresh={fetchPlacementAnalytics}
          />
        )}
      </div>
    </div>
  );
}

// ====================
// Placement Store Tab
// ====================

function PlacementStoreTab({
  tenantId, analytics, loading, error, onRefresh,
}: {
  tenantId: string;
  analytics: PlacementAnalyticsResult | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const svc = FeaturedPlacementAnalyticsService;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
        <span className="ml-2 text-gray-500">Loading placement analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (!analytics || analytics.placements.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No placement data yet</h3>
        <p className="text-sm text-gray-500 mb-4">
          Purchase featured placements from the store to see ROI and lift metrics here.
        </p>
        <Link
          href={`/t/${tenantId}/settings/featured-store`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Store className="w-4 h-4" />
          Visit Featured Store
        </Link>
      </div>
    );
  }

  const totals = analytics.totals;

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <SummaryCard icon={<Store className="w-5 h-5" />} label="Total Placements" value={String(totals.totalPlacements)} color="indigo" />
        <SummaryCard icon={<Package className="w-5 h-5" />} label="Active" value={String(totals.activePlacements)} color="green" />
        <SummaryCard icon={<DollarSign className="w-5 h-5" />} label="Total Spend" value={svc.formatCurrency(totals.totalSpendCents)} color="amber" />
        <SummaryCard icon={<DollarSign className="w-5 h-5" />} label="Attributed Revenue" value={svc.formatCurrency(totals.totalRevenueCents)} color="green" />
        <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Avg ROI" value={svc.formatPercent(totals.avgRoi)} color="purple" />
        <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Renewal Rate" value={svc.formatPercent(totals.renewalRate)} color="blue" />
      </div>

      {/* Placement Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Per-Placement ROI</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Surface</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Spend</th>
                <th className="px-4 py-3 font-medium text-right">Views</th>
                <th className="px-4 py-3 font-medium text-right">Clicks</th>
                <th className="px-4 py-3 font-medium text-right">CTR</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Lift</th>
                <th className="px-4 py-3 font-medium text-right">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.placements.map((p) => (
                <tr key={p.purchaseId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium">{p.productName}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.surface}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' :
                      p.status === 'expired' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{svc.formatCurrency(p.priceCents)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{svc.formatNumber(p.views)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{svc.formatNumber(p.clicks)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{svc.formatPercent(p.ctr)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{svc.formatNumber(p.orderCount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{svc.formatCurrency(p.revenueCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.revenueLift > 0 ? 'text-green-600 font-medium' : p.revenueLift < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                      {p.revenueLift > 0 ? '+' : ''}{svc.formatPercent(p.revenueLift)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.roi > 0 ? 'text-green-600 font-medium' : p.roi < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                      {p.roi > 0 ? '+' : ''}{svc.formatPercent(p.roi)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Want to boost your product visibility?</h3>
        <p className="text-sm text-gray-600 mb-4">Purchase featured placements to spotlight your products across surfaces.</p>
        <Link
          href={`/t/${tenantId}/settings/featured-store`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Store className="w-4 h-4" />
          Visit Featured Store
        </Link>
      </div>
    </>
  );
}

function SummaryCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function BadgeRow({
  badge, isSelected, onClick,
}: { badge: BadgeAnalyticsSummary; isSelected: boolean; onClick: () => void }) {
  const colorClass = COLOR_CLASSES[badge.badgeColor || 'blue'] || COLOR_CLASSES.blue;
  const TrendIcon = badge.trend === 'up' ? TrendingUp : badge.trend === 'down' ? TrendingDown : Minus;
  const trendColor = badge.trend === 'up' ? 'text-green-600' : badge.trend === 'down' ? 'text-red-600' : 'text-gray-400';

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {badge.badgeIcon && <span className="text-base">{badge.badgeIcon}</span>}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {badge.badgeLabel}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatNumber(badge.productCount)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatNumber(badge.totalViews)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatNumber(badge.totalClicks)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatPercent(badge.ctr)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatNumber(badge.orderCount)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{BadgeAnalyticsService.formatPercent(badge.conversionRate)}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">{BadgeAnalyticsService.formatCurrency(badge.revenueCents)}</td>
      <td className="px-4 py-3 text-right">
        <span className={badge.revenueLift > 0 ? 'text-green-600 font-medium' : badge.revenueLift < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {badge.revenueLift > 0 ? '+' : ''}{BadgeAnalyticsService.formatPercent(badge.revenueLift)}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <div className={`inline-flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-xs">{Math.abs(badge.trendPercent).toFixed(0)}%</span>
        </div>
      </td>
    </tr>
  );
}

function TimeSeriesChart({ data }: { data: BadgeTimeSeriesPoint[] }) {
  const maxRevenue = Math.max(...data.map(d => d.revenueCents), 1);
  const maxViews = Math.max(...data.map(d => d.views), 1);

  return (
    <div>
      {/* Revenue bars */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Revenue per Period</h3>
        <div className="flex items-end gap-1 h-40 border-b border-gray-200">
          {data.map((point, i) => {
            const heightPct = (point.revenueCents / maxRevenue) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`${point.periodStart}: ${BadgeAnalyticsService.formatCurrency(point.revenueCents)}`}
              >
                <div
                  className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.map((point, i) => (
            <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">
              {new Date(point.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>

      {/* Views + Clicks line */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Views & Clicks</h3>
        <div className="flex items-end gap-1 h-32 border-b border-gray-200">
          {data.map((point, i) => {
            const viewHeight = (point.views / maxViews) * 100;
            const clickHeight = maxViews > 0 ? (point.clicks / maxViews) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end relative" title={`${point.periodStart}: ${point.views} views, ${point.clicks} clicks`}>
                <div className="w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
                  <div className="w-full bg-blue-300 rounded-t" style={{ height: `${Math.max(viewHeight, 1)}%` }} />
                  <div className="w-full bg-purple-500" style={{ height: `${Math.max(clickHeight, 1)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-300 rounded" />
            <span className="text-xs text-gray-600">Views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span className="text-xs text-gray-600">Clicks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
