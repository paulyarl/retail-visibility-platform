'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Loader2, Flame, Flag, Inbox, X, ChevronDown, ChevronRight,
  UserPlus, UserX, Calendar, AlertTriangle, Phone, FlaskConical,
} from 'lucide-react';
import marketingOpsService, {
  ProspectQueueEntry, ProspectStatus, ProspectPriority, ProspectDismissReason, verificationClearsCampaign,
} from '@/services/MarketingOpsService';
import ResolveVerificationModal from '@/components/marketing-ops/ResolveVerificationModal';
import ProspectTouchLogModal from '@/components/marketing-ops/ProspectTouchLogModal';
import VerificationBadge from '@/components/marketing-ops/VerificationBadge';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';
import { useStaffUsers, staffDisplayName } from '@/components/marketing-ops/PlatformUserSelect';
import {
  PipelineMode, REVIEW_COLUMNS, RECOVERY_COLUMNS, CLOSED_STAGES,
  transitionsForPipeline, pipelineForCampaign,
} from '@/components/marketing-ops/prospectQueueStageMaps';

// ─── Constants ───────────────────────────────────────────────────────────

const CRISIS_SIGNALS = ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'];
const SIGNAL_FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};
const DISMISS_REASONS: ProspectDismissReason[] = ['already_customer', 'bad_fit', 'duplicate', 'unverified_closed', 'other'];

const STALE_AUDIT_DAYS = 14;

// ─── Helpers ─────────────────────────────────────────────────────────────

function hasCrisis(signals: string[] | undefined): boolean {
  return !!signals?.some((s) => CRISIS_SIGNALS.includes(s));
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** next_touch_at → "due now" / "in Nd" label (proving-ground worklist). */
function dueLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'due now';
  const d = Math.floor(diffMs / 86400000);
  if (d === 0) return 'today';
  return `in ${d}d`;
}

