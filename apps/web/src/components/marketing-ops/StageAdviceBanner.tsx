'use client';

/**
 * StageAdviceBanner / StageAdviceChip — the pipeline-stage readiness hint for
 * the VAST surfaces.
 *
 * VAST answers "what outreach is next"; this answers "is the next pipeline
 * stage true yet". The advice is derived server-side from the same predicates
 * the transition route enforces (`StageAdviceService`), so the board cannot go
 * green on something the route will refuse. The banner's only mutation is the
 * existing `POST /:id/transition` — no new gate, no second state store
 * (FOUR_ACT_OUTREACH_CASCADE_SPEC §8).
 */

import { useState } from 'react';
import Link from 'next/link';
import marketingOpsService, {
  type BusinessAnalysisRequiredError,
  type ChecklistIncompleteError,
  type PipelineStage,
  type StageAdvice,
  type StageAdviceReadiness,
} from '@/services/MarketingOpsService';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';

export const STAGE_LABELS: Record<string, string> = {
  seek: 'Seek',
  seed: 'Seed',
  preview_built: 'Preview Built',
  shown: 'Shown',
  paid: 'Paid',
  delivered: 'Delivered',
};

const READINESS_STYLES: Record<StageAdviceReadiness, { chip: string; label: string }> = {
  ready: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    label: 'ready',
  },
  ready_with_ack: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    label: 'ready to acknowledge',
  },
  blocked: {
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    label: 'not yet',
  },
  terminal: {
    chip: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    label: 'complete',
  },
};

function stageLabel(stage: string | null): string {
  if (!stage) return '—';
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ');
}

export function StageAdviceChip({ advice }: { advice: StageAdvice | null }) {
  if (!advice || advice.readiness === 'terminal' || !advice.nextStage) return null;
  const style = READINESS_STYLES[advice.readiness];
  return (
    <span
      title={advice.tip ?? undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}
    >
      <ArrowRight className="h-3 w-3" />
      {stageLabel(advice.nextStage)}
    </span>
  );
}

export default function StageAdviceBanner({
  campaignId,
  advice,
  onAdvanced,
}: {
  campaignId: string;
  advice: StageAdvice | null;
  onAdvanced?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackSteps, setAckSteps] = useState<{ id: string; title: string }[] | null>(null);

  if (!advice) return null;

  const style = READINESS_STYLES[advice.readiness];
  const hardBlocker = advice.blockers.find((b) => b.hard) ?? null;
  const softBlockers = advice.blockers.filter((b) => !b.hard);
  const unmet = advice.checks.filter((c) => !c.met);

  const advance = async (acknowledge: boolean) => {
    if (!advice.nextStage) return;
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.transitionStage(campaignId, {
        to_stage: advice.nextStage as PipelineStage,
        acknowledge_incomplete: acknowledge,
      });
      setAckSteps(null);
      await onAdvanced?.();
    } catch (err: any) {
      if (err?.code === 'checklist_incomplete') {
        setAckSteps((err as ChecklistIncompleteError).incompleteSteps);
      } else if (err?.code === 'business_analysis_required') {
        setError((err as BusinessAnalysisRequiredError).message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to advance the stage');
      }
    } finally {
      setBusy(false);
    }
  };

  const promptsHref = `/settings/admin/marketing-ops/campaigns/${campaignId}?tab=prompts`;
  const checklistHref = `/settings/admin/marketing-ops/campaigns/${campaignId}?tab=checklist`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-white">
          Stage · {stageLabel(advice.currentStage)}
          {advice.nextStage && (
            <>
              <span className="mx-1.5 text-gray-400">→</span>
              {stageLabel(advice.nextStage)}
            </>
          )}
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}>
          {advice.readiness === 'ready' ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {style.label}
        </span>
        {advice.nextStage && (
          <button
            type="button"
            onClick={() => advance(false)}
            disabled={busy || !!hardBlocker}
            title={hardBlocker?.message ?? advice.tip ?? undefined}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            Advance to {stageLabel(advice.nextStage)}
          </button>
        )}
      </div>

      {advice.tip && (
        <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">{advice.tip}</p>
      )}

      {(unmet.length > 0 || softBlockers.length > 0) && (
        <ul className="mt-2 space-y-1">
          {advice.checks
            .filter((c) => !c.met)
            .map((c) => (
              <li key={c.key} className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                <Circle className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 dark:text-neutral-600" />
                <span>
                  {c.label}
                  {c.advisory && <span className="ml-1 text-gray-400">(advisory)</span>}
                </span>
              </li>
            ))}
          {softBlockers
            .filter((b) => !advice.checks.some((c) => !c.met && c.key === b.code))
            .map((b) => (
              <li key={`${b.code}-${b.message}`} className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <span>{b.message}</span>
              </li>
            ))}
        </ul>
      )}

      {hardBlocker && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{hardBlocker.message}</span>
          <Link href={promptsHref} className="font-medium underline">
            {hardBlocker.actionLabel ?? 'Open the Prompts tab'}
          </Link>
        </div>
      )}

      {ackSteps && ackSteps.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium">Required checklist steps are incomplete:</p>
          <ul className="mt-1 list-disc pl-4">
            {ackSteps.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <Link href={checklistHref} className="font-medium underline">
              Open the checklist
            </Link>
            <button
              type="button"
              onClick={() => advance(true)}
              disabled={busy}
              className="font-medium underline disabled:opacity-50"
            >
              Acknowledge and advance anyway
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
