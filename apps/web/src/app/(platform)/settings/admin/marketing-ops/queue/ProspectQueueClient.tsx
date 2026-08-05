'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Plus, Loader2, Flag, Star, MapPin, Flame, Inbox, X,
  Pencil, Check, ExternalLink, UserPlus, UserX, Table as TableIcon, LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  ProspectQueueEntry, ProspectStatus, ProspectPriority, ProspectDismissReason,
  AddToQueueInput, AddToQueueResult,
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
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  category_analysis: 'Category Analysis',
  city_category_audit: 'City Category Audit',
  scan_unmatched: 'Scan Unmatched',
  manual: 'Manual',
};

const DISMISS_REASONS: ProspectDismissReason[] = ['already_customer', 'bad_fit', 'duplicate', 'other'];

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

  // Filters
  const [statusTab, setStatusTab] = useState<ProspectStatus>('queued');
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

  // "Add to Queue" modal — lets operators capture a hot prospect discovered
  // during a deep dive, outside the audit "Add to queue" context.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    business_name: '',
    category: '',
    city: '',
    state: '',
    priority: 'normal' as ProspectPriority,
    note: '',
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
        status: isBoard ? ['queued', 'campaign_created'] : statusTab,
        assigned_to: assignedToMe && (isBoard || statusTab === 'queued') ? 'me' : undefined,
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
    if (entry.status !== 'queued') return;
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
    if (!currentUserId || entry.status !== 'queued') return;
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
    if (entry.status !== 'queued') return;
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

  const openAddModal = () => {
    setAddForm({
      business_name: '',
      category: '',
      city: '',
      state: '',
      priority: 'normal',
      note: '',
    });
    setAddFeedback(null);
    setAddModalOpen(true);
  };

  const handleAddToQueue = async () => {
    const businessName = addForm.business_name.trim();
    if (!businessName) {
      setAddFeedback({ kind: 'exists', message: 'Business name is required.' });
      return;
    }
    setAddingToQueue(true);
    setAddFeedback(null);
    try {
      const input: AddToQueueInput = {
        business_name: businessName,
        category: addForm.category.trim() || undefined,
        city: addForm.city.trim() || undefined,
        state: addForm.state.trim() || undefined,
        source_kind: 'manual',
        priority: addForm.priority,
        note: addForm.note.trim() || undefined,
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
          message: 'A campaign already exists for this business.',
        });
      } else if (result.kind === 'already_queued') {
        setAddFeedback({ kind: 'already', message: 'Already in the queue.' });
      } else {
        setAddFeedback({ kind: 'created', message: 'Added to the queue.' });
        setAddForm({ business_name: '', category: '', city: '', state: '', priority: 'normal', note: '' });
        await fetchQueue();
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

          {/* Assigned to me toggle (only relevant for queued) */}
          {statusTab === 'queued' && (
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
                        {/* Business */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 dark:text-white">{entry.business_name}</span>
                            {entry.is_hot_prospect && <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                          </div>
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
                          <span className="text-gray-600 dark:text-gray-400">{SOURCE_KIND_LABELS[entry.source_kind] ?? entry.source_kind}</span>
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
                          {entry.status === 'queued' ? (
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
                          {entry.status === 'queued' ? (
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
                                  title="Create a business-scope campaign from this prospect"
                                >
                                  {creatingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                  Create
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

              {/* Business name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.business_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, business_name: e.target.value }))}
                  autoFocus
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
                onClick={handleAddToQueue}
                disabled={addingToQueue || !addForm.business_name.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {addingToQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
