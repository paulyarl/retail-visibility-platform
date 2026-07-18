'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, QrCode, RefreshCw, ArrowLeft,
  Smartphone, Monitor, Tablet, Globe, DollarSign, Users,
} from 'lucide-react';
import Link from 'next/link';
import QrAnalyticsService, {
  type QrAnalyticsDashboard,
  type QrAnalyticsSummary,
  type QrTimeSeriesPoint,
  type PeriodType,
  type QrSurfaceType,
} from '@/services/QrAnalyticsService';

interface QrAnalyticsClientProps {
  tenantId: string;
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const DAYS_BACK_OPTIONS = [7, 14, 30, 60, 90];

export default function QrAnalyticsClient({ tenantId }: QrAnalyticsClientProps) {
  const [dashboard, setDashboard] = useState<QrAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('day');
  const [daysBack, setDaysBack] = useState(30);
  const [aggregating, setAggregating] = useState(false);
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [timeseries, setTimeseries] = useState<QrTimeSeriesPoint[]>([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await QrAnalyticsService.getDashboard(tenantId, period, daysBack);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load QR analytics');
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
      await QrAnalyticsService.triggerAggregation(tenantId, period);
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message || 'Aggregation failed');
    } finally {
      setAggregating(false);
    }
  };

  const handleSurfaceClick = async (surface: string) => {
    if (selectedSurface === surface) {
      setSelectedSurface(null);
      setTimeseries([]);
      return;
    }
    setSelectedSurface(surface);
    setTimeseriesLoading(true);
    try {
      const data = await QrAnalyticsService.getTimeSeries(tenantId, surface as QrSurfaceType, period, daysBack);
      setTimeseries(data);
    } catch {
      setTimeseries([]);
    } finally {
      setTimeseriesLoading(false);
    }
  };