const CHANNEL_CHIP: Record<string, string> = {
  call: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  email: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  sms: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  mail: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  form: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  referral: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// ─── Component ───────────────────────────────────────────────────────────

interface ProspectQueueBoardProps {
  entries: ProspectQueueEntry[];
  // Shared status-tab focus — the board renders the same filtered dataset
  // as the list: 'all' shows every lane, a specific status shows just its
  // lane (created → the campaign-stage lanes).
  statusFocus: 'all' | ProspectStatus;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export default function ProspectQueueBoard({ entries, statusFocus, onRefresh, onError }: ProspectQueueBoardProps) {
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>('review');
  const [showClosed, setShowClosed] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReasonOpen, setDismissReasonOpen] = useState<string | null>(null);
  const [togglingPriorityId, setTogglingPriorityId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<{ campaignId: string; steps: { id: string; title: string; stage_tag?: string | null }[] } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [resolveEntry, setResolveEntry] = useState<ProspectQueueEntry | null>(null);
  // Proving-ground worklist lanes (in_thread / hold) — log-outcome modal.
  const [logModalEntry, setLogModalEntry] = useState<ProspectQueueEntry | null>(null);

  const staffUsers = useStaffUsers();
  const currentUserId = staffUsers[0]?.id ?? null;

  // ─── Column setup ─────────────────────────────────────────────────────

  const stageColumns = pipelineMode === 'recovery' ? RECOVERY_COLUMNS : REVIEW_COLUMNS;
  const transitions = transitionsForPipeline(pipelineMode);

  // Split entries: intake (unvetted public-sourced staging) leads, queued
  // entries go in the Queued column; campaign_created entries go in the stage
  // column matching their campaign_stage (filtered by the current pipeline
  // mode). in_thread/hold ride the PG cadence lanes; dismissed renders only
  // when its lane is focused (excluded from the 'all' overview).
  const intakeEntries = useMemo(
    () => entries.filter((e) => e.status === 'intake'),
    [entries],
  );

  const queuedEntries = useMemo(
    () => entries.filter((e) => e.status === 'queued'),
    [entries],
  );

  const verifyEntries = useMemo(
    () => entries.filter((e) => e.status === 'verify_then_outreach'),
    [entries],
  );

  // Proving-ground cadence lanes — in_thread (live conversation) and hold
  // (parked until next_touch_at) ride the same dataset as the list tabs.
  // Seeded worklist rows lead by next_touch_at, matching the list's order.
  const worklistSort = (list: ProspectQueueEntry[]) => {
    const seeded = list.filter((e) => e.seed_id);
    const unseeded = list.filter((e) => !e.seed_id);
    seeded.sort((a, b) => {
      const ta = a.next_touch_at ? new Date(a.next_touch_at).getTime() : 0;
      const tb = b.next_touch_at ? new Date(b.next_touch_at).getTime() : 0;
      return ta - tb;
    });
    return [...seeded, ...unseeded];
  };

  const inThreadEntries = useMemo(
    () => worklistSort(entries.filter((e) => e.status === 'in_thread')),
    [entries],
  );

  const holdEntries = useMemo(
    () => worklistSort(entries.filter((e) => e.status === 'hold')),
    [entries],
  );

  const dismissedEntries = useMemo(
    () => entries.filter((e) => e.status === 'dismissed'),
    [entries],
  );

  const campaignEntriesByStage = useMemo(() => {
    const map: Record<string, ProspectQueueEntry[]> = {};
    for (const e of entries) {
      if (e.status !== 'campaign_created' || !e.campaign_stage) continue;
      // Only show entries whose campaign belongs to the current pipeline mode.
      const campaignPipeline = pipelineForCampaign(e.campaign_category ?? null, e.repair_track ?? null);
      if (campaignPipeline !== pipelineMode) continue;
      if (!map[e.campaign_stage]) map[e.campaign_stage] = [];
      map[e.campaign_stage].push(e);
    }
    // Also collect closed-stage entries
    for (const e of entries) {
      if (e.status !== 'campaign_created' || !e.campaign_stage) continue;
      if (CLOSED_STAGES.includes(e.campaign_stage)) {
        const campaignPipeline = pipelineForCampaign(e.campaign_category ?? null, e.repair_track ?? null);
        if (campaignPipeline !== pipelineMode) continue;
        if (!showClosed) continue;
        if (!map[e.campaign_stage]) map[e.campaign_stage] = [];
        if (!map[e.campaign_stage].includes(e)) map[e.campaign_stage].push(e);
      }
    }
    return map;
  }, [entries, pipelineMode, showClosed]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleCreateCampaign = async (id: string) => {
    setCreatingId(id);
    onError('');
    try {
      await marketingOpsService.createCampaignFromQueue(id);
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to create campaign');
    } finally {
      setCreatingId(null);
    }
  };

  const handleDismiss = async (id: string, reason?: ProspectDismissReason) => {
    setDismissingId(id);
    onError('');
    try {
      await marketingOpsService.dismissProspectQueue(id, reason);
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to dismiss entry');
    } finally {
      setDismissingId(null);
      setDismissReasonOpen(null);
    }
  };

  const handleTogglePriority = async (entry: ProspectQueueEntry) => {
    if (entry.status !== 'intake' && entry.status !== 'queued' && entry.status !== 'verify_then_outreach') return;
    setTogglingPriorityId(entry.id);
    try {
      const newPriority: ProspectPriority = entry.priority === 'high' ? 'normal' : 'high';
      await marketingOpsService.updateProspectQueue(entry.id, { priority: newPriority });
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to update priority');
    } finally {
      setTogglingPriorityId(null);
    }
  };

  const handleAssignToMe = async (entry: ProspectQueueEntry) => {
    if (!currentUserId || (entry.status !== 'intake' && entry.status !== 'queued' && entry.status !== 'verify_then_outreach')) return;
    setAssigningId(entry.id);
    try {
      await marketingOpsService.updateProspectQueue(entry.id, { assigned_to: currentUserId });
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to assign');
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async (entry: ProspectQueueEntry) => {
    if (entry.status !== 'intake' && entry.status !== 'queued' && entry.status !== 'verify_then_outreach') return;
    setAssigningId(entry.id);
    try {
      await marketingOpsService.updateProspectQueue(entry.id, { assigned_to: null });
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to unassign');
    } finally {
      setAssigningId(null);
    }
  };

  const handleTransition = async (campaignId: string, toStage: string) => {
    setTransitioningId(campaignId);
    setOpenMenuId(null);
    setChecklistError(null);
    try {
      await marketingOpsService.transitionStage(campaignId, { to_stage: toStage as any });
      await onRefresh();
    } catch (err: any) {
      // Checklist soft-gate — surface the incomplete steps dialog.
      if (err?.code === 'checklist_incomplete' && Array.isArray(err?.incompleteSteps)) {
        setChecklistError({ campaignId, steps: err.incompleteSteps });
      } else {
        onError(err.message || 'Failed to transition stage');
      }
    } finally {
      setTransitioningId(null);
    }
  };

  const handleProceedAnyway = async () => {
    if (!checklistError) return;
    // Re-fire the last transition with acknowledge_incomplete: true.
    // We don't track the "to" stage here, so the user re-selects from the menu.
    // For v1 simplicity, we close the dialog and let them retry — the retry
    // will include acknowledge_incomplete automatically via the menu.
    setChecklistError(null);
  };

  // ─── Verify-then-outreach handlers ───────────────────────────────────

  const handleRequestVerification = async (id: string) => {
    setVerifyingId(id);
    onError('');
    try {
      await marketingOpsService.requestVerification(id);
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to request verification');
    } finally {
      setVerifyingId(null);
    }
  };

  // Intake graduation (Migration 310) — promote an unvetted public-sourced
  // record to the queue or verify lane; dismissal uses the shared handler.
  const handleGraduate = async (id: string, target: 'queued' | 'verify_then_outreach') => {
    setVerifyingId(id);
    onError('');
    try {
      await marketingOpsService.graduateProspectQueue(id, target);
      await onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to graduate intake entry');
    } finally {
      setVerifyingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  // Column set follows the shared status tab: 'all' shows the funnel —
  // pre-campaign lanes, then the PG cadence lanes (in_thread / hold), then
  // the campaign-stage lanes. A focused tab shows only its lane ('created'
  // = the stage lanes; 'dismissed' = the dismissed lane).
  const closedCols = showClosed
    ? CLOSED_STAGES.filter((s) => transitions[s] !== undefined || s === 'closed')
    : [];
  const allColumns =
    statusFocus === 'all'
      ? ['__intake__', '__queued__', '__verify__', '__in_thread__', '__hold__', ...stageColumns, ...closedCols]
      : statusFocus === 'campaign_created'
        ? [...stageColumns, ...closedCols]
        : statusFocus === 'intake'
          ? ['__intake__']
          : statusFocus === 'queued'
            ? ['__queued__']
            : statusFocus === 'verify_then_outreach'
              ? ['__verify__']
              : statusFocus === 'in_thread'
                ? ['__in_thread__']
                : statusFocus === 'hold'
                  ? ['__hold__']
                  : ['__dismissed__'];

  return (
    <div>
      {/* Pipeline toggle + Show closed — only relevant while the
          campaign-stage lanes are on screen. */}
      {(statusFocus === 'all' || statusFocus === 'campaign_created') && (
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <button
            onClick={() => setPipelineMode('review')}
            className={`px-3 py-1.5 text-xs font-medium ${pipelineMode === 'review' ? 'bg-violet-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'}`}
          >
            Review Pipeline
          </button>
          <button
            onClick={() => setPipelineMode('recovery')}
            className={`px-3 py-1.5 text-xs font-medium ${pipelineMode === 'recovery' ? 'bg-violet-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'}`}
          >
            Recovery Pipeline
          </button>
        </div>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded" />
          Show closed
        </label>
      </div>
      )}

      {/* Board columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {allColumns.map((colKey) => {
            const isIntake = colKey === '__intake__';
            const isQueued = colKey === '__queued__';
            const isVerify = colKey === '__verify__';
            const isInThread = colKey === '__in_thread__';
            const isHold = colKey === '__hold__';
            const isDismissedLane = colKey === '__dismissed__';
            const colEntries = isIntake
              ? intakeEntries
              : isQueued
                ? queuedEntries
                : isVerify
                  ? verifyEntries
                  : isInThread
                    ? inThreadEntries
                    : isHold
                      ? holdEntries
                      : isDismissedLane
                        ? dismissedEntries
                        : (campaignEntriesByStage[colKey] ?? []);
            const colLabel = isIntake
              ? 'Intake'
              : isQueued
                ? 'Queued'
                : isVerify
                  ? 'Verify'
                  : isInThread
                    ? 'In Thread'
                    : isHold
                      ? 'Hold'
                      : isDismissedLane
                        ? 'Dismissed'
                        : (STAGE_LABELS[colKey] ?? colKey);
            const isClosedCol = CLOSED_STAGES.includes(colKey);
            return (
              <div key={colKey} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-b-2 ${
                  isIntake
                    ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-400'
                    : isQueued
                      ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400'
                      : isVerify
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400'
                        : isInThread
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400'
                          : isHold
                            ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-400'
                            : isDismissedLane
                              ? 'bg-gray-100 dark:bg-neutral-700/40 border-gray-300 dark:border-neutral-600'
                              : isClosedCol
                                ? 'bg-gray-100 dark:bg-neutral-700/40 border-gray-300 dark:border-neutral-600'
                                : 'bg-gray-50 dark:bg-neutral-700/30 border-gray-200 dark:border-neutral-600'
                }`}>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
                    {isIntake && <Inbox className="w-3 h-3 text-sky-600 dark:text-sky-400" />}
                    {isVerify && <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                    {isInThread && <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                    {isHold && <Calendar className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                    {colLabel}
                  </span>
                  <span className="text-xs text-gray-400">{colEntries.length}</span>
                </div>

                {/* Column body */}
                <div className="space-y-2 pt-2 min-h-[120px]">
                  {colEntries.length === 0 && (
                    <p className="text-center text-xs text-gray-300 dark:text-neutral-600 py-4">—</p>
                  )}
                  {colEntries.map((entry) => (
                    <BoardCard
                      key={entry.id}
                      entry={entry}
                      isIntake={isIntake}
                      isQueued={isQueued}
                      isVerify={isVerify}
                      isWorklist={isInThread || isHold}
                      isDismissedLane={isDismissedLane}
                      staffUsers={staffUsers}
                      currentUserId={currentUserId}
                      creating={creatingId === entry.id}
                      dismissing={dismissingId === entry.id}
                      togglingPriority={togglingPriorityId === entry.id}
                      assigning={assigningId === entry.id}
                      transitioning={transitioningId === entry.processed_campaign_id}
                      menuOpen={openMenuId === entry.id}
                      dismissReasonOpen={dismissReasonOpen === entry.id}
                      verifying={verifyingId === entry.id}
                      validNextStages={isIntake || isQueued || isVerify || isInThread || isHold || isDismissedLane ? [] : (transitions[entry.campaign_stage ?? ''] ?? [])}
                      onCreate={() => handleCreateCampaign(entry.id)}
                      onDismiss={(reason) => handleDismiss(entry.id, reason)}
                      onTogglePriority={() => handleTogglePriority(entry)}
                      onAssignToMe={() => handleAssignToMe(entry)}
                      onUnassign={() => handleUnassign(entry)}
                      onToggleMenu={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                      onTransition={(toStage) => entry.processed_campaign_id && handleTransition(entry.processed_campaign_id, toStage)}
                      onOpenDismissReason={() => setDismissReasonOpen(dismissReasonOpen === entry.id ? null : entry.id)}
                      onRequestVerify={() => handleRequestVerification(entry.id)}
                      onGraduate={(target) => handleGraduate(entry.id, target)}
                      onOpenResolve={() => setResolveEntry(entry)}
                      onLogTouch={() => setLogModalEntry(entry)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checklist soft-gate dialog */}
      {checklistError && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Checklist incomplete</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Required checklist steps are not complete. Proceed anyway?
                </p>
              </div>
            </div>
            <ul className="mb-4 space-y-1 max-h-40 overflow-auto">
              {checklistError.steps.map((s) => (
                <li key={s.id} className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {s.title}
                  {s.stage_tag && (
                    <span className="text-[9px] text-gray-400">({s.stage_tag.replace(/_/g, ' ')})</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setChecklistError(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                Cancel
              </button>
              <button
                onClick={handleProceedAnyway}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
              >
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify-then-outreach resolution modal (shared) */}
      {resolveEntry && (
        <ResolveVerificationModal
          entry={resolveEntry}
          onClose={() => setResolveEntry(null)}
          onResolved={onRefresh}
        />
      )}

      {/* Proving-ground worklist lanes: the shared touch logger writes the
          canonical seed touch and advances the cadence ladder. */}
      {logModalEntry && (
        <ProspectTouchLogModal
          entry={logModalEntry}
          onClose={() => setLogModalEntry(null)}
          onLogged={async () => {
            setLogModalEntry(null);
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ─── BoardCard subcomponent ──────────────────────────────────────────────

interface BoardCardProps {
  entry: ProspectQueueEntry;
  isIntake?: boolean;
  isQueued: boolean;
  isVerify?: boolean;
  // Proving-ground cadence lanes (in_thread / hold) — seeded worklist cards.
  isWorklist?: boolean;
  isDismissedLane?: boolean;
  staffUsers: ReturnType<typeof useStaffUsers>;
  currentUserId: string | null;
  creating: boolean;
  dismissing: boolean;
  togglingPriority: boolean;
  assigning: boolean;
  transitioning: boolean;
  menuOpen: boolean;
  dismissReasonOpen: boolean;
  verifying: boolean;
  validNextStages: string[];
  onCreate: () => void;
  onDismiss: (reason?: ProspectDismissReason) => void;
  onTogglePriority: () => void;
  onAssignToMe: () => void;
  onUnassign: () => void;
  onToggleMenu: () => void;
  onTransition: (toStage: string) => void;
  onOpenDismissReason: () => void;
  onRequestVerify: () => void;
  onGraduate: (target: 'queued' | 'verify_then_outreach') => void;
  onOpenResolve: () => void;
  onLogTouch: () => void;
}

function BoardCard({
  entry, isIntake, isQueued, isVerify, isWorklist, isDismissedLane, staffUsers, currentUserId,
  creating, dismissing, togglingPriority, assigning, transitioning,
  menuOpen, dismissReasonOpen, verifying, validNextStages,
  onCreate, onDismiss, onTogglePriority, onAssignToMe, onUnassign, onToggleMenu, onTransition, onOpenDismissReason,
  onRequestVerify, onGraduate, onOpenResolve, onLogTouch,
}: BoardCardProps) {
  const signals = entry.detected_signals ?? [];
  const crisis = hasCrisis(signals);
  // Pre-campaign filter: a resolved non-operational verification blocks create.
  const verificationBlocked = !verificationClearsCampaign(entry.verification?.outcome);
  const assigneeLabel = staffDisplayName(staffUsers, entry.assigned_to);
  const auditDays = daysSince(entry.audit_date);
  const stageDays = daysSince(entry.stage_entered_at);
  const isStaleAudit = auditDays != null && auditDays > STALE_AUDIT_DAYS;
  const isStaleStage = stageDays != null && stageDays > 14;
  // Verify-then-outreach and intake entries are editable (assign, priority,
  // note) — same as queued. Intake cards render the graduate/dismiss pair
  // instead of Create/Dismiss; verify cards render the resolve/dismiss pair.
  const isEditable = isQueued || isVerify || isIntake;

  return (
    <div className={`rounded-lg border p-3 bg-white dark:bg-neutral-800 ${
      crisis
        ? 'border-red-300 dark:border-red-800'
        : signals.length > 0
          ? 'border-amber-200 dark:border-amber-800'
          : 'border-gray-200 dark:border-neutral-700'
    }`}>
      {/* Header: name + hot/priority indicators */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        {isQueued || isVerify || isIntake || isWorklist || isDismissedLane ? (
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate inline-flex items-center gap-1">
            {isVerify && <Phone className="w-3 h-3 text-amber-500 flex-shrink-0" />}
            {entry.title || entry.business_name || `${entry.category ?? ''} · ${entry.city ?? ''}`.trim().replace(/^·|·$/g, '').trim() || 'Untitled prospect'}
          </span>
        ) : (
          <Link
            href={entry.processed_campaign_id ? `/settings/admin/marketing-ops/campaigns/${entry.processed_campaign_id}` : '#'}
            className="font-medium text-sm text-gray-900 dark:text-white truncate hover:underline"
          >
            {entry.title || entry.business_name || `${entry.category ?? ''} · ${entry.city ?? ''}`.trim().replace(/^·|·$/g, '').trim() || 'Untitled prospect'}
          </Link>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.is_hot_prospect && <Flame className="w-3 h-3 text-orange-500" />}
          {isEditable && entry.priority === 'high' && (
            <button
              onClick={onTogglePriority}
              disabled={togglingPriority}
              className="text-red-500 hover:text-red-600"
              title="High priority — click to lower"
            >
              {togglingPriority ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
            </button>
          )}
          {isEditable && entry.priority === 'normal' && (
            <button
              onClick={onTogglePriority}
              disabled={togglingPriority}
              className="text-gray-300 hover:text-gray-500"
              title="Normal priority — click to raise"
            >
              {togglingPriority ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Secondary: business name when title is the primary heading */}
      {entry.title && entry.business_name && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{entry.business_name}</div>
      )}

      {/* City + category */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        {[entry.city, entry.state].filter(Boolean).join(', ') || '—'}
        {entry.category && (
          <>
            <span>·</span>
            <span className="rounded bg-gray-100 dark:bg-neutral-700 px-1 py-0.5 text-[9px]">{entry.category}</span>
          </>
        )}
        {entry.source_scope && (
          <span className="rounded bg-gray-100 dark:bg-neutral-700 px-1 py-0.5 text-[9px]">{entry.source_scope}</span>
        )}
      </div>

      {/* Proving-ground membership — links to the cockpit. */}
      {entry.proving_ground && (
        <div className="mb-1.5">
          <Link
            href={`/settings/admin/marketing-ops/proving-grounds/${entry.proving_ground.id}`}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50"
            title={`Proving ground: ${entry.proving_ground.title ?? [entry.proving_ground.category, entry.proving_ground.city].filter(Boolean).join(' · ') ?? entry.proving_ground.id}`}
          >
            <FlaskConical className="w-2.5 h-2.5" />
            {entry.proving_ground.title ?? [entry.proving_ground.category, entry.proving_ground.city].filter(Boolean).join(' · ') ?? 'Proving ground'}
          </Link>
        </div>
      )}

      {entry.verification && (
        <div className="mb-1.5">
          <VerificationBadge verification={entry.verification} />
        </div>
      )}

      {/* Stage badge for campaign cards */}
      {!isQueued && !isVerify && !isIntake && !isWorklist && !isDismissedLane && entry.campaign_stage && (
        <div className="mb-1.5">
          <StageBadge stage={entry.campaign_stage} size="sm" />
          {stageDays != null && (
            <span className={`ml-1.5 text-[10px] ${isStaleStage ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400'}`}>
              {stageDays}d in stage
            </span>
          )}
        </div>
      )}

      {/* Signals */}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {signals.slice(0, 3).map((code) => {
            const family = code.split('_')[0];
            return (
              <span
                key={code}
                className={`inline-block rounded px-1 py-0.5 text-[9px] font-mono ${SIGNAL_FAMILY_COLORS[family] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                title={code}
              >
                {code}
              </span>
            );
          })}
          {signals.length > 3 && (
            <span className="text-[9px] text-gray-400" title={signals.slice(3).join(', ')}>
              +{signals.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Rating + audit date */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
        {entry.rating != null && <span>★ {Number(entry.rating).toFixed(1)}{entry.review_count != null ? ` · ${entry.review_count}` : ''}</span>}
        {entry.audit_date && (
          <span className={`inline-flex items-center gap-0.5 ${isStaleAudit ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            <Calendar className="w-2.5 h-2.5" />
            audit: {new Date(entry.audit_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-1 text-[10px] mb-2">
        {isEditable ? (
          <>
            <span className={assigneeLabel ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'}>
              {assigneeLabel ?? 'Unassigned'}
            </span>
            {assigning ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-400" />
            ) : assigneeLabel ? (
              <button onClick={onUnassign} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Unassign">
                <UserX className="w-2.5 h-2.5" />
              </button>
            ) : (
              <button onClick={onAssignToMe} className="text-blue-600 dark:text-blue-400 hover:underline" title="Assign to me">
                <UserPlus className="w-2.5 h-2.5" />
              </button>
            )}
          </>
        ) : (
          assigneeLabel && <span className="text-gray-500 dark:text-gray-400">{assigneeLabel}</span>
        )}
      </div>

      {/* Queued time + queued_by */}
      <div className="text-[10px] text-gray-400 mb-2">
        {relativeTime(entry.created_at)}
        {entry.queued_by && ` by ${staffDisplayName(staffUsers, entry.queued_by)?.slice(0, 20) ?? entry.queued_by.slice(0, 8)}`}
      </div>

      {/* Note preview */}
      {entry.note && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mb-2" title={entry.note}>
          {entry.note}
        </p>
      )}

      {/* PG cadence lanes — channel ladder (current rung highlighted) and
          the next-touch due label, mirroring the list's worklist rows. */}
      {isWorklist && entry.seed_id && entry.channel_sequence && entry.channel_sequence.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5" title="Channel ladder — current rung highlighted">
          {entry.channel_sequence.map((rung, i) => (
            <span
              key={i}
              className={`inline-block rounded px-1 py-0.5 text-[9px] font-medium ${
                rung.status === 'dead'
                  ? 'bg-gray-100 text-gray-400 line-through dark:bg-neutral-700 dark:text-gray-500'
                  : i === (entry.current_channel_index ?? 0)
                    ? (CHANNEL_CHIP[rung.channel] ?? CHANNEL_CHIP.other) + ' ring-1 ring-current'
                    : 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
              }`}
              title={`${rung.channel}${rung.contact ? ` · ${rung.contact}` : ''}${rung.status === 'dead' ? ' (dead)' : ''}`}
            >
              {rung.channel}
            </span>
          ))}
        </div>
      )}
      {isWorklist && entry.next_touch_at && (() => {
        const label = dueLabel(entry.next_touch_at);
        const due = new Date(entry.next_touch_at).getTime() <= Date.now();
        return (
          <div className={`text-[10px] mb-1.5 ${due ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-400'}`}>
            {due ? '● due now' : `next: ${label}`}
          </div>
        );
      })()}
      {isWorklist && entry.account_family && (
        <div className="mb-1.5">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
            title="Account family — prospects sharing an owner share one operator and one thread"
          >
            family: {entry.account_family}
          </span>
        </div>
      )}

      {/* Actions */}
      {isIntake ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-neutral-700">
          <button
            onClick={() => onGraduate('queued')}
            disabled={verifying}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50"
            title="Accept — graduate this intake record into the prospect queue"
          >
            {verifying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
            Accept
          </button>
          <button
            onClick={() => onGraduate('verify_then_outreach')}
            disabled={verifying}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
            title="Verify — graduate into the phone-verification gate (confirm NAP/operational status before outreach)"
          >
            {verifying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Phone className="w-2.5 h-2.5" />}
            Verify
          </button>
          {dismissReasonOpen ? (
            <div className="inline-flex items-center gap-1">
              <select
                onChange={(e) => onDismiss(e.target.value as ProspectDismissReason)}
                value=""
                autoFocus
                className="text-[10px] px-1 py-0.5 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              >
                <option value="" disabled>Reason…</option>
                {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
              <button onClick={onOpenDismissReason} className="text-gray-400 hover:text-gray-600"><X className="w-2.5 h-2.5" /></button>
            </div>
          ) : (
            <button
              onClick={onOpenDismissReason}
              disabled={dismissing}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              {dismissing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
              Dismiss
            </button>
          )}
        </div>
      ) : isQueued ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-neutral-700">
          <button
            onClick={onCreate}
            disabled={creating || verificationBlocked}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50"
            title={verificationBlocked
              ? 'Blocked — this prospect failed verification (closed/unreachable). Re-verify as operational first.'
              : undefined}
          >
            {creating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
            Create
          </button>
          {/* Verify-then-outreach: gate behind a phone call */}
          <button
            onClick={onRequestVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
            title="Move to Verify column — gate outreach on a phone call to confirm operational status"
          >
            {verifying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Phone className="w-2.5 h-2.5" />}
            Verify
          </button>
          {dismissReasonOpen ? (
            <div className="inline-flex items-center gap-1">
              <select
                onChange={(e) => onDismiss(e.target.value as ProspectDismissReason)}
                value=""
                autoFocus
                className="text-[10px] px-1 py-0.5 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              >
                <option value="" disabled>Reason…</option>
                {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
              <button onClick={onOpenDismissReason} className="text-gray-400 hover:text-gray-600"><X className="w-2.5 h-2.5" /></button>
            </div>
          ) : (
            <button
              onClick={onOpenDismissReason}
              disabled={dismissing}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              {dismissing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
              Dismiss
            </button>
          )}
        </div>
      ) : isVerify ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-neutral-700">
          <button
            onClick={onOpenResolve}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
            title="Resolve verification — record call outcome and verified NAP"
          >
            <Phone className="w-2.5 h-2.5" />
            Resolve
          </button>
          {dismissReasonOpen ? (
            <div className="inline-flex items-center gap-1">
              <select
                onChange={(e) => onDismiss(e.target.value as ProspectDismissReason)}
                value=""
                autoFocus
                className="text-[10px] px-1 py-0.5 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              >
                <option value="" disabled>Reason…</option>
                {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
              <button onClick={onOpenDismissReason} className="text-gray-400 hover:text-gray-600"><X className="w-2.5 h-2.5" /></button>
            </div>
          ) : (
            <button
              onClick={onOpenDismissReason}
              disabled={dismissing}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              {dismissing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
              Dismiss
            </button>
          )}
        </div>
      ) : isWorklist ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-neutral-700">
          {/* Seeded worklist rows log an outcome — the cadence advances the
              ladder and schedules the next touch. Hold rows unlock when the
              hold date passes (same gate as the list view). */}
          {entry.seed_id && (
            entry.status === 'in_thread' ||
            (entry.status === 'hold' && entry.next_touch_at && new Date(entry.next_touch_at) <= new Date())
          ) && (
            <button
              onClick={onLogTouch}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded hover:bg-teal-100 dark:hover:bg-teal-900/50"
              title="Log an outreach outcome — the cadence advances the ladder and schedules the next touch"
            >
              <Phone className="w-2.5 h-2.5" />
              Log
            </button>
          )}
          {entry.processed_campaign_id && (
            <Link
              href={`/settings/admin/marketing-ops/campaigns/${entry.processed_campaign_id}`}
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline ml-auto"
            >
              View campaign →
            </Link>
          )}
        </div>
      ) : isDismissedLane ? (
        <div className="pt-1 border-t border-gray-100 dark:border-neutral-700">
          <span className="text-[10px] text-gray-400">
            {entry.dismissed_reason ? entry.dismissed_reason.replace(/_/g, ' ') : 'dismissed'}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-neutral-700">
          <Link
            href={entry.processed_campaign_id ? `/settings/admin/marketing-ops/campaigns/${entry.processed_campaign_id}` : '#'}
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
          >
            View campaign →
          </Link>
          {/* Stage advance overflow menu */}
          <div className="relative">
            <button
              onClick={onToggleMenu}
              disabled={transitioning || validNextStages.length === 0}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              title="Advance stage"
            >
              {transitioning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ChevronRight className="w-2.5 h-2.5" />}
              Advance
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {menuOpen && validNextStages.length > 0 && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                {validNextStages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => onTransition(stage)}
                    className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700"
                  >
                    → {STAGE_LABELS[stage] ?? stage}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
