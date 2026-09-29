'use client';

/**
 * ArchetypeBriefingPanel — the routed sibling's briefing home.
 *
 * A routed sibling (PB-01/PB-02/PB-03/PB-04/PB-06/PB-07 — archetypes
 * A1/A2/A3/A4/A6) owns no diagnostic of its own; its briefing is a
 * `profile_repair_audit`-shaped seek execution whose prompt composes the
 * operator narrative from the deterministic archetype extract of the
 * shared business_analysis audit (injected at render as
 * {{archetype_extract}} — the same facts the owner-facing report chapter
 * renders). The analyst writes the pitch; the extract guarantees briefing
 * and report can never disagree.
 *
 * Dual execution mirrors WebsiteGapBriefingPanel: in-platform AI run
 * (POST /prompts/executions) or render → external LLM → import
 * (POST /prompts/executions/external, validated against
 * profile_repair_audit). The latest matching execution renders through
 * RepairBriefingCard unchanged — issueType carries the archetype slug.
 *
 * Self-silences unless the campaign's declared archetype maps to a
 * briefing template (A5/A7 keep their own lanes: RepairTrackPanel +
 * WebsiteGapBriefingPanel).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardPaste,
  Copy,
  Loader2,
  Play,
  ScrollText,
  Target,
} from 'lucide-react';
import marketingOpsService, {
  CampaignDetail,
  PromptExecution,
} from '@/services/MarketingOpsService';
import RepairBriefingCard from './RepairBriefingCard';
import CollapsiblePanel from './CollapsiblePanel';

/** Declared archetype → briefing seek template (seeded by seed-archetype-briefing-templates). */
const ARCHETYPE_TEMPLATES: Record<string, { templateId: string; label: string }> = {
  A1: { templateId: 'mpt-archetype-briefing-a1', label: 'Review Gap & Acceleration' },
  A2: { templateId: 'mpt-archetype-briefing-a2', label: 'Negative Review Recovery' },
  A3: { templateId: 'mpt-archetype-briefing-a3', label: 'Listing Drift & Visual Refresh' },
  A4: { templateId: 'mpt-archetype-briefing-a4', label: 'CTA & Friction Gap' },
  A6: { templateId: 'mpt-archetype-briefing-a6', label: 'Product Visibility' },
};

interface Props {
  campaign: CampaignDetail;
  onRefresh?: () => void;
}

export default function ArchetypeBriefingPanel({ campaign, onRefresh }: Props) {
  const [runMode, setRunMode] = useState<'ai' | 'external'>('ai');
  const [execution, setExecution] = useState<PromptExecution | null>(null);
  const [renderedPrompt, setRenderedPrompt] = useState('');
  const [pastedOutput, setPastedOutput] = useState('');
  const [busy, setBusy] = useState<'run' | 'render' | 'import' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  const archetype = (campaign as any).archetype as string | null | undefined;
  const target = archetype ? ARCHETYPE_TEMPLATES[archetype] : undefined;

  const loadLatest = useCallback(async () => {
    try {
      const execs = await marketingOpsService.listExecutions({ campaignId: campaign.id });
      const latest = execs
        .filter((e) => e.template_id === target?.templateId)
        .sort((a, b) => (b.executed_at || '').localeCompare(a.executed_at || ''))[0];
      if (!latest) {
        setExecution(null);
        return;
      }
      const full = await marketingOpsService.getExecution(latest.id);
      setExecution(full ?? latest);
    } catch {
      setExecution(null);
    }
  }, [campaign.id, target?.templateId]);

  useEffect(() => {
    setExecution(null);
    void loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLatest, campaign.stage]);

  if (!target) return null;

  const handleRun = async () => {
    setBusy('run');
    setError(null);
    try {
      await marketingOpsService.createExecution({
        campaign_id: campaign.id,
        template_id: target.templateId,
      });
      await loadLatest();
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'Failed to run archetype briefing');
    } finally {
      setBusy(null);
    }
  };

  const handleRenderPrompt = async () => {
    setBusy('render');
    setError(null);
    try {
      const text = await marketingOpsService.renderPrompt(target.templateId, campaign.id);
      setRenderedPrompt(text);
    } catch (err: any) {
      setError(err.message || 'Failed to render briefing prompt');
    } finally {
      setBusy(null);
    }
  };

  const handleCopyPrompt = async () => {
    if (!renderedPrompt) return;
    try {
      await navigator.clipboard.writeText(renderedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // textarea is selectable as fallback
    }
  };

  const handleImport = async () => {
    if (!pastedOutput.trim()) {
      setError('Paste the external LLM output before importing');
      return;
    }
    setBusy('import');
    setError(null);
    setImportErrors(null);
    try {
      await marketingOpsService.createExternalExecution({
        campaign_id: campaign.id,
        template_id: target.templateId,
        raw_output: pastedOutput,
        source: 'external',
      });
      setPastedOutput('');
      await loadLatest();
      onRefresh?.();
    } catch (err: any) {
      setImportErrors([err.message || 'validation error']);
    } finally {
      setBusy(null);
    }
  };

  return (
    <CollapsiblePanel
      icon={<Target className="w-5 h-5 text-indigo-500" />}
      title="Archetype Briefing"
      subtitle={`${target.label} — composed from the same extract this sibling's report chapter renders.`}
      headerRight={
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5">
          <button
            onClick={() => setRunMode('ai')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
              runMode === 'ai'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            AI Run
          </button>
          <button
            onClick={() => setRunMode('external')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
              runMode === 'external'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            External
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {runMode === 'ai' ? (
          <button
            onClick={handleRun}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
          >
            {busy === 'run' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {execution ? 'Re-run briefing' : 'Run briefing'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRenderPrompt}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-neutral-800 border border-indigo-300 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md disabled:opacity-50"
              >
                {busy === 'render' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScrollText className="w-3.5 h-3.5" />}
                Render Prompt
              </button>
              {renderedPrompt && (
                <button
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/30 rounded-md"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy prompt'}
                </button>
              )}
            </div>
            {renderedPrompt && (
              <textarea
                readOnly
                value={renderedPrompt}
                rows={8}
                className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-3 text-[11px] font-mono text-gray-700 dark:text-gray-300"
              />
            )}
            <textarea
              value={pastedOutput}
              onChange={(e) => setPastedOutput(e.target.value)}
              placeholder='Paste the external LLM JSON output here (must contain a "profile_repair_audit" object)...'
              rows={5}
              className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-[11px] font-mono text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={handleImport}
              disabled={busy !== null || !pastedOutput.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
            >
              {busy === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
              Import result
            </button>
            {importErrors && (
              <p className="text-xs text-red-600 dark:text-red-400">{importErrors.join('; ')}</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {execution && <RepairBriefingCard execution={execution} campaignId={campaign.id} collapsible={false} />}
      </div>
    </CollapsiblePanel>
  );
}
