'use client';

import { Globe, MapPin } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * EnrichmentAuditCard — mapped render for directory_enrichment audits.
 *
 * Enrichment audits are created when a validated `category_enrichment` or
 * `location_enrichment` output is produced (internal run or external import)
 * by a directory_enrichment campaign. The validated packet is stored in
 * `audit.audit_data` and auto-applied to `directory_category_enrichment`
 * (trigger_source='campaign_run'). This card renders the applied packet so
 * the operator can see exactly what went live on the public pages.
 *
 * The card surfaces the full validated packet:
 *   - Shopper-facing fields (SEO + on-page copy + taxonomy + FAQ) render
 *     inline — these are what actually went live on the public page.
 *   - Analyst-facing `context.*` (category_profile, signals, market density,
 *     prospect signals, market gaps, metro dynamics, etc.) render inside a
 *     collapsible `<details>` block so the operator view stays scannable
 *     while still being available for seed/audit review.
 */

interface FaqEntry {
  question?: string;
  answer?: string;
}

interface CategoryProfile {
  business_model?: string;
  typical_products?: string;
  customer_base?: string;
  online_presence_pattern?: string;
  competitive_landscape?: string;
  typical_scale?: string;
}

interface CityProfile {
  metro_description?: string;
  major_industries?: string[];
  growth_trajectory?: string;
  demographic_character?: string;
  market_character?: string;
}

interface MarketGap {
  category?: string;
  signal?: string;
  area?: string;
}

interface MetroDynamic {
  city?: string;
  state?: string;
  relationship?: string;
  character?: string;
  business_scene?: string;
  notes?: string;
}

interface AreaBreakdown {
  area_name?: string;
  description?: string;
  strong_categories?: string[];
}

interface EnrichmentContext {
  // Category enrichment context
  category_summary?: string;
  // Location enrichment context
  market_summary?: string;
  // Shared
  keywords?: string[];
  secondary_categories?: string[];
  top_categories?: string[];
  category_notes?: string;
  market_notes?: string;
  notable_areas?: string[];
  category_profile?: CategoryProfile;
  city_profile?: CityProfile;
  category_signals?: string[];
  market_density?: string;
  prospect_signals?: string[];
  market_gaps?: MarketGap[];
  metro_context?: string;
  metro_dynamics?: MetroDynamic[];
}

interface EnrichmentPacket {
  category_key?: string;
  category_name?: string;
  city?: string;
  state?: string;
  location_name?: string;
  meta_title: string;
  description: string;
  keywords: string[];
  secondary_categories?: string[];
  top_categories?: string[];
  schema_type_hint?: string;
  body_copy?: string;
  // Category-only fields
  category_overview?: string;
  super_categories?: string[];
  sub_categories?: string[];
  adjacent_categories?: string[];
  // Shared guidance
  shopper_guide?: string;
  faq?: FaqEntry[];
  // Location-only fields
  area_breakdown?: AreaBreakdown[];
  // Reusable context (analyst-facing)
  context?: EnrichmentContext;
}

// ─── Small render helpers (keep the JSX below scannable) ────────────────

