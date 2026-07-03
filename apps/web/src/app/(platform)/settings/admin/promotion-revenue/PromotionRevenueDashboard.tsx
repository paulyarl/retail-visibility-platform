'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, RefreshCw, ArrowLeft,
  Store, Package, BarChart3, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { DirectoryPromotionService, PromotionRevenueSummary } from '@/services/DirectoryPromotionService';
import { crmAdminService } from '@/services/crm/CrmAdminService';

interface DashboardData {
  revenue: PromotionRevenueSummary;
  stats: {
    activeCount: number;
    gracePeriodCount: number;
    expiredCount: number;
    totalRevenueCents: number;
    upcomingRenewals: any[];
    gracePeriodPromotions: any[];
    recentActivations: any[];
  } | null;
}

export default function PromotionRevenueDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenue, statsResult] = await Promise.allSettled([
        DirectoryPromotionService.adminGetRevenue(),
        crmAdminService.getPromotionStats(),
      ]);

      const revenueData = revenue.status === 'fulfilled' ? revenue.value : {
        totalRevenueCents: 0, totalPurchases: 0, activePurchases: 0, revenueByTier: {},
      } as PromotionRevenueSummary;

      const statsData = statsResult.status === 'fulfilled' ? statsResult.value : null;

      setData({ revenue: revenueData, stats: statsData });
    } catch (err: any) {
      setError(err.message || 'Failed to load revenue analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const svc = DirectoryPromotionService;

  const renewalRate = data?.revenue && data.revenue.totalPurchases > 0
    ? ((data.revenue.totalPurchases - (data.stats?.expiredCount ?? 0)) / data.revenue.totalPurchases) * 100
    : 0;

  const churnRate = data?.revenue && data.revenue.totalPurchases > 0
    ? ((data.stats?.expiredCount ?? 0) / data.revenue.totalPurchases) * 100
    : 0;

  const gracePeriodConversion = data?.stats && data.stats.gracePeriodCount > 0
    ? ((data.stats.activeCount) / (data.stats.activeCount + data.stats.gracePeriodCount)) * 100
    : 100;

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
                <BarChart3 className="w-6 h-6 text-amber-600" />
                Promotion Revenue
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Platform revenue, renewal metrics, and tier distribution for directory promotions
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
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
            <p className="text-sm text-gray-500">Promotion revenue will appear here once purchases are made.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <RevenueCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Total Revenue"
                value={svc.formatCurrency(data.revenue.totalRevenueCents)}
                color="green"
              />
              <RevenueCard
                icon={<Package className="w-5 h-5" />}
                label="Total Purchases"
                value={data.revenue.totalPurchases.toString()}
                color="indigo"
              />
              <RevenueCard
                icon={<Store className="w-5 h-5" />}
                label="Active Promotions"
                value={(data.stats?.activeCount ?? data.revenue.activePurchases).toString()}
                color="blue"
              />
              <RevenueCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Renewal Rate"
                value={`${renewalRate.toFixed(1)}%`}
                color="purple"
              />
              <RevenueCard
                icon={<TrendingDown className="w-5 h-5" />}
                label="Churn Rate"
                value={`${churnRate.toFixed(1)}%`}
                color="red"
              />
              <RevenueCard
                icon={<AlertCircle className="w-5 h-5" />}
                label="Grace Period"
                value={`${gracePeriodConversion.toFixed(0)}%`}
                color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Revenue by Tier */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Revenue by Tier</h2>
                </div>
                <div className="p-5">
                  {Object.keys(data.revenue.revenueByTier).length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(data.revenue.revenueByTier).map(([tier, info]) => {
                        const pct = data.revenue.totalRevenueCents > 0 ? (info.revenueCents / data.revenue.totalRevenueCents) * 100 : 0;
                        const tierColors: Record<string, string> = {
                          basic: 'bg-amber-500',
                          premium: 'bg-blue-500',
                          featured: 'bg-purple-500',
                        };
                        return (
                          <div key={tier}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 capitalize">{tier}</span>
                              <span className="text-sm text-gray-500">
                                {svc.formatCurrency(info.revenueCents)} ({info.count} purchases)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`${tierColors[tier] || 'bg-gray-500'} rounded-full h-2 transition-all`}
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

              {/* Lifecycle Status */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Lifecycle Status</h2>
                </div>
                <div className="p-5">
                  {data.stats ? (
                    <div className="space-y-4">
                      <StatusRow label="Active" count={data.stats.activeCount} total={data.revenue.totalPurchases} color="bg-green-500" />
                      <StatusRow label="Grace Period" count={data.stats.gracePeriodCount} total={data.revenue.totalPurchases} color="bg-red-500" />
                      <StatusRow label="Expired" count={data.stats.expiredCount} total={data.revenue.totalPurchases} color="bg-gray-400" />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No lifecycle data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Renewals + Grace Period */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Renewals (7 days)</h2>
                </div>
                <div className="p-5">
                  {data.stats?.upcomingRenewals?.length ? (
                    <div className="space-y-2">
                      {data.stats.upcomingRenewals.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                          <Link href={`/settings/admin/crm/tenants/${p.tenantId}`} className="text-amber-600 hover:underline truncate">
                            {p.tenantId}
                          </Link>
                          <span className="text-gray-500 ml-2 shrink-0 capitalize">{p.tier}</span>
                          <span className="text-gray-400 ml-2 shrink-0 text-xs">
                            {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No upcoming renewals</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">In Grace Period</h2>
                </div>
                <div className="p-5">
                  {data.stats?.gracePeriodPromotions?.length ? (
                    <div className="space-y-2">
                      {data.stats.gracePeriodPromotions.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                          <Link href={`/settings/admin/crm/tenants/${p.tenantId}`} className="text-red-600 hover:underline truncate">
                            {p.tenantId}
                          </Link>
                          <span className="text-gray-500 ml-2 shrink-0 capitalize">{p.tier}</span>
                          <span className="text-gray-400 ml-2 shrink-0 text-xs">
                            {p.gracePeriodEndsAt ? new Date(p.gracePeriodEndsAt).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">None in grace period</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RevenueCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color] || colorMap.indigo} mb-2`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">{count} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}
