'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Play, Copy, Upload, ChevronDown, ChevronRight, ExternalLink, ArrowRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  Campaign,
  OpenerResolution,
  OpenerResult,
  OutreachOpener,
  OpenerArchetype,
  CloseVariant,
} from '@/services/MarketingOpsService';
import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import PitchConstructionPanel from './PitchConstructionPanel';

const ARCHETYPE_LABELS: Record<OpenerArchetype, string> = {
  A1: 'Review Response Gap',
  A2: 'Negative Review Recovery',
  A3: 'Listing Inconsistency',
  A4: 'Conversion / CTA Gap',
};

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

export default function OpenerWorkspaceClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [openers, setOpeners] = useState<OutreachOpener[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const [resolution, setResolution] = useState<OpenerResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Close-variant selector — split-tests soft (ambiguity) vs direct_paid
  // (confident commercial intent). Defaults to 'soft' (legacy behavior).
  // Changing it re-resolves the prompt so the operator sees the exact
  // close line that will be generated before executing or copying.
  const [closeVariant, setCloseVariant] = useState<CloseVariant>('soft');

  // Operator name — substituted for "[your name]" in the signoff at
  // resolve/execute/import time. Prefilled from the active
  // MarketingBrandingConfig on mount so the operator doesn't retype it
  // each session. Not persisted on its own; it is recorded on each
  // opener row at generate/import time so the campaign knows who
  // handled it. Editing it re-resolves the prompt so the operator
  // sees the exact signoff that will be produced.
  const [operatorName, setOperatorName] = useState('');

  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OpenerResult | null>(null);
  const [resultOpen, setResultOpen] = useState(true);

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId],
  );

  // Filter to business-scope campaigns (openers are per-business)
  const businessCampaigns = useMemo(
    () => campaigns.filter((c) => c.scope === 'business'),
    [campaigns],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const campResult = await marketingOpsService.listCampaigns({ limit: 200 });
      setCampaigns(campResult.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefill operator name from the active branding config (if any).
  // Runs once on mount; the operator can override afterwards. We don't
  // overwrite a name the operator has already typed, so this only fires
  // when the input is still empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await marketingOpsService.getActiveBrandingConfig();
        if (!cancelled && active?.operator_name && !operatorName) {
          setOperatorName(active.operator_name);
        }
      } catch {
        // Branding config is optional — ignore failures silently.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resolve archetype + prompt when campaign is selected, close variant
  // changes, or operator name changes. The operator name is part of the
  // resolved prompt (it's substituted into the signoff), so the operator
  // sees the exact opener the AI will produce before they execute.
  const fetchResolution = useCallback(async () => {
    if (!selectedCampaignId) {
      setResolution(null);
      return;
    }
    setResolving(true);
    setResolveError(null);
    try {
      const res = await marketingOpsService.resolveOpener(
        selectedCampaignId,
        closeVariant,
        operatorName || undefined,
      );
      setResolution(res);
      // Also fetch existing openers for this campaign
      const existing = await marketingOpsService.listOpeners(selectedCampaignId);
      setOpeners(existing);
      setLastResult(null); // Reset result panel on campaign/variant change
    } catch (err: any) {
      setResolveError(err.message || 'Failed to resolve opener');
      setResolution(null);
    } finally {
      setResolving(false);
    }
  }, [selectedCampaignId, closeVariant, operatorName]);

  useEffect(() => {
    fetchResolution();
  }, [fetchResolution]);

  const handleExecute = async () => {
    if (!selectedCampaignId) return;
    setExecuting(true);
    setExecuteError(null);
    try {
      const result = await marketingOpsService.executeOpener(selectedCampaignId, closeVariant, operatorName || undefined);
      setLastResult(result);
      setResultOpen(true);
      // Refresh openers list
      const existing = await marketingOpsService.listOpeners(selectedCampaignId);
      setOpeners(existing);
    } catch (err: any) {
      setExecuteError(err.message || 'Failed to execute opener');
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
      const result = await marketingOpsService.importOpener(selectedCampaignId, importText.trim(), closeVariant, operatorName || undefined);
      setLastResult(result);
      setResultOpen(true);
      setImportSuccess(`Imported opener ${result.opener.id}`);
      setImportText('');
      // Refresh openers list
      const existing = await marketingOpsService.listOpeners(selectedCampaignId);
      setOpeners(existing);
    } catch (err: any) {
      setImportError(err.message || 'Failed to import opener');
    } finally {
      setImporting(false);
    }
  };

  const handleCopy = () => {
    if (!resolution?.resolvedPrompt) return;
    navigator.clipboard.writeText(resolution.resolvedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!resolution?.resolvedPrompt) return;
    const blob = new Blob([resolution.resolvedPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opener_${selectedCampaign?.business_name?.replace(/\s+/g, '_') ?? 'prompt'}_resolved.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasResolution = !!resolution;
  const lastOpener = lastResult?.opener ?? openers[0] ?? null;

  return (
    <MarketingOpsPageShell
      title="Outreach Openers"
      subtitle="Personalized first-touch openers from campaign audit data"
      breadcrumbs={[
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Openers' },
      ]}
      actions={
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      }
    >
      {error && (
        <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Campaign Selector + Archetype + Fields + Execute */}
        <div className="space-y-4">
          {/* Campaign Selector */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Campaign</h2>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a business campaign —</option>
              {businessCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name ?? `${c.category} · ${c.city}`} ({c.stage})
                </option>
              ))}
            </select>
            {businessCampaigns.length === 0 && campaigns.length > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No business-scope campaigns found. Openers require business-scope campaigns with a business_analysis audit.
              </p>
            )}
          </div>

          {/* Detected Archetype */}
          {selectedCampaignId && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detected Archetype</h2>
              {resolving && (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Resolving...
                </p>
              )}
              {resolveError && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {resolveError}
                  </p>
                </div>
              )}
              {hasResolution && resolution && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {resolution.selection.archetype}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ARCHETYPE_LABELS[resolution.selection.archetype]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{resolution.selection.reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Extracted Fields */}
          {hasResolution && resolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Extracted Fields</h2>
              <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {JSON.stringify(resolution.extractedFields, null, 2)}
              </pre>
            </div>
          )}

          {/* Execute */}
          {selectedCampaignId && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Execute</h2>

              {/* Operator name — substituted for "[your name]" in the signoff
                  at resolve/execute/import time. Prefilled from the active
                  branding config; the operator can override. Recorded on the
                  opener row so the campaign knows who handled it. Editing it
                  re-resolves the prompt so the operator sees the exact
                  signoff that will be produced. */}
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
                  Substituted for &quot;[your name]&quot; in the signoff. Prefilled from your active branding config; recorded on the opener so the campaign knows who handled it.
                </p>
              </div>

              {/* Close-variant selector — split-tests soft vs direct_paid close.
                  Changing it re-resolves the prompt above so the operator sees
                  the exact close line before generating or copying. */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Close variant
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(CLOSE_VARIANT_LABELS) as CloseVariant[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCloseVariant(v)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        closeVariant === v
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                          : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className={`block font-semibold ${closeVariant === v ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {CLOSE_VARIANT_LABELS[v].label}
                      </span>
                      <span className="block text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                        {CLOSE_VARIANT_LABELS[v].hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Recorded on the opener row so reply outcomes can be measured per variant.
                </p>
              </div>

              <button
                onClick={handleExecute}
                disabled={executing || !hasResolution}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {executing ? 'Generating...' : 'Execute Opener'}
              </button>
              {executeError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{executeError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Runs deterministic archetype selection + AI generation + quality gate.
              </p>
            </div>
          )}
        </div>

        {/* Right: Resolved Prompt + Result + Import + Next Steps */}
        <div className="space-y-4">
          {/* Resolved Prompt */}
          {hasResolution && resolution && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Resolved Prompt</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
                Copy this prompt and run it in ChatGPT/Claude, then paste the result in the Import panel below.
              </p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                {resolution.resolvedPrompt}
              </pre>
            </div>
          )}

          {/* Opener Result */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <button
              onClick={() => setResultOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-1"
            >
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                {resultOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Opener Result
              </h2>
              {lastOpener && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  lastOpener.quality_gate_passed
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {lastOpener.quality_gate_passed ? 'gate passed' : 'gate failed'}
                </span>
              )}
            </button>
            {resultOpen && (
              <div className="mt-2">
                {!lastOpener ? (
                  <p className="text-sm text-gray-400">No opener yet. Run Execute or Import to see results here.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>ID: <code className="font-mono">{lastOpener.id}</code></span>
                      <span>{new Date(lastOpener.executed_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {lastOpener.archetype}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                        {lastOpener.source}
                      </span>
                      {lastOpener.close_variant && (
                        <span className={`px-2 py-0.5 rounded ${
                          lastOpener.close_variant === 'direct_paid'
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                        }`}>
                          close: {lastOpener.close_variant}
                        </span>
                      )}
                      {lastOpener.ai_provider && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {lastOpener.ai_provider}{lastOpener.ai_model ? ` · ${lastOpener.ai_model}` : ''}
                          {lastOpener.tokens_used > 0 && ` · ${lastOpener.tokens_used} tokens`}
                        </span>
                      )}
                      {lastOpener.operator_name && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          operator: {lastOpener.operator_name}
                        </span>
                      )}
                    </div>
                    {lastOpener.opener_text && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Opener text</p>
                        <pre className="text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                          {lastOpener.opener_text}
                        </pre>
                      </div>
                    )}
                    {lastOpener.quality_gate_issues && lastOpener.quality_gate_issues.length > 0 && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Quality gate issues:</p>
                        <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                          {lastOpener.quality_gate_issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import External Opener */}
          {selectedCampaignId && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import External Opener
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Paste the opener text returned by an external agent (e.g. ChatGPT, Claude) after running the resolved prompt above.
              </p>
              {importError && (
                <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-xs text-red-700 dark:text-red-400">{importError}</p>
                </div>
              )}
              {importSuccess && (
                <div className="mb-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <p className="text-xs text-green-700 dark:text-green-400">{importSuccess}</p>
                </div>
              )}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Hi [name] —&#10;Pulled together a quick visibility snapshot for..."
                rows={6}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-48 overflow-y-auto"
              />
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import Opener'}
              </button>
            </div>
          )}

          {/* Next Steps */}
          {selectedCampaignId && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Next Steps</h2>
              <Link
                href={`/settings/admin/marketing-ops/campaigns/${selectedCampaignId}`}
                className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
              >
                <span className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Go to campaign</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              {openers.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {openers.length} opener{openers.length !== 1 ? 's' : ''} generated for this campaign.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pitch Construction — collapsible panel below the opener workspace.
          Only renders when a campaign is selected. Lets the admin assemble
          a full outreach pitch from opener + header + 3-slot preview + closer + contact. */}
      {selectedCampaignId && (
        <PitchConstructionPanel campaignId={selectedCampaignId} openers={openers} />
      )}
    </MarketingOpsPageShell>
  );
}
