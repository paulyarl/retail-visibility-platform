'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Plus, Search, LayoutGrid, Table as TableIcon, Flame } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { Campaign, CampaignStage, CampaignScope } from '@/services/MarketingOpsService';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';
import ArchetypeBadge from '@/components/marketing-ops/ArchetypeBadge';
import { useStaffUsers, staffDisplayName } from '@/components/marketing-ops/PlatformUserSelect';
import SuggestiveSelect, { distinctValues } from '@/components/marketing-ops/SuggestiveSelect';

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
/** Terminal stages collapsed behind "Show closed" by default. Mirrors the
 *  queue board's CLOSED_STAGES behavior, scoped to the review pipeline stages
 *  that appear on the campaigns page. */
const CLOSED_STAGES: CampaignStage[] = ['lost', 'dead'];
const RETAINER_OPTIONS: Array<'Fast' | 'Medium' | 'Slow' | ''> = ['Fast', 'Medium', 'Slow'];
const ATTRIBUTE_OPTIONS = ['High Ticket', 'Upscale', 'Friendly', 'Professional', 'Fast Retainers'];
const SCOPES: CampaignScope[] = ['business', 'category', 'city', 'intelligence'];

type FollowUpFilter = '' | 'overdue' | 'due_today' | 'this_week';