function ChipList({
  items,
  tone = 'neutral',
}: {
  items: string[] | undefined;
  tone?: 'neutral' | 'emerald' | 'blue' | 'amber';
}) {
  if (!items || items.length === 0) return null;
  const toneClasses = {
    neutral: 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-neutral-700',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  }[tone];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((c, i) => (
        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${toneClasses}`}>
          {c}
        </span>
      ))}
    </div>
  );
}

function ProseField({ label, text }: { label: string; text: string | undefined }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function ChipsField({
  label,
  items,
  tone = 'neutral',
}: {
  label: string;
  items: string[] | undefined;
  tone?: 'neutral' | 'emerald' | 'blue' | 'amber';
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <ChipList items={items} tone={tone} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-700 pb-0.5 mb-2">
      {children}
    </p>
  );
}

function ProfileGrid({
  profile,
}: {
  profile: Record<string, string | string[] | undefined>;
}) {
  const entries = Object.entries(profile).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  });
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="text-xs">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {k.replace(/_/g, ' ')}
          </dt>
          <dd className="text-gray-700 dark:text-gray-300">
            {Array.isArray(v) ? v.join(', ') : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Main card ──────────────────────────────────────────────────────────

export default function EnrichmentAuditCard({
  audit,
  campaignCategory,
  campaignCity,
  campaignState,
}: {
  audit: Audit;
  /** Campaign fields — the applied-to target is derived from the campaign,
   *  not the payload (payload echoes are ignored by the applier). */
  campaignCategory?: string | null;
  campaignCity?: string | null;
  campaignState?: string | null;
}) {
  const data = audit.audit_data as EnrichmentPacket | null;
  if (!data || typeof data !== 'object' || !data.meta_title) return null;

  const isLocation = audit.platform === 'location_enrichment';
  const isNational = (campaignCity ?? '').trim().toLowerCase() === '__all__';

  const appliedTo = isLocation
    ? `location page · ${campaignCity ?? '—'}${campaignState ? `, ${campaignState}` : ''}`
    : isNational
      ? `category page · ${campaignCategory ?? data.category_name ?? '—'} · national`
      : `category page · ${campaignCategory ?? data.category_name ?? '—'} · ${campaignCity ?? '—'}${campaignState ? `, ${campaignState}` : ''}`;

  const ctx = data.context;
  const hasContext = !!ctx && typeof ctx === 'object';

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/30 dark:bg-emerald-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isLocation
            ? <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          <span className="font-medium text-gray-900 dark:text-white">
            {isLocation ? 'Location Enrichment' : 'Category Enrichment'}
          </span>
          <span className="text-xs text-gray-400">applied to {appliedTo}</span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Applied packet — mirrors the fields written to the enrichment row */}
      <div className="space-y-4">
        {/* ── SEO packet ── */}
        <div className="space-y-2">
          <SectionLabel>SEO packet</SectionLabel>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Meta title</p>
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{data.meta_title}</p>
          </div>
          <ProseField label="Description" text={data.description} />
          {data.schema_type_hint && (
            <p className="text-[10px] text-gray-400">
              Schema type hint: <span className="font-mono">{data.schema_type_hint}</span>
            </p>
          )}
        </div>

        {/* ── On-page copy ── */}
        {(data.body_copy || data.category_overview || data.shopper_guide) && (
          <div className="space-y-2">
            <SectionLabel>On-page copy</SectionLabel>
            <ProseField label="Body copy (page intro)" text={data.body_copy} />
            <ProseField label="Category overview (what this category is)" text={data.category_overview} />
            <ProseField label="Shopper guide (how to choose)" text={data.shopper_guide} />
          </div>
        )}

        {/* ── Category taxonomy (category enrichment only) ── */}
        {!isLocation && (data.super_categories?.length || data.sub_categories?.length || data.adjacent_categories?.length) ? (
          <div className="space-y-2">
            <SectionLabel>Category taxonomy</SectionLabel>
            <ChipsField label="Super categories (breadcrumbs)" items={data.super_categories} tone="blue" />
            <ChipsField label="Sub categories (drill-down)" items={data.sub_categories} tone="emerald" />
            <ChipsField label="Adjacent categories (related)" items={data.adjacent_categories} tone="amber" />
          </div>
        ) : null}

        {/* ── Keywords + related categories ── */}
        {(data.keywords?.length || data.secondary_categories?.length || data.top_categories?.length) ? (
          <div className="space-y-2">
            <SectionLabel>Keywords & related categories</SectionLabel>
            <ChipsField label="Keywords" items={data.keywords} />
            <ChipsField label="Secondary categories" items={data.secondary_categories} tone="emerald" />
            {isLocation && <ChipsField label="Top categories (AI)" items={data.top_categories} tone="emerald" />}
          </div>
        ) : null}

        {/* ── Area breakdown (location enrichment only) ── */}
        {isLocation && data.area_breakdown?.length ? (
          <div className="space-y-2">
            <SectionLabel>Area breakdown</SectionLabel>
            <div className="space-y-2">
              {data.area_breakdown.map((area, i) => (
                <div key={i} className="border border-gray-200 dark:border-neutral-700 rounded p-2 bg-white/50 dark:bg-neutral-800/50">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{area.area_name}</p>
                  {area.description && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{area.description}</p>
                  )}
                  {area.strong_categories?.length ? (
                    <div className="mt-1.5">
                      <ChipList items={area.strong_categories} tone="emerald" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── FAQ ── */}
        {data.faq?.length ? (
          <div className="space-y-2">
            <SectionLabel>FAQ ({data.faq.length})</SectionLabel>
            <div className="space-y-2">
              {data.faq.map((f, i) => (
                <div key={i} className="border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{f.question}</p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Reusable context (analyst-facing, collapsible) ── */}
        {hasContext && (
          <details className="border-t border-gray-200 dark:border-neutral-700 pt-2">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
              Reusable context (analyst-facing · seed/audit only · not rendered on public page)
            </summary>
            <div className="mt-2 space-y-3">
              {/* Market/category summary */}
              <ProseField
                label={isLocation ? 'Market summary' : 'Category summary'}
                text={isLocation ? ctx?.market_summary : ctx?.category_summary}
              />

              {/* Context-level arrays */}
              <div className="space-y-2">
                <ChipsField label="Context keywords" items={ctx?.keywords} />
                <ChipsField label="Context secondary categories" items={ctx?.secondary_categories} tone="emerald" />
                {isLocation && <ChipsField label="Context top categories" items={ctx?.top_categories} tone="emerald" />}
                {isLocation && <ChipsField label="Notable areas" items={ctx?.notable_areas} tone="amber" />}
              </div>

              {/* Notes */}
              <ProseField
                label={isLocation ? 'Market notes' : 'Category notes'}
                text={isLocation ? ctx?.market_notes : ctx?.category_notes}
              />

              {/* Category profile (category enrichment) */}
              {ctx?.category_profile && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Category profile</p>
                  <ProfileGrid
                    profile={{
                      business_model: ctx.category_profile.business_model,
                      typical_products: ctx.category_profile.typical_products,
                      customer_base: ctx.category_profile.customer_base,
                      online_presence_pattern: ctx.category_profile.online_presence_pattern,
                      competitive_landscape: ctx.category_profile.competitive_landscape,
                      typical_scale: ctx.category_profile.typical_scale,
                    }}
                  />
                </div>
              )}

              {/* City profile (location enrichment) */}
              {ctx?.city_profile && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">City profile</p>
                  <ProfileGrid
                    profile={{
                      metro_description: ctx.city_profile.metro_description,
                      major_industries: ctx.city_profile.major_industries,
                      growth_trajectory: ctx.city_profile.growth_trajectory,
                      demographic_character: ctx.city_profile.demographic_character,
                      market_character: ctx.city_profile.market_character,
                    }}
                  />
                </div>
              )}

              {/* Category signals */}
              {ctx?.category_signals?.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    Category signals (what strong looks like)
                  </p>
                  <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5 list-disc pl-4">
                    {ctx.category_signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}

              {/* Market density (category enrichment) */}
              <ProseField label="Market density" text={ctx?.market_density} />

              {/* Prospect signals */}
              {ctx?.prospect_signals?.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    Prospect signals
                  </p>
                  <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5 list-disc pl-4">
                    {ctx.prospect_signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}

              {/* Market gaps (location enrichment) */}
              {ctx?.market_gaps?.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    Market gaps ({ctx.market_gaps.length})
                  </p>
                  <div className="space-y-1">
                    {ctx.market_gaps.map((g, i) => (
                      <div key={i} className="text-xs border border-gray-200 dark:border-neutral-700 rounded p-1.5 bg-white/50 dark:bg-neutral-800/50">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{g.category}</span>
                        {g.area && <span className="text-gray-400"> · {g.area}</span>}
                        {g.signal && <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{g.signal}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Metro context (location enrichment, shopper-facing) */}
              <ProseField label="Metro context" text={ctx?.metro_context} />

              {/* Metro dynamics (location enrichment) */}
              {ctx?.metro_dynamics?.length ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    Metro dynamics ({ctx.metro_dynamics.length})
                  </p>
                  <div className="space-y-1">
                    {ctx.metro_dynamics.map((m, i) => (
                      <div key={i} className="text-xs border border-gray-200 dark:border-neutral-700 rounded p-1.5 bg-white/50 dark:bg-neutral-800/50">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {m.city}{m.state ? `, ${m.state}` : ''}
                        </span>
                        {m.relationship && <span className="text-gray-400"> · {m.relationship}</span>}
                        {m.character && <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{m.character}</p>}
                        {m.business_scene && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{m.business_scene}</p>}
                        {m.notes && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{m.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
