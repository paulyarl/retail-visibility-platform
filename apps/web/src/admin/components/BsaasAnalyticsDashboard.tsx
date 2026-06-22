/**
 * BSaaS Analytics Dashboard
 *
 * Admin dashboard showing BSaaS revenue metrics, per-feature breakdown,
 * and recent purchases. Read-only.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { adminBsaasAnalyticsService, type BsaasAnalytics } from '@/services/AdminBsaasAnalyticsService';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, TrendingUp, Users, DollarSign, Activity, ShoppingCart } from 'lucide-react';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function BsaasAnalyticsDashboard() {
  const [data, setData] = useState<BsaasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminBsaasAnalyticsService.getAnalytics()
      .then(setData)
      .catch(err => setError(err.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, perFeature, recentPurchases } = data;

  const metricCards = [
    {
      label: 'MRR',
      value: formatCurrency(summary.monthlyRecurringRevenue),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'ARR',
      value: formatCurrency(summary.annualRecurringRevenue),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Lifetime Revenue',
      value: formatCurrency(summary.totalLifetimeRevenue),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Active Purchases',
      value: String(summary.totalActivePurchases),
      icon: <Activity className="w-5 h-5" />,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Active Trials',
      value: String(summary.totalTrialPurchases),
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      label: 'Unique Tenants',
      value: String(summary.totalTenantsWithPurchases),
      icon: <Users className="w-5 h-5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Trial Conversion',
      value: `${summary.trialConversionRate}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Churn Rate',
      value: `${summary.churnRate}%`,
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          BSaaS Revenue Analytics
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Revenue metrics, per-feature breakdown, and recent purchase activity.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-500">{card.label}</span>
              <div className={`p-1.5 rounded-md ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status Summary */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold mb-3">Purchase Status Breakdown</h3>
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">Active: {summary.totalActivePurchases}</Badge>
          <Badge variant="secondary">Trial: {summary.totalTrialPurchases}</Badge>
          <Badge variant="secondary">Past Due: {summary.totalPastDuePurchases}</Badge>
          <Badge variant="secondary">Suspended: {summary.totalSuspendedPurchases}</Badge>
          <Badge variant="secondary">Expired: {summary.totalExpiredPurchases}</Badge>
        </div>
      </div>

      {/* Per-Feature Revenue Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold">Revenue by Feature</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Feature</th>
                <th className="px-4 py-2 text-right font-medium">Active</th>
                <th className="px-4 py-2 text-right font-medium">Trials</th>
                <th className="px-4 py-2 text-right font-medium">MRR</th>
                <th className="px-4 py-2 text-right font-medium">ARR</th>
                <th className="px-4 py-2 text-right font-medium">Lifetime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perFeature.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No purchases yet</td>
                </tr>
              ) : perFeature.map((row) => (
                <tr key={row.feature_key} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.marketing_name || row.feature_name}</div>
                    <div className="text-xs text-neutral-400">{row.feature_key}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{row.active_count}</td>
                  <td className="px-4 py-3 text-right">{row.trial_count}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.monthly_revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.annual_revenue)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.lifetime_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Purchases */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold">Recent Purchases</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tenant</th>
                <th className="px-4 py-2 text-left font-medium">Feature</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
                <th className="px-4 py-2 text-left font-medium">Cycle</th>
                <th className="px-4 py-2 text-left font-medium">Purchased</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No purchases yet</td>
                </tr>
              ) : recentPurchases.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.tenant_name || p.tenant_id}</div>
                    <div className="text-xs text-neutral-400">{p.tenant_id}</div>
                  </td>
                  <td className="px-4 py-3">{p.feature_key}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-500'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.price_cents)}</td>
                  <td className="px-4 py-3">{p.billing_cycle}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(p.purchased_at)}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(p.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
