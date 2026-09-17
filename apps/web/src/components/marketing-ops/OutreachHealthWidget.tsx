'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, RefreshCw, Send, MessageSquareReply, ShieldCheck } from 'lucide-react';
import marketingOpsService from '@/services/MarketingOpsService';

/**
 * OutreachHealthWidget — openers + outreach throughput at a glance.
 *
 * Sourced from the split-test aggregate (one query): opener volume, sends,
 * replies, reply rate, and the quality-gate pass rate across the same rows.
 * The Openers workspace owns the per-campaign detail.
 */
export default function OutreachHealthWidget() {
  const [stats, setStats] = useState<{
    openers: number;
    sent: number;
    replies: number;
    replyRate: number;
    gatePassed: number;
    gateTotal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    marketingOpsService
      .getSplitTestStats()
      .then((s) => {
        if (cancelled) return;
        const rows = s.cohorts.flatMap((c) => c.campaignRows ?? []);
        const gateTotal = rows.length;
        const gatePassed = rows.filter((r) => r.quality_gate_passed).length;
        setStats({
          openers: s.totals.openers,
          sent: s.totals.sent,
          replies: s.totals.replies,
          replyRate: s.totals.replyRate,
          gatePassed,
          gateTotal,
        });
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load outreach stats'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const gateRate = stats && stats.gateTotal > 0 ? stats.gatePassed / stats.gateTotal : null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Outreach Health</h3>
        </div>
        <Link
          href="/settings/admin/marketing-ops/openers"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Openers →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : !stats || stats.openers === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No openers yet. Build one from the Openers workspace.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.openers}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Openers</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.sent}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <MessageSquareReply className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {(stats.replyRate * 100).toFixed(0)}%
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stats.replies} replies</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {gateRate === null ? '—' : `${(gateRate * 100).toFixed(0)}%`}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gate pass{gateRate !== null ? ` (${stats.gatePassed}/${stats.gateTotal})` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
