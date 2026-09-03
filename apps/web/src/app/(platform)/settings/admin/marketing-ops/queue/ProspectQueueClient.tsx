'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Plus, Loader2, Flag, Star, MapPin, Flame, Inbox, X,
  Pencil, Check, ExternalLink, UserPlus, UserX, Table as TableIcon, LayoutGrid,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  ProspectQueueEntry, ProspectStatus, ProspectPriority, ProspectDismissReason,
  AddToQueueInput, AddToQueueResult, CampaignScope,
  VerificationResolutionInput, VerificationOutcome, OwnerReceptivity, VerificationNextAction,
} from '@/services/MarketingOpsService';
import { useStaffUsers, staffDisplayName } from '@/components/marketing-ops/PlatformUserSelect';
import ProspectQueueBoard from '@/components/marketing-ops/ProspectQueueBoard';

// ─── Constants ───────────────────────────────────────────────────────────

const CRISIS_SIGNALS = ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'];

const SIGNAL_FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  INT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  category_analysis: 'Category Analysis',
  city_category_audit: 'City Category Audit',
  scan_unmatched: 'Scan Unmatched',
  manual: 'Manual',
  intelligence_seek: 'Intelligence Seek',
};

const DISMISS_REASONS: ProspectDismissReason[] = ['already_customer', 'bad_fit', 'duplicate', 'unverified_closed', 'other'];

const SCOPE_LABELS: Record<string, string> = {
  business: 'Business',
  category: 'Category',
  city: 'City',
  intelligence: 'Intelligence',
};

