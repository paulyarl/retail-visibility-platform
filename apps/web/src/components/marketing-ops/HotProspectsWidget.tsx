'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, Clock, RefreshCw } from 'lucide-react';
import marketingOpsService, { HotProspectEntry } from '@/services/MarketingOpsService';
import { StageBadge } from '@/components/marketing-ops/StageBadge';

export default function HotProspectsWidget() {
  const [prospects, setProspects] = useState<HotProspectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    marketingOpsService.listHotProspects()
      .then((r) => { if (!cancelled) setProspects(r.prospects ?? []); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load hot prospects'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Hot Prospects {!loading && !error && `(${prospects.length})`}
          </h3>
        </div>
        <Link
          href="/settings/admin/marketing-ops/campaigns"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open list →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : prospects.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No active hot prospects.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto">
          {prospects.map((p) => {
            const progressPct = Math.min(100, (p.auto_followup_count / p.max_auto_followups) * 100);
            const nextFu = p.next_follow_up_at ? new Date(p.next_follow_up_at) : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdue = nextFu && nextFu < today;
            return (
              <Link
                key={p.campaign_id}
                href={`/settings/admin/marketing-ops/campaigns/${p.campaign_id}`}
                className="block rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-neutral-700/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {p.business_name ?? p.campaign_id}
                  </span>
                  <StageBadge stage={p.stage as any} size="sm" />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{p.category}</span>
                  <span>·</span>
                  <span>{p.city}{p.state ? `, ${p.state}` : ''}</span>
                  {p.pain_score != null && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">Score {p.pain_score}</span>
                    </>
                  )}
                </div>
                {p.hot_prospect_reason && (
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 truncate" title={p.hot_prospect_reason}>
                    {p.hot_prospect_reason}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  {/* Auto-follow-up progress */}
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {p.auto_followup_count}/{p.max_auto_followups}
                    </span>
                  </div>
                  {nextFu && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Clock className="h-2.5 w-2.5" />
                      {overdue ? 'Overdue' : nextFu.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
