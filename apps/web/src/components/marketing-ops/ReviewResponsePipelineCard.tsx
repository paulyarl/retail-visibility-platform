'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Star, MessageSquare, CheckCircle2, Clock, ChevronDown, ChevronRight,
  Plus, Calendar, AlertTriangle, ArrowRight, SkipForward, RefreshCw, X,
} from 'lucide-react';
import marketingOpsService, {
  ReviewResponsePipeline, ReviewResponseLogEntry, ReviewPipelineStage, FollowUpOutcome,
} from '@/services/MarketingOpsService';
import ReviewResponseLogModal from './ReviewResponseLogModal';

const STAGE_ORDER: ReviewPipelineStage[] = ['backlog', 'responding', 'follow_up', 'closed', 'monitoring'];

const STAGE_LABELS: Record<ReviewPipelineStage, string> = {
  backlog: 'Backlog',
  responding: 'Responding',
  follow_up: 'Follow-Up',
  closed: 'Closed',
  monitoring: 'Monitoring',
};

const STAGE_COLORS: Record<ReviewPipelineStage, string> = {
  backlog: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  responding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  follow_up: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  closed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  monitoring: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  trustpilot: 'Trustpilot',
};

const OUTCOME_OPTIONS: { value: FollowUpOutcome; label: string; color: string }[] = [
  { value: 'converted_paid', label: 'Converted to Paid', color: 'text-green-700 dark:text-green-300' },
  { value: 'customer_responded', label: 'Customer Responded', color: 'text-blue-700 dark:text-blue-300' },
  { value: 'no_response', label: 'No Response', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'duplicate', label: 'Duplicate', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'out_of_scope', label: 'Out of Scope', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'other', label: 'Other', color: 'text-gray-600 dark:text-gray-400' },
];

const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(OUTCOME_OPTIONS.map((o) => [o.value, o.label]));

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return s;
  }
}

function followUpStatus(p: ReviewResponsePipeline): { label: string; color: string; overdue: boolean } {
  if (!p.next_follow_up_at) return { label: 'None scheduled', color: 'text-gray-400', overdue: false };
  const fu = new Date(p.next_follow_up_at);
  const now = new Date();
  const diffMs = fu.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffMs < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, color: 'text-red-600 dark:text-red-400 font-semibold', overdue: true };
  if (diffDays === 0) return { label: 'Due today', color: 'text-amber-600 dark:text-amber-400 font-semibold', overdue: false };
  if (diffDays <= 7) return { label: `In ${diffDays}d`, color: 'text-gray-600 dark:text-gray-400', overdue: false };
  return { label: formatDate(p.next_follow_up_at), color: 'text-gray-500 dark:text-gray-400', overdue: false };
}

interface ReviewResponsePipelineCardProps {
  campaignId: string;
  onRefresh?: () => void;
}