const SCOPE_BADGE_COLORS: Record<string, string> = {
  business: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
  category: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  city: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  intelligence: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hasCrisis(signals: string[] | undefined): boolean {
  return !!signals?.some((s) => CRISIS_SIGNALS.includes(s));
}

function rowBorderClass(entry: ProspectQueueEntry): string {
  if (entry.status !== 'queued') return 'border-gray-200 dark:border-neutral-700';
  const signals = entry.detected_signals ?? [];
  if (hasCrisis(signals)) return 'border-red-300 dark:border-red-800';
  if (signals.length > 0) return 'border-amber-200 dark:border-amber-800';
  return 'border-gray-200 dark:border-neutral-700';
}

// ─── Component ───────────────────────────────────────────────────────────

export default function ProspectQueueClient() {
  const [entries, setEntries] = useState<ProspectQueueEntry[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode — persists in localStorage so operators land on their preferred view.
  const [viewMode, setViewMode] = useState<'list' | 'board'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('prospectQueueView') as 'list' | 'board') ?? 'list';
    }
    return 'list';
  });
  const toggleViewMode = (mode: 'list' | 'board') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('prospectQueueView', mode);
  };

  // Filters — status tab can be deep-linked via ?status= (e.g. from
  // discovery surfaces that send a prospect straight to verify_then_outreach).
  const initialStatus: ProspectStatus = (() => {
    if (typeof window === 'undefined') return 'queued';
    const param = new URLSearchParams(window.location.search).get('status');
    if (param === 'verify_then_outreach' || param === 'queued' || param === 'campaign_created' || param === 'dismissed') {
      return param as ProspectStatus;
    }
    return 'queued';
  })();
  const [statusTab, setStatusTab] = useState<ProspectStatus>(initialStatus);
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Row-level action state
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReasonOpen, setDismissReasonOpen] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [togglingPriorityId, setTogglingPriorityId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Verify-then-outreach (Migration 255)
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

  // "Add to Queue" modal — lets operators capture a hot prospect discovered
  // during a deep dive, outside the audit "Add to queue" context.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    business_name: '',
    title: '',
    category: '',
    city: '',
    state: '',
    priority: 'normal' as ProspectPriority,
    note: '',
    scope: 'business' as CampaignScope,
  });
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{ kind: 'created' | 'already' | 'exists'; campaignId?: string; message: string } | null>(null);

  const staffUsers = useStaffUsers();
  // The current user's id — used for "assign to me". We don't have a direct
  // hook here, so we fall back to the first staff user's id only as a last
  // resort for the assign action label; the backend uses req.user.id.
  const currentUserId = staffUsers[0]?.id ?? null;

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Board view needs both queued + campaign_created entries and the
      // campaign join (for stage columns). List view uses the active status tab.
      const isBoard = viewMode === 'board';
      const result = await marketingOpsService.listProspectQueue({
        status: isBoard ? ['queued', 'verify_then_outreach', 'campaign_created'] : statusTab,
        assigned_to: assignedToMe && (isBoard || statusTab === 'queued' || statusTab === 'verify_then_outreach') ? 'me' : undefined,
        category: categoryFilter || undefined,
        city: cityFilter || undefined,
        limit: 200,
        includeCampaigns: isBoard,
      });
      setEntries(result.entries);
      setQueuedCount(result.queuedCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load prospect queue');
    } finally {
      setLoading(false);
    }
  }, [statusTab, assignedToMe, categoryFilter, cityFilter, viewMode]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ─── Row actions ──────────────────────────────────────────────────────

  const handleCreateCampaign = async (id: string) => {
    setCreatingId(id);
    setError(null);
    try {
      await marketingOpsService.createCampaignFromQueue(id);
      // Refresh — the row will now show status=campaign_created with a link.
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setCreatingId(null);
    }
  };

  const handleDismiss = async (id: string, reason?: ProspectDismissReason) => {
    setDismissingId(id);
    setError(null);
    try {
      await marketingOpsService.dismissProspectQueue(id, reason);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss entry');
    } finally {
      setDismissingId(null);
      setDismissReasonOpen(null);
    }
  };

  const handleTogglePriority = async (entry: ProspectQueueEntry) => {
    if (entry.status !== 'queued' && entry.status !== 'verify_then_outreach') return;
    setTogglingPriorityId(entry.id);
    try {
      const newPriority: ProspectPriority = entry.priority === 'high' ? 'normal' : 'high';
      await marketingOpsService.updateProspectQueue(entry.id, { priority: newPriority });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, priority: newPriority } : e));
    } catch (err: any) {
      setError(err.message || 'Failed to update priority');
    } finally {
      setTogglingPriorityId(null);
    }
  };

  const handleSaveNote = async (id: string) => {
    setSavingNoteId(id);
    try {
      await marketingOpsService.updateProspectQueue(id, { note: noteDraft || null });
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: noteDraft || null } : e));
      setEditingNoteId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleAssignToMe = async (entry: ProspectQueueEntry) => {
    if (!currentUserId || (entry.status !== 'queued' && entry.status !== 'verify_then_outreach')) return;
    setAssigningId(entry.id);
    try {
      await marketingOpsService.updateProspectQueue(entry.id, { assigned_to: currentUserId });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, assigned_to: currentUserId } : e));
    } catch (err: any) {
      setError(err.message || 'Failed to assign');
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async (entry: ProspectQueueEntry) => {
    if (entry.status !== 'queued' && entry.status !== 'verify_then_outreach') return;
    setAssigningId(entry.id);
    try {
      await marketingOpsService.updateProspectQueue(entry.id, { assigned_to: null });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, assigned_to: null, assigned_at: null } : e));
    } catch (err: any) {
      setError(err.message || 'Failed to unassign');
    } finally {
      setAssigningId(null);
    }
  };

  // ─── Verify-then-outreach handlers (Migration 255) ──────────────────

  const handleRequestVerification = async (id: string) => {
    setVerifyingId(id);
    setError(null);
    try {
      await marketingOpsService.requestVerification(id);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to request verification');
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
      await fetchQueue();
    } catch (err: any) {
      setResolveError(err.message || 'Failed to resolve verification');
    } finally {
      setResolving(false);
    }
  };

  const openAddModal = () => {
    setAddForm({
      business_name: '',
      title: '',
      category: '',
      city: '',
      state: '',
      priority: 'normal',
      note: '',
      scope: 'business',
    });
    setAddFeedback(null);
    setAddModalOpen(true);
  };

  const handleAddToQueue = async (keepOpen: boolean) => {
    const businessName = addForm.business_name.trim();
    // title is required for all entries (primary dedup key).
    if (!addForm.title.trim()) {
      setAddFeedback({ kind: 'exists', message: 'Title is required.' });
      return;
    }
    // business_name is required only for business-scope entries.
    if (addForm.scope === 'business' && !businessName) {
      setAddFeedback({ kind: 'exists', message: 'Business name is required for business-scope entries.' });
      return;
    }
    setAddingToQueue(true);
    setAddFeedback(null);
    try {
      const input: AddToQueueInput = {
        business_name: businessName || undefined,
        title: addForm.title.trim(),
        category: addForm.category.trim() || undefined,
        city: addForm.city.trim() || undefined,
        state: addForm.state.trim() || undefined,
        source_kind: 'manual',
        priority: addForm.priority,
        note: addForm.note.trim() || undefined,
        scope: addForm.scope,
        business_snapshot: {
          rating: null,
          review_count: null,
          location: [addForm.city, addForm.state].filter(Boolean).join(', ') || null,
        },
      };
      const result: AddToQueueResult = await marketingOpsService.addToQueue(input);
      if (result.kind === 'campaign_exists') {
        setAddFeedback({
          kind: 'exists',
          campaignId: result.campaignId,
          message: 'A campaign already exists for this prospect.',
        });
      } else if (result.kind === 'already_queued') {
        setAddFeedback({ kind: 'already', message: 'Already in the queue.' });
      } else {
        await fetchQueue();
        if (keepOpen) {
          // "Save and New" — clear the form, show brief confirmation, keep modal open.
          setAddForm({ business_name: '', title: '', category: '', city: '', state: '', priority: 'normal', note: '', scope: 'business' });
          setAddFeedback({ kind: 'created', message: 'Added to the queue. Add another?' });
        } else {
          // "Add to Queue" — close the modal immediately.
          setAddModalOpen(false);
        }
      }
    } catch (err: any) {
      setAddFeedback({ kind: 'exists', message: err.message || 'Failed to add to queue' });
    } finally {
      setAddingToQueue(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────

  const categoryOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.category).filter(Boolean))) as string[],
    [entries],
  );
  const cityOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.city).filter(Boolean))) as string[],
    [entries],
  );

  const statusTabs: { key: ProspectStatus; label: string; count: number }[] = [
    { key: 'queued', label: 'Queued', count: queuedCount },
    { key: 'verify_then_outreach', label: 'Verify', count: entries.filter((e) => e.status === 'verify_then_outreach').length },
    { key: 'campaign_created', label: 'Created', count: entries.filter((e) => e.status === 'campaign_created').length },
    { key: 'dismissed', label: 'Dismissed', count: entries.filter((e) => e.status === 'dismissed').length },
  ];

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prospect Queue</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {queuedCount} queued prospect{queuedCount !== 1 ? 's' : ''} awaiting action
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* List / Board view toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
              <button
                onClick={() => toggleViewMode('list')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${
                  viewMode === 'list'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
                title="List view"
              >
                <TableIcon className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => toggleViewMode('board')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${
                  viewMode === 'board'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
                title="Board view (mini kanban)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
              title="Manually add a prospect to the queue (outside an audit)"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Queue
            </button>
            <button
              onClick={fetchQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter bar — list view only */}
        {viewMode === 'list' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Status tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  statusTab === tab.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Assigned to me toggle (relevant for queued + verify) */}
          {(statusTab === 'queued' || statusTab === 'verify_then_outreach') && (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
                className="rounded"
              />
              Assigned to me + unassigned
            </label>
          )}

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 text-gray-900 dark:text-white"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* City filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 text-gray-900 dark:text-white"
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading queue…
          </div>
        )}

        {/* Empty state — list view only */}
        {viewMode === 'list' && !loading && entries.length === 0 && (
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {statusTab === 'queued'
                ? 'No queued prospects. Use "Add to Queue" above or "Queue" on any audit card to capture prospects for later.'
                : statusTab === 'verify_then_outreach'
                  ? 'No prospects pending verification. Move a queued prospect to "Verify" when NAP is unverified and a phone call is needed before outreach.'
                  : `No ${statusTab === 'campaign_created' ? 'created' : 'dismissed'} entries.`}
            </p>
          </div>
        )}

        {/* Table — list view only */}
        {viewMode === 'list' && !loading && entries.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-700/30 border-b border-gray-200 dark:border-neutral-700">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Business</th>
                    <th className="px-3 py-2">Signals</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Queued</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Assigned</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                  {entries.map((entry) => {
                    const signals = entry.detected_signals ?? [];
                    const crisis = hasCrisis(signals);
                    const assigneeLabel = staffDisplayName(staffUsers, entry.assigned_to);
                    return (
                      <tr key={entry.id} className={`border-l-4 ${rowBorderClass(entry)} hover:bg-gray-50 dark:hover:bg-neutral-700/20`}>
                        {/* Business / Title */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {entry.title || entry.business_name || `${entry.category ?? ''} · ${entry.city ?? ''}`.trim().replace(/^·|·$/g, '').trim() || 'Untitled prospect'}
                            </span>
                            {entry.is_hot_prospect && <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                          </div>
                          {entry.title && entry.business_name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry.business_name}</div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {[entry.city, entry.state].filter(Boolean).join(', ') || '—'}
                          </div>
                        </td>

                        {/* Signals */}
                        <td className="px-3 py-2">
                          {signals.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-[180px]">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                crisis
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}>
                                {signals.length}
                              </span>
                              {signals.slice(0, 2).map((code) => {
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
                              {signals.length > 2 && (
                                <span className="text-[9px] text-gray-400" title={signals.slice(2).join(', ')}>
                                  +{signals.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {/* Intelligence discovery signals (Sprint 3) */}
                          {entry.discovery_signals && entry.discovery_signals.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1 max-w-[180px]">
                              {entry.discovery_signals.slice(0, 3).map((code) => (
                                <span
                                  key={code}
                                  className="inline-block rounded px-1 py-0.5 text-[9px] font-mono bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                                  title={code}
                                >
                                  {code}
                                </span>
                              ))}
                              {entry.discovery_signals.length > 3 && (
                                <span className="text-[9px] text-gray-400" title={entry.discovery_signals.slice(3).join(', ')}>
                                  +{entry.discovery_signals.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Business Seek Priority badge (Sprint 3) */}
                          {entry.business_seek_priority && entry.business_seek_priority !== 'normal' && (
                            <div className="mt-1">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                entry.business_seek_priority === 'hold'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : entry.business_seek_priority === 'high'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`} title="Business Seek priority from intelligence discovery">
                                {entry.business_seek_priority}
                              </span>
                            </div>
                          )}
                          {/* Provenance count + run link (Sprint 3) */}
                          {entry.discovery_provenance && entry.discovery_provenance.length > 0 && (
                            <div className="text-[9px] text-gray-400 mt-1" title={entry.discovery_provenance.map(p => `${p.source} (${p.role})`).join(', ')}>
                              {entry.discovery_provenance.length} source{entry.discovery_provenance.length !== 1 ? 's' : ''}
                              {entry.intelligence_run_id && (
                                <> · <a href={`/api/admin/marketing-ops/intelligence-runs/${entry.intelligence_run_id}`} className="text-blue-500 hover:underline">run</a></>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Rating */}
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          {entry.rating != null ? (
                            <div className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-amber-400" />
                              {Number(entry.rating).toFixed(1)}
                              {entry.review_count != null && <span className="text-gray-400 ml-1">· {entry.review_count}</span>}
                            </div>
                          ) : '—'}
                        </td>

                        {/* Source */}
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600 dark:text-gray-400">{SOURCE_KIND_LABELS[entry.source_kind] ?? entry.source_kind}</span>
                            {entry.source_scope && entry.source_scope !== 'business' && (
                              <span
                                className={`rounded px-1 py-0.5 text-[9px] font-semibold ${SCOPE_BADGE_COLORS[entry.source_scope] ?? SCOPE_BADGE_COLORS.business}`}
                                title={`Campaign scope: ${entry.source_scope}`}
                              >
                                {SCOPE_LABELS[entry.source_scope] ?? entry.source_scope}
                              </span>
                            )}
                          </div>
                          {entry.source_campaign_id && (
                            <Link
                              href={`/settings/admin/marketing-ops/campaigns/${entry.source_campaign_id}`}
                              className="block text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              parent campaign
                            </Link>
                          )}
                        </td>

                        {/* Queued */}
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                          {relativeTime(entry.created_at)}
                          {entry.queued_by && (
                            <div className="text-[10px] text-gray-400">
                              by {staffDisplayName(staffUsers, entry.queued_by) ?? entry.queued_by.slice(0, 8)}
                            </div>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="px-3 py-2">
                          {(entry.status === 'queued' || entry.status === 'verify_then_outreach') ? (
                            <button
                              onClick={() => handleTogglePriority(entry)}
                              disabled={togglingPriorityId === entry.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                entry.priority === 'high'
                                  ? 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300'
                                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-700'
                              } disabled:opacity-50`}
                              title={entry.priority === 'high' ? 'High priority — click to lower' : 'Normal priority — click to raise'}
                            >
                              {togglingPriorityId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                              {entry.priority}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">{entry.priority}</span>
                          )}
                        </td>

                        {/* Assigned */}
                        <td className="px-3 py-2 text-xs">
                          {(entry.status === 'queued' || entry.status === 'verify_then_outreach') ? (
                            <div className="flex items-center gap-1">
                              <span className={assigneeLabel ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
                                {assigneeLabel ?? 'Unassigned'}
                              </span>
                              {assigningId === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                              ) : assigneeLabel ? (
                                <button
                                  onClick={() => handleUnassign(entry)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                  title="Unassign"
                                >
                                  <UserX className="w-3 h-3" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAssignToMe(entry)}
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  title="Assign to me"
                                >
                                  <UserPlus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">{assigneeLabel ?? '—'}</span>
                          )}
                        </td>

                        {/* Note */}
                        <td className="px-3 py-2 text-xs">
                          {editingNoteId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNote(entry.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                                placeholder="Add note…"
                                autoFocus
                                className="w-32 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                              />
                              <button onClick={() => handleSaveNote(entry.id)} disabled={savingNoteId === entry.id} className="text-green-600 hover:text-green-700">
                                {savingNoteId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                              <button onClick={() => setEditingNoteId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingNoteId(entry.id); setNoteDraft(entry.note ?? ''); }}
                              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 max-w-[140px]"
                            >
                              {entry.note ? (
                                <span className="truncate" title={entry.note}>{entry.note}</span>
                              ) : (
                                <Pencil className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {entry.status === 'queued' ? (
                              <>
                                <button
                                  onClick={() => handleCreateCampaign(entry.id)}
                                  disabled={creatingId === entry.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50"
                                  title={`Create a ${entry.source_scope ?? 'business'}-scope campaign from this prospect`}
                                >
                                  {creatingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                  Create
                                </button>
                                <button
                                  onClick={() => handleRequestVerification(entry.id)}
                                  disabled={verifyingId === entry.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
                                  title="Gate outreach on a phone call to confirm operational status"
                                >
                                  {verifyingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                                  Verify
                                </button>
                                {dismissReasonOpen === entry.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <select
                                      onChange={(e) => handleDismiss(entry.id, e.target.value as ProspectDismissReason)}
                                      value=""
                                      autoFocus
                                      className="text-xs px-1 py-1 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                                    >
                                      <option value="" disabled>Reason…</option>
                                      {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                    </select>
                                    <button onClick={() => setDismissReasonOpen(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDismissReasonOpen(entry.id)}
                                    disabled={dismissingId === entry.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                                  >
                                    {dismissingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    Dismiss
                                  </button>
                                )}
                              </>
                            ) : entry.status === 'verify_then_outreach' ? (
                              <>
                                <button
                                  onClick={() => openResolveModal(entry)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
                                  title="Resolve verification — record call outcome and verified NAP"
                                >
                                  <Phone className="w-3 h-3" />
                                  Resolve
                                </button>
                                {dismissReasonOpen === entry.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <select
                                      onChange={(e) => handleDismiss(entry.id, e.target.value as ProspectDismissReason)}
                                      value=""
                                      autoFocus
                                      className="text-xs px-1 py-1 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                                    >
                                      <option value="" disabled>Reason…</option>
                                      {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                    </select>
                                    <button onClick={() => setDismissReasonOpen(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDismissReasonOpen(entry.id)}
                                    disabled={dismissingId === entry.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                                  >
                                    {dismissingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    Dismiss
                                  </button>
                                )}
                              </>
                            ) : entry.status === 'campaign_created' && entry.processed_campaign_id ? (
                              <Link
                                href={`/settings/admin/marketing-ops/campaigns/${entry.processed_campaign_id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View campaign
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {entry.dismissed_reason ? entry.dismissed_reason.replace(/_/g, ' ') : 'dismissed'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Board view */}
        {viewMode === 'board' && !loading && (
          <ProspectQueueBoard
            entries={entries}
            onRefresh={fetchQueue}
            onError={(msg) => setError(msg || null)}
          />
        )}
      </div>

      {/* Add to Queue modal — manual prospect capture */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !addingToQueue && setAddModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add Prospect to Queue</h2>
              <button
                onClick={() => !addingToQueue && setAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                disabled={addingToQueue}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Capture a hot prospect discovered outside an audit. Source will be recorded as <span className="font-medium">Manual</span>.
              </p>

              {/* Campaign scope — determines what kind of campaign "Create" will build */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Campaign scope
                </label>
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden w-full">
                  {(['business', 'category', 'city', 'intelligence'] as CampaignScope[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, scope: s }))}
                      disabled={addingToQueue}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium capitalize disabled:opacity-50 ${
                        addForm.scope === s
                          ? 'bg-violet-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-300 dark:hover:bg-neutral-700'
                      }`}
                      title={
                        s === 'business'
                          ? 'One campaign focused on this single business (default)'
                          : s === 'category'
                            ? 'A category-level campaign; this business is the triggering prospect'
                            : s === 'city'
                              ? 'A city-level campaign; this business is the triggering prospect'
                              : 'An intelligence-scope discovery campaign; this business is the triggering prospect'
                      }
                    >
                      {SCOPE_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  {addForm.scope === 'business'
                    ? 'Create will build a business-scope campaign for this one business.'
                    : `Create will build a ${addForm.scope}-scope campaign; a business name is optional.`}
                </p>
              </div>

              {/* Title — required, primary dedup key for campaign-exists check */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                  disabled={addingToQueue}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="e.g. Homer Hills Fleet Services — Review Recovery"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  Required. Used as the primary dedup key (title + city + state) to prevent false-positive campaign collisions. Forwarded to the campaign on Create.
                </p>
              </div>

              {/* Business name — required for business scope, optional otherwise */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business name
                  {addForm.scope === 'business'
                    ? <span className="text-red-500"> *</span>
                    : <span className="text-gray-400 font-normal"> (optional)</span>}
                </label>
                <input
                  type="text"
                  value={addForm.business_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, business_name: e.target.value }))}
                  autoFocus={addForm.scope === 'business'}
                  disabled={addingToQueue}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="e.g. Joe's Pizza"
                />
              </div>

              {/* Category + City */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={addForm.category}
                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                    disabled={addingToQueue}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="restaurant"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={addForm.city}
                    onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                    disabled={addingToQueue}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="Austin"
                  />
                </div>
              </div>

              {/* State + Priority */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                  <input
                    type="text"
                    value={addForm.state}
                    onChange={(e) => setAddForm((f) => ({ ...f, state: e.target.value }))}
                    disabled={addingToQueue}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="TX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={addForm.priority}
                    onChange={(e) => setAddForm((f) => ({ ...f, priority: e.target.value as ProspectPriority }))}
                    disabled={addingToQueue}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                <textarea
                  value={addForm.note}
                  onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
                  disabled={addingToQueue}
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="Optional context (e.g. discovered while auditing a competitor)"
                />
              </div>

              {/* Feedback */}
              {addFeedback && (
                <div className={`rounded-lg px-3 py-2 text-xs ${
                  addFeedback.kind === 'created'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : addFeedback.kind === 'already'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                  <span>{addFeedback.message}</span>
                  {addFeedback.kind === 'exists' && addFeedback.campaignId && (
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${addFeedback.campaignId}`}
                      className="ml-1 underline hover:no-underline"
                    >
                      View campaign
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-neutral-700">
              <button
                onClick={() => setAddModalOpen(false)}
                disabled={addingToQueue}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => handleAddToQueue(true)}
                disabled={addingToQueue || !addForm.title.trim() || (addForm.scope === 'business' && !addForm.business_name.trim())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-50"
                title="Save and keep the modal open for another entry"
              >
                {addingToQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Save and New
              </button>
              <button
                onClick={() => handleAddToQueue(false)}
                disabled={addingToQueue || !addForm.title.trim() || (addForm.scope === 'business' && !addForm.business_name.trim())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {addingToQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify-then-outreach resolution modal (Migration 255) */}
      {resolveModalEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resolve verification</h3>
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

            {(resolveForm.outcome === 'operational' || resolveForm.outcome === 'relocated') && (
              <div className="mb-3 space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Verified NAP</label>
                <input type="text" placeholder="Business name" value={resolveForm.verifiedName}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedName: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
                <input type="tel" placeholder="Phone" value={resolveForm.verifiedPhone}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedPhone: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
                <input type="text" placeholder="Street address" value={resolveForm.verifiedAddress}
                  onChange={(e) => setResolveForm((f) => ({ ...f, verifiedAddress: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
                <div className="flex gap-2">
                  <input type="text" placeholder="City" value={resolveForm.verifiedCity}
                    onChange={(e) => setResolveForm((f) => ({ ...f, verifiedCity: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
                  <input type="text" placeholder="State" value={resolveForm.verifiedState}
                    onChange={(e) => setResolveForm((f) => ({ ...f, verifiedState: e.target.value }))}
                    className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
                </div>
              </div>
            )}

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

            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Call notes</label>
            <textarea rows={3} value={resolveForm.callNotes}
              onChange={(e) => setResolveForm((f) => ({ ...f, callNotes: e.target.value }))}
              className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />

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
              <button onClick={handleResolve} disabled={resolving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50">
                {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
