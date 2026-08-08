'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Eye, MousePointerClick, TrendingUp, Users, Activity } from 'lucide-react';
import marketingOpsService, { GalleryDashboard } from '@/services/MarketingOpsService';

export default function GalleryDashboardClient() {
  const [dashboard, setDashboard] = useState<GalleryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.getGalleryDashboard(daysBack);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!dashboard) return null;

  const { funnel, byArchetype, totalEvents } = dashboard;

  // Summary cards
  const summaryCards = [
    { label: 'Total Tokens', value: funnel.totalTokens, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Unique Prospects', value: funnel.viewedTokens, icon: Users, color: 'text-yellow-600' },
    { label: 'CTA Clicks', value: funnel.convertedTokens, icon: MousePointerClick, color: 'text-green-600' },
    { label: 'Total Events', value: totalEvents, icon: Activity, color: 'text-purple-600' },
  ];

  // Max view rate for bar chart scaling
  const maxViewRate = Math.max(...byArchetype.map((a) => a.viewRate), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Period:</label>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-5 w-5 ${card.color}`} />
                <span className="text-2xl font-bold">{card.value}</span>
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Funnel widget */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {[
            { label: 'Tokens Generated', value: funnel.totalTokens, pct: 100, color: 'bg-blue-500' },
            { label: 'Viewed by Prospect', value: funnel.viewedTokens, pct: funnel.viewRate, color: 'bg-yellow-500' },
            { label: 'Converted (Paid)', value: funnel.convertedTokens, pct: funnel.conversionRate, color: 'bg-green-500' },
          ].map((step) => (
            <div key={step.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{step.label}</span>
                <span className="text-gray-500">
                  {step.value} ({step.pct}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-neutral-700 rounded-full h-3">
                <div
                  className={`${step.color} h-3 rounded-full transition-all`}
                  style={{ width: `${step.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Archetype breakdown table */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Archetype Breakdown</h3>
        {byArchetype.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No gallery data in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-700 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Archetype</th>
                  <th className="pb-2 pr-4 font-medium text-right">Tokens</th>
                  <th className="pb-2 pr-4 font-medium text-right">Viewed</th>
                  <th className="pb-2 pr-4 font-medium text-right">Converted</th>
                  <th className="pb-2 pr-4 font-medium text-right">View Rate</th>
                  <th className="pb-2 pr-4 font-medium text-right">Conv. Rate</th>
                  <th className="pb-2 font-medium">View Rate Bar</th>
                </tr>
              </thead>
              <tbody>
                {byArchetype
                  .slice()
                  .sort((a, b) => b.totalTokens - a.totalTokens)
                  .map((row) => (
                    <tr
                      key={row.archetype}
                      className="border-b border-gray-100 dark:border-neutral-700/50"
                    >
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          {row.archetype}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">{row.totalTokens}</td>
                      <td className="py-3 pr-4 text-right">{row.viewedTokens}</td>
                      <td className="py-3 pr-4 text-right">{row.convertedTokens}</td>
                      <td className="py-3 pr-4 text-right font-medium">{row.viewRate}%</td>
                      <td className="py-3 pr-4 text-right font-medium">{row.conversionRate}%</td>
                      <td className="py-3">
                        <div className="w-full bg-gray-100 dark:bg-neutral-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(row.viewRate / maxViewRate) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
