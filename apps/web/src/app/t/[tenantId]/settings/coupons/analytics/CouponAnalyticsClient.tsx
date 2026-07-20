'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Tag, RefreshCw, ArrowLeft,
  DollarSign, Users, Eye, MousePointerClick, CheckCircle, XCircle, Copy,
} from 'lucide-react';
import Link from 'next/link';
import { CouponAnalyticsService } from '@/services/CouponAnalyticsService';
import { useCouponOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface CouponAnalyticsClientProps {
  tenantId: string;
}

type PeriodType = 'day' | 'week' | 'month';

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const DAYS_BACK_OPTIONS = [7, 14, 30, 60, 90];

export default function CouponAnalyticsClient({ tenantId }: CouponAnalyticsClientProps) {
  const { data: capState, loading: capLoading } = useCouponOptionsCapability(tenantId);
  const [dashboard, setDashboard] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [roi, setRoi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('day');
  const [daysBack, setDaysBack] = useState(30);
  const [aggregating, setAggregating] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  const analyticsService = CouponAnalyticsService.getInstance();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, fun, roiData] = await Promise.all([
        analyticsService.getDashboard(tenantId, period, daysBack),
        analyticsService.getFunnelReport(tenantId, daysBack),
        analyticsService.getROIReport(tenantId, period, daysBack),
      ]);
      setDashboard(dash);
      setFunnel(fun);
      setRoi(roiData);
    } catch (err: any) {
      setError(err.message || 'Failed to load coupon analytics');
    } finally {
      setLoading(false);
    }
  }, [tenantId, period, daysBack, analyticsService]);

  useEffect(() => {
    if (capState?.enabled && capState?.canViewAnalytics) {
      fetchAll();
    }
  }, [capState?.enabled, capState?.canViewAnalytics, fetchAll]);

  const handleAggregate = async () => {
    setAggregating(true);
    try {
      await analyticsService.triggerAggregation(tenantId, period);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Aggregation failed');
    } finally {
      setAggregating(false);
    }
  };

  const handleCouponClick = async (couponId: string) => {
    if (selectedCoupon === couponId) {
      setSelectedCoupon(null);
      setTimeseries([]);
      return;
    }
    setSelectedCoupon(couponId);
    setTimeseriesLoading(true);
    try {
      const data = await analyticsService.getTimeSeries(tenantId, couponId, period, daysBack);
      setTimeseries(data);
    } catch {
      setTimeseries([]);
    } finally {
      setTimeseriesLoading(false);
    }
  };

  if (capLoading || !capState) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!capState.enabled || !capState.canViewAnalytics) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Analytics not available</h3>
        <p className="text-sm text-gray-500">Coupon analytics capability is not enabled for this tenant.</p>
      </div>
    );
  }

  const fmt = CouponAnalyticsService;
  const summary = dashboard?.summary;
  const coupons = dashboard?.coupons ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/t/${tenantId}/settings/coupons`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Coupons
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-amber-600" />
                Coupon Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Track coupon performance — views, copies, clicks, redemptions, and ROI
              </p>
            </div>
            <button
              onClick={handleAggregate}
              disabled={aggregating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${aggregating ? 'animate-spin' : ''}`} />
              {aggregating ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

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
            <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : !dashboard || coupons.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data yet</h3>
            <p className="text-sm text-gray-500">
              Coupon analytics are computed from events. Click &quot;Refresh Data&quot; to run aggregation, or wait for the scheduled job.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <SummaryCard icon={<Eye className="w-5 h-5" />} label="Total Views" value={fmt.formatNumber(summary?.totalViews || 0)} color="blue" />
              <SummaryCard icon={<Copy className="w-5 h-5" />} label="Copies" value={fmt.formatNumber(summary?.totalClicks || 0)} color="purple" />
              <SummaryCard icon={<CheckCircle className="w-5 h-5" />} label="Redemptions" value={fmt.formatNumber(summary?.totalRedemptions || 0)} color="green" />
              <SummaryCard icon={<DollarSign className="w-5 h-5" />} label="Discount Given" value={fmt.formatCurrency(summary?.totalDiscountCents || 0)} color="amber" />
              <SummaryCard icon={<Users className="w-5 h-5" />} label="Unique Visitors" value={fmt.formatNumber(summary?.uniqueVisitors || 0)} color="indigo" />
            </div>

            {funnel && <FunnelChart funnel={funnel} />}

            {roi && <RoiChart roi={roi} />}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Per-Coupon Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium text-right">Views</th>
                      <th className="px-4 py-3 font-medium text-right">Copies</th>
                      <th className="px-4 py-3 font-medium text-right">Clicks</th>
                      <th className="px-4 py-3 font-medium text-right">Validates</th>
                      <th className="px-4 py-3 font-medium text-right">Redemptions</th>
                      <th className="px-4 py-3 font-medium text-right">Conv. Rate</th>
                      <th className="px-4 py-3 font-medium text-right">Discount</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map((c: any) => (
                      <tr
                        key={c.couponId}
                        onClick={() => handleCouponClick(c.couponId)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedCoupon === c.couponId ? 'bg-amber-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.couponCode}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(c.views)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(c.copies)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(c.clicks)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(c.validates)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(c.redemptions)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatPercent(c.conversionRate)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt.formatCurrency(c.discountCents)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs ${c.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                            {c.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedCoupon && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Time Series: {coupons.find((c: any) => c.couponId === selectedCoupon)?.couponCode || selectedCoupon}
                </h2>
                {timeseriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
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
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
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

function FunnelChart({ funnel }: { funnel: any }) {
  const stages = [
    { label: 'Views', value: funnel.views, icon: <Eye className="w-4 h-4" />, color: 'bg-blue-500' },
    { label: 'Clicks', value: funnel.clicks, icon: <MousePointerClick className="w-4 h-4" />, color: 'bg-indigo-500' },
    { label: 'Validates', value: funnel.validates, icon: <CheckCircle className="w-4 h-4" />, color: 'bg-purple-500' },
    { label: 'Redemptions', value: funnel.redemptions, icon: <Tag className="w-4 h-4" />, color: 'bg-green-500' },
  ];
  const maxVal = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const pct = (stage.value / maxVal) * 100;
          const prevVal = i > 0 ? stages[i - 1].value : stage.value;
          const stepRate = prevVal > 0 ? ((stage.value / prevVal) * 100).toFixed(1) : '0';
          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5 text-gray-700">
                  {stage.icon}
                  {stage.label}
                </span>
                <span className="text-gray-500">
                  {CouponAnalyticsService.formatNumber(stage.value)}
                  {i > 0 && <span className="ml-2 text-xs text-gray-400">({stepRate}% from prev)</span>}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-6">
                <div className={`h-6 rounded-full ${stage.color} flex items-center justify-end px-2`} style={{ width: `${Math.max(pct, 2)}%` }}>
                  {pct > 10 && <span className="text-xs text-white font-medium">{pct.toFixed(0)}%</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-600">Overall Conversion Rate</span>
        <span className="font-bold text-gray-900">{CouponAnalyticsService.formatPercent(funnel.overallConversionRate)}</span>
      </div>
    </div>
  );
}

function RoiChart({ roi }: { roi: any }) {
  const maxVal = Math.max(roi.totalDiscountCents, roi.totalRevenueInfluencedCents, 1);
  const discountPct = (roi.totalDiscountCents / maxVal) * 100;
  const revenuePct = (roi.totalRevenueInfluencedCents / maxVal) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">ROI: Discount vs Revenue Influenced</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700">Total Discount Given</span>
              <span className="font-medium text-gray-900">{CouponAnalyticsService.formatCurrency(roi.totalDiscountCents)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4">
              <div className="h-4 rounded-full bg-amber-500" style={{ width: `${Math.max(discountPct, 2)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700">Revenue Influenced</span>
              <span className="font-medium text-gray-900">{CouponAnalyticsService.formatCurrency(roi.totalRevenueInfluencedCents)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4">
              <div className="h-4 rounded-full bg-green-500" style={{ width: `${Math.max(revenuePct, 2)}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">ROI Ratio</span>
            <span className="text-lg font-bold text-gray-900">{CouponAnalyticsService.formatPercent(roi.roi)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg Discount / Redemption</span>
            <span className="text-sm font-medium text-gray-900">{CouponAnalyticsService.formatCurrency(roi.avgDiscountPerRedemption)}</span>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Top Coupons by Revenue</h3>
          <div className="space-y-2">
            {(roi.topCoupons || []).slice(0, 5).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-gray-700">{c.couponCode}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{c.redemptions} redemptions</span>
                  <span className="font-medium text-gray-900">{CouponAnalyticsService.formatCurrency(c.revenueInfluencedCents)}</span>
                </div>
              </div>
            ))}
            {(!roi.topCoupons || roi.topCoupons.length === 0) && (
              <p className="text-sm text-gray-500">No redemption data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSeriesChart({ data }: { data: any[] }) {
  const maxViews = Math.max(...data.map(d => d.views), 1);
  const maxRedemptions = Math.max(...data.map(d => d.redemptions), 1);

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Views per Period</h3>
        <div className="flex items-end gap-1 h-40 border-b border-gray-200">
          {data.map((point, i) => {
            const heightPct = (point.views / maxViews) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`${point.date}: ${CouponAnalyticsService.formatNumber(point.views)} views`}
              >
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.map((point, i) => (
            <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">
              {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Redemptions per Period</h3>
        <div className="flex items-end gap-1 h-32 border-b border-gray-200">
          {data.map((point, i) => {
            const heightPct = (point.redemptions / maxRedemptions) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`${point.date}: ${point.redemptions} redemptions`}
              >
                <div
                  className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.map((point, i) => (
            <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">
              {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
