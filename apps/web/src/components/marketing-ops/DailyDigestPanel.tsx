'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowRight } from 'lucide-react';
import marketingOpsService, { type DailyDigest } from '@/services/MarketingOpsService';

/**
 * DailyDigestPanel — the derived "module activity" section.
 *
 * Self-contained: owns its date + fetch and renders the day's automated
 * motion activity (seeks, seeds, proving grounds, batches, outreach, reports,
 * canonical revenue) with a per-proving-ground cockpit and a canonical-vs-logged
 * revenue reconciliation. Read-only; sourced from GET /scorecards/daily-summary.
 *
 * Used by the Scorecards page and the Growth Engine page.
 */
const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;
const todayStr = () => new Date().toISOString().split('T')[0];

function DigestCard({ title, value, sub, href }: { title: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div>{body}</div>
          <ArrowRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-violet-500 transition-colors" />
        </div>
      </Link>
    );
  }
  return <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">{body}</div>;
}

export default function DailyDigestPanel({
  title = 'Module Activity',
  subtitle = 'Derived from proving grounds, batches, seeds, outreach, reports, and queues — no manual entry',
  showDatePicker = true,
  initialDate,
}: {
  title?: string;
  subtitle?: string;
  showDatePicker?: boolean;
  initialDate?: string;
}) {
  const [digestDate, setDigestDate] = useState(initialDate ?? todayStr());
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDigest(await marketingOpsService.getDailyDigest(digestDate));
    } catch (err: any) {
      setError(err.message || 'Failed to load module activity');
    } finally {
      setLoading(false);
    }
  }, [digestDate]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const maxFunnel = useMemo(
    () => Math.max(...(digest?.funnel ?? []).map((s) => s.count), 1),
    [digest],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        {showDatePicker && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={digestDate}
              onChange={(e) => setDigestDate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchDigest}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading && !digest ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : digest ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DigestCard
              title="Seeks Run"
              value={digest.seeks.runs}
              sub={`${digest.queue.created} prospects queued`}
              href="/settings/admin/marketing-ops/queue"
            />
            <DigestCard
              title="Seeds Created"
              value={digest.seeds.created}
              sub={`${digest.seeds.published} published · ${digest.seeds.claimed} claimed`}
              href="/settings/admin/directory/funnel"
            />
            <DigestCard
              title="Proving Grounds"
              value={digest.provingGrounds.workspaces}
              sub={`${digest.provingGrounds.linkedSeeds} linked seeds`}
              href="/settings/admin/marketing-ops/proving-grounds"
            />
            <DigestCard
              title="Batches Launched"
              value={digest.batches.launched}
              sub={`${digest.batches.completed} completed · ${digest.batches.running} running`}
              href="/settings/admin/directory/batches"
            />
            <DigestCard
              title="Seed Outreach"
              value={digest.outreach.seedTouches}
              sub={Object.entries(digest.outreach.byChannel)
                .map(([k, v]) => `${v} ${k}`)
                .join(' · ') || 'no touches'}
              href="/settings/admin/directory/funnel"
            />
            <DigestCard
              title="Campaign Outreach"
              value={digest.outreach.campaignTouches}
              sub={Object.entries(digest.outreach.byOutcome)
                .map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`)
                .join(' · ') || 'no touches'}
              href="/settings/admin/marketing-ops/openers"
            />
            <DigestCard
              title="Reports Delivered"
              value={digest.reports.delivered}
              sub={`${digest.reports.viewed} viewed · ${digest.reports.claimed} claimed`}
              href="/settings/admin/directory/funnel"
            />
            <DigestCard
              title="Canonical Revenue"
              value={formatCurrency(digest.revenue.canonicalCents)}
              sub={`${digest.revenue.count} payment${digest.revenue.count === 1 ? '' : 's'} · from marketing_revenue`}
            />
          </div>

          {/* Revenue reconciliation — canonical payments vs operator-logged */}
          <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
            <span className="text-gray-500 dark:text-gray-400">Revenue reconciliation:</span>
            <span className="text-gray-700 dark:text-gray-300">canonical {formatCurrency(digest.revenue.canonicalCents)}</span>
            <span className="text-gray-400 dark:text-gray-500">vs</span>
            <span className="text-gray-700 dark:text-gray-300">logged {formatCurrency(digest.revenue.loggedCents)}</span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            {digest.revenue.varianceCents === 0 ? (
              <span className="text-green-600 dark:text-green-400">in agreement</span>
            ) : digest.revenue.varianceCents > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">{formatCurrency(digest.revenue.varianceCents)} under-logged</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">{formatCurrency(-digest.revenue.varianceCents)} over-logged</span>
            )}
          </div>

          {/* Seed funnel for the day */}
          <div className="mt-4 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Seed Funnel</h3>
              <Link href="/settings/admin/directory/funnel" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Seed Funnel →
              </Link>
            </div>
            <div className="space-y-2">
              {digest.funnel.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-32 truncate">{stage.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white w-10 text-right">{stage.count}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 w-12 text-right">
                    {stage.conversionFromPrevious === null ? '—' : `${(stage.conversionFromPrevious * 100).toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Proving Ground cockpit — per-workspace seed activity for the day */}
          <div className="mt-4 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Proving Ground Cockpit</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Seed activity by workspace for {digest.date}</p>
              </div>
              <Link href="/settings/admin/marketing-ops/proving-grounds" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                All proving grounds →
              </Link>
            </div>
            {digest.provingGrounds.byWorkspace.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                No proving-ground seed activity on this day.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="pb-2 font-medium">Workspace</th>
                      <th className="pb-2 font-medium">Market</th>
                      <th className="pb-2 font-medium text-right">Seeds</th>
                      <th className="pb-2 font-medium text-right">Published</th>
                      <th className="pb-2 font-medium text-right">Claimed</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                    {digest.provingGrounds.byWorkspace.map((pg) => (
                      <tr key={pg.provingGroundId}>
                        <td className="py-2 text-gray-900 dark:text-white">
                          {pg.displayId ?? pg.category ?? 'Proving Ground'}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-300">
                          {[pg.city, pg.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300">{pg.seeds}</td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300">{pg.published}</td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300">{pg.claimed}</td>
                        <td className="py-2 text-right">
                          <Link
                            href={`/settings/admin/marketing-ops/proving-grounds/${pg.provingGroundId}`}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Cockpit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
