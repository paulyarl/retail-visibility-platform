'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Tag, RefreshCw, Users, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { CouponAnalyticsService } from '@/services/CouponAnalyticsService';

export default function AdminCouponAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CouponAnalyticsService.getInstance().getAdminAnalytics();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin coupon analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = CouponAnalyticsService;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/settings/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-amber-600" />
                Coupon Analytics (Admin)
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Cross-tenant coupon analytics — total coupons, redemptions, discount, and events
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
            <span className="ml-2 text-gray-500">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : !data ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data yet</h3>
            <p className="text-sm text-gray-500">
              Coupon analytics are computed from events across all tenants.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <AdminSummaryCard icon={<Tag className="w-5 h-5" />} label="Active Coupons" value={fmt.formatNumber(data.totalCoupons)} color="amber" />
              <AdminSummaryCard icon={<Users className="w-5 h-5" />} label="Active Tenants" value={fmt.formatNumber(data.totalTenants)} color="blue" />
              <AdminSummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Total Redemptions" value={fmt.formatNumber(data.totalRedemptions)} color="green" />
              <AdminSummaryCard icon={<DollarSign className="w-5 h-5" />} label="Total Discount" value={fmt.formatCurrency(data.totalDiscountCents)} color="purple" />
              <AdminSummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Total Events" value={fmt.formatNumber(data.totalEvents)} color="indigo" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Top Tenants by Discount</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Tenant ID</th>
                      <th className="px-4 py-3 font-medium text-right">Coupons</th>
                      <th className="px-4 py-3 font-medium text-right">Redemptions</th>
                      <th className="px-4 py-3 font-medium text-right">Total Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.topTenants || []).map((t: any) => (
                      <tr key={t.tenantId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.tenantId}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(t.couponCount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(t.redemptionCount)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt.formatCurrency(t.discountCents)}</td>
                      </tr>
                    ))}
                    {(!data.topTenants || data.topTenants.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminSummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
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
