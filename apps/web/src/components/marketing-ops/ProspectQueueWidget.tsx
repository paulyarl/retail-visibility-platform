'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, RefreshCw, Flame } from 'lucide-react';
import marketingOpsService, { ProspectQueueEntry } from '@/services/MarketingOpsService';

/**
 * ProspectQueueWidget — dashboard widget showing the queued-prospect count
 * and the top 3 entries (by priority → signal_count → FIFO). Mirrors the
 * HotProspectsWidget structure: poll-free fetch, count in header, per-row
 * link to the queue page.
 */
export default function ProspectQueueWidget() {
  const [entries, setEntries] = useState<ProspectQueueEntry[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Fetch only the top 3 queued entries for the widget preview. The
    // backend returns queuedCount (status='queued' total) regardless of the
    // limit, so the header count is always accurate.
    marketingOpsService.listProspectQueue({ status: 'queued', limit: 3 })
      .then((r) => {
        if (cancelled) return;
        setEntries(r.entries);
        setQueuedCount(r.queuedCount);
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load prospect queue'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Prospect Queue {!loading && !error && `(${queuedCount})`}
          </h3>
        </div>
        <Link
          href="/settings/admin/marketing-ops/queue"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Work the queue →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No queued prospects. Use "Queue" on any audit card to capture prospects for later.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const signals = entry.detected_signals ?? [];
            const crisis = signals.some((s) => s === 'RA_BBB_GRADE_SUPPRESSION' || s === 'RA_UNANSWERED_COMPLAINTS');
            return (
              <Link
                key={entry.id}
                href="/settings/admin/marketing-ops/queue"
                className={`block rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-neutral-700/30 ${
                  crisis
                    ? 'border-red-200 dark:border-red-800'
                    : signals.length > 0
                      ? 'border-amber-100 dark:border-amber-800'
                      : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {entry.business_name}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {entry.priority === 'high' && (
                      <span title="High priority">
                        <Flame className="h-3 w-3 text-red-500" />
                      </span>
                    )}
                    {signals.length > 0 && (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        crisis
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {signals.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {[entry.city, entry.state].filter(Boolean).join(', ') || '—'}
                  <span>·</span>
                  <span>{relativeTime(entry.created_at)}</span>
                </div>
              </Link>
            );
          })}
          {queuedCount > entries.length && (
            <p className="text-center text-xs text-gray-400 pt-1">
              +{queuedCount - entries.length} more in queue
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
