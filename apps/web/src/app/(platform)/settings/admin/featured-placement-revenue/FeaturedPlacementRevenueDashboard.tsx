'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, RefreshCw, ArrowLeft,
  Store, Package, Users, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import {
  FeaturedPlacementAdminAnalyticsService,
  type PlatformRevenueAnalytics,
} from '@/services/FeaturedPlacementAnalyticsService';

export default function FeaturedPlacementRevenueDashboard() {
  const [data, setData] = useState<PlatformRevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await FeaturedPlacementAdminAnalyticsService.getPlatformRevenueAnalytics();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load revenue analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const svc = FeaturedPlacementAdminAnalyticsService;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/settings/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Featured Placement Revenue
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Platform revenue, utilization, churn, and trial conversion for featured placements
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading revenue analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : !data ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No revenue data yet</h3>
            <p className="text-sm text-gray-500">
              Featured placement revenue will appear here once purchases are made.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <RevenueCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Total Revenue"
                value={svc.formatCurrency(data.totalRevenueCents)}
                color="green"
              />
              <RevenueCard
                icon={<Package className="w-5 h-5" />}
                label="Total Purchases"
                value={svc.formatNumber(data.totalPurchases)}
                color="indigo"
              />
              <RevenueCard
                icon={<Store className="w-5 h-5" />}
                label="Active Placements"
                value={svc.formatNumber(data.activePurchases)}
                color="blue"
              />
              <RevenueCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Renewal Rate"
                value={svc.formatPercent(data.renewalRate)}
                color="purple"
              />
              <RevenueCard
                icon={<TrendingDown className="w-5 h-5" />}
                label="Churn Rate"
                value={svc.formatPercent(data.churnRate)}
                color="red"
              />
              <RevenueCard
                icon={<Users className="w-5 h-5" />}
                label="Trial Conversion"
                value={svc.formatPercent(data.trialConversionRate)}
                color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Revenue by Surface */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Revenue by Surface</h2>
                </div>
                <div className="p-5">
                  {Object.keys(data.revenueBySurface).length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(data.revenueBySurface).map(([surface, info]) => {
                        const pct = data.totalRevenueCents > 0 ? (info.revenueCents / data.totalRevenueCents) * 100 : 0;
                        return (
                          <div key={surface}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 capitalize">{surface}</span>
                              <span className="text-sm text-gray-500">
                                {svc.formatCurrency(info.revenueCents)} ({info.count} purchases)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-indigo-500 rounded-full h-2 transition-all"
                                style={{ width: `${Math.max(pct, 1)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue by Plan */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Revenue by Plan</h2>
                </div>
                <div className="overflow-x-auto">
                  {Object.keys(data.revenueByPlan).length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No data available</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-gray-600">
                          <th className="px-4 py-3 font-medium">Plan</th>
                          <th className="px-4 py-3 font-medium text-right">Revenue</th>
                          <th className="px-4 py-3 font-medium text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(data.revenueByPlan).map(([planKey, info]) => (
                          <tr key={planKey} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">{info.label || planKey}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{svc.formatCurrency(info.revenueCents)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{info.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Revenue Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
              {data.monthlyRevenue.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No monthly data available</p>
              ) : (
                <MonthlyRevenueChart data={data.monthlyRevenue} formatCurrency={svc.formatCurrency} />
              )}
            </div>

            {/* Top Spenders */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Top Spenders</h2>
              </div>
              <div className="overflow-x-auto">
                {data.topSpenders.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No spender data available</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-4 py-3 font-medium">Tenant</th>
                        <th className="px-4 py-3 font-medium text-right">Total Spend</th>
                        <th className="px-4 py-3 font-medium text-right">Purchases</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.topSpenders.map((s) => (
                        <tr key={s.tenantId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">{s.tenantName}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{svc.formatCurrency(s.totalSpendCents)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{s.purchaseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RevenueCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
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

function MonthlyRevenueChart({
  data,
  formatCurrency,
}: {
  data: Array<{ month: string; revenueCents: number; count: number }>;
  formatCurrency: (cents: number) => string;
}) {
  const maxRevenue = Math.max(...data.map(d => d.revenueCents), 1);

  return (
    <div>
      <div className="flex items-end gap-2 h-48 border-b border-gray-200">
        {data.map((point, i) => {
          const heightPct = (point.revenueCents / maxRevenue) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
              title={`${point.month}: ${formatCurrency(point.revenueCents)} (${point.count} purchases)`}
            >
              <div
                className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1">
        {data.map((point, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">
            {point.month}
          </div>
        ))}
      </div>
    </div>
  );
}
