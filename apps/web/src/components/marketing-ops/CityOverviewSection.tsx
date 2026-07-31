'use client';

import { MapPin, Building, Gauge, TrendingUp, Layers, Target, Compass } from 'lucide-react';
import type { CampaignDetail, Audit } from '@/services/MarketingOpsService';

/**
 * CityOverviewSection — scope-aware Overview content for city-scope campaigns.
 *
 * Surfaces the regional city-opportunity digest (summary, regional metrics,
 * top city opportunities, regional category opportunities) from the latest
 * `city_analysis` audit — mirroring how CategoryOverviewSection pulls the
 * latest `category_analysis` audit. Falls back to a sparse city-context view
 * when no regional scan has been imported yet.
 */

// ─── Types (subset of regional-city-opportunity.schema.ts) ──────────────

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

interface ReferenceMarket {
  city?: string;
  state?: string;
  radius_miles?: number;
  include_reference_city?: boolean;
  cross_state_results_allowed?: boolean;
}

interface AuditMetadata {
  audit_date?: string;
  reference_market?: ReferenceMarket;
  cities_considered?: number;
  cities_included?: number;
  distance_method?: string;
}

interface RegionalCityOpportunityData {
  audit_metadata?: AuditMetadata;
  summary?: string;
  regional_metrics?: RegionalMetrics;
  top_city_opportunities?: TopCityOpportunity[];
  regional_category_opportunities?: RegionalCategoryOpportunity[];
  data_quality?: { overall_confidence?: string };
}

function isRegionalCityOpportunityAudit(audit: Audit): boolean {
  return (
    audit.platform === 'city_analysis' &&
    audit.audit_data != null &&
    typeof audit.audit_data === 'object' &&
    ('city_rankings' in audit.audit_data || 'regional_metrics' in audit.audit_data || 'top_city_opportunities' in audit.audit_data)
  );
}

/**
 * Audits are returned newest-first by the API (orderBy created_at desc in
 * getCampaign's include). Find the first city_analysis audit with a regional
 * scan shape.
 */
function findLatestRegionalScan(audits: Audit[] | undefined): RegionalCityOpportunityData | null {
  if (!audits || audits.length === 0) return null;
  for (const audit of audits) {
    if (isRegionalCityOpportunityAudit(audit)) {
      return audit.audit_data as RegionalCityOpportunityData;
    }
  }
  return null;
}

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score <= 6) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (score <= 8) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function priorityColor(pri?: string): string {
  if (pri === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (pri === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
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

function fmtDec(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  return Number(n).toFixed(digits);
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function CityOverviewSection({ campaign }: { campaign: CampaignDetail }) {
  const scan = findLatestRegionalScan(campaign.audits);
  const meta = scan?.audit_metadata ?? {};
  const ref = meta.reference_market ?? {};
  const rm = scan?.regional_metrics ?? {};
  const topOps = scan?.top_city_opportunities ?? [];
  const catOps = scan?.regional_category_opportunities ?? [];

  return (
    <div className="space-y-6">
      {/* City Context */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-blue-500" />
          City Context
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">City</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.city ?? '—'}</dd>
          </div>
          {campaign.neighborhood && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Neighborhood</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.neighborhood}</dd>
            </div>
          )}
          {campaign.tone && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Tone</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.tone}</dd>
            </div>
          )}
          {campaign.attributes && campaign.attributes.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Attributes</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.attributes.join(', ')}</dd>
            </div>
          )}
        </div>
      </div>

      {!scan ? (
        <div className="rounded-lg bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-700 p-4">
          <div className="flex items-start gap-2">
            <Building className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No regional city scan imported yet. Run a city-scope prompt template
              and import the external result to populate the regional digest below.
              Imported scans also surface in full under the Audits tab.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Scan header */}
          <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-blue-500" />
                Regional City Scan
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
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
                    {meta.cities_included} / {meta.cities_considered ?? '—'} cities
                  </Badge>
                )}
                {scan.data_quality?.overall_confidence && (
                  <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    Confidence: {scan.data_quality.overall_confidence}
                  </Badge>
                )}
              </div>
            </div>
            {scan.summary && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{scan.summary}</p>
            )}
          </div>

          {/* Regional metrics */}
          {Object.keys(rm).length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-blue-500" />
                Regional Metrics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Total population" value={fmtNum(rm.total_approximate_population)} />
                <Metric label="Local businesses" value={fmtNum(rm.total_approximate_local_businesses)} />
                <Metric label="Sampled businesses" value={fmtNum(rm.total_sampled_businesses)} />
                <Metric label="Avg opp score" value={fmtDec(rm.average_city_digital_opportunity_score)} />
                <Metric label="High-opp cities" value={fmtNum(rm.high_opportunity_cities)} />
                <Metric label="Very-high-opp" value={fmtNum(rm.very_high_opportunity_cities)} />
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

          {/* Top city opportunities */}
          {topOps.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Top City Opportunities
              </h3>
              <div className="space-y-1.5">
                {topOps.map((t) => (
                  <div
                    key={`${t.rank}-${t.city}`}
                    className="flex items-start justify-between gap-2 flex-wrap bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 px-3 py-2"
                  >
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
                      {t.distance_from_reference_miles != null && (
                        <span className="text-[10px] text-gray-400">{t.distance_from_reference_miles} mi</span>
                      )}
                    </div>
                    {t.recommended_next_action && (
                      <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {nextActionLabel(t.recommended_next_action)}
                      </Badge>
                    )}
                    {t.primary_opportunity && (
                      <p className="w-full text-xs text-gray-600 dark:text-gray-400">{t.primary_opportunity}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regional category opportunities */}
          {catOps.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Regional Category Opportunities
              </h3>
              <div className="space-y-1.5">
                {catOps.map((c) => (
                  <div
                    key={`${c.rank}-${c.category}`}
                    className="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-400">#{c.rank}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.category}</span>
                        {c.regional_outreach_priority && (
                          <Badge cls={priorityColor(c.regional_outreach_priority)}>{c.regional_outreach_priority} priority</Badge>
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

          <p className="text-[11px] text-gray-400">
            Full per-city breakdown (rankings, benchmarks, themes, sources) is available under the Audits tab.
          </p>
        </>
      )}
    </div>
  );
}
