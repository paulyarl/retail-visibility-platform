'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Plus, Search, LayoutGrid, Table as TableIcon } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { Campaign, CampaignStage } from '@/services/MarketingOpsService';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead'];

export default function CampaignListClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<CampaignStage | ''>('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.listCampaigns({
        search: search || undefined,
        stage: stageFilter || undefined,
        limit: 200,
      });
      setCampaigns(result.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const formatCurrency = (cents: number | null) => cents != null ? `$${(cents / 100).toLocaleString()}` : '—';

  const campaignsByStage = (stage: CampaignStage) => campaigns.filter((c) => c.stage === stage);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/settings/admin/marketing-ops"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketing Ops
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} in pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/admin/marketing-ops/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Link>
            <button
              onClick={fetchCampaigns}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by business name, category, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as CampaignStage | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-2 text-sm font-medium ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-neutral-800 dark:text-gray-200'}`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-2 text-sm font-medium ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-neutral-800 dark:text-gray-200'}`}
            >
              <LayoutGrid className="w-4 h-4" />
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
        ) : view === 'table' ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Business</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">City</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Stage</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Est. Fee</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                        No campaigns found. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-700/30">
                        <td className="px-4 py-3">
                          <Link href={`/settings/admin/marketing-ops/campaigns/${c.id}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                            {c.business_name}
                          </Link>
                          {c.display_id && (
                            <span className="ml-2 text-xs text-gray-400">{c.display_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.category}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.city}{c.neighborhood ? ` (${c.neighborhood})` : ''}</td>
                        <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.estimated_fee_cents)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.amount_paid_cents)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.assigned_to ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.map((stage) => {
                const items = campaignsByStage(stage);
                return (
                  <div key={stage} className="w-72 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{STAGE_LABELS[stage]}</h3>
                      <span className="text-xs font-medium text-gray-400">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700 p-4 text-center text-xs text-gray-400">
                          Empty
                        </div>
                      ) : (
                        items.map((c) => (
                          <Link
                            key={c.id}
                            href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                            className="block bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                          >
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{c.business_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.category} · {c.city}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">{c.assigned_to ?? 'Unassigned'}</span>
                              {c.estimated_fee_cents != null && (
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{formatCurrency(c.estimated_fee_cents)}</span>
                              )}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
