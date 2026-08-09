'use client';

/**
 * CampaignChecklistTab — Operator-facing checklist tab on the campaign page
 *
 * Shows the resolved checklist for the campaign's CURRENT effective playbook
 * (overridden if triage was overridden, recommended if accepted). Operators
 * check off steps, capture notes, and submit suggestions that flow to the
 * admin review queue on the playbook builder tab.
 *
 * Empty states:
 *   - No triage decision → points at the triage card on the Overview tab.
 *   - Triage accepted but no steps → "no checklist defined for this playbook"
 *     with a "suggest a step" affordance.
 *
 * Spec: docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md §8, §12
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle2, Circle, AlertCircle, X, Lightbulb,
  ExternalLink, ArrowUpRight, MessageSquare,
} from 'lucide-react';
import marketingOpsService, {
  type CampaignChecklistView,
  type ChecklistStepView,
  type PlaybookChecklistSuggestion,
  type SuggestionKind,
  type SuggestionPosition,
  type ChecklistStageTag,
  type ChecklistStepType,
  SUGGESTION_KINDS,
  SUGGESTION_POSITIONS,
  CHECKLIST_STAGE_TAGS,
  CHECKLIST_STAGE_TAG_LABELS,
  CHECKLIST_STEP_TYPES,
  INTERNAL_LINK_TARGETS,
  INTERNAL_LINK_TARGET_LABELS,
  OUTREACH_KINDS,
  OUTREACH_KIND_LABELS,
} from '@/services/MarketingOpsService';

interface Props {
  campaignId: string;
  currentStage?: string | null;
  onGoToTriage?: () => void;
}

const STEP_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  url_check: 'URL Check',
  internal_link: 'Internal Link',
  ai_prompt: 'AI Prompt',
  deliverable: 'Deliverable',
  outreach: 'Outreach',
  credentials: 'Credentials',
};

// Stage badge colors — pre-sale blue, fulfillment teal, retainer amber/green,
// terminal stages gray/red, tenant conversion purple.
const STAGE_TAG_COLORS: Record<string, string> = {
  seek: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preview_built: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  shown: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  retainer_pitched: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  retainer_won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  dead: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  tenant_onboarded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function StageTagBadge({ stageTag }: { stageTag: string | null }) {
  if (!stageTag) return null;
  const label = CHECKLIST_STAGE_TAG_LABELS[stageTag as ChecklistStageTag] ?? stageTag.replace(/_/g, ' ');
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${STAGE_TAG_COLORS[stageTag] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

export default function CampaignChecklistTab({ campaignId, currentStage, onGoToTriage }: Props) {
  const [view, setView] = useState<CampaignChecklistView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingStepId, setTogglingStepId] = useState<string | null>(null);
  const [noteStepId, setNoteStepId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  // Stage-aware filter: default shows steps due by the campaign's current
  // stage (untagged steps always show); "all" reveals the full playbook.
  const [stageFilter, setStageFilter] = useState<'due' | 'all'>('due');

  // Suggestion submission
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestionStep, setSuggestionStep] = useState<ChecklistStepView | null>(null);
  const [suggestionKind, setSuggestionKind] = useState<SuggestionKind>('add');
  const [suggestionPosition, setSuggestionPosition] = useState<SuggestionPosition | ''>('');
  const [suggestionStageTag, setSuggestionStageTag] = useState<ChecklistStageTag | ''>('');
  const [proposedTitle, setProposedTitle] = useState('');
  const [proposedInstructions, setProposedInstructions] = useState('');
  const [proposedStepType, setProposedStepType] = useState<ChecklistStepType | ''>('');
  const [proposedActionConfig, setProposedActionConfig] = useState<Record<string, any>>({});
  const [rationale, setRationale] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.getCampaignChecklist(campaignId);
      setView(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const handleToggle = async (step: ChecklistStepView) => {
    const wasCompleted = step.progress?.completedAt != null;
    setTogglingStepId(step.id);
    try {
      const updated = await marketingOpsService.setChecklistStepProgress(campaignId, step.id, {
        completed: !wasCompleted,
      });
      setView(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update step');
    } finally {
      setTogglingStepId(null);
    }
  };

  /** One-click mark-complete for bridge-detected outreach steps. */
  const handleMarkComplete = async (step: ChecklistStepView, note: string) => {
    setTogglingStepId(step.id);
    try {
      const updated = await marketingOpsService.setChecklistStepProgress(campaignId, step.id, {
        completed: true,
        note,
      });
      setView(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to mark step complete');
    } finally {
      setTogglingStepId(null);
    }
  };

  const handleSaveNote = async (step: ChecklistStepView) => {
    setTogglingStepId(step.id);
    try {
      const wasCompleted = step.progress?.completedAt != null;
      const updated = await marketingOpsService.setChecklistStepProgress(campaignId, step.id, {
        completed: wasCompleted,
        note: noteDraft,
      });
      setView(updated);
      setNoteStepId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setTogglingStepId(null);
    }
  };

  const openNoteEditor = (step: ChecklistStepView) => {
    setNoteDraft(step.progress?.note ?? '');
    setNoteStepId(step.id);
  };

  // ─── Suggestion submission ────────────────────────────────────────────

  const openSuggestionForm = (step: ChecklistStepView | null, kind: SuggestionKind) => {
    setSuggestionStep(step);
    setSuggestionKind(kind);
    setSuggestionPosition(kind === 'add' && step ? 'after' : '');
    setSuggestionStageTag(step?.stageTag ?? '');
    setProposedTitle(step?.title ?? '');
    setProposedInstructions(step?.instructions ?? '');
    // Pre-fill step type + action config from the anchor step (for modify)
    setProposedStepType(step?.stepType ?? '');
    setProposedActionConfig(step?.actionConfig ? { ...step.actionConfig } : {});
    setRationale('');
    setShowSuggestionForm(true);
  };

  const handleSubmitSuggestion = async () => {
    if (!rationale.trim()) {
      setError('Rationale is required — explain why this change improves the playbook');
      return;
    }
    if (suggestionKind !== 'remove' && !proposedTitle.trim()) {
      setError('Proposed step title is required');
      return;
    }
    setSubmittingSuggestion(true);
    setError(null);
    try {
      const proposedStep: Record<string, any> = { title: proposedTitle };
      if (proposedInstructions) proposedStep.instructions = proposedInstructions;
      if (suggestionStageTag) proposedStep.stage_tag = suggestionStageTag;
      if (proposedStepType) {
        proposedStep.stepType = proposedStepType;
        // Only include actionConfig if it has meaningful values
        const configKeys = Object.keys(proposedActionConfig).filter(
          (k) => proposedActionConfig[k] != null && proposedActionConfig[k] !== '',
        );
        if (configKeys.length > 0) {
          proposedStep.actionConfig = proposedActionConfig;
        }
      }
      await marketingOpsService.submitChecklistSuggestion(campaignId, {
        stepId: suggestionStep?.id ?? null,
        suggestionKind,
        position: suggestionPosition || null,
        proposedStep,
        rationale,
      });
      setShowSuggestionForm(false);
      await fetchChecklist();
    } catch (err: any) {
      setError(err.message || 'Failed to submit suggestion');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading checklist...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 hover:underline">Dismiss</button>
      </div>
    );
  }

  if (!view) return null;

  // Empty state: no effective playbook (no triage decision)
  if (!view.playbook) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
          <AlertCircle className="w-6 h-6 text-blue-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No playbook assigned yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
          Run triage on the Overview tab to assign a playbook. The checklist appears once an operator accepts or overrides the recommendation.
        </p>
        {onGoToTriage && (
          <button
            onClick={onGoToTriage}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Go to Triage <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Empty state: playbook assigned but no steps defined
  if (view.steps.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 dark:bg-neutral-800 mb-3">
            <CheckCircle2 className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No checklist defined</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
            This playbook has no checklist steps yet. Suggest the first step — an admin will review it on the playbook builder tab.
          </p>
          <button
            onClick={() => openSuggestionForm(null, 'add')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <Lightbulb className="w-3 h-3" /> Suggest a step
          </button>
        </div>
        <SuggestionFormModal
          show={showSuggestionForm}
          onClose={() => setShowSuggestionForm(false)}
          suggestionStep={suggestionStep}
          suggestionKind={suggestionKind}
          suggestionPosition={suggestionPosition}
          setSuggestionKind={setSuggestionKind}
          setSuggestionPosition={setSuggestionPosition}
          suggestionStageTag={suggestionStageTag}
          setSuggestionStageTag={setSuggestionStageTag}
          proposedTitle={proposedTitle}
          setProposedTitle={setProposedTitle}
          proposedInstructions={proposedInstructions}
          setProposedInstructions={setProposedInstructions}
          proposedStepType={proposedStepType}
          setProposedStepType={setProposedStepType}
          proposedActionConfig={proposedActionConfig}
          setProposedActionConfig={setProposedActionConfig}
          rationale={rationale}
          setRationale={setRationale}
          onSubmit={handleSubmitSuggestion}
          submitting={submittingSuggestion}
        />
      </div>
    );
  }

  const completionPct = view.requiredTotal > 0
    ? Math.round((view.requiredCompleted / view.requiredTotal) * 100)
    : 100;

  // Stage-aware filtering. Untagged steps (stageTag null) appear in both
  // views. Campaigns on a non-review-track stage (e.g. recovery pipeline)
  // can't filter — they see the full list.
  const currentStageOrder = currentStage ? CHECKLIST_STAGE_TAGS.indexOf(currentStage as ChecklistStageTag) : -1;
  const canStageFilter = currentStageOrder >= 0;
  const dueSteps = canStageFilter
    ? view.steps.filter((s) => s.stageTag == null || CHECKLIST_STAGE_TAGS.indexOf(s.stageTag) <= currentStageOrder)
    : view.steps;
  const visibleSteps = stageFilter === 'due' ? dueSteps : view.steps;
  const currentStageLabel = currentStage
    ? (CHECKLIST_STAGE_TAG_LABELS[currentStage as ChecklistStageTag] ?? currentStage.replace(/_/g, ' '))
    : null;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{view.playbook.code}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{view.playbook.name}</span>
              {view.playbook.isOverride && (
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  override
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {view.completedCount} of {view.steps.length} steps complete
              {view.requiredTotal > 0 && ` · ${view.requiredCompleted} of ${view.requiredTotal} required`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{completionPct}%</div>
            <div className="text-[10px] text-gray-500">required complete</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-700 overflow-hidden">
          <div
            className={`h-full transition-all ${completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Stage filter toggle */}
      {canStageFilter && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStageFilter('due')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
              stageFilter === 'due'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-neutral-700 hover:border-gray-300'
            }`}
          >
            Due by {currentStageLabel} ({dueSteps.length})
          </button>
          <button
            onClick={() => setStageFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
              stageFilter === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-neutral-700 hover:border-gray-300'
            }`}
          >
            All stages ({view.steps.length})
          </button>
          {stageFilter === 'due' && dueSteps.length < view.steps.length && (
            <span className="text-[10px] text-gray-400 ml-1">
              {view.steps.length - dueSteps.length} later-stage {view.steps.length - dueSteps.length === 1 ? 'step' : 'steps'} hidden
            </span>
          )}
        </div>
      )}

      {/* Step list */}
      <div className="space-y-2">
        {visibleSteps.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
            No steps due by {currentStageLabel}.{' '}
            <button onClick={() => setStageFilter('all')} className="text-blue-600 hover:underline">Show all stages</button>
          </div>
        )}
        {visibleSteps.map((step) => {
          const isCompleted = step.progress?.completedAt != null;
          const isToggling = togglingStepId === step.id;
          return (
            <div
              key={step.id}
              className={`rounded-lg border p-3 transition-colors ${
                isCompleted
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                  : step.isRequired
                    ? 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                    : 'border-gray-100 dark:border-neutral-800 bg-gray-50/30 dark:bg-neutral-800/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(step)}
                  disabled={isToggling}
                  className="mt-0.5 flex-shrink-0"
                  title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isToggling ? (
                    <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className={`w-5 h-5 ${step.isRequired ? 'text-gray-300 dark:text-neutral-600' : 'text-gray-200 dark:text-neutral-700'}`} />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-gray-400">{step.stepOrder}.</span>
                        <span className={`text-sm font-medium ${isCompleted ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {step.title}
                        </span>
                        {step.isRequired && !isCompleted && (
                          <span className="inline-block rounded px-1 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            required
                          </span>
                        )}
                      </div>
                      {step.instructions && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{step.instructions}</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      <StageTagBadge stageTag={step.stageTag} />
                      <span className="text-[10px] text-gray-400">
                        {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                      </span>
                    </span>
                  </div>

                  {/* Action deep-links (url_check → open URL, ai_prompt → prompts tab) */}
                  {step.actionConfig?.url && (
                    <a
                      href={step.actionConfig.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> {step.actionConfig.url}
                    </a>
                  )}
                  {step.actionConfig?.prompt_template_id && (
                    <div className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-purple-600 dark:text-purple-400">
                      <MessageSquare className="w-3 h-3" /> prompt: {step.actionConfig.prompt_template_id}
                    </div>
                  )}
                  {step.actionConfig?.credential_ref && (
                    <div className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" /> creds: {step.actionConfig.credential_ref}
                    </div>
                  )}

                  {/* Outreach step enrichment (bridge sprint) */}
                  {step.stepType === 'outreach' && step.outreachStatus && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {step.actionConfig?.channel && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                          {step.actionConfig.channel}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {OUTREACH_KIND_LABELS[step.outreachStatus.kind] ?? step.outreachStatus.kind}
                      </span>
                      {step.outreachStatus.satisfied ? (
                        step.progress?.completedAt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3 h-3" /> detected
                          </span>
                        ) : (
                          <button
                            onClick={() => handleMarkComplete(step, `Auto-detected: ${step.outreachStatus!.kind}`)}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <CheckCircle2 className="w-3 h-3" /> detected — mark complete
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                          <Circle className="w-3 h-3" /> not yet
                        </span>
                      )}
                      {step.outreachStatus.deepLink && (
                        <a
                          href={step.outreachStatus.deepLink}
                          className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Open in Outreach Workspace
                        </a>
                      )}
                    </div>
                  )}

                  {/* Internal-link step enrichment (bridge sprint) */}
                  {step.stepType === 'internal_link' && step.internalLink && (
                    <a
                      href={step.internalLink.resolvedUrl}
                      className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Open →
                    </a>
                  )}

                  {/* Note + suggestion row */}
                  <div className="flex items-center gap-3 mt-2">
                    {step.progress?.note && noteStepId !== step.id && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">"{step.progress.note}"</span>
                    )}
                    <button
                      onClick={() => openNoteEditor(step)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {step.progress?.note ? 'edit note' : 'add note'}
                    </button>
                    <button
                      onClick={() => openSuggestionForm(step, 'modify')}
                      className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      <Lightbulb className="w-3 h-3" /> suggest edit
                    </button>
                  </div>

                  {/* Inline note editor */}
                  {noteStepId === step.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={2}
                        placeholder="Capture context for this step (e.g. what you found, why it's done)"
                        className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNote(step)}
                          disabled={togglingStepId === step.id}
                          className="px-2 py-1 text-[10px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save note
                        </button>
                        <button
                          onClick={() => setNoteStepId(null)}
                          className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggestion CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-neutral-700">
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          Spot a missing step or a step that should change? Suggestions flow to the playbook admin for review.
        </p>
        <button
          onClick={() => openSuggestionForm(null, 'add')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          <Lightbulb className="w-3 h-3" /> Suggest a step
        </button>
      </div>

      <SuggestionFormModal
        show={showSuggestionForm}
        onClose={() => setShowSuggestionForm(false)}
        suggestionStep={suggestionStep}
        suggestionKind={suggestionKind}
        suggestionPosition={suggestionPosition}
        setSuggestionKind={setSuggestionKind}
        setSuggestionPosition={setSuggestionPosition}
        suggestionStageTag={suggestionStageTag}
        setSuggestionStageTag={setSuggestionStageTag}
        proposedTitle={proposedTitle}
        setProposedTitle={setProposedTitle}
        proposedInstructions={proposedInstructions}
        setProposedInstructions={setProposedInstructions}
        proposedStepType={proposedStepType}
        setProposedStepType={setProposedStepType}
        proposedActionConfig={proposedActionConfig}
        setProposedActionConfig={setProposedActionConfig}
        rationale={rationale}
        setRationale={setRationale}
        onSubmit={handleSubmitSuggestion}
        submitting={submittingSuggestion}
      />
    </div>
  );
}

// ─── Suggestion form modal (inline component) ─────────────────────────────

interface SuggestionFormModalProps {
  show: boolean;
  onClose: () => void;
  suggestionStep: ChecklistStepView | null;
  suggestionKind: SuggestionKind;
  suggestionPosition: SuggestionPosition | '';
  setSuggestionKind: (k: SuggestionKind) => void;
  setSuggestionPosition: (p: SuggestionPosition | '') => void;
  suggestionStageTag: ChecklistStageTag | '';
  setSuggestionStageTag: (t: ChecklistStageTag | '') => void;
  proposedTitle: string;
  setProposedTitle: (s: string) => void;
  proposedInstructions: string;
  setProposedInstructions: (s: string) => void;
  proposedStepType: ChecklistStepType | '';
  setProposedStepType: (t: ChecklistStepType | '') => void;
  proposedActionConfig: Record<string, any>;
  setProposedActionConfig: (c: Record<string, any>) => void;
  rationale: string;
  setRationale: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

function SuggestionFormModal({
  show, onClose, suggestionStep, suggestionKind, suggestionPosition,
  setSuggestionKind, setSuggestionPosition, suggestionStageTag, setSuggestionStageTag,
  proposedTitle, setProposedTitle,
  proposedInstructions, setProposedInstructions,
  proposedStepType, setProposedStepType,
  proposedActionConfig, setProposedActionConfig,
  rationale, setRationale,
  onSubmit, submitting,
}: SuggestionFormModalProps) {
  if (!show) return null;

  const isRemove = suggestionKind === 'remove';
  const needsPosition = suggestionKind === 'add' && suggestionStep != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Suggest a checklist change
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {suggestionStep && (
            <div className="rounded bg-gray-50 dark:bg-neutral-700/50 p-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Anchor step:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-white">{suggestionStep.title}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Suggestion kind</label>
            <select
              value={suggestionKind}
              onChange={(e) => setSuggestionKind(e.target.value as SuggestionKind)}
              className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
            >
              {SUGGESTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k === 'add' ? 'Add a new step' : k === 'modify' ? 'Modify this step' : 'Remove this step'}
                </option>
              ))}
            </select>
          </div>

          {needsPosition && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Position</label>
              <select
                value={suggestionPosition}
                onChange={(e) => setSuggestionPosition(e.target.value as SuggestionPosition | '')}
                className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
              >
                <option value="">at end</option>
                {SUGGESTION_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'before' ? 'before anchor' : p === 'after' ? 'after anchor' : 'instead of (supersede)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isRemove && (
            <>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Proposed title</label>
                <input
                  type="text"
                  value={proposedTitle}
                  onChange={(e) => setProposedTitle(e.target.value)}
                  placeholder="e.g. Verify GBP listing is claimed"
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Stage</label>
                <select
                  value={suggestionStageTag}
                  onChange={(e) => setSuggestionStageTag(e.target.value as ChecklistStageTag | '')}
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
                >
                  <option value="">untagged</option>
                  {CHECKLIST_STAGE_TAGS.map((t) => (
                    <option key={t} value={t}>{CHECKLIST_STAGE_TAG_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Proposed instructions</label>
                <textarea
                  value={proposedInstructions}
                  onChange={(e) => setProposedInstructions(e.target.value)}
                  rows={3}
                  placeholder="What to check, what done looks like"
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Step type</label>
                <select
                  value={proposedStepType}
                  onChange={(e) => {
                    const v = e.target.value as ChecklistStepType | '';
                    setProposedStepType(v);
                    setProposedActionConfig({});
                  }}
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
                >
                  <option value="">manual (default)</option>
                  {CHECKLIST_STEP_TYPES.map((t) => (
                    <option key={t} value={t}>{STEP_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              {/* Type-specific action config */}
              {proposedStepType === 'url_check' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">URL to check</label>
                  <input
                    type="url"
                    value={proposedActionConfig.url ?? ''}
                    onChange={(e) => setProposedActionConfig({ ...proposedActionConfig, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                  />
                </div>
              )}
              {proposedStepType === 'internal_link' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Internal link target</label>
                  <select
                    value={proposedActionConfig.target ?? ''}
                    onChange={(e) => setProposedActionConfig({ ...proposedActionConfig, target: e.target.value })}
                    className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
                  >
                    <option value="">select target...</option>
                    {INTERNAL_LINK_TARGETS.map((t) => (
                      <option key={t} value={t}>{INTERNAL_LINK_TARGET_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              )}
              {proposedStepType === 'outreach' && (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Channel</label>
                    <select
                      value={proposedActionConfig.channel ?? ''}
                      onChange={(e) => setProposedActionConfig({ ...proposedActionConfig, channel: e.target.value })}
                      className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
                    >
                      <option value="">any</option>
                      <option value="email">email</option>
                      <option value="phone">phone</option>
                      <option value="sms">sms</option>
                      <option value="dm">dm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Outreach kind</label>
                    <select
                      value={proposedActionConfig.outreach_kind ?? 'generic'}
                      onChange={(e) => setProposedActionConfig({ ...proposedActionConfig, outreach_kind: e.target.value })}
                      className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800"
                    >
                      {OUTREACH_KINDS.map((k) => (
                        <option key={k} value={k}>{OUTREACH_KIND_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {proposedStepType === 'credentials' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Credential reference</label>
                  <input
                    type="text"
                    value={proposedActionConfig.credential_ref ?? ''}
                    onChange={(e) => setProposedActionConfig({ ...proposedActionConfig, credential_ref: e.target.value })}
                    placeholder="e.g. gbp_admin, stripe_dashboard"
                    className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Why? <span className="text-red-500 normal-case font-normal">(required)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Explain why this change improves the playbook — the admin will see this when reviewing."
              className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !rationale.trim() || (!isRemove && !proposedTitle.trim())}
            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </div>
      </div>
    </div>
  );
}
