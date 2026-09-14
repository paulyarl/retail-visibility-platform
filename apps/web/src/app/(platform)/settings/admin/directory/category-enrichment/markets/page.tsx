'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  type EnrichedMarket,
} from '@/services/DirectoryPresenceAdminService';
import { clientLogger } from '@/lib/client-logger';
import { ArrowLeft, Loader2, Search, X, Save, RotateCcw, Globe, Lightbulb, TrendingUp, Target } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function CategoryEnrichmentMarketsPage() {
  const [markets, setMarkets] = useState<EnrichedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<EnrichedMarket | null>(null);
  const [saving, setSaving] = useState(false);
  const [overrideDescription, setOverrideDescription] = useState('');
  const [overrideMetaTitle, setOverrideMetaTitle] = useState('');
  const [overrideKeywords, setOverrideKeywords] = useState('');
  const [resetDescription, setResetDescription] = useState(false);
  const [resetMetaTitle, setResetMetaTitle] = useState(false);
  const [resetKeywords, setResetKeywords] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await directoryPresenceAdminService.listMarkets({});
      setMarkets(data);
    } catch (err) {
      clientLogger.error('Failed to load enriched markets:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = markets.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.categoryName.toLowerCase().includes(q) ||
      m.city.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.categoryKey.toLowerCase().includes(q)
    );
  });

  const selectMarket = (m: EnrichedMarket) => {
    setSelected(m);
    setOverrideDescription(m.override.description || '');
    setOverrideMetaTitle(m.override.metaTitle || '');
    setOverrideKeywords((m.override.keywords || []).join(', '));
    setResetDescription(false);
    setResetMetaTitle(false);
    setResetKeywords(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const keywordsArray = overrideKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const updated = await directoryPresenceAdminService.overrideMarket(
        selected.categoryKey,
        selected.city,
        selected.state,
        {
          operator_override_description: overrideDescription.trim() || undefined,
          operator_override_meta_title: overrideMetaTitle.trim() || undefined,
          operator_override_keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
          reset_description: resetDescription,
          reset_meta_title: resetMetaTitle,
          reset_keywords: resetKeywords,
        },
      );
      setSelected(updated);
      setOverrideDescription(updated.override.description || '');
      setOverrideMetaTitle(updated.override.metaTitle || '');
      setOverrideKeywords((updated.override.keywords || []).join(', '));
      setResetDescription(false);
      setResetMetaTitle(false);
      setResetKeywords(false);
      await load();
    } catch (err) {
      clientLogger.error('Failed to override market:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Category Market Enrichment"
        description="View and override composed market-level SEO for category pages."
        actions={
          <Link
            href="/settings/admin/directory"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Directory Panel
          </Link>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category, city, state…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Loading markets…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No enriched markets found.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-[600px] overflow-auto">
                {filtered.map((m) => (
                  <li
                    key={m.id}
                    onClick={() => selectMarket(m)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selected?.id === m.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {m.categoryName} in {m.city}, {m.state}
                    </div>
                    <div className="text-xs text-gray-500">
                      Enriched {formatDate(m.enrichedAt)} · {m.triggerSource}
                      {m.overrideBy && ' · overridden'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
              Select a market from the list to view and edit overrides.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selected.categoryName} in {selected.city}, {selected.state}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Last composed {formatDate(selected.enrichedAt)} · profile{' '}
                    {selected.intelligenceProfileId || '—'} · composer v{selected.composerVersion}
                  </p>
                </div>
                {selected.overrideBy && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Overridden by {selected.overrideBy} · {formatDate(selected.overrideAt)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* ── Market intelligence (read-only, analyst scan) ── */}
                <MarketIntelligencePanel market={selected} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Composed meta title (read-only)
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                    {selected.composed.metaTitle}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Override meta title (≤ 70 chars)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={overrideMetaTitle}
                      onChange={(e) => setOverrideMetaTitle(e.target.value)}
                      disabled={resetMetaTitle}
                      maxLength={70}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                      placeholder="Leave blank to use composed title"
                    />
                    <label className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={resetMetaTitle}
                        onChange={(e) => setResetMetaTitle(e.target.checked)}
                      />
                      <RotateCcw className="w-3 h-3" /> Reset
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Composed description (read-only)
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono whitespace-pre-wrap">
                    {selected.composed.description}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Override description (≤ 1000 chars)
                  </label>
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={4}
                      value={overrideDescription}
                      onChange={(e) => setOverrideDescription(e.target.value)}
                      disabled={resetDescription}
                      maxLength={1000}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                      placeholder="Leave blank to use composed description"
                    />
                    <label className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap mt-2">
                      <input
                        type="checkbox"
                        checked={resetDescription}
                        onChange={(e) => setResetDescription(e.target.checked)}
                      />
                      <RotateCcw className="w-3 h-3" /> Reset
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {overrideDescription.length}/1000 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Composed keywords
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selected.composed.keywords.map((k, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Override keywords (comma-separated, ≤ 15)
                  </label>
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={overrideKeywords}
                      onChange={(e) => setOverrideKeywords(e.target.value)}
                      disabled={resetKeywords}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                      placeholder="african grocery, west african foods, …"
                    />
                    <label className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap mt-2">
                      <input
                        type="checkbox"
                        checked={resetKeywords}
                        onChange={(e) => setResetKeywords(e.target.checked)}
                      />
                      <RotateCcw className="w-3 h-3" /> Reset
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {overrideKeywords
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean).length}{' '}
                    keywords
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Close
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save overrides'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Market Intelligence Panel (read-only analyst scan) ─────────────────
//
// Surfaces the full enrichment packet — taxonomy (super/sub/adjacent
// categories), category overview, shopper guide, FAQ, and the analyst-facing
// context (category profile, category signals, market density, prospect
// signals). All fields are read-only here; overrides are limited to the SEO
// packet (meta title, description, keywords) in the editor below.
//
// `super_categories` is the field the analyst scanning a market benefits most
// from — it places the category in its taxonomy tree (breadcrumbs) without
// requiring a visit to the public page.

function ChipList({
  items,
  tone = 'neutral',
}: {
  items: string[] | null | undefined;
  tone?: 'neutral' | 'blue' | 'emerald' | 'amber';
}) {
  const safe = (items ?? []).filter(Boolean);
  if (safe.length === 0) return null;
  const toneClasses = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }[tone];
  return (
    <div className="flex flex-wrap gap-1">
      {safe.map((c, i) => (
        <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${toneClasses}`}>
          {c}
        </span>
      ))}
    </div>
  );
}

function ProseBlock({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-0.5 mb-2">
      {icon}
      {children}
    </div>
  );
}

function MarketIntelligencePanel({ market }: { market: EnrichedMarket }) {
  const ctx = market.context;
  const hasTaxonomy = !!(
    ctx?.super_categories?.length ||
    ctx?.sub_categories?.length ||
    ctx?.adjacent_categories?.length
  );
  const hasOnPage = !!(market.bodyCopy || ctx?.category_overview || market.shopperGuide);
  const hasFaq = !!(market.faq && market.faq.length > 0);
  const hasAnalystContext = !!(
    ctx?.category_summary ||
    ctx?.category_profile ||
    ctx?.category_signals?.length ||
    ctx?.market_density ||
    ctx?.prospect_signals?.length ||
    ctx?.category_notes
  );

  if (!hasTaxonomy && !hasOnPage && !hasFaq && !hasAnalystContext) return null;

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
      {/* Taxonomy */}
      {hasTaxonomy && (
        <div className="space-y-2">
          <SectionLabel icon={<Globe className="w-3 h-3" />}>Category taxonomy</SectionLabel>
          {ctx?.super_categories?.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Super categories (breadcrumbs)</p>
              <ChipList items={ctx.super_categories} tone="blue" />
            </div>
          ) : null}
          {ctx?.sub_categories?.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Sub categories (drill-down)</p>
              <ChipList items={ctx.sub_categories} tone="emerald" />
            </div>
          ) : null}
          {ctx?.adjacent_categories?.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Adjacent categories (related)</p>
              <ChipList items={ctx.adjacent_categories} tone="amber" />
            </div>
          ) : null}
        </div>
      )}

      {/* On-page copy */}
      {hasOnPage && (
        <div className="space-y-2">
          <SectionLabel icon={<Lightbulb className="w-3 h-3" />}>On-page copy</SectionLabel>
          <ProseBlock label="Body copy (page intro)" text={market.bodyCopy} />
          <ProseBlock label="Category overview (what this category is)" text={ctx?.category_overview} />
          <ProseBlock label="Shopper guide (how to choose)" text={market.shopperGuide} />
        </div>
      )}

      {/* FAQ */}
      {hasFaq && (
        <div className="space-y-2">
          <SectionLabel icon={<Lightbulb className="w-3 h-3" />}>FAQ ({market.faq!.length})</SectionLabel>
          <div className="space-y-2">
            {market.faq!.map((f, i) => (
              <div key={i} className="border-l-2 border-gray-300 pl-2">
                <p className="text-sm font-medium text-gray-800">{f.question}</p>
                <p className="text-xs text-gray-600 mt-0.5">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyst context (collapsible) */}
      {hasAnalystContext && (
        <details className="border-t border-gray-200 pt-2">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-500 select-none">
            Analyst context (seed/audit only · not rendered on public page)
          </summary>
          <div className="mt-2 space-y-3">
            <ProseBlock label="Category summary" text={ctx?.category_summary} />

            {ctx?.category_profile && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Category profile</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {ctx.category_profile.business_model && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Business model</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.business_model}</dd>
                    </div>
                  )}
                  {ctx.category_profile.typical_products && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Typical products</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.typical_products}</dd>
                    </div>
                  )}
                  {ctx.category_profile.customer_base && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Customer base</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.customer_base}</dd>
                    </div>
                  )}
                  {ctx.category_profile.online_presence_pattern && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Online presence</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.online_presence_pattern}</dd>
                    </div>
                  )}
                  {ctx.category_profile.competitive_landscape && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Competitive landscape</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.competitive_landscape}</dd>
                    </div>
                  )}
                  {ctx.category_profile.typical_scale && (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Typical scale</dt>
                      <dd className="text-sm text-gray-700">{ctx.category_profile.typical_scale}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {ctx?.category_signals?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Category signals (what strong looks like)
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5 list-disc pl-5">
                  {ctx.category_signals.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            ) : null}

            <ProseBlock label="Market density" text={ctx?.market_density} />

            {ctx?.prospect_signals?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Prospect signals
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5 list-disc pl-5">
                  {ctx.prospect_signals.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            ) : null}

            <ProseBlock label="Category notes" text={ctx?.category_notes} />
          </div>
        </details>
      )}
    </div>
  );
}
