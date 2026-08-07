'use client';

/**
 * ChecklistBuilderTab — Operator Checklist builder (third tab on Playbooks page)
 *
 * Per-playbook ordered checklist step template editor + suggestion review queue.
 * Operators never edit templates directly from the campaign page — suggestions
 * flow through this review queue where an admin accepts (optionally amending) or rejects.
 *
 * Spec: docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md §7, §13
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, ChevronUp, ChevronDown, X, AlertCircle,
  CheckCircle2, Lightbulb, MessageSquare, ArrowUpRight,
} from 'lucide-react';
import marketingOpsService, {
  type PlaybookCatalogEntry,
  type PlaybookChecklistStep,
  type PlaybookChecklistSuggestion,
  type ChecklistStepType,
  type ChecklistStageTag,
  type SuggestionKind,
  type SuggestionPosition,
  CHECKLIST_STEP_TYPES,
  CHECKLIST_STAGE_TAGS,
  CHECKLIST_STAGE_TAG_LABELS,
} from '@/services/MarketingOpsService';

const STEP_TYPE_COLORS: Record<ChecklistStepType, string> = {
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  url_check: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ai_prompt: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  deliverable: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  outreach: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  credentials: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  review_management: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recovery_management: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  triage_management: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const emptyStepForm = () => ({
  title: '',
  instructions: '',
  stepType: 'manual' as ChecklistStepType,
  actionConfig: {} as Record<string, any>,
  isRequired: true,
  isActive: true,
  stageTag: 'seek' as ChecklistStageTag,
});

interface Props {
  playbooks: PlaybookCatalogEntry[];
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function ChecklistBuilderTab({ playbooks, onError, onSuccess }: Props) {
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [steps, setSteps] = useState<PlaybookChecklistStep[]>([]);
  const [suggestions, setSuggestions] = useState<PlaybookChecklistSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Step editor
  const [editingStep, setEditingStep] = useState<PlaybookChecklistStep | null>(null);
  const [showStepForm, setShowStepForm] = useState(false);
  const [stepForm, setStepForm] = useState(emptyStepForm());
  const [savingStep, setSavingStep] = useState(false);

  // Suggestion review
  const [rejectingSuggestion, setRejectingSuggestion] = useState<PlaybookChecklistSuggestion | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewingSuggestion, setReviewingSuggestion] = useState(false);

  const selectedPlaybook = playbooks.find((p) => p.id === selectedPlaybookId);
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const fetchSteps = useCallback(async (playbookId: string) => {
    if (!playbookId) {
      setSteps([]);
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const [stepData, sugData] = await Promise.all([
        marketingOpsService.listChecklistSteps(playbookId),
        marketingOpsService.listPlaybookChecklistSuggestions(playbookId),
      ]);
      setSteps(stepData);
      setSuggestions(sugData);
    } catch (err: any) {
      onError(err.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (selectedPlaybookId) fetchSteps(selectedPlaybookId);
  }, [selectedPlaybookId, fetchSteps]);

  // ─── Step CRUD ────────────────────────────────────────────────────────

  const handleNewStep = () => {
    setEditingStep(null);
    setStepForm(emptyStepForm());
    setShowStepForm(true);
  };

  const handleEditStep = (step: PlaybookChecklistStep) => {
    setEditingStep(step);
    setStepForm({
      title: step.title,
      instructions: step.instructions ?? '',
      stepType: step.stepType,
      actionConfig: step.actionConfig ?? {},
      isRequired: step.isRequired,
      isActive: step.isActive,
      stageTag: step.stageTag ?? 'seek',
    });
    setShowStepForm(true);
  };

  const handleSaveStep = async () => {
    if (!selectedPlaybookId) return;
    if (!stepForm.title.trim()) {
      onError('Step title is required');
      return;
    }
    setSavingStep(true);
    try {
      if (editingStep) {
        await marketingOpsService.updateChecklistStep(editingStep.id, {
          title: stepForm.title,
          instructions: stepForm.instructions || undefined,
          stepType: stepForm.stepType,
          actionConfig: stepForm.actionConfig,
          isRequired: stepForm.isRequired,
          isActive: stepForm.isActive,
          stageTag: stepForm.stageTag,
        });
        onSuccess(`Updated step "${stepForm.title}"`);
      } else {
        await marketingOpsService.createChecklistStep(selectedPlaybookId, {
          title: stepForm.title,
          instructions: stepForm.instructions || undefined,
          stepType: stepForm.stepType,
          actionConfig: stepForm.actionConfig,
          isRequired: stepForm.isRequired,
          isActive: stepForm.isActive,
          stageTag: stepForm.stageTag,
        });
        onSuccess(`Created step "${stepForm.title}"`);
      }
      setShowStepForm(false);
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to save step');
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = async (step: PlaybookChecklistStep) => {
    if (!confirm(`Delete step "${step.title}"? If campaigns have progress on it, deactivate instead.`)) return;
    try {
      await marketingOpsService.deleteChecklistStep(step.id);
      onSuccess(`Deleted step "${step.title}"`);
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to delete step');
    }
  };

  const handleToggleStepActive = async (step: PlaybookChecklistStep) => {
    try {
      await marketingOpsService.updateChecklistStep(step.id, { isActive: !step.isActive });
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to toggle step');
    }
  };

  const handleReorderStep = async (idx: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    const a = steps[idx];
    const b = steps[swapIdx];
    const rankings = [
      { id: a.id, step_order: b.stepOrder },
      { id: b.id, step_order: a.stepOrder },
    ];
    try {
      await marketingOpsService.reorderChecklistSteps(selectedPlaybookId, rankings);
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to reorder');
    }
  };

  // ─── Suggestion review ───────────────────────────────────────────────

  const handleAcceptSuggestion = async (suggestion: PlaybookChecklistSuggestion) => {
    if (!confirm(`Accept this suggestion? It will be applied to the playbook template.`)) return;
    setReviewingSuggestion(true);
    try {
      await marketingOpsService.acceptChecklistSuggestion(suggestion.id, suggestion.proposedStep);
      onSuccess('Suggestion accepted and applied to template');
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to accept suggestion');
    } finally {
      setReviewingSuggestion(false);
    }
  };

  const handleRejectSuggestion = async () => {
    if (!rejectingSuggestion) return;
    try {
      await marketingOpsService.rejectChecklistSuggestion(rejectingSuggestion.id, rejectNote || undefined);
      onSuccess('Suggestion rejected');
      setRejectingSuggestion(null);
      setRejectNote('');
      await fetchSteps(selectedPlaybookId);
    } catch (err: any) {
      onError(err.message || 'Failed to reject suggestion');
    }
  };

  const suggestionKindLabel = (kind: SuggestionKind): string => {
    if (kind === 'add') return 'New step';
    if (kind === 'modify') return 'Modify';
    return 'Remove';
  };

  const positionLabel = (pos: SuggestionPosition | null): string => {
    if (pos === 'before') return 'before';
    if (pos === 'after') return 'after';
    if (pos === 'supersede') return 'instead of (supersede)';
    return 'at end';
  };

  return (
    <div className="space-y-4">
      {/* Playbook selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Playbook:</label>
        <select
          value={selectedPlaybookId}
          onChange={(e) => setSelectedPlaybookId(e.target.value)}
          className="text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
        >
          <option value="">— Select a playbook —</option>
          {playbooks.filter((p) => p.isActive).map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {!selectedPlaybook ? (
        /* Empty state: no playbook selected */
        <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
          Select a playbook to view its operations overview and checklist steps.
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {/* Operations overview header */}
          <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{selectedPlaybook.code}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedPlaybook.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[selectedPlaybook.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {selectedPlaybook.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">{selectedPlaybook.archetype}</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-gray-500 dark:text-gray-400">
                <div>FITD: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedPlaybook.fitdOfferTitle} ({formatCents(selectedPlaybook.fitdDefaultFeeCents)})</span></div>
                <div>Retainer: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedPlaybook.retainerPitchTitle} ({formatCents(selectedPlaybook.retainerFeeCents)})</span></div>
              </div>
            </div>
            {selectedPlaybook.description && (
              <p className="text-xs text-gray-600 dark:text-gray-400">{selectedPlaybook.description}</p>
            )}
          </div>

          {/* Suggestion review queue (collapsible) */}
          {pendingSuggestions.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Operator Suggestions ({pendingSuggestions.length} pending)
                  </span>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400">{showSuggestions ? 'Hide' : 'Show'}</span>
              </button>
              {showSuggestions && (
                <div className="border-t border-amber-200 dark:border-amber-800 p-3 space-y-3">
                  {pendingSuggestions.map((sug) => (
                    <div key={sug.id} className="rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-neutral-800 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {suggestionKindLabel(sug.suggestionKind)}
                          </span>
                          {sug.suggestionKind === 'add' && sug.stepId && (
                            <span className="text-[10px] text-gray-500">
                              {positionLabel(sug.position)} step {steps.find((s) => s.id === sug.stepId)?.stepOrder ?? '?'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">{new Date(sug.createdAt).toLocaleDateString()}</span>
                      </div>
                      {sug.proposedStep?.title && (
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{sug.proposedStep.title}</div>
                      )}
                      {sug.proposedStep?.instructions && (
                        <p className="text-[10px] text-gray-600 dark:text-gray-400">{sug.proposedStep.instructions}</p>
                      )}
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Why:</span> {sug.rationale}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">by {sug.submittedBy}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAcceptSuggestion(sug)}
                            disabled={reviewingSuggestion}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Accept
                          </button>
                          <button
                            onClick={() => { setRejectingSuggestion(sug); setRejectNote(''); }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step list header */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ordered checklist steps tagged by pipeline stage. Required steps gate stage transitions (soft gate — only steps at or before the current stage).
            </p>
            <button
              onClick={handleNewStep}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" /> Add Step
            </button>
          </div>

          {/* Step list */}
          {steps.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
              No checklist steps yet — add the first step.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Order</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">Stage</th>
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                    <th className="text-center px-3 py-2 font-medium">Required</th>
                    <th className="text-center px-3 py-2 font-medium">Active</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                  {steps.map((step, idx) => (
                    <tr key={step.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{step.stepOrder}</span>
                          <button onClick={() => handleReorderStep(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleReorderStep(idx, 'down')} disabled={idx === steps.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STEP_TYPE_COLORS[step.stepType] ?? 'bg-gray-100 text-gray-700'}`}>
                          {step.stepType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {step.stageTag ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STAGE_TAG_COLORS[step.stageTag] ?? 'bg-gray-100 text-gray-700'}`}>
                            {CHECKLIST_STAGE_TAG_LABELS[step.stageTag] ?? step.stageTag.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">untagged</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {step.title}
                        {step.instructions && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{step.instructions}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${step.isRequired ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-600'}`} title={step.isRequired ? 'Required (gates transitions)' : 'Optional'} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleToggleStepActive(step)} className={`inline-block w-2 h-2 rounded-full ${step.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`} title={step.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => handleEditStep(step)} className="text-gray-400 hover:text-blue-600" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteStep(step)} className="text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step edit/create modal */}
          {showStepForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-auto">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {editingStep ? 'Edit Step' : 'Add Checklist Step'}
                  </h3>
                  <button onClick={() => setShowStepForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Title</label>
                    <input type="text" value={stepForm.title} onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })} placeholder="e.g. Verify GBP listing is claimed" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Instructions</label>
                    <textarea value={stepForm.instructions} onChange={(e) => setStepForm({ ...stepForm, instructions: e.target.value })} rows={3} placeholder="What to check, what done looks like" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Step Type</label>
                    <select value={stepForm.stepType} onChange={(e) => setStepForm({ ...stepForm, stepType: e.target.value as ChecklistStepType, actionConfig: {} })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800">
                      {CHECKLIST_STEP_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Stage</label>
                    <select value={stepForm.stageTag} onChange={(e) => setStepForm({ ...stepForm, stageTag: e.target.value as ChecklistStageTag })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800">
                      {CHECKLIST_STAGE_TAGS.map((t) => (
                        <option key={t} value={t}>{CHECKLIST_STAGE_TAG_LABELS[t]}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">Which pipeline stage this step belongs to. Required steps gate transitions out of stages at or after their tag.</p>
                  </div>

                  {/* Type-specific action config */}
                  {stepForm.stepType === 'url_check' && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">URL</label>
                      <input type="url" value={stepForm.actionConfig.url ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, url: e.target.value } })} placeholder="https://..." className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </div>
                  )}
                  {stepForm.stepType === 'ai_prompt' && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Prompt Template ID</label>
                      <input type="text" value={stepForm.actionConfig.prompt_template_id ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, prompt_template_id: e.target.value } })} placeholder="mpt-..." className="w-full text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </div>
                  )}
                  {stepForm.stepType === 'deliverable' && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Deliverable Type</label>
                      <input type="text" value={stepForm.actionConfig.deliverable_type ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, deliverable_type: e.target.value } })} placeholder="e.g. preview, report" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </div>
                  )}
                  {stepForm.stepType === 'outreach' && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Channel</label>
                      <select value={stepForm.actionConfig.channel ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, channel: e.target.value } })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-800">
                        <option value="">— Select —</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="sms">SMS</option>
                        <option value="dm">DM</option>
                      </select>
                    </div>
                  )}
                  {stepForm.stepType === 'credentials' && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>Reference only — never paste secrets here. Store a vault path or password-manager entry name.</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Credential Reference</label>
                        <input type="text" value={stepForm.actionConfig.credential_ref ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, credential_ref: e.target.value } })} placeholder="e.g. 1Password › LocalBiz › GBP vault" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Username Hint (optional)</label>
                        <input type="text" value={stepForm.actionConfig.username_hint ?? ''} onChange={(e) => setStepForm({ ...stepForm, actionConfig: { ...stepForm.actionConfig, username_hint: e.target.value } })} placeholder="e.g. admin@localbiz.com" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={stepForm.isRequired} onChange={(e) => setStepForm({ ...stepForm, isRequired: e.target.checked })} className="rounded" />
                      Required (gates transitions)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={stepForm.isActive} onChange={(e) => setStepForm({ ...stepForm, isActive: e.target.checked })} className="rounded" />
                      Active
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
                  <button onClick={() => setShowStepForm(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
                    Cancel
                  </button>
                  <button onClick={handleSaveStep} disabled={savingStep || !stepForm.title.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                    {savingStep ? 'Saving...' : 'Save Step'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reject suggestion modal */}
          {rejectingSuggestion && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Reject Suggestion</h3>
                  <button onClick={() => setRejectingSuggestion(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    The submitter will see this rejection reason — it teaches what kinds of suggestions get accepted.
                  </p>
                  <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} placeholder="Why is this suggestion being rejected? (optional)" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
                  <button onClick={() => setRejectingSuggestion(null)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
                    Cancel
                  </button>
                  <button onClick={handleRejectSuggestion} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">
                    Reject Suggestion
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
