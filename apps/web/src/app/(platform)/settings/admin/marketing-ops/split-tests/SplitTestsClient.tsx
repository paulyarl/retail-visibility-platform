'use client';

/**
 * SplitTestsClient — Cohort comparison for opener close-variant split tests.
 *
 * Shows:
 *   - Summary cards per cohort (openers, sent, replies, reply rate)
 *   - Side-by-side comparison table with outcome breakdown
 *   - Per-cohort campaign drill-down (expandable)
 *   - Winner callout when one cohort's reply rate meaningfully leads
 *
 * Data source: GET /api/admin/marketing-ops/openers/split-tests
 * → OutreachOpenerService.getSplitTestStats()
 *
 * Reply signal: any human-contact outcome (reached, interested,
 * not_interested, callback_scheduled). See REPLY_OUTCOMES in the service.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Trophy, FlaskConical, Mail, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  SplitTestStats,
  SplitTestCohort,
  SplitTestCampaignRow,
} from '@/services/MarketingOpsService';

const VARIANT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  soft: {
    label: 'Soft close',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-neutral-700',
  },
  direct_paid: {
    label: 'Direct paid close',
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
  },
};

const OUTCOME_LABELS: Record<string, string> = {
  reached: 'Reached',
  no_answer: 'No Answer',
  left_message: 'Left Message',
  interested: 'Interested',
  not_interested: 'Not Interested',
  callback_scheduled: 'Callback Scheduled',
  other: 'Other',
  auto_follow_up_scheduled: 'Auto Follow-Up',
};

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function SplitTestsClient() {
  const [stats, setStats] = useState<SplitTestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.getSplitTestStats();
      setStats(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load split-test stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  if (!stats || stats.cohorts.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-8 text-center">
        <FlaskConical className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No split-test data yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Generate openers with a close variant selected in the{' '}
          <Link href="/settings/admin/marketing-ops/openers" className="text-blue-600 dark:text-blue-400 underline">
            Opener Workspace
          </Link>
          , then send pitches and log contact outcomes. Cohort comparison will appear here.
        </p>
      </div>
    );
  }

  const { cohorts, totals } = stats;

  // Determine winner: cohort with highest reply rate, only if there's
  // a meaningful difference (>= 5 percentage points) and at least 3
  // sent campaigns per cohort.
  let winner: SplitTestCohort | null = null;
  if (cohorts.length >= 2) {
    const sorted = [...cohorts].sort((a, b) => b.replyRate - a.replyRate);
    const top = sorted[0];
    const second = sorted[1];
    if (top.sent >= 3 && second.sent >= 3 && (top.replyRate - second.replyRate) >= 0.05) {
      winner = top;
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Winner callout ─────────────────────────────────────────── */}
      {winner && (
        <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {VARIANT_LABELS[winner.variant]?.label ?? winner.variant} is leading
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {formatPct(winner.replyRate)} reply rate vs{' '}
              {formatPct(cohorts.find((c) => c.variant !== winner?.variant)?.replyRate ?? 0)} —{' '}
              {winner.replies} of {winner.sent} sent campaigns replied.
            </p>
          </div>
        </div>
      )}

      {/* ─── Totals bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">Openers:</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totals.openers}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Sent:</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totals.sent}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Replies:</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totals.replies}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Overall reply rate:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{formatPct(totals.replyRate)}</span>
        </div>
      </div>

      {/* ─── Cohort comparison cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cohorts.map((cohort) => {
          const meta = VARIANT_LABELS[cohort.variant] ?? { label: cohort.variant, color: '', bg: '' };
          const isExpanded = expandedCohort === cohort.variant;
          return (
            <div
              key={cohort.variant}
              className={`bg-white dark:bg-neutral-800 rounded-xl border-2 ${
                winner?.variant === cohort.variant
                  ? 'border-amber-300 dark:border-amber-700'
                  : 'border-gray-200 dark:border-neutral-700'
              } p-5`}
            >
              {/* Variant header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  {winner?.variant === cohort.variant && (
                    <Trophy className="w-4 h-4 text-amber-500" />
                  )}
                </div>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Openers generated</p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{cohort.openers}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Campaigns sent</p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{cohort.sent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Replies</p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{cohort.replies}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reply rate</p>
                  <p className={`text-lg font-bold ${
                    cohort.replyRate > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400'
                  }`}>
                    {formatPct(cohort.replyRate)}
                  </p>
                </div>
              </div>

              {/* Outcome breakdown */}
              {Object.keys(cohort.outcomeBreakdown).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Outcome breakdown</p>
                  <div className="space-y-1">
                    {Object.entries(cohort.outcomeBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([outcome, count]) => (
                        <div key={outcome} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            {OUTCOME_LABELS[outcome] ?? outcome}
                          </span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Drill-down toggle */}
              {cohort.campaignRows.length > 0 && (
                <button
                  onClick={() => setExpandedCohort(isExpanded ? null : cohort.variant)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {cohort.campaignRows.length} campaign{cohort.campaignRows.length !== 1 ? 's' : ''}
                </button>
              )}

              {/* Campaign drill-down */}
              {isExpanded && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {cohort.campaignRows.map((row) => (
                    <CampaignRow key={row.campaign_id} row={row} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Sample-size warning ────────────────────────────────────── */}
      {totals.sent > 0 && totals.sent < 30 && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Early data — {totals.sent} sent.</strong> Reply-rate differences below ~15 sent per cohort
            are likely noise. Aim for 15–20 per cohort before drawing conclusions.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Campaign row (drill-down) ──────────────────────────────────────────

function CampaignRow({ row }: { row: SplitTestCampaignRow }) {
  return (
    <Link
      href={`/settings/admin/marketing-ops/campaigns/${row.campaign_id}`}
      className="block rounded-lg border border-gray-100 dark:border-neutral-700 p-2.5 hover:border-gray-200 dark:hover:border-neutral-600 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
          {row.business_name}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {row.sent ? (
            row.replied ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
            )
          ) : (
            <span className="text-xs text-gray-400">unsent</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="capitalize">{row.stage.replace(/_/g, ' ')}</span>
        {row.city && <span>· {row.city}</span>}
        {row.latest_outcome && (
          <span>· last: {OUTCOME_LABELS[row.latest_outcome] ?? row.latest_outcome}</span>
        )}
      </div>
    </Link>
  );
}
