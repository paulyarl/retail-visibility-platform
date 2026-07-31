'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, TrendingUp, DollarSign, Target, Trophy, Download, Activity, Eye, Package } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { DashboardStats, ConversionStats, CampaignStage } from '@/services/MarketingOpsService';
import FollowUpsDueWidget from '@/components/marketing-ops/FollowUpsDueWidget';
import ReviewFollowUpsDueWidget from '@/components/marketing-ops/ReviewFollowUpsDueWidget';
import HotProspectsWidget from '@/components/marketing-ops/HotProspectsWidget';

const STAGE_LABELS: Record<CampaignStage, string> = {
  seek: 'Seek',
  preview_built: 'Preview Built',
  shown: 'Shown',
  paid: 'Paid',
  delivered: 'Delivered',
  retainer_pitched: 'Retainer Pitched',
  retainer_won: 'Retainer Won',
  lost: 'Lost',
  dead: 'Dead',
  tenant_onboarded: 'Tenant Onboarded',
};

const STAGE_COLORS: Record<CampaignStage, string> = {
  seek: 'bg-blue-100 text-blue-800',
  preview_built: 'bg-indigo-100 text-indigo-800',
  shown: 'bg-cyan-100 text-cyan-800',
  paid: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  retainer_pitched: 'bg-amber-100 text-amber-800',
  retainer_won: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-800',
  dead: 'bg-gray-300 text-gray-800',
  tenant_onboarded: 'bg-teal-100 text-teal-800',
};

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'tenant_onboarded'];

function SourceBreakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data || {});
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No conversions yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([source, count]) => (
            <div key={source} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300 capitalize">{source.replace(/_/g, ' ')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketingOpsDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [convStats, setConvStats] = useState<ConversionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchRef = useRef<(() => Promise<void>) | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const [data, conv] = await Promise.all([
        marketingOpsService.getDashboard(),
        marketingOpsService.getConversionStats().catch(() => null),
      ]);
      setStats(data);
      setConvStats(conv);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchRef.current = fetchDashboard;
    const interval = setInterval(() => {
      fetchRef.current?.();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await marketingOpsService.exportCsv();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'marketing-campaigns.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Ops Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Campaign pipeline health, conversion metrics, and revenue tracking
              {lastUpdated && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  · Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : stats ? (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Campaigns</span>
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCampaigns}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stats.activeCampaigns} active</p>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalRevenueCents)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(stats.weeklyRevenueCents)} this week</p>
                {stats.marketingRevenueCents != null && stats.marketingRevenueCents > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    {formatCurrency(stats.marketingRevenueCents)} from {stats.marketingRevenueCount ?? 0} payment{stats.marketingRevenueCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Retainers Won</span>
                  <Trophy className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalRetainersWon}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(stats.totalRetainerRevenueCents)} retainer revenue</p>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversion Rate</span>
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats.conversionRate * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">shown → paid</p>
              </div>
            </div>

            {/* Follow-ups due widget (Sprint 2) + Hot prospects widget (Sprint 3) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <FollowUpsDueWidget />
              <HotProspectsWidget />
            </div>

            {/* Review follow-ups due widget (Sprint 4) */}
            <div className="mb-8">
              <ReviewFollowUpsDueWidget />
            </div>

            {/* Weekly Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Weekly Previews</span>
                  <Eye className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.weeklyPreviews}</p>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Weekly Delivered</span>
                  <Package className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.weeklyDelivered}</p>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Weekly Revenue</span>
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.weeklyRevenueCents)}</p>
                {stats.weeklyMarketingRevenueCents != null && stats.weeklyMarketingRevenueCents > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {formatCurrency(stats.weeklyMarketingRevenueCents)} from online payments
                  </p>
                )}
              </div>
            </div>

            {/* Tenant Conversion */}
            {convStats && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tenant Conversion</h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Prospecting channel performance</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Conversions</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{convStats.totalConversions}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Conversion Rate</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{(convStats.conversionRate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Resurrected</p>
                    <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{convStats.resurrectedConversions}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">QR View → Conv.</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {(convStats.qrViewRate * 100).toFixed(0)}% → {(convStats.qrConversionRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{convStats.tokensViewed}/{convStats.tokensIssued} tokens viewed</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Demo Claim Rate</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{(convStats.demoClaimRate * 100).toFixed(0)}%</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{convStats.demoTokensIssued} demos issued</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Days to Convert</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{convStats.avgDaysToConvert}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-gray-100 dark:border-neutral-700 pt-4">
                  <SourceBreakdown title="Closed by (last touch)" data={convStats.byLastTouchSource} />
                  <SourceBreakdown title="Opened by (first touch)" data={convStats.byFirstTouchSource} />
                  <SourceBreakdown title="Prospect vs. Upsell" data={convStats.byOrigin} />
                </div>
              </div>
            )}

            {/* Pipeline Breakdown */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pipeline by Stage</h2>
              <div className="space-y-3">
                {PIPELINE_STAGES.map((stage) => {
                  const count = stats.stageCounts?.[stage] ?? stats.byStage?.[stage] ?? 0;
                  const maxCount = Math.max(...PIPELINE_STAGES.map((s) => stats.stageCounts?.[s] ?? stats.byStage?.[s] ?? 0), 1);
                  const widthPct = (count / maxCount) * 100;
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 truncate">
                        {STAGE_LABELS[stage]}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${STAGE_COLORS[stage]} rounded-full transition-all duration-500`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/settings/admin/marketing-ops/campaigns"
                className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Campaign Tracker</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">View and manage prospect campaigns</p>
              </Link>
              <Link
                href="/settings/admin/marketing-ops/campaigns/new"
                className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 hover:border-green-400 dark:hover:border-green-600 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">New Campaign</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add a new prospect to the pipeline</p>
              </Link>
              <Link
                href="/settings/admin/marketing-ops/prompts"
                className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Prompt Library</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage prompt templates</p>
              </Link>
              <Link
                href="/settings/admin/marketing-ops/scorecards"
                className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Scorecards</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily activity tracking</p>
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
