'use client';

/**
 * PlaybookCatalogClient — Sprint 4 admin UI
 *
 * Two tabs:
 *   1. Playbooks — table with code, category, archetype, fees, active status,
 *      priority_rank reorder (up/down), and a Rule Builder editor for
 *      matching_rules DSL.
 *   2. Signals — signal registry manager with code, family badge, label,
 *      detection_source, active toggle, and register-signal modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ChevronUp, ChevronDown, X, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import marketingOpsService, {
  type PlaybookCatalogEntry,
  type PlaybookCreateInput,
  type MatchingRules,
  type SignalRegistryEntry,
} from '@/services/MarketingOpsService';
import RuleBuilder from './RuleBuilder';
import ChecklistBuilderTab from './ChecklistBuilderTab';

const ARCHETYPES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
const CATEGORIES = ['review_management', 'recovery_management', 'triage_management'];
const PLAYBOOK_CODES = ['PB-01', 'PB-02', 'PB-03', 'PB-04', 'PB-05', 'PB-06', 'PB-07', 'PB-08'];
const DETECTION_SOURCES = ['model_emitted', 'derived', 'operator_input'];

const FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  review_management: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recovery_management: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  triage_management: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function familyColor(code: string): string {
  return FAMILY_COLORS[code.split('_')[0]] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const emptyRules = (): MatchingRules => ({
  any: [],
  all: [],
  none: [],
  dual: null,
  confidence: 0.85,
});

const emptyPlaybookForm = (): PlaybookCreateInput => ({
  code: '',
  name: '',
  category: 'review_management',
  archetype: 'A1',
  description: '',
  matching_rules: emptyRules(),
  priority_rank: 99,
  fitd_offer_title: '',
  fitd_default_fee_cents: 10000,
  retainer_pitch_title: '',
  retainer_fee_cents: 20000,
  is_active: true,
});

export default function PlaybookCatalogClient() {
  const [tab, setTab] = useState<'playbooks' | 'signals' | 'checklist'>('playbooks');
  const [playbooks, setPlaybooks] = useState<PlaybookCatalogEntry[]>([]);
  const [signals, setSignals] = useState<SignalRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Playbook editor state
  const [editingPlaybook, setEditingPlaybook] = useState<PlaybookCatalogEntry | null>(null);
  const [showPlaybookForm, setShowPlaybookForm] = useState(false);
  const [playbookForm, setPlaybookForm] = useState<PlaybookCreateInput>(emptyPlaybookForm());
  const [savingPlaybook, setSavingPlaybook] = useState(false);

  // Signal editor state
  const [showSignalForm, setShowSignalForm] = useState(false);
  // `editingSignal` is null for register/clone, set for edit. `code` is empty
  // for clone (user must enter a new unique code) and read-only for edit.
  const [editingSignal, setEditingSignal] = useState<SignalRegistryEntry | null>(null);
  const [signalForm, setSignalForm] = useState({
    code: '',
    family: '',
    label: '',
    description: '',
    detection_source: 'model_emitted',
    is_active: true,
  });
  const [savingSignal, setSavingSignal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pbs, sigs] = await Promise.all([
        marketingOpsService.listPlaybooks(),
        marketingOpsService.listSignals(),
      ]);
      setPlaybooks(pbs);
      setSignals(sigs);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Playbook CRUD ──────────────────────────────────────────────────

  const handleEditPlaybook = (pb: PlaybookCatalogEntry) => {
    setEditingPlaybook(pb);
    setPlaybookForm({
      code: pb.code,
      name: pb.name,
      category: pb.category,
      archetype: pb.archetype,
      description: pb.description ?? '',
      matching_rules: pb.matchingRules,
      priority_rank: pb.priorityRank,
      fitd_offer_title: pb.fitdOfferTitle,
      fitd_default_fee_cents: pb.fitdDefaultFeeCents,
      retainer_pitch_title: pb.retainerPitchTitle,
      retainer_fee_cents: pb.retainerFeeCents,
      opener_prompt_template_id: pb.openerPromptTemplateId ?? undefined,
      preview_deliverable_type: pb.previewDeliverableType ?? undefined,
      is_active: pb.isActive,
    });
    setShowPlaybookForm(true);
  };

  const handleNewPlaybook = () => {
    setEditingPlaybook(null);
    setPlaybookForm(emptyPlaybookForm());
    setShowPlaybookForm(true);
  };

  const handleSavePlaybook = async () => {
    setSavingPlaybook(true);
    setError(null);
    try {
      if (editingPlaybook) {
        await marketingOpsService.updatePlaybook(editingPlaybook.id, playbookForm);
        setSuccess(`Updated ${playbookForm.code}`);
      } else {
        await marketingOpsService.createPlaybook(playbookForm);
        setSuccess(`Created ${playbookForm.code}`);
      }
      setShowPlaybookForm(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save playbook');
    } finally {
      setSavingPlaybook(false);
    }
  };

  const handleDeletePlaybook = async (id: string, code: string) => {
    if (!confirm(`Delete playbook ${code}? This cannot be undone.`)) return;
    try {
      await marketingOpsService.deletePlaybook(id);
      setSuccess(`Deleted ${code}`);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to delete playbook');
    }
  };

  const handleReorder = async (idx: number, direction: 'up' | 'down') => {
    const sorted = [...playbooks].sort((a, b) => a.priorityRank - b.priorityRank);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const rankings = [
      { id: a.id, priority_rank: b.priorityRank },
      { id: b.id, priority_rank: a.priorityRank },
    ];
    try {
      await marketingOpsService.reorderPlaybooks(rankings);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to reorder');
    }
  };

  // ─── Signal CRUD ────────────────────────────────────────────────────

  /**
   * Count playbooks whose matching_rules reference this signal code in any
   * of the any/all/none/dual sets. Used for the delete confirmation so the
   * operator sees the blast radius before removing a code.
   */
  const countPlaybookReferences = (code: string): number => {
    return playbooks.filter((pb) => {
      const r = pb.matchingRules;
      if (r.any?.includes(code)) return true;
      if (r.all?.includes(code)) return true;
      if (r.none?.includes(code)) return true;
      if (r.dual && (r.dual.groupA?.includes(code) || r.dual.groupB?.includes(code))) return true;
      return false;
    }).length;
  };

  const handleNewSignal = () => {
    setEditingSignal(null);
    setSignalForm({ code: '', family: '', label: '', description: '', detection_source: 'model_emitted', is_active: true });
    setShowSignalForm(true);
  };

  const handleEditSignal = (signal: SignalRegistryEntry) => {
    setEditingSignal(signal);
    setSignalForm({
      code: signal.code,
      family: signal.family,
      label: signal.label,
      description: signal.description ?? '',
      detection_source: signal.detectionSource,
      is_active: signal.isActive,
    });
    setShowSignalForm(true);
  };

  const handleCloneSignal = (signal: SignalRegistryEntry) => {
    setEditingSignal(null);
    setSignalForm({
      code: '',
      family: signal.family,
      label: signal.label,
      description: signal.description ?? '',
      detection_source: signal.detectionSource,
      is_active: signal.isActive,
    });
    setShowSignalForm(true);
  };

  const handleSaveSignal = async () => {
    setSavingSignal(true);
    setError(null);
    try {
      if (editingSignal) {
        // Edit mode: code is immutable, send the other fields.
        await marketingOpsService.updateSignal(editingSignal.id, {
          family: signalForm.family,
          label: signalForm.label,
          description: signalForm.description || null,
          detection_source: signalForm.detection_source,
          is_active: signalForm.is_active,
        });
        setSuccess(`Updated signal ${editingSignal.code}`);
      } else {
        // Register / clone: a new unique code is required.
        await marketingOpsService.createSignal({
          code: signalForm.code,
          family: signalForm.family,
          label: signalForm.label,
          description: signalForm.description || undefined,
          detection_source: signalForm.detection_source,
          is_active: signalForm.is_active,
        });
        setSuccess(`Registered signal ${signalForm.code}`);
      }
      setShowSignalForm(false);
      setEditingSignal(null);
      setSignalForm({ code: '', family: '', label: '', description: '', detection_source: 'model_emitted', is_active: true });
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save signal');
    } finally {
      setSavingSignal(false);
    }
  };

  const handleToggleSignalActive = async (signal: SignalRegistryEntry) => {
    try {
      await marketingOpsService.updateSignal(signal.id, { is_active: !signal.isActive });
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle signal');
    }
  };

  const handleDeleteSignal = async (id: string, code: string) => {
    const refCount = countPlaybookReferences(code);
    const msg = refCount > 0
      ? `Delete signal ${code}?\n\nThis code is referenced by ${refCount} playbook${refCount === 1 ? '' : 's'}' matching rules. Those playbooks will stop matching on this code and may no longer fire for campaigns that previously triaged to them.\n\nThis cannot be undone.`
      : `Delete signal ${code}?\n\nNo playbooks currently reference this code.\n\nThis cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      await marketingOpsService.deleteSignal(id);
      setSuccess(`Deleted signal ${code}`);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to delete signal');
    }
  };

  const sortedPlaybooks = [...playbooks].sort((a, b) => a.priorityRank - b.priorityRank);

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-neutral-700">
        <button
          onClick={() => setTab('playbooks')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'playbooks'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Playbooks ({playbooks.length})
        </button>
        <button
          onClick={() => setTab('signals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'signals'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Signal Registry ({signals.length})
        </button>
        <button
          onClick={() => setTab('checklist')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === 'checklist'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Checklist Builder
        </button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : tab === 'playbooks' ? (
        /* ─── Playbooks tab ─── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cascade order = priority_rank. The triage engine evaluates playbooks top-to-bottom; first match wins.
            </p>
            <button
              onClick={handleNewPlaybook}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" /> New Playbook
            </button>
          </div>

          {/* Playbook table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Rank</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Archetype</th>
                  <th className="text-right px-3 py-2 font-medium">FITD</th>
                  <th className="text-right px-3 py-2 font-medium">Retainer</th>
                  <th className="text-center px-3 py-2 font-medium">Active</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {sortedPlaybooks.map((pb, idx) => (
                  <tr key={pb.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{pb.priorityRank}</span>
                        <button onClick={() => handleReorder(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleReorder(idx, 'down')} disabled={idx === sortedPlaybooks.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-white">{pb.code}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{pb.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[pb.category] ?? 'bg-gray-100 text-gray-700'}`}>
                        {pb.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{pb.archetype}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatCents(pb.fitdDefaultFeeCents)}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatCents(pb.retainerFeeCents)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${pb.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => handleEditPlaybook(pb)} className="text-gray-400 hover:text-blue-600" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeletePlaybook(pb.id, pb.code)} className="text-gray-400 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Playbook edit/create modal */}
          {showPlaybookForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-auto">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {editingPlaybook ? `Edit ${editingPlaybook.code}` : 'New Playbook'}
                  </h3>
                  <button onClick={() => setShowPlaybookForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Basic fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Code">
                      <select value={playbookForm.code} onChange={(e) => setPlaybookForm({ ...playbookForm, code: e.target.value })} disabled={!!editingPlaybook} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                        <option value="">Select code...</option>
                        {PLAYBOOK_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Name">
                      <input type="text" value={playbookForm.name} onChange={(e) => setPlaybookForm({ ...playbookForm, name: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                    <Field label="Category">
                      <select value={playbookForm.category} onChange={(e) => setPlaybookForm({ ...playbookForm, category: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </Field>
                    <Field label="Archetype">
                      <select value={playbookForm.archetype} onChange={(e) => setPlaybookForm({ ...playbookForm, archetype: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                        {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                    <Field label="Priority Rank">
                      <input type="number" min={0} max={999} value={playbookForm.priority_rank} onChange={(e) => setPlaybookForm({ ...playbookForm, priority_rank: parseInt(e.target.value) || 99 })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                    <Field label="Active">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={playbookForm.is_active} onChange={(e) => setPlaybookForm({ ...playbookForm, is_active: e.target.checked })} />
                        <span className="text-gray-600 dark:text-gray-400">Playbook is active (evaluated by triage engine)</span>
                      </label>
                    </Field>
                    <Field label="FITD Offer Title">
                      <input type="text" value={playbookForm.fitd_offer_title} onChange={(e) => setPlaybookForm({ ...playbookForm, fitd_offer_title: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                    <Field label="FITD Fee (cents)">
                      <input type="number" min={0} value={playbookForm.fitd_default_fee_cents} onChange={(e) => setPlaybookForm({ ...playbookForm, fitd_default_fee_cents: parseInt(e.target.value) || 0 })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                    <Field label="Retainer Pitch Title">
                      <input type="text" value={playbookForm.retainer_pitch_title} onChange={(e) => setPlaybookForm({ ...playbookForm, retainer_pitch_title: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                    <Field label="Retainer Fee (cents)">
                      <input type="number" min={0} value={playbookForm.retainer_fee_cents} onChange={(e) => setPlaybookForm({ ...playbookForm, retainer_fee_cents: parseInt(e.target.value) || 0 })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                    </Field>
                  </div>

                  <Field label="Description">
                    <textarea value={playbookForm.description} onChange={(e) => setPlaybookForm({ ...playbookForm, description: e.target.value })} rows={2} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </Field>

                  {/* Rule Builder */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Matching Rules (DSL)</h4>
                    <RuleBuilder
                      rules={playbookForm.matching_rules ?? emptyRules()}
                      signals={signals}
                      onChange={(rules) => setPlaybookForm({ ...playbookForm, matching_rules: rules })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
                  <button onClick={() => setShowPlaybookForm(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
                    Cancel
                  </button>
                  <button onClick={handleSavePlaybook} disabled={savingPlaybook} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                    {savingPlaybook ? 'Saving...' : 'Save Playbook'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'signals' ? (
        /* ─── Signals tab ─── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Signal codes as data. The triage engine and audit prompts reference these codes. Derived signals also need extractor code to fire.
            </p>
            <button
              onClick={handleNewSignal}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" /> Register Signal
            </button>
          </div>

          {/* Signal table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">Family</th>
                  <th className="text-left px-3 py-2 font-medium">Label</th>
                  <th className="text-left px-3 py-2 font-medium">Detection</th>
                  <th className="text-center px-3 py-2 font-medium">Active</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {signals.map((sig) => (
                  <tr key={sig.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${familyColor(sig.code)}`}>
                        {sig.code}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{sig.family}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{sig.label}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{sig.detectionSource.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleToggleSignalActive(sig)} className={`inline-block w-2 h-2 rounded-full ${sig.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`} title={sig.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => handleEditSignal(sig)} className="text-gray-400 hover:text-blue-600" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleCloneSignal(sig)} className="text-gray-400 hover:text-blue-600" title="Clone">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteSignal(sig.id, sig.code)} className="text-gray-400 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signal register modal */}
          {showSignalForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-auto">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full my-8">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {editingSignal ? `Edit Signal — ${editingSignal.code}` : 'Register Signal'}
                  </h3>
                  <button onClick={() => { setShowSignalForm(false); setEditingSignal(null); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <Field label={editingSignal ? 'Code (immutable)' : 'Code (FAMILY_UPPER_SNAKE)'}>
                    <input
                      type="text"
                      value={signalForm.code}
                      onChange={(e) => setSignalForm({ ...signalForm, code: e.target.value.toUpperCase() })}
                      placeholder={editingSignal ? '' : 'e.g. RA_REVIEW_DROUGHT'}
                      disabled={!!editingSignal}
                      className="w-full text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {editingSignal && (
                      <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                        Code is the unique business key referenced by playbook matching rules and audit prompts, so it cannot be renamed. Deactivate or delete and re-register if a new code is needed.
                      </p>
                    )}
                  </Field>
                  <Field label="Family (2-3 letter prefix)">
                    <input type="text" value={signalForm.family} onChange={(e) => setSignalForm({ ...signalForm, family: e.target.value.toUpperCase() })} placeholder="e.g. RA" className="w-full text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </Field>
                  <Field label="Label">
                    <input type="text" value={signalForm.label} onChange={(e) => setSignalForm({ ...signalForm, label: e.target.value })} placeholder="e.g. Review Drought (>180 days)" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </Field>
                  <Field label="Description (optional)">
                    <textarea value={signalForm.description} onChange={(e) => setSignalForm({ ...signalForm, description: e.target.value })} rows={2} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                  </Field>
                  <Field label="Detection Source">
                    <select value={signalForm.detection_source} onChange={(e) => setSignalForm({ ...signalForm, detection_source: e.target.value })} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                      {DETECTION_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                    {signalForm.detection_source === 'derived' && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠ Derived signals also need extractor code in signal-extractor.ts to fire. Registering here makes it available in the Rule Builder, but it won't be auto-detected until the extractor is updated.
                      </p>
                    )}
                  </Field>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
                  <button
                    onClick={() => { setShowSignalForm(false); setEditingSignal(null); }}
                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSignal}
                    disabled={savingSignal || (!editingSignal && !signalForm.code) || !signalForm.family || !signalForm.label}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingSignal
                      ? (editingSignal ? 'Saving...' : 'Registering...')
                      : (editingSignal ? 'Save Changes' : 'Register Signal')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── Checklist builder tab ─── */
        <ChecklistBuilderTab
          playbooks={playbooks}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
