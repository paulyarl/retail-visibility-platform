'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Gauge } from 'lucide-react';
import marketingOpsService, { type DailyDigest } from '@/services/MarketingOpsService';

/**
 * DailyDigestWidget — today's derived module activity at a glance.
 *
 * The same payload the Scorecards page renders in full, condensed to the
 * day's throughput numbers so the dashboard shows what the module actually
 * did alongside the prospect-campaign cards. Read-only; sourced from
 * MarketingDailyDigestService via GET /scorecards/daily-summary.
 */
const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

export default function DailyDigestWidget({ date }: { date?: string }) {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketingOpsService
      .getDailyDigest(date)
      .then((d) => { if (!cancelled) setDigest(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load daily digest'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Daily Scorecard</h3>
          {digest && <span className="text-[11px] text-gray-400 dark:text-gray-500">{digest.date}</span>}
        </div>
        <Link
          href="/settings/admin/marketing-ops/scorecards"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Scorecards →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : digest ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Seeks run" value={digest.seeks.runs} />
            <Stat label="Seeds created" value={digest.seeds.created} />
            <Stat label="Batches launched" value={digest.batches.launched} />
            <Stat label="Seed outreach" value={digest.outreach.seedTouches} />
            <Stat label="Reports delivered" value={digest.reports.delivered} />
            <Stat label="Canonical revenue" value={formatCurrency(digest.revenue.canonicalCents)} />
          </div>
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            {digest.provingGrounds.workspaces} proving-ground workspace{digest.provingGrounds.workspaces === 1 ? '' : 's'} ·{' '}
            {digest.seeds.published} published · {digest.seeds.claimed} claimed
          </p>
        </>
      ) : null}
    </div>
  );
}
