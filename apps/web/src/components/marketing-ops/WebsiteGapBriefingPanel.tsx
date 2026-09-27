'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardPaste, Copy, FileText, Globe, Loader2, PencilLine, Sparkles } from 'lucide-react';
import marketingOpsService, { Audit, CampaignDetail } from '@/services/MarketingOpsService';
import { isWebsiteGapCampaign } from './repairCampaignGate';
import WebsitePositioningAuditCard from './WebsitePositioningAuditCard';

interface WebsiteGapBriefingPanelProps {
  campaign: CampaignDetail;
  onRefresh: () => void;
}

const WEBSITE_POSITIONING_TEMPLATE_ID = 'mpt-seed-website-positioning-001';

type BuildScopeChoice = 'new_build' | 'rebuild' | 'repair' | 'secure_and_refresh';
const BUILD_SCOPE_CHOICES: BuildScopeChoice[] = ['new_build', 'rebuild', 'repair', 'secure_and_refresh'];

function humanize(v: string | null | undefined): string {
  return (v ?? '').replace(/_/g, ' ');
}

/**
 * Website Gap Briefing panel (PB-08 / A7).
 *
 * PB-08 campaigns share campaign_category='profile_repair' with repair
 * campaigns but have no repair track — the RepairTrackPanel is gated out via
 * isWebsiteGapCampaign. This panel is the website-gap counterpart: the same
 * dual-execution surface (synchronous AI run, or render → external LLM →
 * import bridge) driving the dedicated Website Positioning Audit instead of
 * the repair triage template.
 *
 * The audit itself IS the briefing for this motion — presence verdict,
 * conversion-framed issues, positioning gaps vs. the category gold standard,
 * a build_scope recommendation, and outreach ammunition. There is no repair
 * track; the decision analog is build-scope confirmation — the operator
 * commits a scope (prefilled from the audit's recommendation) which persists
 * to campaign.playbook_decision (migration 309, kind='website_build_scope')
 * and can be revised.
 *
 * Execution lanes (all pre-existing generic machinery):
 *   - AI Run  → POST /prompts/executions (MarketingExecutionService.executeSingle)
 *   - Render  → GET  /prompts/templates/:id/render
 *   - Import  → POST /prompts/executions/external (validated against the
 *               website_positioning_audit schema; lands in mkt_audits_list)
 *
 * resolvePrompt auto-sources {{website_url}} (campaign.website_url — empty is
 * a valid input; no_presence is a legitimate verdict) and
 * {{prior_website_findings}} (the latest business_analysis audit's website
 * block) — both inherited audits from the triage parent flow through.
 */
