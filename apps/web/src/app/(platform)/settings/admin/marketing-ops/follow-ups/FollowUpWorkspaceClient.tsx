'use client';

/**
 * FollowUpWorkspaceClient — Follow-up message generation workspace
 *
 * Patterned after OpenerWorkspaceClient. Key differences:
 *   - Requires an opener to exist for the selected campaign (follow-ups
 *     build on the opener's archetype + close_variant)
 *   - Shows the doing/telling branch auto-selected by the fresh-snapshot
 *     diff, with the data diff displayed for transparency
 *   - The close variant is inherited from the opener (displayed as
 *     read-only, not selectable)
 *   - Shows the follow-up number (1, 2, 3...) in the sequence
 *
 * Workflow:
 *   1. Select a campaign (must have an opener)
 *   2. System re-pulls fresh data, diffs against opener, auto-selects
 *      doing/telling branch
 *   3. Operator reviews the resolved prompt + branch + diff
 *   4. Execute (AI generation) or Import (external paste)
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Copy, Upload, AlertTriangle, CheckCircle, XCircle, Mail, MailOpen } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  Campaign,
  FollowUpResolution,
  FollowUpResult,
  OutreachFollowUp,
  FollowUpType,
  CloseVariant,
} from '@/services/MarketingOpsService';

const CLOSE_VARIANT_LABELS: Record<CloseVariant, { label: string; hint: string }> = {
  soft: {
    label: 'Soft close',
    hint: `Ambiguity by design — "Full deliverable's ready within a day if any of it's useful." Optimized for response rate; introduce payment on the reply.`,
  },
  direct_paid: {
    label: 'Direct paid close',
    hint: `Commercial intent up front — "The full deliverable's a paid engagement, ready within a day if any of the previews land." Optimized for reply quality; filters freebie-seekers immediately.`,
  },
};

const FOLLOWUP_TYPE_LABELS: Record<FollowUpType, { label: string; color: string; bg: string; hint: string }> = {
  doing: {
    label: 'Doing',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-100 dark:bg-green-900/30',
    hint: 'Footprint changed since opener — follow-up shows new proof (new reviews, new responses drafted). Aligns with the opener\'s showing-not-telling philosophy.',
  },
  telling: {
    label: 'Telling',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-neutral-700',
    hint: 'Footprint unchanged — follow-up reminds the prospect of existing previews. Fallback when there\'s nothing new to show.',
  },
};

export default function FollowUpWorkspaceClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [followUps, setFollowUps] = useState<OutreachFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const [resolution, setResolution] = useState<FollowUpResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [operatorName, setOperatorName] = useState('');

  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FollowUpResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, followUpsData] = await Promise.all([
        marketingOpsService.listCampaigns(),
        marketingOpsService.listFollowUps(),
      ]);
      setCampaigns(campaignsData.items);
      setFollowUps(followUpsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prefill operator name from branding config (same as opener workspace).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await marketingOpsService.getActiveBrandingConfig();
        if (!cancelled && active?.operator_name && !operatorName) {
          setOperatorName(active.operator_name);
        }
      } catch {
        // Branding config is optional.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve follow-up when campaign is selected or operator name changes.
  const fetchResolution = useCallback(async () => {
    if (!selectedCampaignId) {
      setResolution(null);
      return;
    }
    setResolving(true);
    setResolveError(null);
    try {
      const res = await marketingOpsService.resolveFollowUp(
        selectedCampaignId,
        undefined, // close variant inherited from opener
        operatorName || undefined,
      );
      setResolution(res);
      // Also fetch existing follow-ups for this campaign.
      const existing = await marketingOpsService.listFollowUps(selectedCampaignId);
      setFollowUps(existing);
    } catch (err: any) {
      setResolution(null);
      setResolveError(err.message || 'Failed to resolve follow-up');
    } finally {
      setResolving(false);
    }
  }, [selectedCampaignId, operatorName]);

  useEffect(() => {
    fetchResolution();
  }, [fetchResolution]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleExecute = async () => {
    if (!selectedCampaignId) return;
    setExecuting(true);
    setExecuteError(null);
    try {
      const result = await marketingOpsService.executeFollowUp(
        selectedCampaignId,
        resolution?.closeVariant,
        operatorName || undefined,
      );
      setLastResult(result);
      setResultOpen(true);
      // Refresh follow-ups list.
      const existing = await marketingOpsService.listFollowUps(selectedCampaignId);
      setFollowUps(existing);
    } catch (err: any) {
      setExecuteError(err.message || 'Failed to execute follow-up');
    } finally {
      setExecuting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCampaignId || !importText.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await marketingOpsService.importFollowUp(
        selectedCampaignId,
        importText.trim(),
        resolution?.closeVariant,
        resolution?.followUpType,
        operatorName || undefined,
      );
      setLastResult(result);
      setResultOpen(true);
      setImportSuccess(`Imported follow-up ${result.followUp.id}`);
      setImportText('');
      // Refresh follow-ups list.
      const existing = await marketingOpsService.listFollowUps(selectedCampaignId);
      setFollowUps(existing);
    } catch (err: any) {
      setImportError(err.message || 'Failed to import follow-up');
    } finally {
      setImporting(false);
    }
  };

  const handleCopy = () => {
    if (resolution?.resolvedPrompt) {
      navigator.clipboard.writeText(resolution.resolvedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasResolution = !!resolution;
  const campaignFollowUps = followUps.filter((f) => f.campaign_id === selectedCampaignId);

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

  return (
    <div className="space-y-6">
      {/* ─── Campaign Selector ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Campaign</h2>
        <select
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select a campaign —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.business_name} · {c.city} · {c.stage}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Follow-ups require an opener to exist for the selected campaign. The opener&apos;s archetype and close variant are inherited.
        </p>
      </div>

      {/* ─── Resolve Error ──────────────────────────────────────────────── */}
      {resolveError && selectedCampaignId && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-700 dark:text-amber-400">{resolveError}</p>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              <Link href="/settings/admin/marketing-ops/openers" className="underline">
                Generate an opener first
              </Link>{' '}
              in the Opener Workspace, then return here to create a follow-up.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Resolution + Execute + Import */}
        <div className="space-y-4">
          {/* Resolution Summary */}
          {hasResolution && resolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Resolution</h2>

              {/* Opener reference */}
              <div className="mb-3 flex items-center gap-2 text-xs">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Opener:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{resolution.opener.archetype}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {resolution.opener.close_variant ?? 'soft'}
                </span>
              </div>

              {/* Follow-up number */}
              <div className="mb-3 flex items-center gap-2 text-xs">
                <MailOpen className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-gray-500 dark:text-gray-400">Follow-up #:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{resolution.followUpNumber}</span>
              </div>

              {/* Branch selection (auto) */}
              <div className="mb-3">
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Branch (auto-selected from data diff)
                </span>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${FOLLOWUP_TYPE_LABELS[resolution.followUpType].bg} ${FOLLOWUP_TYPE_LABELS[resolution.followUpType].color}`}>
                  {FOLLOWUP_TYPE_LABELS[resolution.followUpType].label}
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {FOLLOWUP_TYPE_LABELS[resolution.followUpType].hint}
                </p>
              </div>

              {/* Data diff (doing branch only) */}
              {resolution.dataDiff && (
                <div className="mb-3">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Data diff (what changed since opener)
                  </span>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {JSON.stringify(resolution.dataDiff, null, 2)}
                  </pre>
                </div>
              )}

              {/* Close variant (inherited, read-only) */}
              <div className="mb-3">
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Close variant (inherited from opener)
                </span>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                  resolution.closeVariant === 'direct_paid'
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                }`}>
                  {CLOSE_VARIANT_LABELS[resolution.closeVariant]?.label ?? resolution.closeVariant}
                </div>
              </div>
            </div>
          )}

          {/* Execute */}
          {selectedCampaignId && hasResolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Execute</h2>

              {/* Operator name */}
              <div className="mb-4">
                <label htmlFor="operator-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Operator name
                </label>
                <input
                  id="operator-name"
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. Alex"
                  maxLength={120}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Substituted for &quot;[your name]&quot; in the signoff. Prefilled from your active branding config.
                </p>
              </div>

              <button
                onClick={handleExecute}
                disabled={executing || !hasResolution}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {executing ? 'Generating...' : `Execute Follow-up #${resolution?.followUpNumber ?? ''}`}
              </button>
              {executeError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{executeError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Runs fresh-snapshot diff + AI generation + quality gate. The branch ({resolution?.followUpType}) is auto-selected from the data diff.
              </p>
            </div>
          )}

          {/* Import */}
          {selectedCampaignId && hasResolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Import (External Paste)</h2>
              <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
                Copy the resolved prompt → run in ChatGPT/Claude → paste the result here.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste the generated follow-up text here..."
                rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import Follow-up'}
              </button>
              {importError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{importError}</p>
              )}
              {importSuccess && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{importSuccess}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Resolved Prompt + Result + Existing Follow-Ups */}
        <div className="space-y-4">
          {/* Resolved Prompt */}
          {hasResolution && resolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Resolved Prompt</h2>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
                Copy this prompt and run it in ChatGPT/Claude, then paste the result in the Import panel.
              </p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-96 overflow-y-auto">
                {resolution.resolvedPrompt}
              </pre>
            </div>
          )}

          {/* Result */}
          {resultOpen && lastResult && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Result</h2>
                <button
                  onClick={() => setResultOpen(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Close
                </button>
              </div>

              {/* Quality gate */}
              <div className="mb-3 flex items-center gap-2">
                {lastResult.qualityGate.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-xs font-medium ${lastResult.qualityGate.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  Quality gate {lastResult.qualityGate.passed ? 'passed' : 'failed'}
                </span>
                {lastResult.qualityGate.issues.length > 0 && (
                  <span className="text-xs text-gray-400">({lastResult.qualityGate.issues.length} issues)</span>
                )}
              </div>
              {lastResult.qualityGate.issues.length > 0 && (
                <ul className="mb-3 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                  {lastResult.qualityGate.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}

              {/* Follow-up text */}
              <div className="mb-3">
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Follow-up text</span>
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 whitespace-pre-wrap border border-gray-100 dark:border-neutral-700">
                  {lastResult.followUp.opener_text}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {lastResult.selection.archetype}
                </span>
                <span className={`px-2 py-0.5 rounded ${FOLLOWUP_TYPE_LABELS[lastResult.followUpType].bg} ${FOLLOWUP_TYPE_LABELS[lastResult.followUpType].color}`}>
                  {FOLLOWUP_TYPE_LABELS[lastResult.followUpType].label}
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                  #{lastResult.followUp.followup_number}
                </span>
                {lastResult.followUp.operator_name && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    operator: {lastResult.followUp.operator_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Existing Follow-Ups for This Campaign */}
          {selectedCampaignId && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Follow-Ups for This Campaign ({campaignFollowUps.length})
              </h2>
              {campaignFollowUps.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">No follow-ups yet.</p>
              ) : (
                <div className="space-y-2">
                  {campaignFollowUps
                    .sort((a, b) => (a.followup_number ?? 0) - (b.followup_number ?? 0))
                    .map((fu) => (
                      <div key={fu.id} className="rounded-lg border border-gray-100 dark:border-neutral-700 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              #{fu.followup_number}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              fu.followup_type === 'doing'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                            }`}>
                              {fu.followup_type}
                            </span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{fu.source}</span>
                            {fu.quality_gate_passed ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500" />
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(fu.executed_at).toLocaleDateString()}
                          </span>
                        </div>
                        {fu.opener_text && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                            {fu.opener_text}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