function followUpBadge(c: Campaign): { label: string; cls: string } | null {
  if (!c.next_follow_up_at) return null;
  const fu = new Date(c.next_follow_up_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  fu.setHours(0, 0, 0, 0);
  const diffDays = Math.round((fu.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  if (diffDays === 0) return { label: 'Due today', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  if (diffDays <= 7) return { label: `Due ${fu.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  return null;
}

function matchesFollowUpFilter(c: Campaign, filter: FollowUpFilter): boolean {
  if (!filter) return true;
  const badge = followUpBadge(c);
  if (!badge) return false;
  if (filter === 'overdue') return badge.label.startsWith('Overdue');
  if (filter === 'due_today') return badge.label === 'Due today';
  if (filter === 'this_week') return badge.label.startsWith('Due ');
  return true;
}

export default function CampaignListClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<CampaignStage | ''>('');
  const [scopeFilter, setScopeFilter] = useState<CampaignScope | ''>('');
  const [toneFilter, setToneFilter] = useState('');
  const [retainerFilter, setRetainerFilter] = useState<'Fast' | 'Medium' | 'Slow' | ''>('');
  const [attributeFilter, setAttributeFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('');
  const [showClosed, setShowClosed] = useState(false);
  const [presetTones, setPresetTones] = useState<string[]>([]);
  const staffUsers = useStaffUsers();

  useEffect(() => {
    marketingOpsService.listTonePresets()
      .then(setPresetTones)
      .catch(() => {});
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.listCampaigns({
        search: search || undefined,
        stage: stageFilter || undefined,
        scope: scopeFilter || undefined,
        tone: toneFilter || undefined,
        retainer: retainerFilter || undefined,
        attributes: attributeFilter ? [attributeFilter] : undefined,
        limit: 200,
      });
      setCampaigns(result.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, scopeFilter, toneFilter, retainerFilter, attributeFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const formatCurrency = (cents: number | null) => cents != null ? `$${(cents / 100).toLocaleString()}` : '—';

  const toneOptions = useMemo(
    () => [...new Set([...presetTones, ...distinctValues(campaigns, (c) => c.tone)])].sort((a, b) => a.localeCompare(b)),
    [presetTones, campaigns],
  );

  const campaignsByStage = (stage: CampaignStage) => campaigns.filter((c) => c.stage === stage);
  const filteredCampaigns = useMemo(
    () => campaigns.filter((c) => matchesFollowUpFilter(c, followUpFilter))
      .filter((c) => showClosed || !CLOSED_STAGES.includes(c.stage)),
    [campaigns, followUpFilter, showClosed],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filteredCampaigns.length} of {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}{!showClosed && campaigns.some((c) => CLOSED_STAGES.includes(c.stage)) ? ' (closed hidden)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/admin/marketing-ops/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Link>
            <button
              onClick={fetchCampaigns}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, business name, category, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as CampaignStage | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as CampaignScope | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scopes</option>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <SuggestiveSelect
            value={toneFilter}
            onChange={setToneFilter}
            options={toneOptions}
            emptyLabel="All Tones"
            newLabel="+ Tone..."
            newInputPlaceholder="Filter by tone"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={retainerFilter}
            onChange={(e) => setRetainerFilter(e.target.value as 'Fast' | 'Medium' | 'Slow' | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Retainers</option>
            {RETAINER_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={attributeFilter}
            onChange={(e) => setAttributeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Attributes</option>
            {ATTRIBUTE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex items-center rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-2 text-sm font-medium ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-neutral-800 dark:text-gray-200'}`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-2 text-sm font-medium ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-neutral-800 dark:text-gray-200'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded" />
            Show closed
          </label>
        </div>

        {/* Follow-up quick filter chips */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Follow-ups:</span>
          {(['', 'overdue', 'due_today', 'this_week'] as FollowUpFilter[]).map((f) => {
            const labels: Record<FollowUpFilter, string> = { '': 'All', overdue: 'Overdue', due_today: 'Due today', this_week: 'This week' };
            const active = followUpFilter === f;
            return (
              <button
                key={f || 'all'}
                onClick={() => setFollowUpFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : view === 'table' ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Open</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Scope</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Campaign</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tone</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">City</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Stage</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Follow-up</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Retainer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Attributes</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Est. Fee</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                        No campaigns found. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-700/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.scope}</td>
                        <td className="px-4 py-3">
                          <Link href={`/settings/admin/marketing-ops/campaigns/${c.id}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                            {c.is_hot_prospect && <Flame className="inline w-3 h-3 mr-1 text-orange-500" />}
                            {c.title || c.business_name || c.category || c.city || '—'}
                          </Link>
                          {c.archetype && (
                            <ArchetypeBadge archetype={c.archetype} className="ml-1.5 align-middle" />
                          )}
                          {c.display_id && (
                            <span className="ml-2 text-xs text-gray-400">{c.display_id}</span>
                          )}
                          {c.title && (c.business_name || c.category || c.city) && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {c.business_name || `${c.category} · ${c.city}`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.category}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.tone ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.city}{c.neighborhood ? ` (${c.neighborhood})` : ''}</td>
                        <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                        <td className="px-4 py-3">
                          {(() => {
                            const b = followUpBadge(c);
                            return b ? <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.label}</span> : <span className="text-xs text-gray-400">—</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.retainer ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.attributes?.join(', ') || '—'}</td>
                        <td className="px-4 py-3">
                          {c.tenant_id ? (
                            <Link
                              href={`/t/${c.tenant_id}/settings/tenant`}
                              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                            >
                              Linked
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">Unlinked</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.estimated_fee_cents)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.amount_paid_cents)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{staffDisplayName(staffUsers, c.assigned_to) ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.filter((stage) => showClosed || !CLOSED_STAGES.includes(stage)).map((stage) => {
                const items = filteredCampaigns.filter((c) => c.stage === stage);
                return (
                  <div key={stage} className="w-72 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{STAGE_LABELS[stage]}</h3>
                      <span className="text-xs font-medium text-gray-400">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700 p-4 text-center text-xs text-gray-400">
                          Empty
                        </div>
                      ) : (
                        items.map((c) => {
                          const fuBadge = followUpBadge(c);
                          return (
                          <Link
                            key={c.id}
                            href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                            className="block bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {c.is_hot_prospect && <Flame className="inline w-3 h-3 mr-1 flex-shrink-0 text-orange-500" />}
                                {c.title || c.business_name || c.category || c.city}
                                {c.archetype && (
                                  <ArchetypeBadge archetype={c.archetype} className="ml-1 align-middle" />
                                )}
                              </p>
                              {fuBadge && <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${fuBadge.cls}`}>{fuBadge.label}</span>}
                            </div>
                            {c.title && (c.business_name || c.category || c.city) && (
                              <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                {c.business_name || c.category || c.city}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1"><span className="uppercase text-[10px] tracking-wider text-gray-400">{c.scope}</span> · {c.category} · {c.city}</p>
                            {(c.tone || c.retainer || c.attributes?.length) && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {c.tone}{c.tone && c.retainer ? ' · ' : ''}{c.retainer}
                                {c.attributes?.length ? ` · ${c.attributes.join(', ')}` : ''}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">{staffDisplayName(staffUsers, c.assigned_to) ?? 'Unassigned'}</span>
                              {c.estimated_fee_cents != null && (
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{formatCurrency(c.estimated_fee_cents)}</span>
                              )}
                            </div>
                          </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