export default function WebsiteGapBriefingPanel({ campaign, onRefresh }: WebsiteGapBriefingPanelProps) {
  const [runMode, setRunMode] = useState<'ai' | 'external'>('ai');
  const [running, setRunning] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderedPrompt, setRenderedPrompt] = useState<string | null>(null);
  const [pastedOutput, setPastedOutput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ passed: boolean; errors?: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build-scope decision state (the PB-08 analog of track confirmation)
  const [showScopeForm, setShowScopeForm] = useState(false);
  const [scopeChoice, setScopeChoice] = useState<BuildScopeChoice>('new_build');
  const [scopeReason, setScopeReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  // PB-08 / A7 only — repair-track campaigns use RepairTrackPanel instead.
  if (!isWebsiteGapCampaign(campaign)) return null;

  const websiteAudit: Audit | undefined = (campaign.audits ?? []).find(
    (a: Audit) => a.platform === 'website_positioning' && a.audit_data,
  );
  const auditData = (websiteAudit?.audit_data ?? {}) as any;
  const recommendedScope: BuildScopeChoice | null = BUILD_SCOPE_CHOICES.includes(auditData.build_scope?.recommended)
    ? auditData.build_scope.recommended
    : null;
  const decision = campaign.playbook_decision ?? null;

  const handleOpenScopeForm = () => {
    setScopeChoice(decision?.confirmed_scope ?? recommendedScope ?? 'new_build');
    setScopeReason('');
    setShowScopeForm(true);
  };

  const handleConfirmScope = async () => {
    if (!scopeReason.trim()) {
      setError('A reason is required for build-scope confirmation');
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      await marketingOpsService.confirmWebsiteBuildScope(campaign.id, {
        scope: scopeChoice,
        reason: scopeReason,
      });
      setShowScopeForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm build scope');
    } finally {
      setConfirming(false);
    }
  };

  const handleRunAudit = async () => {
    setRunning(true);
    setError(null);
    try {
      await marketingOpsService.createExecution({
        campaign_id: campaign.id,
        template_id: WEBSITE_POSITIONING_TEMPLATE_ID,
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to run website positioning audit');
    } finally {
      setRunning(false);
    }
  };

  const handleRenderPrompt = async () => {
    setRendering(true);
    setError(null);
    try {
      const text = await marketingOpsService.renderPrompt(WEBSITE_POSITIONING_TEMPLATE_ID, campaign.id);
      setRenderedPrompt(text);
    } catch (err: any) {
      setError(err.message || 'Failed to render positioning prompt');
    } finally {
      setRendering(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!renderedPrompt) return;
    try {
      await navigator.clipboard.writeText(renderedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the textarea is selectable as fallback
    }
  };

  const handleImportResult = async () => {
    if (!pastedOutput.trim()) {
      setError('Paste the external LLM output before importing');
      return;
    }
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await marketingOpsService.createExternalExecution({
        campaign_id: campaign.id,
        template_id: WEBSITE_POSITIONING_TEMPLATE_ID,
        raw_output: pastedOutput,
        source: 'external',
      });
      setImportResult({ passed: !!result.audit, errors: undefined });
      setPastedOutput('');
      onRefresh();
    } catch (err: any) {
      setImportResult({ passed: false, errors: [err.message || 'validation error'] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-sky-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Website Gap Briefing</h3>
          {auditData.build_scope?.recommended && (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
              build: {String(auditData.build_scope.recommended).replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Status strip + dual-execution toggle */}
        <div className={`flex items-start justify-between gap-3 p-3.5 rounded-lg border ${
          websiteAudit
            ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200/60 dark:border-sky-800/40'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/40'
        }`}>
          <div className="flex items-start gap-2.5">
            {websiteAudit ? (
              <CheckCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-xs font-semibold ${
                websiteAudit
                  ? 'text-sky-800 dark:text-sky-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {websiteAudit ? 'Positioning audit on file' : 'Briefing not yet produced'}
              </p>
              <p className={`text-xs mt-0.5 ${
                websiteAudit
                  ? 'text-sky-700 dark:text-sky-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {websiteAudit
                  ? `${String(auditData.presence_classification ?? 'verdict recorded').replace(/_/g, ' ')} — run again to refresh after the site changes.`
                  : 'Run the website positioning audit to produce the operator briefing — presence verdict, conversion-framed issues, recommended build, and outreach ammunition.'}
              </p>
            </div>
          </div>
          {/* Segmented toggle: AI Run (sync) vs External (copy-paste bridge) */}
          <div className="inline-flex rounded-lg border border-sky-300 dark:border-sky-800/60 bg-white dark:bg-neutral-800 p-0.5 shrink-0">
            <button
              onClick={() => setRunMode('ai')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                runMode === 'ai'
                  ? 'bg-sky-600 text-white'
                  : 'text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              AI Run
            </button>
            <button
              onClick={() => setRunMode('external')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                runMode === 'external'
                  ? 'bg-sky-600 text-white'
                  : 'text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20'
              }`}
            >
              <ClipboardPaste className="w-3 h-3" />
              External
            </button>
          </div>
        </div>

        {/* AI Run mode — synchronous execution via the generic prompt runner */}
        {runMode === 'ai' && (
          <div className="flex justify-end">
            <button
              onClick={handleRunAudit}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Auditing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {websiteAudit ? 'Re-run Positioning Audit' : 'Run Positioning Audit'}
                </>
              )}
            </button>
          </div>
        )}

        {/* External mode — copy-paste bridge for any external LLM. Renders the
            positioning prompt, then accepts pasted output and imports it via
            /prompts/executions/external (website_positioning_audit schema).
            Bypasses the sync AI path — useful when credits are exhausted or a
            browser-capable model is needed for render verification. */}
        {runMode === 'external' && (
          <div className="space-y-3 p-3.5 rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/10">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Step 1 — Render prompt
                </p>
                <button
                  onClick={handleRenderPrompt}
                  disabled={rendering}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {rendering ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                  {renderedPrompt ? 'Re-render' : 'Render Prompt'}
                </button>
              </div>
              {renderedPrompt ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-900/30 hover:bg-sky-200/70 dark:hover:bg-sky-900/50 rounded-md transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={renderedPrompt}
                    rows={8}
                    className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-sky-200 dark:border-sky-800/60 rounded-lg p-2.5 text-gray-700 dark:text-gray-300 resize-y"
                    placeholder="Rendered prompt will appear here..."
                  />
                  <p className="text-[11px] text-sky-600 dark:text-sky-400">
                    Copy this prompt into any external LLM, then paste the JSON response below.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Click <span className="font-medium">Render Prompt</span> to generate the positioning prompt text for an external LLM.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-sky-200/60 dark:border-sky-800/40 pt-2.5">
              <p className="text-xs font-medium text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5" />
                Step 2 — Paste external output & import
              </p>
              <textarea
                value={pastedOutput}
                onChange={(e) => setPastedOutput(e.target.value)}
                rows={6}
                placeholder='Paste the external LLM JSON output here (must contain "presence_classification" and "ownership")...'
                className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2.5 text-gray-700 dark:text-gray-300 resize-y focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  {importResult && (
                    <p className={`text-[11px] ${importResult.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {importResult.passed
                        ? 'Imported successfully — audit saved.'
                        : `Import failed: ${importResult.errors?.join('; ') ?? 'validation error'}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleImportResult}
                  disabled={importing || !pastedOutput.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
                  Import Result
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Build-scope decision — the PB-08 analog of track confirmation. The
            audit's build_scope.recommended is advisory; confirming commits the
            operator's choice to campaign.playbook_decision (migration 309).
            Only meaningful once a positioning audit is on file. */}
        {websiteAudit && decision && !showScopeForm && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Build scope confirmed: {humanize(decision.confirmed_scope)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {new Date(decision.decided_at).toLocaleDateString()}
                {decision.diverged_from_audit && decision.recommended_scope
                  ? ` · diverged from audit recommendation (${humanize(decision.recommended_scope)})`
                  : ''}
                {decision.reason ? ` · ${decision.reason}` : ''}
              </p>
            </div>
            <button
              onClick={handleOpenScopeForm}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/30 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/50 rounded-md transition-colors"
            >
              <PencilLine className="w-3 h-3" />
              Revise
            </button>
          </div>
        )}

        {websiteAudit && !decision && !showScopeForm && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-dashed border-sky-300 dark:border-sky-800/60 bg-sky-50/30 dark:bg-sky-950/10">
            <p className="text-xs text-sky-700 dark:text-sky-300">
              {recommendedScope
                ? `Audit recommends ${humanize(recommendedScope)} — confirm the build scope to commit the decision.`
                : 'No build-scope recommendation in the audit — confirm a scope to commit the decision.'}
            </p>
            <button
              onClick={handleOpenScopeForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors shrink-0"
            >
              Confirm Build Scope
            </button>
          </div>
        )}

        {showScopeForm && (
          <div className="space-y-2.5 p-3.5 rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/10">
            <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
              {decision ? 'Revise build scope' : 'Confirm build scope'}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={scopeChoice}
                onChange={(e) => setScopeChoice(e.target.value as BuildScopeChoice)}
                className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200"
              >
                {BUILD_SCOPE_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}{recommendedScope === s ? ' (audit recommended)' : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={scopeReason}
                onChange={(e) => setScopeReason(e.target.value)}
                placeholder="Reason (required)"
                className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowScopeForm(false)}
                className="px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScope}
                disabled={confirming || !scopeReason.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {decision ? 'Save Revision' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* Briefing body — the persisted website_positioning audit rendered
            with the same card the Audits tab uses, so both surfaces read
            identically. */}
        {websiteAudit && (
          <WebsitePositioningAuditCard audit={websiteAudit} campaignId={campaign.id} />
        )}
      </div>
    </div>
  );
}
