'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Eye, MousePointer, TrendingUp, Calendar, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';
import { DirectoryPromotionService } from '@/services/DirectoryPromotionService';

interface AnalyticsData {
  isPromoted: boolean;
  promotionTier: string | null;
  promotionStartedAt: string | null;
  promotionExpiresAt: string | null;
  impressions: number;
  clicks: number;
  clickThroughRate: number;
  daysActive: number;
  avgImpressionsPerDay: number;
  avgClicksPerDay: number;
}

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-amber-100 text-amber-800',
  premium: 'bg-blue-100 text-blue-800',
  featured: 'bg-purple-100 text-purple-800',
};

export default function PromotionAnalyticsClient() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await DirectoryPromotionService.getAnalytics(tenantId);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const daysRemaining = data?.promotionExpiresAt
    ? Math.max(0, Math.ceil((new Date(data.promotionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/t/${tenantId}/settings/promotion`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Promotion
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-amber-600" />
                Promotion Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Track impressions, clicks, and ROI for your directory promotion
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
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data</h3>
            <p className="text-sm text-gray-500">Promotion analytics will appear here once you have an active promotion.</p>
          </div>
        ) : (
          <>
            {/* Status Banner */}
            {data.isPromoted ? (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${TIER_COLORS[data.promotionTier || 'basic'] || 'bg-gray-100 text-gray-800'}`}>
                    {data.promotionTier || 'Unknown'}
                  </span>
                  <div className="text-sm text-gray-600">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {data.promotionStartedAt ? new Date(data.promotionStartedAt).toLocaleDateString() : '—'} → {data.promotionExpiresAt ? new Date(data.promotionExpiresAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{daysRemaining}</span>
                  <span className="text-gray-500"> days remaining</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6 text-center">
                <p className="text-sm text-gray-500">No active promotion. Purchase a promotion to start tracking analytics.</p>
                <Link
                  href={`/t/${tenantId}/settings/promotion`}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                >
                  View Plans
                </Link>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={<Eye className="w-5 h-5" />}
                label="Impressions"
                value={data.impressions.toLocaleString()}
                color="blue"
              />
              <MetricCard
                icon={<MousePointer className="w-5 h-5" />}
                label="Clicks"
                value={data.clicks.toLocaleString()}
                color="purple"
              />
              <MetricCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="CTR"
                value={`${data.clickThroughRate.toFixed(2)}%`}
                color="green"
              />
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                label="Days Active"
                value={data.daysActive.toString()}
                color="amber"
              />
            </div>

            {/* Daily Averages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Daily Impressions</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.avgImpressionsPerDay.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Average per day over {data.daysActive} days</p>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((data.avgImpressionsPerDay / Math.max(data.impressions, 1)) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MousePointer className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Daily Clicks</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.avgClicksPerDay.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Average per day over {data.daysActive} days</p>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min((data.avgClicksPerDay / Math.max(data.clicks, 1)) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Breakdown</h3>
              <div className="space-y-3">
                <PerformanceRow label="Impressions → Clicks" value={data.clickThroughRate} suffix="%" color="bg-green-500" />
                <PerformanceRow
                  label="Days Elapsed"
                  value={data.promotionExpiresAt ? (data.daysActive / (data.daysActive + daysRemaining)) * 100 : 0}
                  suffix="%"
                  color="bg-amber-500"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color] || colorMap.blue} mb-2`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function PerformanceRow({ label, value, suffix, color }: { label: string; value: number; suffix: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${Math.max(value, 1)}%` }} />
      </div>
    </div>
  );
}
