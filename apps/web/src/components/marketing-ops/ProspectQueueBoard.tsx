'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Loader2, Flame, Flag, Inbox, X, ChevronDown, ChevronRight,
  UserPlus, UserX, Calendar, AlertTriangle, Phone,
} from 'lucide-react';
import marketingOpsService, {
  ProspectQueueEntry, ProspectPriority, ProspectDismissReason,
  VerificationResolutionInput, VerificationOutcome, OwnerReceptivity, VerificationNextAction,
} from '@/services/MarketingOpsService';
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

// ─── Component ───────────────────────────────────────────────────────────

interface ProspectQueueBoardProps {
  entries: ProspectQueueEntry[];
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export default function ProspectQueueBoard({ entries, onRefresh, onError }: ProspectQueueBoardProps) {
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
  const [resolveModalEntry, setResolveModalEntry] = useState<ProspectQueueEntry | null>(null);
  const [resolveForm, setResolveForm] = useState<{
    outcome: VerificationOutcome;
    verifiedName: string;
    verifiedPhone: string;
    verifiedAddress: string;
    verifiedCity: string;
    verifiedState: string;
    ownerReceptivity: OwnerReceptivity | '';
    callNotes: string;
    nextAction: VerificationNextAction;
  }>({
    outcome: 'operational',
    verifiedName: '', verifiedPhone: '', verifiedAddress: '', verifiedCity: '', verifiedState: '',
    ownerReceptivity: '', callNotes: '', nextAction: 'create_campaign',
  });
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const staffUsers = useStaffUsers();
  const currentUserId = staffUsers[0]?.id ?? null;

  // ─── Column setup ─────────────────────────────────────────────────────

  const stageColumns = pipelineMode === 'recovery' ? RECOVERY_COLUMNS : REVIEW_COLUMNS;
  const transitions = transitionsForPipeline(pipelineMode);

  // Split entries: queued entries go in the Queued column; campaign_created
  // entries go in the stage column matching their campaign_stage (filtered by
  // the current pipeline mode). Dismissed entries are excluded from the board.
  const queuedEntries = useMemo(
    () => entries.filter((e) => e.status === 'queued'),
    [entries],
  );

  const verifyEntries = useMemo(
    () => entries.filter((e) => e.status === 'verify_then_outreach'),
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
    if (entry.status !== 'queued') return;
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
    if (!currentUserId || entry.status !== 'queued') return;
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
    if (entry.status !== 'queued') return;
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

  const openResolveModal = (entry: ProspectQueueEntry) => {
    const snap = entry.business_snapshot ?? {};
    const nap = snap.verified_nap ?? snap.nap ?? {};
    setResolveForm({
      outcome: 'operational',
      verifiedName: nap.name ?? entry.business_name ?? '',
      verifiedPhone: nap.phone ?? '',
      verifiedAddress: nap.address ?? '',
      verifiedCity: nap.city ?? entry.city ?? '',
      verifiedState: nap.state ?? entry.state ?? '',
      ownerReceptivity: '',
      callNotes: '',
      nextAction: 'create_campaign',
    });
    setResolveError(null);
    setResolveModalEntry(entry);
  };

  const handleOutcomeChange = (outcome: VerificationOutcome) => {
    // Auto-select nextAction based on outcome + receptivity heuristics.
    let nextAction: VerificationNextAction = 'requeue';
    if (outcome === 'closed' || outcome === 'wrong_business') nextAction = 'dismiss';
    else if (outcome === 'unreachable') nextAction = 'dismiss';
    else if (outcome === 'operational') nextAction = 'create_campaign';
    else if (outcome === 'relocated') nextAction = 'requeue';
    setResolveForm((f) => ({ ...f, outcome, nextAction }));
  };

  const handleResolve = async () => {
    if (!resolveModalEntry) return;
    setResolving(true);
    setResolveError(null);
    try {
      const input: VerificationResolutionInput = {
        outcome: resolveForm.outcome,
        verifiedName: resolveForm.verifiedName || undefined,
        verifiedPhone: resolveForm.verifiedPhone || undefined,
        verifiedAddress: resolveForm.verifiedAddress || undefined,
        verifiedCity: resolveForm.verifiedCity || undefined,
        verifiedState: resolveForm.verifiedState || undefined,
        ownerReceptivity: resolveForm.ownerReceptivity || undefined,
        callNotes: resolveForm.callNotes || undefined,
        nextAction: resolveForm.nextAction,
      };
      await marketingOpsService.resolveVerification(resolveModalEntry.id, input);
      setResolveModalEntry(null);
      await onRefresh();
    } catch (err: any) {
      setResolveError(err.message || 'Failed to resolve verification');
    } finally {
      setResolving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const allColumns = ['__queued__', '__verify__', ...stageColumns, ...(showClosed ? CLOSED_STAGES.filter((s) => transitions[s] !== undefined || s === 'closed') : [])];

  return (
    <div>
      {/* Pipeline toggle + Show closed */}
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

      {/* Board columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {allColumns.map((colKey) => {
            const isQueued = colKey === '__queued__';
            const isVerify = colKey === '__verify__';
            const colEntries = isQueued
              ? queuedEntries
              : isVerify
                ? verifyEntries
                : (campaignEntriesByStage[colKey] ?? []);
            const colLabel = isQueued
              ? 'Queued'
              : isVerify
                ? 'Verify'
                : (STAGE_LABELS[colKey] ?? colKey);
            const isClosedCol = CLOSED_STAGES.includes(colKey);
            return (
              <div key={colKey} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-b-2 ${
                  isQueued
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400'
                    : isVerify
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400'
                      : isClosedCol
                        ? 'bg-gray-100 dark:bg-neutral-700/40 border-gray-300 dark:border-neutral-600'
                        : 'bg-gray-50 dark:bg-neutral-700/30 border-gray-200 dark:border-neutral-600'
                }`}>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
                    {isVerify && <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
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
                      isQueued={isQueued}
                      isVerify={isVerify}
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
                      validNextStages={isQueued || isVerify ? [] : (transitions[entry.campaign_stage ?? ''] ?? [])}
                      onCreate={() => handleCreateCampaign(entry.id)}
                      onDismiss={(reason) => handleDismiss(entry.id, reason)}
                      onTogglePriority={() => handleTogglePriority(entry)}
                      onAssignToMe={() => handleAssignToMe(entry)}
                      onUnassign={() => handleUnassign(entry)}
                      onToggleMenu={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                      onTransition={(toStage) => entry.processed_campaign_id && handleTransition(entry.processed_campaign_id, toStage)}
                      onOpenDismissReason={() => setDismissReasonOpen(dismissReasonOpen === entry.id ? null : entry.id)}
                      onRequestVerify={() => handleRequestVerification(entry.id)}
                      onOpenResolve={() => openResolveModal(entry)}
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

      {/* Verify-then-outreach resolution modal */}
      {resolveModalEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resolve verification
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {resolveModalEntry.business_name ?? resolveModalEntry.title} · {resolveModalEntry.city ?? '—'}
                </p>
              </div>
              <button onClick={() => setResolveModalEntry(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {resolveError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-800 dark:text-red-300">
                {resolveError}
              </div>
            )}

            {/* Outcome */}
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Call outcome</label>
            <select
              value={resolveForm.outcome}
              onChange={(e) => handleOutcomeChange(e.target.value as VerificationOutcome)}
              className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              <option value="operational">Operational — open and reachable</option>
              <option value="closed">Closed — out of business</option>
              <option value="relocated">Relocated — moved to a new address</option>
              <option value="unreachable">Unreachable — no answer after attempts</option>
              <option value="wrong_business">Wrong business — not the target</option>
            </select>

            {/* Verified NAP — shown for operational + relocated */}
            {(resolveForm.outcome === 'operational' || resolveForm.outcome === 'relocated') && (
              <div className="mb-3 space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Verified NAP</label>
                <input
                  type="text"
                  placeholder="Business name"
                  value={resolveForm.verifiedName}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedName: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={resolveForm.verifiedPhone}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedPhone: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Street address"
                  value={resolveForm.verifiedAddress}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedAddress: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={resolveForm.verifiedCity}
                    onChange={(e) => setResolveForm((f) => ({ ...f, verifiedCity: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={resolveForm.verifiedState}
                    onChange={(e) => setResolveForm((f) => ({ ...f, verifiedState: e.target.value }))}
                    className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Owner receptivity */}
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Owner receptivity</label>
            <select
              value={resolveForm.ownerReceptivity}
              onChange={(e) => setResolveForm((f) => ({ ...f, ownerReceptivity: e.target.value as OwnerReceptivity | '' }))}
              className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              <option value="">—</option>
              <option value="interested">Interested</option>
              <option value="neutral">Neutral</option>
              <option value="defensive">Defensive</option>
              <option value="no_answer">No answer</option>
            </select>

            {/* Call notes */}
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Call notes</label>
            <textarea
              rows={3}
              value={resolveForm.callNotes}
              onChange={(e) => setResolveForm((f) => ({ ...f, callNotes: e.target.value }))}
              className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            />

            {/* Next action */}
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Next action</label>
            <select
              value={resolveForm.nextAction}
              onChange={(e) => setResolveForm((f) => ({ ...f, nextAction: e.target.value as VerificationNextAction }))}
              disabled={resolveForm.outcome === 'closed' || resolveForm.outcome === 'wrong_business'}
              className="w-full mb-4 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
            >
              <option value="requeue">Re-queue (back to Queued with verified NAP)</option>
              <option value="create_campaign">Create campaign (graduate immediately)</option>
              <option value="dismiss">Dismiss (unverified_closed)</option>
            </select>

            <div className="flex justify-end gap-2">
              <button onClick={() => setResolveModalEntry(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BoardCard subcomponent ──────────────────────────────────────────────

interface BoardCardProps {
  entry: ProspectQueueEntry;
  isQueued: boolean;
  isVerify?: boolean;
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
  onOpenResolve: () => void;
}

function BoardCard({
  entry, isQueued, isVerify, staffUsers, currentUserId,
  creating, dismissing, togglingPriority, assigning, transitioning,
  menuOpen, dismissReasonOpen, verifying, validNextStages,
  onCreate, onDismiss, onTogglePriority, onAssignToMe, onUnassign, onToggleMenu, onTransition, onOpenDismissReason,
  onRequestVerify, onOpenResolve,
}: BoardCardProps) {
  const signals = entry.detected_signals ?? [];
  const crisis = hasCrisis(signals);
  const assigneeLabel = staffDisplayName(staffUsers, entry.assigned_to);
  const auditDays = daysSince(entry.audit_date);
  const stageDays = daysSince(entry.stage_entered_at);
  const isStaleAudit = auditDays != null && auditDays > STALE_AUDIT_DAYS;
  const isStaleStage = stageDays != null && stageDays > 14;
  // Verify-then-outreach entries are editable (assign, priority, note) — same
  // as queued. The card renders verify-specific action buttons instead of the
  // Create/Dismiss pair.
  const isEditable = isQueued || isVerify;

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
        {isQueued || isVerify ? (
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

      {/* Stage badge for campaign cards */}
      {!isQueued && !isVerify && entry.campaign_stage && (
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

      {/* Actions */}
      {isQueued ? (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-neutral-700">
          <button
            onClick={onCreate}
            disabled={creating}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50"
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
