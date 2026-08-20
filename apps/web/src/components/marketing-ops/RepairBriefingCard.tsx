'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Target, TrendingDown, MessageSquare, ShieldAlert, Loader2, Sparkles, CheckCircle, Wrench, ArrowRight } from 'lucide-react';
import marketingOpsService, { PromptExecution } from '@/services/MarketingOpsService';

interface RepairBriefingCardProps {
  execution: PromptExecution;
  campaignId: string;
}

interface RepairAuditOutput {
  profile_repair_audit: {
    severityScore: number;
    issueType: string;
    scope: {
      summary: string;
      affected_platforms: string[];
      specifics: string;
    };
    impact: {
      primary_consequence: string;
      estimated_reach_loss: string;
      competitive_gap: string;
    };
    pitch: {
      opener_hook: string;
      pain_points: string[];
      value_preview: string;
    };
    risks: string[];
  };
}

function parseBriefing(raw: string | null): RepairAuditOutput['profile_repair_audit'] | null {
  if (!raw) return null;
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as RepairAuditOutput;
    if (!parsed.profile_repair_audit) return null;
    const a = parsed.profile_repair_audit;
    if (!a.severityScore || !a.issueType || !a.scope || !a.impact || !a.pitch) return null;
    return a;
  } catch {
    return null;
  }
}

function getSeverityBadgeColor(score: number) {
  if (score >= 7) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-800';
  if (score >= 4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-800';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
}

export default function RepairBriefingCard({ execution, campaignId }: RepairBriefingCardProps) {
  const [creating, setCreating] = useState(false);
  const [openerResult, setOpenerResult] = useState<{ created: boolean; warnings?: string[]; error?: string } | null>(null);

  const briefing = parseBriefing(execution.raw_output);

  if (!briefing) return null;

  const handleCreateOpener = async () => {
    setCreating(true);
    setOpenerResult(null);
    try {
      const result = await marketingOpsService.createOpenerFromBriefing({
        campaign_id: campaignId,
        opener_text: briefing.pitch.opener_hook,
        primary_angle: (briefing as any).pitch?.primary_angle,
        source_briefing: 'issue_audit',
        execution_id: execution.id,
      });
      const issues = (result as any)?.quality_gate_issues;
      setOpenerResult({
        created: true,
        warnings: Array.isArray(issues) && issues.length > 0 ? issues : undefined,
      });
    } catch (err: any) {
      setOpenerResult({ created: false, error: err.message || 'Failed to create opener' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Repair Briefing</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({briefing.issueType.replace(/_/g, ' ')})
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(execution.executed_at).toLocaleString()}
        </span>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
        {/* Header: severity + issue type */}
        <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 dark:border-blue-800/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
              Issue Briefing
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityBadgeColor(briefing.severityScore)}`}>
              Severity {briefing.severityScore}/10
            </span>
          </div>
        </div>

        {/* Scope */}
        {briefing.scope && (
          <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-medium">
              <Target className="w-3.5 h-3.5" />
              Scope
            </div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed pl-5">
              {briefing.scope.summary}
            </p>
            {briefing.scope.affected_platforms.length > 0 && (
              <p className="pl-5">
                <span className="font-medium text-gray-900 dark:text-gray-100">Affected platforms: </span>
                {briefing.scope.affected_platforms.join(', ')}
              </p>
            )}
            {briefing.scope.specifics && (
              <p className="pl-5">
                <span className="font-medium text-gray-900 dark:text-gray-100">Specifics: </span>
                {briefing.scope.specifics}
              </p>
            )}
          </div>
        )}

        {/* Impact */}
        {briefing.impact && (
          <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-medium">
              <TrendingDown className="w-3.5 h-3.5" />
              Impact
            </div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed pl-5">
              <span className="font-medium text-gray-900 dark:text-gray-100">Consequence: </span>
              {briefing.impact.primary_consequence}
            </p>
            {briefing.impact.estimated_reach_loss && (
              <p className="pl-5">
                <span className="font-medium text-gray-900 dark:text-gray-100">Reach loss: </span>
                {briefing.impact.estimated_reach_loss}
              </p>
            )}
            {briefing.impact.competitive_gap && (
              <p className="pl-5">
                <span className="font-medium text-gray-900 dark:text-gray-100">Competitive gap: </span>
                {briefing.impact.competitive_gap}
              </p>
            )}
          </div>
        )}

        {/* Pitch */}
        {briefing.pitch && (
          <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-medium">
              <MessageSquare className="w-3.5 h-3.5" />
              Pitch
            </div>
            <div className="pl-5 mt-1 p-2 rounded bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30">
              <p className="italic text-gray-700 dark:text-gray-300">
                "{briefing.pitch.opener_hook}"
              </p>
            </div>
            {briefing.pitch.pain_points.length > 0 && (
              <div className="pl-5 mt-1">
                <span className="font-medium text-gray-900 dark:text-gray-100">Pain points: </span>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                  {briefing.pitch.pain_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {briefing.pitch.value_preview && (
              <p className="pl-5 mt-1">
                <span className="font-medium text-gray-900 dark:text-gray-100">Value preview: </span>
                {briefing.pitch.value_preview}
              </p>
            )}
          </div>
        )}

        {/* Risks */}
        {briefing.risks.length > 0 && (
          <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
              <ShieldAlert className="w-3.5 h-3.5" />
              Risks
            </div>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 pl-5">
              {briefing.risks.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {/* Create Opener button */}
        <div className="flex items-center gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/40">
          <button
            onClick={handleCreateOpener}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Create Opener from Hook
          </button>
          {openerResult?.created && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Opener created</span>
              {openerResult.warnings && openerResult.warnings.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400" title={openerResult.warnings.join('\n')}>
                  ({openerResult.warnings.length} warning{openerResult.warnings.length === 1 ? '' : 's'})
                </span>
              )}
              <Link
                href={`/settings/admin/marketing-ops/openers?campaign=${campaignId}`}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Open in workspace
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          {openerResult && !openerResult.created && openerResult.error && (
            <span className="text-xs text-red-600 dark:text-red-400">{openerResult.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