  const fmt = QrAnalyticsService;
  const totals = dashboard?.totals;
  const surfaces = dashboard?.surfaces ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/t/${tenantId}/settings/storefront-qr`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to QR Codes
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                QR Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Track QR code scan performance — scans, unique visitors, conversions, and revenue by surface
              </p>
            </div>
            <button
              onClick={handleAggregate}
              disabled={aggregating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${aggregating ? 'animate-spin' : ''}`} />
              {aggregating ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

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
        ) : !dashboard || surfaces.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data yet</h3>
            <p className="text-sm text-gray-500">
              QR analytics are computed from scan events. Click &quot;Refresh Data&quot; to run aggregation, or wait for the scheduled job.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <SummaryCard
                icon={<QrCode className="w-5 h-5" />}
                label="Total Scans"
                value={fmt.formatNumber(totals?.totalScans || 0)}
                color="indigo"
              />
              <SummaryCard
                icon={<Users className="w-5 h-5" />}
                label="Unique Visitors"
                value={fmt.formatNumber(totals?.uniqueVisitors || 0)}
                color="blue"
              />
              <SummaryCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Conversions"
                value={fmt.formatNumber(totals?.conversionCount || 0)}
                color="green"
              />
              <SummaryCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Revenue"
                value={fmt.formatCurrency(totals?.revenueCents || 0)}
                color="amber"
              />
              <SummaryCard
                icon={<QrCode className="w-5 h-5" />}
                label="Active Surfaces"
                value={String(totals?.activeSurfaceCount || 0)}
                color="purple"
              />
            </div>

            {/* Surface Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Per-Surface Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Surface</th>
                      <th className="px-4 py-3 font-medium text-right">Scans</th>
                      <th className="px-4 py-3 font-medium text-right">Unique Visitors</th>
                      <th className="px-4 py-3 font-medium text-right">Conversions</th>
                      <th className="px-4 py-3 font-medium text-right">Conv. Rate</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                      <th className="px-4 py-3 font-medium text-right">Avg Rev/Scan</th>
                      <th className="px-4 py-3 font-medium text-right">Mobile</th>
                      <th className="px-4 py-3 font-medium text-right">Desktop</th>
                      <th className="px-4 py-3 font-medium text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {surfaces.map((surface) => (
                      <SurfaceRow
                        key={surface.surface}
                        surface={surface}
                        isSelected={selectedSurface === surface.surface}
                        onClick={() => handleSurfaceClick(surface.surface)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time Series Chart for Selected Surface */}
            {selectedSurface && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Time Series: {surfaces.find(s => s.surface === selectedSurface)?.surfaceLabel || selectedSurface}
                </h2>
                {timeseriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                ) : timeseries.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No time series data available</p>
                ) : (
                  <QrTimeSeriesChart data={timeseries} />
                )}
              </div>
            )}

            {/* Geographic + Device Breakdown */}
            {surfaces.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-gray-400" />
                    Top Locations
                  </h2>
                  <div className="space-y-2">
                    {surfaces
                      .filter(s => s.topCountry || s.topCity)
                      .slice(0, 5)
                      .map((s) => (
                        <div key={s.surface} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            {s.topCity ? `${s.topCity}, ` : ''}{s.topCountry || 'Unknown'}
                          </span>
                          <span className="text-gray-500">{s.surfaceLabel}</span>
                        </div>
                      ))}
                    {surfaces.filter(s => s.topCountry || s.topCity).length === 0 && (
                      <p className="text-sm text-gray-500">No location data available</p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-gray-400" />
                    Device Breakdown
                  </h2>
                  <div className="space-y-3">
                    {(() => {
                      const totalMobile = surfaces.reduce((sum, s) => sum + s.mobileScans, 0);
                      const totalDesktop = surfaces.reduce((sum, s) => sum + s.desktopScans, 0);
                      const totalTablet = surfaces.reduce((sum, s) => sum + s.tabletScans, 0);
                      const total = totalMobile + totalDesktop + totalTablet || 1;
                      return (
                        <>
                          <DeviceBar icon={<Smartphone className="w-4 h-4" />} label="Mobile" count={totalMobile} total={total} color="bg-blue-500" />
                          <DeviceBar icon={<Monitor className="w-4 h-4" />} label="Desktop" count={totalDesktop} total={total} color="bg-indigo-500" />
                          <DeviceBar icon={<Tablet className="w-4 h-4" />} label="Tablet" count={totalTablet} total={total} color="bg-purple-500" />
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
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

function SurfaceRow({
  surface, isSelected, onClick,
}: { surface: QrAnalyticsSummary; isSelected: boolean; onClick: () => void }) {
  const TrendIcon = surface.trend === 'up' ? TrendingUp : surface.trend === 'down' ? TrendingDown : Minus;
  const trendColor = surface.trend === 'up' ? 'text-green-600' : surface.trend === 'down' ? 'text-red-600' : 'text-gray-400';

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
    >
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <QrCode className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{surface.surfaceLabel}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatNumber(surface.totalScans)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatNumber(surface.uniqueVisitors)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatNumber(surface.conversionCount)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatPercent(surface.conversionRate)}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">{QrAnalyticsService.formatCurrency(surface.revenueCents)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatCurrency(surface.avgRevenuePerScan)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatNumber(surface.mobileScans)}</td>
      <td className="px-4 py-3 text-right text-gray-700">{QrAnalyticsService.formatNumber(surface.desktopScans)}</td>
      <td className="px-4 py-3 text-center">
        <div className={`inline-flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-xs">{Math.abs(surface.trendPercent).toFixed(0)}%</span>
        </div>
      </td>
    </tr>
  );
}

function DeviceBar({
  icon, label, count, total, color,
}: { icon: React.ReactNode; label: string; count: number; total: number; color: string }) {
  const pct = (count / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 text-gray-700">
          {icon}
          {label}
        </span>
        <span className="text-gray-500">
          {QrAnalyticsService.formatNumber(count)} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

function QrTimeSeriesChart({ data }: { data: QrTimeSeriesPoint[] }) {
  const maxScans = Math.max(...data.map(d => d.totalScans), 1);
  const maxRevenue = Math.max(...data.map(d => d.revenueCents), 1);

  return (
    <div>
      {/* Scans bars */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Scans per Period</h3>
        <div className="flex items-end gap-1 h-40 border-b border-gray-200">
          {data.map((point, i) => {
            const heightPct = (point.totalScans / maxScans) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`${point.periodStart}: ${QrAnalyticsService.formatNumber(point.totalScans)} scans`}
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

      {/* Revenue + Visitors */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Revenue & Unique Visitors</h3>
        <div className="flex items-end gap-1 h-32 border-b border-gray-200">
          {data.map((point, i) => {
            const revHeight = (point.revenueCents / maxRevenue) * 100;
            const visHeight = maxScans > 0 ? (point.uniqueVisitors / maxScans) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end relative" title={`${point.periodStart}: ${QrAnalyticsService.formatCurrency(point.revenueCents)}, ${point.uniqueVisitors} visitors`}>
                <div className="w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
                  <div className="w-full bg-blue-300 rounded-t" style={{ height: `${Math.max(visHeight, 1)}%` }} />
                  <div className="w-full bg-green-500" style={{ height: `${Math.max(revHeight, 1)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-300 rounded" />
            <span className="text-xs text-gray-600">Unique Visitors</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-xs text-gray-600">Revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