export default function ReviewResponsePipelineCard({ campaignId, onRefresh }: ReviewResponsePipelineCardProps) {
  const [pipelines, setPipelines] = useState<ReviewResponsePipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsByPipeline, setLogsByPipeline] = useState<Record<string, ReviewResponseLogEntry[]>>({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeAction, setOutcomeAction] = useState<{ logId: string; type: 'complete' | 'skip' } | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPipelines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketingOpsService.listReviewPipelines(campaignId);
      setPipelines(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load review pipelines');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  const loadLogs = useCallback(async (pipelineId: string) => {
    try {
      const logs = await marketingOpsService.listReviewLog(pipelineId);
      setLogsByPipeline((prev) => ({ ...prev, [pipelineId]: logs }));
    } catch (e: any) {
      console.error('Failed to load review log:', e);
    }
  }, []);

  const handleExpand = (pipelineId: string) => {
    const newExpanded = expandedId === pipelineId ? null : pipelineId;
    setExpandedId(newExpanded);
    if (newExpanded && !logsByPipeline[pipelineId]) {
      loadLogs(pipelineId);
    }
  };

  const handleAction = async (action: string, fn: () => Promise<any>) => {
    setActionLoading(action);
    try {
      await fn();
      await loadPipelines();
      if (expandedId) await loadLogs(expandedId);
      onRefresh?.();
    } catch (e: any) {
      setError(e.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdvance = (pipelineId: string, force: boolean) =>
    handleAction('advance', () => marketingOpsService.advanceReviewStage(pipelineId, force));

  const handleCheckGate = async (pipelineId: string) => {
    setActionLoading('gate');
    try {
      const result = await marketingOpsService.checkReviewGate(pipelineId);
      if (result.gateMet) {
        await loadPipelines();
      } else {
        setError(`Gate not met: ${result.reasons.join(', ')}`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to check gate');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteFollowUp = (logId: string) => {
    setOutcomeAction({ logId, type: 'complete' });
    setShowOutcomeModal(true);
  };

  const handleSkipFollowUp = (logId: string) => {
    setOutcomeAction({ logId, type: 'skip' });
    setShowOutcomeModal(true);
  };

  const handleOutcomeSubmit = async (outcome: FollowUpOutcome | null) => {
    if (!outcomeAction) return;
    const { logId, type } = outcomeAction;
    setShowOutcomeModal(false);
    setOutcomeAction(null);
    if (type === 'complete') {
      handleAction('complete', () => marketingOpsService.completeScheduledFollowUp(logId, undefined, outcome ?? undefined));
    } else {
      handleAction('skip', () => marketingOpsService.skipScheduledFollowUp(logId, undefined, outcome ?? undefined));
    }
  };

  const handleLogSubmitted = async () => {
    setShowLogModal(false);
    await loadPipelines();
    if (expandedId) await loadLogs(expandedId);
    onRefresh?.();
  };

  const handleScheduleSubmitted = async () => {
    setShowScheduleModal(false);
    await loadPipelines();
    if (expandedId) await loadLogs(expandedId);
    onRefresh?.();
  };

  const openLogModal = (pipelineId: string) => {
    setActivePipelineId(pipelineId);
    setShowLogModal(true);
  };

  const openScheduleModal = (pipelineId: string) => {
    setActivePipelineId(pipelineId);
    setShowScheduleModal(true);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Review Response Pipeline</h3>
        <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review Response Pipeline</h3>
        <button
          type="button"
          onClick={loadPipelines}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {pipelines.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No review response pipelines yet. Pipelines are created per platform (Google, Yelp, Facebook).
        </p>
      ) : (
        <div className="space-y-2">
          {pipelines
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((pipeline) => {
              const expanded = expandedId === pipeline.id;
              const logs = logsByPipeline[pipeline.id] ?? [];
              const fuStatus = followUpStatus(pipeline);
              const stageIdx = STAGE_ORDER.indexOf(pipeline.stage);
              const isTerminal = pipeline.stage === 'monitoring';

              return (
                <div key={pipeline.id} className="rounded-md border border-gray-100 dark:border-gray-800">
                  {/* Pipeline header */}
                  <button
                    type="button"
                    onClick={() => handleExpand(pipeline.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {PLATFORM_LABELS[pipeline.platform] ?? pipeline.platform}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STAGE_COLORS[pipeline.stage]}`}>
                        {STAGE_LABELS[pipeline.stage]}
                      </span>
                      {pipeline.gate_met && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Gate met
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {pipeline.unanswered_count}/{pipeline.total_reviews}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3" />
                        {pipeline.average_rating ? pipeline.average_rating.toFixed(1) : '—'}
                      </span>
                      <span>{pipeline.response_rate}%</span>
                      <span className={fuStatus.color}>
                        <Clock className="mr-0.5 inline h-3 w-3" />
                        {fuStatus.label}
                      </span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800">
                      {/* Metrics grid */}
                      <div className="mb-3 grid grid-cols-4 gap-2 text-xs">
                        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
                          <div className="text-gray-500 dark:text-gray-400">Total reviews</div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{pipeline.total_reviews}</div>
                        </div>
                        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
                          <div className="text-gray-500 dark:text-gray-400">Unanswered</div>
                          <div className={`font-medium ${pipeline.unanswered_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {pipeline.unanswered_count}
                          </div>
                        </div>
                        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
                          <div className="text-gray-500 dark:text-gray-400">Follow-ups open</div>
                          <div className={`font-medium ${pipeline.follow_ups_open > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {pipeline.follow_ups_open}
                          </div>
                        </div>
                        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
                          <div className="text-gray-500 dark:text-gray-400">Response rate</div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{pipeline.response_rate}%</div>
                        </div>
                      </div>

                      {/* Stage progress bar */}
                      <div className="mb-3 flex items-center gap-1">
                        {STAGE_ORDER.map((s, i) => (
                          <div key={s} className="flex items-center">
                            <div
                              className={`h-1.5 w-8 rounded-full ${i <= stageIdx ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                              title={STAGE_LABELS[s]}
                            />
                            {i < STAGE_ORDER.length - 1 && (
                              <ArrowRight className="h-2.5 w-2.5 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>
                        ))}
                        <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400">
                          Stage {stageIdx + 1}/{STAGE_ORDER.length}
                        </span>
                      </div>

                      {/* Actions */}
                      {!isTerminal && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => openLogModal(pipeline.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <Plus className="h-3 w-3" /> Log response
                          </button>
                          <button
                            type="button"
                            onClick={() => openScheduleModal(pipeline.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Calendar className="h-3 w-3" /> Schedule follow-up
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === 'gate'}
                            onClick={() => handleCheckGate(pipeline.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Check gate
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === 'advance'}
                            onClick={() => handleAdvance(pipeline.id, false)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <ArrowRight className="h-3 w-3" /> Advance
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === 'advance'}
                            onClick={() => handleAdvance(pipeline.id, true)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                            title="Force advance (bypass gate)"
                          >
                            <SkipForward className="h-3 w-3" /> Force
                          </button>
                        </div>
                      )}

                      {/* Scheduled follow-ups */}
                      {logs.filter((l) => l.status === 'scheduled').length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Scheduled follow-ups
                          </div>
                          <div className="space-y-1">
                            {logs
                              .filter((l) => l.status === 'scheduled')
                              .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))
                              .map((l) => {
                                const isOverdue = l.scheduled_for && new Date(l.scheduled_for) < new Date();
                                return (
                                  <div key={l.id} className="flex items-center justify-between rounded bg-amber-50 px-2 py-1 text-xs dark:bg-amber-900/20">
                                    <div className="flex items-center gap-1.5">
                                      {isOverdue ? <AlertTriangle className="h-3 w-3 text-amber-600" /> : <Calendar className="h-3 w-3 text-amber-600" />}
                                      <span className="text-amber-800 dark:text-amber-300">{formatDateTime(l.scheduled_for)}</span>
                                      {l.notes && <span className="text-gray-500 dark:text-gray-400">— {l.notes}</span>}
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        disabled={actionLoading === 'complete'}
                                        onClick={() => handleCompleteFollowUp(l.id)}
                                        className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Complete
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoading === 'skip'}
                                        onClick={() => handleSkipFollowUp(l.id)}
                                        className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                                      >
                                        Skip
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Log history */}
                      {logs.length === 0 ? (
                        <p className="py-2 text-center text-xs text-gray-400">No responses logged yet.</p>
                      ) : (
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Response log
                          </div>
                          <div className="max-h-48 space-y-1 overflow-auto">
                            {logs
                              .filter((l) => l.status !== 'scheduled')
                              .sort((a, b) => b.responded_at.localeCompare(a.responded_at))
                              .slice(0, 20)
                              .map((l) => (
                                <div key={l.id} className="rounded border border-gray-100 px-2 py-1 text-xs dark:border-gray-800">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{l.response_type.replace(/_/g, ' ')}</span>
                                      <span className="text-gray-400">{formatDate(l.responded_at)}</span>
                                      {l.status === 'skipped' && (
                                        <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">skipped</span>
                                      )}
                                      {l.outcome && (
                                        <span className={`rounded px-1 py-0.5 text-[9px] ${l.outcome === 'converted_paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                          {OUTCOME_LABELS[l.outcome] ?? l.outcome}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {l.customer_replied && !l.thread_closed && (
                                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">replied</span>
                                      )}
                                      {l.thread_closed && (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      )}
                                    </div>
                                  </div>
                                  {l.notes && <p className="mt-0.5 text-gray-500 dark:text-gray-400">{l.notes}</p>}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Modals */}
      {showLogModal && activePipelineId && (
        <ReviewResponseLogModal
          pipelineId={activePipelineId}
          mode="log"
          onSubmit={handleLogSubmitted}
          onClose={() => setShowLogModal(false)}
        />
      )}
      {showScheduleModal && activePipelineId && (
        <ReviewResponseLogModal
          pipelineId={activePipelineId}
          mode="schedule"
          onSubmit={handleScheduleSubmitted}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
      {showOutcomeModal && outcomeAction && (
        <OutcomeModal
          action={outcomeAction.type}
          onSubmit={handleOutcomeSubmit}
          onClose={() => { setShowOutcomeModal(false); setOutcomeAction(null); }}
        />
      )}
    </div>
  );
}

// ─── Outcome Modal ───────────────────────────────────────────────────────
function OutcomeModal({
  action, onSubmit, onClose,
}: {
  action: 'complete' | 'skip';
  onSubmit: (outcome: FollowUpOutcome | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {action === 'complete' ? 'Complete Follow-Up' : 'Skip Follow-Up'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Why is this follow-up being {action === 'complete' ? 'completed' : 'skipped'}? Select an outcome:
        </p>
        <div className="space-y-1.5">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSubmit(opt.value)}
              className={`w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${opt.color}`}
            >
              {opt.label}
              {opt.value === 'converted_paid' && (
                <span className="ml-1.5 rounded bg-green-100 px-1 py-0.5 text-[9px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  advances campaign to paid
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSubmit(null)}
            className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            No outcome — just {action === 'complete' ? 'complete' : 'skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
