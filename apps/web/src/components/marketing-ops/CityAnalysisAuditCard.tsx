'use client';

import { useState, Fragment } from 'react';
import {
  Copy,
  MapPin,
  Compass,
  Gauge,
  TrendingUp,
  Target,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';

// ─── Types (mirrors regional-city-opportunity.schema.ts) ────────────────

interface DigitalOpportunityScore {
  score: number;
  classification: string;
  rationale?: string;
  components?: Record<string, number>;
}

interface CityPriorityScore {
  score: number;
  ranking_rationale?: string;
  components?: Record<string, number>;
}

interface Population {
  approximate_population?: number | null;
  population_year?: number | null;
  growth_direction?: string;
  growth_rate_percent?: number | null;
  household_count?: number | null;
  median_household_income?: number | null;
}

interface CommercialContext {
  approximate_active_businesses?: number | null;
  verified_sampled_businesses?: number;
  categories_represented?: number;
  estimated_independent_business_percent?: number | null;
  estimated_service_business_percent?: number | null;
  business_density?: string;
  commercial_corridors?: string[];
  major_employment_sectors?: string[];
  development_signals?: string[];
  nearby_competing_commercial_centers?: string[];
}

interface ReviewBenchmarks {
  valid_google_business_count?: number;
  average_google_rating?: number | null;
  median_google_rating?: number | null;
  average_google_review_count?: number | null;
  median_google_review_count?: number | null;
  percent_below_10_google_reviews?: number | null;
  percent_above_100_google_reviews?: number | null;
  percent_below_4_rating?: number | null;
  percent_at_or_above_4_5_rating?: number | null;
  percent_with_recent_owner_responses?: number | null;
  percent_with_visible_unanswered_negative_reviews?: number | null;
  percent_with_weak_review_response_activity?: number | null;
}

interface GoogleProfileMetrics {
  verifiable_profile_count?: number;
  claimed_or_likely_claimed_percent?: number | null;
  unable_to_verify_percent?: number | null;
  incomplete_profile_percent?: number | null;
  hours_issue_percent?: number | null;
  weak_photo_coverage_percent?: number | null;
  duplicate_or_conflicting_listing_percent?: number | null;
}

interface WebsiteMetrics {
  verifiable_business_count?: number;
  working_website_percent?: number | null;
  no_website_percent?: number | null;
  social_media_only_percent?: number | null;
  mobile_friendly_percent?: number | null;
  clear_conversion_action_percent?: number | null;
  material_website_issue_percent?: number | null;
}

interface NapMetrics {
  verifiable_business_count?: number;
  consistent_percent?: number | null;
  minor_variation_percent?: number | null;
  material_inconsistency_percent?: number | null;
  possible_duplicate_listing_percent?: number | null;
}

interface CommonOpportunityTheme {
  theme: string;
  observed_business_count?: number;
  valid_sample_size?: number;
  observed_percent?: number;
  severity?: string;
  evidence_summary?: string;
  confidence?: string;
}

interface RepresentativeCategory {
  rank?: number;
  category: string;
  approximate_business_count?: number | null;
  digital_opportunity_level?: string;
  most_common_weakness?: string;
  outreach_priority?: string;
  recommended_next_analysis?: string;
}

interface CityDataQuality {
  confidence?: string;
  verified_fields?: string[];
  estimated_fields?: string[];
  unavailable_fields?: string[];
  small_sample_warnings?: string[];
  limitations?: string[];
}

interface Source {
  source_name?: string;
  source_type?: string;
  url?: string | null;
  accessed_date?: string;
}

interface CityRanking {
  rank: number;
  city: string;
  state: string;
  county_names?: string[];
  place_type?: string;
  distance_from_reference_miles?: number;
  direction_from_reference?: string;
  inside_requested_radius?: boolean;
  representative_zip_codes?: string[];
  zip_code_count?: number;
  zip_code_count_complete?: boolean;
  population?: Population;
  commercial_context?: CommercialContext;
  review_benchmarks?: ReviewBenchmarks;
  google_profile_metrics?: GoogleProfileMetrics;
  website_metrics?: WebsiteMetrics;
  nap_metrics?: NapMetrics;
  common_opportunity_themes?: CommonOpportunityTheme[];
  representative_categories?: RepresentativeCategory[];
  digital_opportunity_score?: DigitalOpportunityScore;
  city_priority_score?: CityPriorityScore;
  recommended_next_action?: string;
  recommended_next_action_rationale?: string;
  data_quality?: CityDataQuality;
  sources?: Source[];
}

interface TopCityOpportunity {
  rank: number;
  city: string;
  state: string;
  distance_from_reference_miles?: number;
  representative_zip_codes?: string[];
  digital_opportunity_score?: number;
  city_priority_score?: number;
  primary_opportunity?: string;
  strongest_category?: string;
  recommended_next_action?: string;
}

interface RegionalCategoryOpportunity {
  rank: number;
  category: string;
  cities_where_prominent?: string[];
  common_weakness?: string;
  regional_outreach_priority?: string;
  recommended_follow_up?: string;
}

interface RegionalMetrics {
  total_approximate_population?: number | null;
  total_approximate_local_businesses?: number | null;
  total_sampled_businesses?: number;
  average_city_digital_opportunity_score?: number | null;
  high_opportunity_cities?: number;
  very_high_opportunity_cities?: number;
  largest_addressable_market_city?: string | null;
  highest_digital_opportunity_city?: string | null;
  recommended_next_scan_city?: string | null;
}

interface ReferenceMarket {
  city?: string;
  state?: string;
  radius_miles?: number;
  include_reference_city?: boolean;
  cross_state_results_allowed?: boolean;
}

interface RequestedLimits {
  maximum_cities?: number;
  minimum_population?: number | null;
  maximum_population?: number | null;
  excluded_cities?: string[];
  preferred_categories?: string[];
}

interface AuditMetadata {
  audit_date?: string;
  reference_market?: ReferenceMarket;
  requested_limits?: RequestedLimits;
  distance_method?: string;
  cities_considered?: number;
  cities_included?: number;
  limitations?: string[];
}

interface RegionalDataQuality {
  overall_confidence?: string;
  verified_fields?: string[];
  estimated_fields?: string[];
  unavailable_fields?: string[];
  limitations?: string[];
}

interface RegionalCityOpportunityData {
  audit_metadata?: AuditMetadata;
  summary?: string;
  regional_metrics?: RegionalMetrics;
  city_rankings?: CityRanking[];
  top_city_opportunities?: TopCityOpportunity[];
  regional_category_opportunities?: RegionalCategoryOpportunity[];
  data_quality?: RegionalDataQuality;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score <= 6) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (score <= 8) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function confidenceColor(conf?: string): string {
  if (conf === 'high') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (conf === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function severityColor(sev?: string): string {
  if (sev === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (sev === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function priorityColor(pri?: string): string {
  if (pri === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (pri === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function opportunityClassColor(cls?: string): string {
  if (cls === 'very_high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (cls === 'high') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  if (cls === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function nextActionLabel(action?: string): string {
  if (!action) return '—';
  return action.replace(/_/g, ' ');
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n}%`;
}

function fmtDec(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  return Number(n).toFixed(digits);
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-neutral-700/40 border border-gray-200 dark:border-neutral-700 p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function isRegionalCityOpportunityAudit(audit: Audit): boolean {
  return (
    audit.platform === 'city_analysis' &&
    audit.audit_data != null &&
    typeof audit.audit_data === 'object' &&
    ('city_rankings' in audit.audit_data || 'regional_metrics' in audit.audit_data || 'summary' in audit.audit_data)
  );
}

// ─── Component ──────────────────────────────────────────────────────────

interface CityAnalysisAuditCardProps {
  audit: Audit;
}

export default function CityAnalysisAuditCard({ audit }: CityAnalysisAuditCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (!isRegionalCityOpportunityAudit(audit)) {
    // Fallback for legacy / mismatched shapes — render a compact raw view.
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-900 dark:text-white">City Analysis</span>
          <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
        </div>
        <pre className="text-[10px] text-gray-500 dark:text-gray-400 overflow-auto max-h-60">
          {JSON.stringify(audit.audit_data ?? {}, null, 2)}
        </pre>
      </div>
    );
  }

  const b = audit.audit_data as RegionalCityOpportunityData;
  const meta = b.audit_metadata ?? {};
  const ref = meta.reference_market ?? {};
  const limits = meta.requested_limits ?? {};
  const rm = b.regional_metrics ?? {};
  const rankings = b.city_rankings ?? [];
  const topOps = b.top_city_opportunities ?? [];
  const catOps = b.regional_category_opportunities ?? [];
  const dq = b.data_quality ?? {};

  const toggle = (rank: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  };

  const handleCopySummary = () => {
    const top = topOps.slice(0, 3).map((t) => `  ${t.rank}. ${t.city}, ${t.state} (priority ${t.city_priority_score ?? '—'}, opp ${t.digital_opportunity_score ?? '—'})`).join('\n');
    const text = `Regional City Scan — ${ref.city ?? '?'}, ${ref.state ?? '?'} (${ref.radius_miles ?? '?'} mi radius)\n${b.summary ?? ''}\n\nTop opportunities:\n${top}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
      {/* Header — reference market + audit metadata */}
      <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-neutral-700/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Regional City Scan
          </h3>
          {ref.city && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {ref.city}, {ref.state} · {ref.radius_miles ?? '—'} mi radius
            </span>
          )}
          {meta.audit_date && (
            <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{meta.audit_date}</Badge>
          )}
          {meta.cities_included != null && (
            <Badge cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {meta.cities_included} included / {meta.cities_considered ?? '—'} considered
            </Badge>
          )}
          {dq.overall_confidence && (
            <Badge cls={confidenceColor(dq.overall_confidence)}>Confidence: {dq.overall_confidence}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy summary'}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* 1. Summary */}
        {b.summary && (
          <p className="text-sm text-gray-700 dark:text-gray-300 pt-3">{b.summary}</p>
        )}

        {/* 2. Regional metrics */}
        {Object.keys(rm).length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Regional Metrics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <Metric label="Total population" value={fmtNum(rm.total_approximate_population)} />
              <Metric label="Total local businesses" value={fmtNum(rm.total_approximate_local_businesses)} />
              <Metric label="Sampled businesses" value={fmtNum(rm.total_sampled_businesses)} />
              <Metric label="Avg opp score" value={fmtDec(rm.average_city_digital_opportunity_score)} />
              <Metric label="High-opp cities" value={fmtNum(rm.high_opportunity_cities)} />
              <Metric label="Very-high-opp cities" value={fmtNum(rm.very_high_opportunity_cities)} />
              <Metric label="Largest market" value={rm.largest_addressable_market_city ?? '—'} />
              <Metric label="Highest opp city" value={rm.highest_digital_opportunity_city ?? '—'} />
            </div>
            {rm.recommended_next_scan_city && (
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Recommended next scan: <span className="font-semibold">{rm.recommended_next_scan_city}</span>
              </p>
            )}
          </div>
        )}

        {/* 3. Top city opportunities */}
        {topOps.length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Top City Opportunities
            </h4>
            <div className="space-y-1.5">
              {topOps.map((t) => (
                <div
                  key={`${t.rank}-${t.city}`}
                  className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/60 dark:bg-neutral-700/30 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-400">#{t.rank}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.city}, {t.state}</span>
                      {t.city_priority_score != null && (
                        <Badge cls={scoreColor(t.city_priority_score)}>Priority {t.city_priority_score}</Badge>
                      )}
                      {t.digital_opportunity_score != null && (
                        <Badge cls={scoreColor(t.digital_opportunity_score)}>Opp {t.digital_opportunity_score}/10</Badge>
                      )}
                      {t.strongest_category && (
                        <Badge cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{t.strongest_category}</Badge>
                      )}
                    </div>
                    {t.recommended_next_action && (
                      <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {nextActionLabel(t.recommended_next_action)}
                      </Badge>
                    )}
                  </div>
                  {t.primary_opportunity && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t.primary_opportunity}</p>
                  )}
                  {t.representative_zip_codes && t.representative_zip_codes.length > 0 && (
                    <p className="mt-1 text-[10px] text-gray-400">ZIPs: {t.representative_zip_codes.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Regional category opportunities */}
        {catOps.length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Regional Category Opportunities
            </h4>
            <div className="space-y-1.5">
              {catOps.map((c) => (
                <div
                  key={`${c.rank}-${c.category}`}
                  className="rounded-lg border border-gray-200 dark:border-neutral-700 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-400">#{c.rank}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.category}</span>
                      {c.regional_outreach_priority && (
                        <Badge cls={priorityColor(c.regional_outreach_priority)}>
                          {c.regional_outreach_priority} priority
                        </Badge>
                      )}
                    </div>
                    {c.cities_where_prominent && c.cities_where_prominent.length > 0 && (
                      <span className="text-[10px] text-gray-400">{c.cities_where_prominent.join(', ')}</span>
                    )}
                  </div>
                  {c.common_weakness && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Weakness:</span> {c.common_weakness}
                    </p>
                  )}
                  {c.recommended_follow_up && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Follow-up:</span> {c.recommended_follow_up}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. City rankings — dense expandable table */}
        {rankings.length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> City Rankings ({rankings.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200 dark:border-neutral-700">
                    <th className="text-left py-1.5 pr-2">#</th>
                    <th className="text-left py-1.5 pr-2">City</th>
                    <th className="text-right py-1.5 pr-2">Pop</th>
                    <th className="text-right py-1.5 pr-2">Dist</th>
                    <th className="text-left py-1.5 pr-2">Density</th>
                    <th className="text-right py-1.5 pr-2">Indep%</th>
                    <th className="text-right py-1.5 pr-2">Resp weak%</th>
                    <th className="text-right py-1.5 pr-2">Unans neg%</th>
                    <th className="text-right py-1.5 pr-2">Opp</th>
                    <th className="text-right py-1.5 pr-2">Priority</th>
                    <th className="text-left py-1.5 pr-2">Next</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {rankings.map((c) => {
                    const isOpen = expanded.has(c.rank);
                    const pop = c.population?.approximate_population;
                    const dist = c.distance_from_reference_miles;
                    const density = c.commercial_context?.business_density;
                    const indep = c.commercial_context?.estimated_independent_business_percent;
                    const respWeak = c.review_benchmarks?.percent_with_weak_review_response_activity;
                    const unansNeg = c.review_benchmarks?.percent_with_visible_unanswered_negative_reviews;
                    const opp = c.digital_opportunity_score?.score;
                    const prio = c.city_priority_score?.score;
                    return (
                      <Fragment key={c.rank}>
                        <tr
                          className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700/30"
                          onClick={() => toggle(c.rank)}
                        >
                          <td className="py-1.5 pr-2 text-gray-400">{c.rank}</td>
                          <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {c.city}, {c.state}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{fmtNum(pop)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{dist != null ? `${dist}` : '—'}</td>
                          <td className="py-1.5 pr-2 capitalize">{density ?? '—'}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{fmtPct(indep)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{fmtPct(respWeak)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{fmtPct(unansNeg)}</td>
                          <td className="py-1.5 pr-2 text-right">
                            {opp != null ? <Badge cls={scoreColor(opp)}>{opp}/10</Badge> : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {prio != null ? <Badge cls={scoreColor(prio)}>{prio}</Badge> : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {nextActionLabel(c.recommended_next_action)}
                          </td>
                          <td className="py-1.5 pl-1 text-gray-400">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/60 dark:bg-neutral-700/20">
                            <td colSpan={12} className="p-3">
                              <CityRankingDetail city={c} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Data quality */}
        {(dq.overall_confidence || (dq.verified_fields && dq.verified_fields.length > 0) || (dq.limitations && dq.limitations.length > 0)) && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Data Quality
            </h4>
            <div className="flex items-center gap-2 mb-2">
              {dq.overall_confidence && <Badge cls={confidenceColor(dq.overall_confidence)}>Overall: {dq.overall_confidence}</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dq.verified_fields && dq.verified_fields.length > 0 && (
                <div>
                  <span className="text-[10px] text-green-600 dark:text-green-400">Verified</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {dq.verified_fields.map((f) => (
                      <Badge key={f} cls="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {dq.estimated_fields && dq.estimated_fields.length > 0 && (
                <div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">Estimated</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {dq.estimated_fields.map((f) => (
                      <Badge key={f} cls="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {dq.unavailable_fields && dq.unavailable_fields.length > 0 && (
                <div>
                  <span className="text-[10px] text-red-600 dark:text-red-400">Unavailable</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {dq.unavailable_fields.map((f) => (
                      <Badge key={f} cls="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {dq.limitations && dq.limitations.length > 0 && (
              <ul className="mt-2 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside space-y-0.5">
                {dq.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* 7. Audit metadata footer */}
        {(meta.distance_method || (limits.preferred_categories && limits.preferred_categories.length > 0)) && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 flex items-center gap-3 flex-wrap">
            {meta.distance_method && (
              <span className="flex items-center gap-1"><Compass className="w-3 h-3" /> {meta.distance_method.replace(/_/g, ' ')}</span>
            )}
            {limits.minimum_population != null && limits.maximum_population != null && (
              <span>Pop filter: {fmtNum(limits.minimum_population)}–{fmtNum(limits.maximum_population)}</span>
            )}
            {limits.preferred_categories && limits.preferred_categories.length > 0 && (
              <span>Categories: {limits.preferred_categories.join(', ')}</span>
            )}
            {meta.cities_included != null && <span>{meta.cities_included} of {meta.cities_considered ?? '—'} cities included</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── City ranking detail (expandable) ───────────────────────────────────

function CityRankingDetail({ city }: { city: CityRanking }) {
  const pop = city.population ?? {};
  const cc = city.commercial_context ?? {};
  const rb = city.review_benchmarks ?? {};
  const gpm = city.google_profile_metrics ?? {};
  const wm = city.website_metrics ?? {};
  const nap = city.nap_metrics ?? {};
  const themes = city.common_opportunity_themes ?? [];
  const cats = city.representative_categories ?? [];
  const dos = city.digital_opportunity_score;
  const cps = city.city_priority_score;
  const cdq = city.data_quality ?? {};
  const sources = city.sources ?? [];

  return (
    <div className="space-y-3 text-xs">
      {/* Rationale + next action */}
      {city.recommended_next_action_rationale && (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">Next action rationale:</span> {city.recommended_next_action_rationale}
        </p>
      )}
      {cps?.ranking_rationale && (
        <p className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">Ranking rationale:</span> {cps.ranking_rationale}
        </p>
      )}

      {/* Population + commercial context */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <Metric label="Population" value={fmtNum(pop.approximate_population)} />
        <Metric label="Households" value={fmtNum(pop.household_count)} />
        <Metric label="Median income" value={pop.median_household_income != null ? `$${fmtNum(pop.median_household_income)}` : '—'} />
        <Metric label="Growth" value={pop.growth_direction ? `${pop.growth_direction} (${fmtDec(pop.growth_rate_percent)}%)` : '—'} />
        <Metric label="Active businesses" value={fmtNum(cc.approximate_active_businesses)} />
        <Metric label="Sampled" value={fmtNum(cc.verified_sampled_businesses)} />
        <Metric label="Service biz %" value={fmtPct(cc.estimated_service_business_percent)} />
        <Metric label="Categories" value={fmtNum(cc.categories_represented)} />
      </div>

      {/* Digital opportunity score components */}
      {dos && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Digital Opportunity Score — {dos.score}/10 ({dos.classification})
          </h5>
          {dos.components && Object.keys(dos.components).length > 0 && (
            <div className="space-y-1">
              {Object.entries(dos.components).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 capitalize w-44 truncate">{k.replace(/_/g, ' ')}:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (v as number) * 10)}%` }} />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 w-6 text-right">{v as number}</span>
                </div>
              ))}
            </div>
          )}
          {dos.rationale && <p className="mt-1 text-gray-500 dark:text-gray-400">{dos.rationale}</p>}
        </div>
      )}

      {/* City priority score components */}
      {cps?.components && Object.keys(cps.components).length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            City Priority Score — {cps.score}
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(cps.components).map(([k, v]) => (
              <Badge key={k} cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {k.replace(/_/g, ' ')}: {v}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Review benchmarks */}
      {rb.valid_google_business_count != null && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Review Benchmarks ({rb.valid_google_business_count} valid)
          </h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <Metric label="Avg rating" value={fmtDec(rb.average_google_rating)} />
            <Metric label="Median rating" value={fmtDec(rb.median_google_rating)} />
            <Metric label="Avg reviews" value={fmtNum(rb.average_google_review_count)} />
            <Metric label="Median reviews" value={fmtNum(rb.median_google_review_count)} />
            <Metric label="≥4.5 rating" value={fmtPct(rb.percent_at_or_above_4_5_rating)} />
            <Metric label="<4 rating" value={fmtPct(rb.percent_below_4_rating)} />
            <Metric label=">100 reviews" value={fmtPct(rb.percent_above_100_google_reviews)} />
            <Metric label="<10 reviews" value={fmtPct(rb.percent_below_10_google_reviews)} />
            <Metric label="Recent responses" value={fmtPct(rb.percent_with_recent_owner_responses)} />
            <Metric label="Weak response" value={fmtPct(rb.percent_with_weak_review_response_activity)} />
            <Metric label="Unanswered neg" value={fmtPct(rb.percent_with_visible_unanswered_negative_reviews)} />
          </div>
        </div>
      )}

      {/* GBP + website + NAP metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {gpm.verifiable_profile_count != null && (
          <div>
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Google Profile ({gpm.verifiable_profile_count})
            </h5>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Claimed</span><span>{fmtPct(gpm.claimed_or_likely_claimed_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Incomplete</span><span>{fmtPct(gpm.incomplete_profile_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Hours issue</span><span>{fmtPct(gpm.hours_issue_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Weak photos</span><span>{fmtPct(gpm.weak_photo_coverage_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Duplicates</span><span>{fmtPct(gpm.duplicate_or_conflicting_listing_percent)}</span></div>
            </div>
          </div>
        )}
        {wm.verifiable_business_count != null && (
          <div>
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Website ({wm.verifiable_business_count})
            </h5>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Working</span><span>{fmtPct(wm.working_website_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">No website</span><span>{fmtPct(wm.no_website_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Mobile friendly</span><span>{fmtPct(wm.mobile_friendly_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Clear CTA</span><span>{fmtPct(wm.clear_conversion_action_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Material issue</span><span>{fmtPct(wm.material_website_issue_percent)}</span></div>
            </div>
          </div>
        )}
        {nap.verifiable_business_count != null && (
          <div>
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              NAP ({nap.verifiable_business_count})
            </h5>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Consistent</span><span>{fmtPct(nap.consistent_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Minor variation</span><span>{fmtPct(nap.minor_variation_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Material inconsistency</span><span>{fmtPct(nap.material_inconsistency_percent)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Possible duplicate</span><span>{fmtPct(nap.possible_duplicate_listing_percent)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Common opportunity themes */}
      {themes.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Common Opportunity Themes
          </h5>
          <div className="space-y-1">
            {themes.map((t, i) => (
              <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{t.theme}</span>
                  {t.severity && <Badge cls={severityColor(t.severity)}>{t.severity}</Badge>}
                  {t.confidence && <Badge cls={confidenceColor(t.confidence)}>conf: {t.confidence}</Badge>}
                  {t.observed_percent != null && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{t.observed_percent}%</Badge>}
                </div>
                {t.evidence_summary && <p className="mt-0.5 text-gray-500 dark:text-gray-400">{t.evidence_summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Representative categories */}
      {cats.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Representative Categories
          </h5>
          <div className="space-y-1">
            {cats.map((c, i) => (
              <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-400">#{c.rank ?? i + 1}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{c.category}</span>
                  {c.digital_opportunity_level && <Badge cls={opportunityClassColor(c.digital_opportunity_level)}>{c.digital_opportunity_level.replace(/_/g, ' ')}</Badge>}
                  {c.outreach_priority && <Badge cls={priorityColor(c.outreach_priority)}>{c.outreach_priority} outreach</Badge>}
                  {c.approximate_business_count != null && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">~{c.approximate_business_count} biz</Badge>}
                </div>
                {c.most_common_weakness && <p className="mt-0.5 text-gray-500 dark:text-gray-400">{c.most_common_weakness}</p>}
                {c.recommended_next_analysis && (
                  <p className="mt-0.5 text-[10px] text-gray-400">Next: {c.recommended_next_analysis.replace(/_/g, ' ')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commercial corridors + development signals */}
      {(cc.commercial_corridors?.length || cc.development_signals?.length || cc.major_employment_sectors?.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cc.commercial_corridors && cc.commercial_corridors.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Corridors</h5>
              <div className="flex flex-wrap gap-1">
                {cc.commercial_corridors.map((c, i) => <Badge key={i} cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{c}</Badge>)}
              </div>
            </div>
          )}
          {cc.major_employment_sectors && cc.major_employment_sectors.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Employment sectors</h5>
              <div className="flex flex-wrap gap-1">
                {cc.major_employment_sectors.map((s, i) => <Badge key={i} cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{s}</Badge>)}
              </div>
            </div>
          )}
          {cc.development_signals && cc.development_signals.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Development signals</h5>
              <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 space-y-0.5">
                {cc.development_signals.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ZIP codes + counties */}
      {(city.representative_zip_codes?.length || city.county_names?.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {city.representative_zip_codes && city.representative_zip_codes.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                ZIP codes ({city.zip_code_count ?? city.representative_zip_codes.length}{city.zip_code_count_complete === false ? ' · incomplete' : ''})
              </h5>
              <div className="flex flex-wrap gap-1">
                {city.representative_zip_codes.map((z) => <Badge key={z} cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{z}</Badge>)}
              </div>
            </div>
          )}
          {city.county_names && city.county_names.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Counties</h5>
              <div className="flex flex-wrap gap-1">
                {city.county_names.map((c) => <Badge key={c} cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{c}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* City-level data quality */}
      {(cdq.confidence || (cdq.small_sample_warnings && cdq.small_sample_warnings.length > 0) || (cdq.limitations && cdq.limitations.length > 0)) && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">City Data Quality</h5>
          <div className="flex items-center gap-2 mb-1">
            {cdq.confidence && <Badge cls={confidenceColor(cdq.confidence)}>Confidence: {cdq.confidence}</Badge>}
          </div>
          {cdq.small_sample_warnings && cdq.small_sample_warnings.length > 0 && (
            <ul className="list-disc list-inside text-amber-700 dark:text-amber-400 space-y-0.5">
              {cdq.small_sample_warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {cdq.limitations && cdq.limitations.length > 0 && (
            <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 space-y-0.5">
              {cdq.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sources</h5>
          <ul className="space-y-0.5">
            {sources.map((s, i) => (
              <li key={i} className="text-gray-500 dark:text-gray-400">
                {s.source_name ?? '—'}
                {s.source_type && <span className="text-gray-400"> · {s.source_type.replace(/_/g, ' ')}</span>}
                {s.accessed_date && <span className="text-gray-400"> · {s.accessed_date}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
