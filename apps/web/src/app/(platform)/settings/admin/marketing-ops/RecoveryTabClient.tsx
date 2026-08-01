'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, Plus, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import recoveryOpsService, { RecoveryCampaign } from '@/services/RecoveryOpsService';
import { StageBadge, RECOVERY_STAGES } from '@/components/marketing-ops/StageBadge';

export default function RecoveryTabClient() {
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([]);
  const [byStage, setByStage] = useState<Record<string, RecoveryCampaign[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const result = await recoveryOpsService.listCampaigns();
      setCampaigns(result.campaigns || []);
      setByStage(result.byStage || {});
      setTotal(result.total || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Recovery Campaigns</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create a campaign with category &ldquo;Recovery Management&quot; to get started.
        </p>
        <Link
          href="/settings/admin/marketing-ops/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recovery Campaigns</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} campaign{total === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={fetchCampaigns}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stage-grouped lists */}
      <div className="space-y-4">
        {RECOVERY_STAGES.map((stage) => {
          const stageCampaigns = byStage[stage] || [];
          if (stageCampaigns.length === 0) return null;
          return (
            <div key={stage} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <StageBadge stage={stage} size="md" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{stageCampaigns.length}</span>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-neutral-700">
                {stageCampaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/settings/admin/marketing-ops/recovery/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {c.business_name || c.display_id || c.id}
                        </p>
                        {c.display_id && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{c.display_id}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {c.category} · {c.city}
                        {c.assigned_to && ` · ${c.assigned_to}`}
                      </p>
                      {c.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{c.notes}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
