'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Flame, Plus, RefreshCw, AlertCircle, Loader2, Inbox, Check, Phone } from 'lucide-react';
import marketingOpsService, { type SyncReport } from '@/services/MarketingOpsService';

interface SyncReportCardProps {
  executionId: string;
  campaignId: string;
  initialReport?: SyncReport | null;
  onRefresh?: () => void;
}

export default function SyncReportCard({ executionId, campaignId, initialReport, onRefresh }: SyncReportCardProps) {
  const router = useRouter();
  const [report, setReport] = useState<SyncReport | null>(initialReport ?? null);
  const [loading, setLoading] = useState(!initialReport);
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueingIdx, setQueueingIdx] = useState<number | null>(null);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<number, 'queued' | 'verify' | 'exists' | 'already' | 'error'>>({});
  const [queuedEntryId, setQueuedEntryId] = useState<Record<number, string>>({});
  const [createdCampaignId, setCreatedCampaignId] = useState<Record<number, string>>({});

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await marketingOpsService.getSyncReport(executionId);
      setReport(r);
    } catch (e: any) {
      setError(e.message || 'Failed to load sync report');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount if no initial report
  if (!report && !loading && !error) {
    fetchReport();
  }

  const handleCreateOne = async (idx: number, businessName: string) => {
    setCreatingIdx(idx);
    setError(null);
    try {
      // We need the full business JSON — but the sync report only has
      // {businessName, reason}. The backend's derive-all-unmatched route
      // handles this by re-parsing the execution. For single-derive, we
      // pass a minimal business object and the backend will fill in defaults.
      // However, the backend derive-from-scan route expects the full business
      // object. So for single-derive, we use the bulk endpoint with a filter,
      // OR we accept that single-derive from the report requires the full
      // business JSON which we don't have here.
      //
      // Simplest: call deriveAllUnmatched and filter to just this one.
      // But that's wasteful. Instead, we'll just call the bulk endpoint
      // and let the backend handle it — then redirect to the created campaign.
      //
      // Actually, the cleanest UX: redirect to a "create from scan" form
      // pre-filled with the business name. But that doesn't exist yet.
      //
      // For now: use the bulk endpoint and find the created campaign for
      // this business name.
      const result = await marketingOpsService.deriveAllUnmatched(campaignId, executionId);
      const created = result.created.find((c) => c.businessName.toLowerCase() === businessName.toLowerCase());
      if (created) {
        setCreatedCampaignId((prev) => ({ ...prev, [idx]: created.campaignId }));
      } else {
        const failed = result.failed.find((f) => f.businessName.toLowerCase() === businessName.toLowerCase());
        setError(failed?.error || 'Campaign was not created (may already exist)');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create campaign');
    } finally {
      setCreatingIdx(null);
    }
  };

  const handleCreateAll = async () => {
    if (!report?.unmatched?.length) return;
    const count = report.unmatched.length;
    if (!confirm(`Create ${count} business campaign${count === 1 ? '' : 's'} from unmatched businesses?`)) return;
    setBulkCreating(true);
    setBulkResult(null);
    setError(null);
    try {
      const result = await marketingOpsService.deriveAllUnmatched(campaignId, executionId);
      const parts = [`${result.created.length} created`];
      if (result.failed.length) parts.push(`${result.failed.length} failed`);
      setBulkResult(parts.join(', '));
      // Refresh the sync report so the created businesses now show as matched
      await fetchReport();
      onRefresh?.();
    } catch (e: any) {
      setError(e.message || 'Failed to create campaigns');
    } finally {
      setBulkCreating(false);
    }
  };

  const handleQueueOne = async (idx: number, businessName: string, initialStatus?: 'queued' | 'verify_then_outreach') => {
    setQueueingIdx(idx);
    setError(null);
    try {
      const result = await marketingOpsService.addToQueue({
        business_name: businessName,
        title: businessName,
        source_kind: 'scan_unmatched',
        source_campaign_id: campaignId,
        source_execution_id: executionId,
        // Sync report rows only carry {businessName, reason} — no rating/
        // review/signal data. The snapshot is intentionally thin; the
        // operator can enrich it from the campaign detail page later.
        business_snapshot: { business_name: businessName },
        initial_status: initialStatus,
      });
      const successKind = initialStatus === 'verify_then_outreach' ? 'verify' : 'queued';
      setQueuedFeedback((prev) => ({
        ...prev,
        [idx]: result.kind === 'campaign_exists' ? 'exists' : result.kind === 'already_queued' ? 'already' : successKind,
      }));
      if (result.kind === 'created' || result.kind === 'already_queued') {
        setQueuedEntryId((prev) => ({ ...prev, [idx]: result.entry.id }));
      }
    } catch (e: any) {
      setQueuedFeedback((prev) => ({ ...prev, [idx]: 'error' }));
      setError(e.message || 'Failed to add to queue');
    } finally {
      setQueueingIdx(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sync report…
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
        <button onClick={fetchReport} className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">Retry</button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">No sync report available for this execution.</p>
      </div>
    );
  }

  const matched = report.matched ?? [];
  const unmatched = report.unmatched ?? [];

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 dark:bg-neutral-700/30 border-b border-gray-100 dark:border-neutral-700">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">City Pain Scan Sync Report</h3>
          <div className="flex items-center gap-2">
            {report.syncedAt && (
              <span className="text-[10px] text-gray-400">
                Synced: {new Date(report.syncedAt).toLocaleString()}
              </span>
            )}
            <button
              onClick={fetchReport}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700"
              title="Refresh report"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
        {/* Summary stats */}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" /> {matched.length} matched
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" /> {unmatched.length} unmatched
          </span>
          {report.skippedChains > 0 && (
            <span className="text-gray-500 dark:text-gray-400">{report.skippedChains} chains skipped</span>
          )}
          {report.hotProspectsMarked > 0 && (
            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
              <Flame className="h-3 w-3" /> {report.hotProspectsMarked} hot prospects
            </span>
          )}
          {report.summaryStored && (
            <span className="text-gray-500 dark:text-gray-400">Summary stored</span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700 text-xs text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {bulkResult && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-700 text-xs text-green-800 dark:text-green-300">
          {bulkResult}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Matched campaigns */}
        {matched.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Matched Campaigns ({matched.length})
            </h4>
            <div className="space-y-1">
              {matched.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => router.push(`/settings/admin/marketing-ops/campaigns/${m.campaignId}`)}
                    className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {m.businessName}
                  </button>
                  {m.hot && <Flame className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched businesses */}
        {unmatched.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Unmatched Businesses ({unmatched.length})
              </h4>
              <button
                onClick={handleCreateAll}
                disabled={bulkCreating}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
              >
                {bulkCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create all
              </button>
            </div>
            <div className="space-y-1">
              {unmatched.map((u, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="truncate">
                    <span className="text-gray-700 dark:text-gray-300">{u.businessName}</span>
                    <span className="text-gray-400 ml-2">— {u.reason}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {queuedFeedback[i] === 'queued' && queuedEntryId[i] ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=queued`}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        title="Added to queue — click to view in the prospect queue"
                      >
                        <Check className="h-2.5 w-2.5" />
                        Queued
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleQueueOne(i, u.businessName)}
                        disabled={queueingIdx === i || queuedFeedback[i] === 'verify'}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/40 disabled:opacity-50"
                        title={`Add ${u.businessName} to the prospect queue for later`}
                      >
                        {queueingIdx === i ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Inbox className="h-2.5 w-2.5" />}
                        Queue
                      </button>
                    )}
                    {queuedFeedback[i] === 'verify' && queuedEntryId[i] ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=verify_then_outreach`}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        title="Sent to verification queue — click to view in the prospect queue"
                      >
                        <Check className="h-2.5 w-2.5" />
                        Sent
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleQueueOne(i, u.businessName, 'verify_then_outreach')}
                        disabled={queueingIdx === i || queuedFeedback[i] === 'queued'}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 disabled:opacity-50"
                        title={`Send ${u.businessName} to phone verification (NAP/digital presence unverified)`}
                      >
                        {queueingIdx === i ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Phone className="h-2.5 w-2.5" />}
                        Verify
                      </button>
                    )}
                    {queuedFeedback[i] === 'already' && (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=queued`}
                        className="text-[9px] text-slate-400 hover:text-slate-600 hover:underline"
                        title="Already in the queue — click to view"
                      >
                        already
                      </Link>
                    )}
                    {queuedFeedback[i] === 'exists' && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400">campaign exists</span>
                    )}
                    {createdCampaignId[i] ? (
                      <Link
                        href={`/settings/admin/marketing-ops/campaigns/${createdCampaignId[i]}`}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        title="Campaign created — click to view"
                      >
                        <Check className="h-2.5 w-2.5" />
                        Created
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleCreateOne(i, u.businessName)}
                        disabled={creatingIdx === i || bulkCreating}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                      >
                        {creatingIdx === i ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
                        Create
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {matched.length === 0 && unmatched.length === 0 && (
          <p className="text-xs text-gray-400">No businesses in sync report.</p>
        )}
      </div>
    </div>
  );
}
