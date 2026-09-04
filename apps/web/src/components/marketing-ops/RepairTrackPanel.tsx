'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle, Loader2, Sparkles, ShieldAlert, Wrench, Target, MessageSquare, TrendingDown, Lightbulb, Copy, ClipboardPaste, FileText } from 'lucide-react';
import marketingOpsService, { Campaign, RepairTrack, TriageRecommendation } from '@/services/MarketingOpsService';

interface RepairTrackPanelProps {
  campaign: Campaign;
  onRefresh: () => void;
}

const TRIAGE_TEMPLATE_ID = 'mpt-profile-repair-triage-default';

export default function RepairTrackPanel({ campaign, onRefresh }: RepairTrackPanelProps) {
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchTrack, setSwitchTrack] = useState<RepairTrack>('standard');
  const [switchReason, setSwitchReason] = useState('');
  const [switchIssueType, setSwitchIssueType] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Triage state
  const [triaging, setTriaging] = useState(false);
  const [recommendation, setRecommendation] = useState<TriageRecommendation | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Opener-from-briefing state
  const [creatingOpener, setCreatingOpener] = useState(false);
  const [openerResult, setOpenerResult] = useState<{ created: boolean; warnings?: string[]; error?: string } | null>(null);

  // External execute/import (copy-paste bridge) state
  const [triageMode, setTriageMode] = useState<'ai' | 'external'>('ai');
  const [rendering, setRendering] = useState(false);
  const [renderedPrompt, setRenderedPrompt] = useState<string | null>(null);
  const [pastedOutput, setPastedOutput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ passed: boolean; errors?: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  // Rehydrate the briefing from the campaign row on mount/refresh. The backend
  // persists it at triage execution time (§2), so it survives page refresh and
  // track confirmation. Falls back to null when no triage has run yet.
  useEffect(() => {
    const persisted = campaign.repair_triage_briefing;
    if (persisted) {
      setRecommendation(persisted as TriageRecommendation);
    }
  }, [campaign.repair_triage_briefing]);

  // Render for profile_repair campaigns, triage_management campaigns (PB-05
  // sets triage_management — the repair triage briefing is the bridge from
  // triage to the repair track), or any campaign with a persisted briefing.
  if (
    campaign.campaign_category !== 'profile_repair' &&
    campaign.campaign_category !== 'triage_management' &&
    !campaign.repair_triage_briefing
  ) {
    return null;
  }

  const currentTrack = (campaign as any).repair_track as RepairTrack | null;
  const issueType = (campaign as any).repair_issue_type as string | null;
  const trackDecidedAt = (campaign as any).track_decided_at as string | null;
  const trackDecisionReason = (campaign as any).track_decision_reason as string | null;

  const handleRunTriage = async () => {
    setTriaging(true);
    setError(null);
    try {
      // Always pass the triage template ID explicitly. executeSeekSync resolves
      // the template from campaign.repair_issue_type when no templateId is
      // given — after track confirmation that field is set (e.g. nap_drift),
      // so a bare call would silently run the per-issue seek instead and
      // return recommendation: null.
      const result = await marketingOpsService.runRepairTriage(campaign.id, TRIAGE_TEMPLATE_ID);
      if (result.recommendation) {
        setRecommendation(result.recommendation);
      } else {
        setError('AI triage completed but did not return a structured recommendation. You can set the track manually.');
      }
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to run triage analysis');
    } finally {
      setTriaging(false);
    }
  };

  const handleRenderPrompt = async () => {
    setRendering(true);
    setError(null);
    try {
      const result = await marketingOpsService.renderRepairTriage(campaign.id, TRIAGE_TEMPLATE_ID);
      setRenderedPrompt(result.renderedPrompt);
    } catch (err: any) {
      setError(err.message || 'Failed to render triage prompt');
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
      const result = await marketingOpsService.importRepairTriage(campaign.id, pastedOutput, TRIAGE_TEMPLATE_ID);
      setImportResult({ passed: result.passed, errors: result.errors });
      if (result.passed) {
        // Briefing is persisted on the campaign row; onRefresh rehydrates it
        // via the useEffect above. Clear the paste buffer on success.
        setPastedOutput('');
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import external triage result');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmRecommendation = async () => {
    if (!recommendation) return;
    setConfirming(true);
    setError(null);
    try {
      await marketingOpsService.switchRepairTrack(campaign.id, {
        to_track: recommendation.recommended_track,
        reason: recommendation.rationale || `Confirmed AI triage recommendation (${recommendation.recommended_track})`,
        issue_type: recommendation.issue_type_confirmed || undefined,
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm track recommendation');
    } finally {
      setConfirming(false);
    }
  };

  const handleOpenOverride = () => {
    if (recommendation) {
      setSwitchTrack(recommendation.recommended_track === 'standard' ? 'escalated' : 'standard');
      setSwitchReason(recommendation.rationale || '');
      setSwitchIssueType(recommendation.issue_type_confirmed || '');
    } else {
      setSwitchTrack('standard');
      setSwitchReason('');
      setSwitchIssueType('');
    }
    setShowSwitchDialog(true);
  };

  const handleSwitch = async () => {
    if (!switchReason.trim()) {
      setError('A reason is required for track switches');
      return;
    }
    setSwitching(true);
    setError(null);
    try {
      await marketingOpsService.switchRepairTrack(campaign.id, {
        to_track: switchTrack,
        reason: switchReason,
        issue_type: switchIssueType || undefined,
      });
      setShowSwitchDialog(false);
      setSwitchReason('');
      setSwitchIssueType('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to switch track');
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateOpener = async () => {
    if (!recommendation?.pitch?.opener_hook) return;
    setCreatingOpener(true);
    setOpenerResult(null);
    try {
      const result = await marketingOpsService.createOpenerFromBriefing({
        campaign_id: campaign.id,
        opener_text: recommendation.pitch.opener_hook,
        primary_angle: recommendation.pitch.primary_angle,
        source_briefing: 'triage',
        execution_id: recommendation._execution_id,
      });
      const issues = (result as any)?.qualityGate?.issues;
      setOpenerResult({
        created: true,
        warnings: Array.isArray(issues) && issues.length > 0 ? issues : undefined,
      });
    } catch (err: any) {
      setOpenerResult({ created: false, error: err.message || 'Failed to create opener' });
    } finally {
      setCreatingOpener(false);
    }
  };

  const STANDARD_ISSUES = ['nap_drift', 'unclaimed_profile', 'missing_category', 'missing_hours', 'platform_gap'];
  const ESCALATED_ISSUES = ['suspension', 'duplicate_listing', 'hijacked_listing', 'ownership_dispute', 'address_verification_block'];

  const getSeverityBadgeColor = (score: number) => {
    if (score >= 7) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-800';
    if (score >= 4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Repair Track</h3>
        </div>
        {currentTrack && (
          <button
            onClick={() => {
              setSwitchTrack(currentTrack === 'standard' ? 'escalated' : 'standard');
              setSwitchReason('');
              setSwitchIssueType(issueType || '');
              setShowSwitchDialog(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Switch Track
          </button>
        )}
      </div>

      {/* Current track status or Triage Workflow */}
      <div className="space-y-4">
        {!currentTrack ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Triage — Track Not Yet Decided</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Run AI triage analysis to produce an operator briefing — scope, viability, pitch angle, and risks — and recommend a repair track.
                  </p>
                </div>
              </div>
              {/* Segmented toggle: AI Run (sync OpenAI) vs External (copy-paste bridge) */}
              <div className="inline-flex rounded-lg border border-amber-300 dark:border-amber-800/60 bg-white dark:bg-neutral-800 p-0.5 shrink-0">
                <button
                  onClick={() => setTriageMode('ai')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    triageMode === 'ai'
                      ? 'bg-purple-600 text-white'
                      : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  AI Run
                </button>
                <button
                  onClick={() => setTriageMode('external')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    triageMode === 'external'
                      ? 'bg-purple-600 text-white'
                      : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  <ClipboardPaste className="w-3 h-3" />
                  External
                </button>
              </div>
            </div>

            {/* AI Run mode — synchronous OpenAI execution */}
            {triageMode === 'ai' && (
              <div className="flex justify-end">
                <button
                  onClick={handleRunTriage}
                  disabled={triaging}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {triaging ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Run Triage Analysis
                    </>
                  )}
                </button>
              </div>
            )}

            {/* External mode — copy-paste bridge for any external LLM.
                Renders the prompt text, then accepts pasted output and imports
                it via /repair-triage/import. Bypasses the sync OpenAI path
                (useful when credits are exhausted or a different model is
                preferred). The imported briefing is persisted on the campaign
                row and rehydrated by the useEffect above. */}
            {triageMode === 'external' && (
              <div className="space-y-3 p-3.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/10">
                {/* Step 1: Render prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Step 1 — Render prompt
                    </p>
                    <button
                      onClick={handleRenderPrompt}
                      disabled={rendering}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-900/30 hover:bg-purple-200/70 dark:hover:bg-purple-900/50 rounded-md transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={renderedPrompt}
                        rows={8}
                        className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-purple-200 dark:border-purple-800/60 rounded-lg p-2.5 text-gray-700 dark:text-gray-300 resize-y"
                        placeholder="Rendered prompt will appear here..."
                      />
                      <p className="text-[11px] text-purple-600 dark:text-purple-400">
                        Copy this prompt into any external LLM, then paste the JSON response below.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Click <span className="font-medium">Render Prompt</span> to generate the triage prompt text for an external LLM.
                    </p>
                  )}
                </div>

                {/* Step 2: Paste output + import */}
                <div className="space-y-2 border-t border-purple-200/60 dark:border-purple-800/40 pt-2.5">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    Step 2 — Paste external output & import
                  </p>
                  <textarea
                    value={pastedOutput}
                    onChange={(e) => setPastedOutput(e.target.value)}
                    rows={6}
                    placeholder='Paste the external LLM JSON output here (must contain a "profile_repair_triage" object)...'
                    className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2.5 text-gray-700 dark:text-gray-300 resize-y focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      {importResult && (
                        <p className={`text-[11px] ${importResult.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {importResult.passed
                            ? 'Imported successfully — briefing saved.'
                            : `Import failed: ${importResult.errors?.join('; ') ?? 'validation error'}`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleImportResult}
                      disabled={importing || !pastedOutput.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                    >
                      {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
                      Import Result
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            currentTrack === 'escalated'
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <CheckCircle className={`w-4 h-4 ${
              currentTrack === 'escalated' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`} />
            <div className="flex-1">
              <p className={`text-xs font-medium ${
                currentTrack === 'escalated' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
              }`}>
                {currentTrack === 'escalated' ? 'Escalated (Recovery Pipeline)' : 'Standard (Review Pipeline)'}
              </p>
              {issueType && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Issue: {issueType.replace(/_/g, ' ')}
                </p>
              )}
            </div>
            <button
              onClick={handleRunTriage}
              disabled={triaging}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 rounded-lg transition-colors shrink-0"
            >
              {triaging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Re-running...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Re-run Triage
                </>
              )}
            </button>
          </div>
        )}

        {/* Recommendation Card — rendered in both pre-confirm and post-confirm
            states. Rehydrated from campaign.repair_triage_briefing (§2) so it
            survives page refresh. Confirm/override buttons only show before
            track confirmation; after confirmation only re-run is available. */}
        {recommendation && (
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-purple-200/60 dark:border-purple-800/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                      AI Triage Briefing
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityBadgeColor(recommendation.severity_score)}`}>
                      Severity {recommendation.severity_score}/10
                    </span>
                    {recommendation._validated === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-800" title="AI output did not pass strict schema validation — best-effort extraction was used">
                        <AlertTriangle className="w-3 h-3" />
                        Unverified
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                    recommendation.recommended_track === 'escalated'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}>
                    {recommendation.recommended_track === 'escalated' ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Escalated (Recovery)
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5" />
                        Standard (Review)
                      </>
                    )}
                  </span>
                </div>

                {/* Scope section */}
                {recommendation.scope && (
                  <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-medium">
                      <Target className="w-3.5 h-3.5" />
                      Scope
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed pl-5">
                      {recommendation.scope.summary}
                    </p>
                    {recommendation.scope.broken_platforms.length > 0 && (
                      <p className="pl-5">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Broken platforms: </span>
                        {recommendation.scope.broken_platforms.join(', ')}
                      </p>
                    )}
                    {recommendation.scope.drift_details && (
                      <p className="pl-5">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Drift: </span>
                        {recommendation.scope.drift_details}
                      </p>
                    )}
                    {recommendation.scope.missing_assets.length > 0 && (
                      <p className="pl-5">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Missing: </span>
                        {recommendation.scope.missing_assets.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Viability section */}
                {recommendation.viability && (
                  <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Viability
                    </div>
                    <div className="pl-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        recommendation.viability.pursuit_recommendation === 'pursue'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : recommendation.viability.pursuit_recommendation === 'pursue_with_caveats'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {recommendation.viability.pursuit_recommendation.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed pl-5">
                      {recommendation.viability.rationale}
                    </p>
                  </div>
                )}

                {/* Pitch section */}
                {recommendation.pitch && (
                  <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Pitch Angle
                    </div>
                    <p className="pl-5">
                      <span className="font-medium text-gray-900 dark:text-gray-100">Angle: </span>
                      {recommendation.pitch.primary_angle}
                    </p>
                    <div className="pl-5 mt-1 p-2 rounded bg-purple-100/50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30">
                      <p className="italic text-gray-700 dark:text-gray-300">
                        "{recommendation.pitch.opener_hook}"
                      </p>
                    </div>
                    {/* Create Opener from Hook — wires the AI briefing's opener
                        hook into the Openers workspace as a real opener variant.
                        Upserts in place (one opener per campaign). */}
                    <div className="pl-5 mt-1.5 flex items-center gap-2">
                      <button
                        onClick={handleCreateOpener}
                        disabled={creatingOpener}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {creatingOpener ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Create Opener from Hook
                      </button>
                      {openerResult?.created && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          <span>Opener created</span>
                          {openerResult.warnings && openerResult.warnings.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400" title={openerResult.warnings.join('\n')}>
                              ({openerResult.warnings.length} warning{openerResult.warnings.length === 1 ? '' : 's'})
                            </span>
                          )}
                        </div>
                      )}
                      {openerResult && !openerResult.created && openerResult.error && (
                        <span className="text-xs text-red-600 dark:text-red-400">{openerResult.error}</span>
                      )}
                    </div>
                    {recommendation.pitch.pain_points.length > 0 && (
                      <div className="pl-5 mt-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Pain points: </span>
                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                          {recommendation.pitch.pain_points.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {recommendation.pitch.marketplace_positioning && (
                      <p className="pl-5 mt-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Market position: </span>
                        {recommendation.pitch.marketplace_positioning}
                      </p>
                    )}
                  </div>
                )}

                {/* Risks section */}
                {recommendation.risks && recommendation.risks.length > 0 && (
                  <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Risks
                    </div>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 pl-5">
                      {recommendation.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}

                {/* Confirmed issue + rationale */}
                <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300 pt-1 border-t border-purple-200/40 dark:border-purple-800/30">
                  <p>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Confirmed Issue: </span>
                    <span className="capitalize">{recommendation.issue_type_confirmed?.replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Track Rationale: </span>
                    {recommendation.rationale}
                  </p>
                </div>

                {((recommendation.escalation_signals && recommendation.escalation_signals.length > 0) ||
                  (recommendation.standard_signals && recommendation.standard_signals.length > 0)) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recommendation.escalation_signals?.map((s) => (
                      <span key={s} className="px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                        {s}
                      </span>
                    ))}
                    {recommendation.standard_signals?.map((s) => (
                      <span key={s} className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-300 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-purple-200/60 dark:border-purple-800/40">
                  {!currentTrack && (
                    <>
                      <button
                        onClick={handleConfirmRecommendation}
                        disabled={confirming}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                      >
                        {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Confirm {recommendation.recommended_track === 'escalated' ? 'Escalated' : 'Standard'} Track
                      </button>
                      <button
                        onClick={handleOpenOverride}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-900/30 hover:bg-purple-200/70 dark:hover:bg-purple-900/50 rounded-lg transition-colors"
                      >
                        Override / Custom...
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

        {error && (
          <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-800">
            <span>{error}</span>
            <button
              onClick={() => { setError(null); handleRunTriage(); }}
              className="text-xs font-medium underline hover:no-underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {trackDecidedAt && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            <p>Decided: {new Date(trackDecidedAt).toLocaleString()}</p>
            {trackDecisionReason && <p className="mt-1">Reason: {trackDecisionReason}</p>}
          </div>
        )}
      </div>

      {/* Switch / Override Track Dialog */}
      {showSwitchDialog && (
        <div className="mt-4 rounded-lg border border-purple-200 dark:border-purple-800 p-4 bg-purple-50 dark:bg-purple-900/10">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            {currentTrack ? `Switch to ${switchTrack === 'escalated' ? 'Escalated' : 'Standard'} Track` : `Set Track: ${switchTrack === 'escalated' ? 'Escalated' : 'Standard'}`}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Target Track
              </label>
              <select
                value={switchTrack}
                onChange={(e) => setSwitchTrack(e.target.value as RepairTrack)}
                className="w-full text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2"
              >
                <option value="standard">Standard (Review Pipeline — Listing Drift / Fix Package)</option>
                <option value="escalated">Escalated (Recovery Pipeline — Suspension / Appeals)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Reason (required)
              </label>
              <textarea
                value={switchReason}
                onChange={(e) => setSwitchReason(e.target.value)}
                rows={2}
                placeholder="Why are you choosing or switching this track?"
                className="w-full text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Issue Type (optional)
              </label>
              <select
                value={switchIssueType}
                onChange={(e) => setSwitchIssueType(e.target.value)}
                className="w-full text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2"
              >
                <option value="">— Keep current / auto —</option>
                <optgroup label="Standard">
                  {STANDARD_ISSUES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </optgroup>
                <optgroup label="Escalated">
                  {ESCALATED_ISSUES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSwitch}
                disabled={switching}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {switching ? 'Saving...' : 'Confirm Track'}
              </button>
              <button
                onClick={() => { setShowSwitchDialog(false); setError(null); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-700 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

