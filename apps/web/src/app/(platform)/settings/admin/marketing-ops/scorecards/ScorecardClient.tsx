'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Save, Trash2, Pencil, X } from 'lucide-react';
import marketingOpsService, { Scorecard, CampaignStage, CampaignScope } from '@/services/MarketingOpsService';
import SuggestiveSelect, { distinctValues } from '@/components/marketing-ops/SuggestiveSelect';
import PlatformUserSelect from '@/components/marketing-ops/PlatformUserSelect';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
const SCOPES: CampaignScope[] = ['business', 'category', 'city'];

const SCOPE_LABELS: Record<CampaignScope, string> = {
  business: 'Business',
  category: 'Category',
  city: 'City',
};

const emptyForm = () => {
  const today = new Date().toISOString().split('T')[0];
  return {
    user_id: '',
    date: today,
    category_focus: '',
    neighborhood_focus: '',
    scope_focus: '' as CampaignScope | '',
    stage_focus: '' as CampaignStage | '',
    previews_built: 0,
    previews_shown: 0,
    packages_paid: 0,
    packages_delivered: 0,
    revenue_collected_cents: 0,
    retainers_pitched: 0,
    retainers_won: 0,
    notes: '',
  };
};

export default function ScorecardClient() {
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  // Filters
  const [scopeFilter, setScopeFilter] = useState<CampaignScope | ''>('');
  const [stageFilter, setStageFilter] = useState<CampaignStage | ''>('');

  const [vocab, setVocab] = useState({ categories: [] as string[], neighborhoods: [] as string[] });

  useEffect(() => {
    Promise.all([
      marketingOpsService.listCampaigns({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      marketingOpsService.listScorecards().catch(() => [] as Scorecard[]),
    ]).then(([{ items }, cards]) => {
      setVocab({
        categories: [...new Set([...distinctValues(items, (c) => c.category), ...distinctValues(cards, (s) => s.category_focus)])].sort((a, b) => a.localeCompare(b)),
        neighborhoods: [...new Set([...distinctValues(items, (c) => c.neighborhood), ...distinctValues(cards, (s) => s.neighborhood_focus)])].sort((a, b) => a.localeCompare(b)),
      });
    });
  }, []);

  const fetchScorecards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.listScorecards({
        scope: scopeFilter || undefined,
        stage: stageFilter || undefined,
      });
      setScorecards(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err: any) {
      setError(err.message || 'Failed to load scorecards');
    } finally {
      setLoading(false);
    }
  }, [scopeFilter, stageFilter]);

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (s: Scorecard) => {
    setEditingId(s.id);
    setShowForm(true);
    setError(null);
    setForm({
      user_id: s.user_id ?? '',
      date: new Date(s.date).toISOString().split('T')[0],
      category_focus: s.category_focus ?? '',
      neighborhood_focus: s.neighborhood_focus ?? '',
      scope_focus: s.scope_focus ?? '',
      stage_focus: (s.stage_focus as CampaignStage | '') ?? '',
      previews_built: s.previews_built,
      previews_shown: s.previews_shown,
      packages_paid: s.packages_paid,
      packages_delivered: s.packages_delivered,
      revenue_collected_cents: s.revenue_collected_cents,
      retainers_pitched: s.retainers_pitched,
      retainers_won: s.retainers_won,
      notes: s.notes ?? '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        user_id: form.user_id,
        date: new Date(form.date).toISOString(),
        category_focus: form.category_focus || undefined,
        neighborhood_focus: form.neighborhood_focus || undefined,
        scope_focus: (form.scope_focus as CampaignScope) || undefined,
        stage_focus: (form.stage_focus as string) || undefined,
        previews_built: form.previews_built || undefined,
        previews_shown: form.previews_shown || undefined,
        packages_paid: form.packages_paid || undefined,
        packages_delivered: form.packages_delivered || undefined,
        revenue_collected_cents: form.revenue_collected_cents || undefined,
        retainers_pitched: form.retainers_pitched || undefined,
        retainers_won: form.retainers_won || undefined,
        notes: form.notes || undefined,
      };

      if (editingId) {
        await marketingOpsService.updateScorecard(editingId, payload);
      } else {
        await marketingOpsService.upsertScorecard(payload);
      }
      resetForm();
      await fetchScorecards();
    } catch (err: any) {
      setError(err.message || 'Failed to save scorecard');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scorecard entry?')) return;
    try {
      await marketingOpsService.deleteScorecard(id);
      if (editingId === id) resetForm();
      await fetchScorecards();
    } catch (err: any) {
      setError(err.message || 'Failed to delete scorecard');
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;
  const numChange = (field: keyof typeof form, value: string) => setForm((p) => ({ ...p, [field]: value === '' ? 0 : parseInt(value) }));
  const hasActiveFilters = scopeFilter !== '' || stageFilter !== '';

  const focusSummary = (s: Scorecard) => {
    const parts: string[] = [];
    if (s.scope_focus) parts.push(SCOPE_LABELS[s.scope_focus] ?? s.scope_focus);
    if (s.category_focus) parts.push(s.category_focus);
    if (s.neighborhood_focus) parts.push(s.neighborhood_focus);
    return parts.length ? parts.join(' · ') : '—';
  };

  const filteredCount = useMemo(() => scorecards.length, [scorecards]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Scorecards</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track daily outreach activity and revenue by scope and stage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {showForm ? <X className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'New Entry'}
            </button>
            <button
              onClick={fetchScorecards}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {showForm && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Scorecard Entry' : 'New Scorecard Entry'}
              </h2>
              {editingId && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                  Editing
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
                <PlatformUserSelect required value={form.user_id} onChange={(v) => setForm((p) => ({ ...p, user_id: v }))}
                  emptyLabel="-- Select user --" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scope Focus</label>
                <select value={form.scope_focus} onChange={(e) => setForm((p) => ({ ...p, scope_focus: e.target.value as CampaignScope | '' }))}
                  className={inputClass}>
                  <option value="">-- Select scope --</option>
                  {SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Stage Focus</label>
                <select value={form.stage_focus} onChange={(e) => setForm((p) => ({ ...p, stage_focus: e.target.value as CampaignStage | '' }))}
                  className={inputClass}>
                  <option value="">-- Select stage --</option>
                  {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category Focus</label>
                <SuggestiveSelect value={form.category_focus} onChange={(v) => setForm((p) => ({ ...p, category_focus: v }))}
                  options={vocab.categories} emptyLabel="-- Select category --" newLabel="+ New category..."
                  newInputPlaceholder="Enter new category" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Neighborhood Focus</label>
                <SuggestiveSelect value={form.neighborhood_focus} onChange={(v) => setForm((p) => ({ ...p, neighborhood_focus: v }))}
                  options={vocab.neighborhoods} emptyLabel="-- Select neighborhood --" newLabel="+ New neighborhood..."
                  newInputPlaceholder="Enter new neighborhood" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Previews Built</label>
                <input type="number" value={form.previews_built} onChange={(e) => numChange('previews_built', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Previews Shown</label>
                <input type="number" value={form.previews_shown} onChange={(e) => numChange('previews_shown', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Packages Paid</label>
                <input type="number" value={form.packages_paid} onChange={(e) => numChange('packages_paid', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Packages Delivered</label>
                <input type="number" value={form.packages_delivered} onChange={(e) => numChange('packages_delivered', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Revenue (cents)</label>
                <input type="number" value={form.revenue_collected_cents} onChange={(e) => numChange('revenue_collected_cents', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Retainers Pitched</label>
                <input type="number" value={form.retainers_pitched} onChange={(e) => numChange('retainers_pitched', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Retainers Won</label>
                <input type="number" value={form.retainers_won} onChange={(e) => numChange('retainers_won', e.target.value)}
                  className={inputClass} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3} className={inputClass} />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.user_id}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as CampaignScope | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scopes</option>
            {SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as CampaignStage | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stages</option>
            {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setScopeFilter(''); setStageFilter(''); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 sm:ml-auto self-center">
            {filteredCount} entr{filteredCount === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : scorecards.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-12 text-center">
            <p className="text-gray-400 dark:text-gray-500">No scorecard entries yet.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Focus</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Stage</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Built</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Shown</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Delivered</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Retainers</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {scorecards.map((s) => (
                    <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-neutral-700/30 ${editingId === s.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{focusSummary(s)}</td>
                      <td className="px-4 py-3">
                        {s.stage_focus ? <StageBadge stage={s.stage_focus as CampaignStage} /> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.previews_built}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.previews_shown}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.packages_paid}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.packages_delivered}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(s.revenue_collected_cents)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{s.retainers_won}/{s.retainers_pitched}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => startEdit(s)}
                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit entry"
                            aria-label="Edit entry"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete entry"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
