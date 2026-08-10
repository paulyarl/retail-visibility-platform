'use client';

import { useState } from 'react';
import { Copy, Check, ArrowRight, Sparkles, StickyNote, Plus, Loader2, X, MapPin, Star, TrendingUp, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * CityCategoryAnalysisAuditCard — structured renderer for city_category_opportunity
 * audits (the "City Category Digital Audit" prompt output).
 *
 * These audits are created by the external-import flow when a prompt template
 * declares `output_schema.name = "city_category_opportunity"`. The full
 * validated JSON is stored in `audit.audit_data`. This card renders the
 * structured fields (market size, category benchmarks, competitive landscape,
 * top competitors, sampled businesses, opportunity score, outreach
 * recommendation) and provides action buttons:
 *   - Copy outreach angle
 *   - Save to campaign notes (append)
 *   - Create seek prompt deep-link
 *   - Derive business-scope child campaign from a sampled business
 *     (per-business button + custom-name action)
 */

interface SampledBusiness {
  business_name: string;
  ownership_type?: string;
  location_status?: string;
  // V2 fields
  city?: string | null;
  state?: string | null;
  distance_from_market_center_miles?: number | null;
  signal_count?: number;
  prospect_priority?: string;
  // Shared fields
  address?: string;
  phone?: string | null;
  website?: string | null;
  detected_signals?: string[];
  nap_status?: string;
  data_confidence?: string;
  google?: {
    rating?: number | null;
    review_count?: number | null;
    profile_status?: string;
    hours_status?: string;
    photo_activity?: string;
  } | null;
  yelp?: { rating?: number | null; review_count?: number | null } | null;
  website_assessment?: {
    status?: string;
    mobile_friendly?: string | null;
    clear_call_to_action?: string | null;
    issues?: string[];
  } | null;
  observed_opportunities?: string[];
}

interface HighestSignalBusiness {
  business_name: string;
  city?: string | null;
  location_status?: string;
  signal_count: number;
  detected_signals?: string[];
  prospect_priority: string;
}

interface RecommendedForBusinessAudit {
  business_name: string;
  city?: string | null;
  location_status?: string;
  prospect_priority: string;
  reason: string;
}

interface ProspectDiscovery {
  total_qualifying_prospects?: number | null;
  high_priority_count?: number;
  medium_priority_count?: number;
  low_priority_count?: number;
  insufficient_evidence_count?: number;
  inside_city_prospect_count?: number;
  adjacent_city_prospect_count?: number;
  metro_area_prospect_count?: number;
  highest_signal_businesses?: HighestSignalBusiness[];
  recommended_for_business_audit?: RecommendedForBusinessAudit[];
}

interface TopCompetitor {
  rank: number;
  business_name: string;
  ownership_type?: string;
  address?: string;
  website?: string | null;
  detected_signals?: string[];
  google?: {
    rating?: number | null;
    review_count?: number | null;
    profile_status?: string;
  } | null;
  competitive_visibility_score?: { score?: number };
  strengths?: string[];
  weaknesses?: string[];
  ranking_rationale?: string;
}

interface CityCategoryOpportunityData {
  audit_metadata?: {
    requested_market?: { category?: string; city?: string; state?: string };
    geographic_scope?: {
      scope_mode?: string;
      market_center?: string;
      adjacent_cities_included?: string[];
      metro_areas_included?: string[];
    };
  };
  summary?: string;
  market_size?: {
    // V2 nested structure
    core_city?: {
      verified_business_count?: number | null;
      approximate_business_count?: number | null;
    };
    prospect_universe?: {
      verified_business_count?: number | null;
      approximate_business_count?: number | null;
      inside_city_count?: number | null;
      adjacent_city_count?: number | null;
      metro_area_count?: number | null;
    };
    // Shared top-level fields
    detailed_sample_size?: number;
    estimate_confidence?: string;
    counts_complete?: boolean;
    // Legacy V1 flat fields (fallback for older stored audits)
    verified_business_count?: number | null;
    approximate_business_count?: number | null;
  };
  category_benchmarks?: {
    google?: {
      average_rating?: number | null;
      average_review_count?: number | null;
      valid_business_count?: number;
      claimed_or_likely_claimed_percent?: number | null;
    };
    website?: {
      working_website_percent?: number | null;
      mobile_friendly_percent?: number | null;
      clear_conversion_action_percent?: number | null;
    };
  };
  competitive_landscape?: {
    concentration?: string;
    market_leader?: string;
    highest_google_review_count?: number | null;
    top_five_share_of_sample_reviews_percent?: number | null;
    competitive_summary?: string;
  };
  top_competitors?: TopCompetitor[];
  sampled_businesses?: SampledBusiness[];
  category_digital_opportunity_score?: {
    score?: number;
    classification?: string;
    rationale?: string;
    components?: Record<string, number>;
  };
  outreach_recommendation?: {
    primary_angle?: string;
    problem_to_reference?: string;
    suggested_service_package?: string[];
    recommended_proof_or_demonstration?: string;
    suggested_call_to_action?: string;
  };
  recommended_tier?: string;
  estimated_monthly_service_fee?: { minimum?: number; maximum?: number; currency?: string };
  // V2 prospect discovery
  prospect_discovery?: ProspectDiscovery;
}

function isCityCategoryAudit(audit: Audit): boolean {
  return audit.platform === 'city_category_analysis'
    && audit.audit_data != null
    && typeof audit.audit_data === 'object'
    && ('audit_metadata' in audit.audit_data || 'sampled_businesses' in audit.audit_data || 'top_competitors' in audit.audit_data);
}

function parseAudit(audit: Audit): CityCategoryOpportunityData | null {
  if (!isCityCategoryAudit(audit)) return null;
  return audit.audit_data as CityCategoryOpportunityData;
}

export default function CityCategoryAnalysisAuditCard({
  audit,
  campaignId,
}: {
  audit: Audit;
  campaignId: string;
}) {
  const data = parseAudit(audit);
  const [copiedAngle, setCopiedAngle] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [derivingIdx, setDerivingIdx] = useState<number | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [showCustomDerive, setShowCustomDerive] = useState(false);
  const [customName, setCustomName] = useState('');
  const [derivingCustom, setDerivingCustom] = useState(false);
  const [queueingIdx, setQueueingIdx] = useState<number | null>(null);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<number, 'queued' | 'exists' | 'already'>>({});
  const router = useRouter();

  if (!data) return null;

  const market = data.audit_metadata?.requested_market;
  const marketLabel = [market?.city, market?.state].filter(Boolean).join(', ');
  const categoryLabel = market?.category ?? '';
  const outreachAngle = data.outreach_recommendation?.primary_angle ?? '';
  const sampled = data.sampled_businesses ?? [];
  const competitors = data.top_competitors ?? [];
  const score = data.category_digital_opportunity_score;
  const fee = data.estimated_monthly_service_fee;
  const prospectDiscovery = data.prospect_discovery;

  // V2 market_size: prefer nested core_city / prospect_universe, fall back to
  // legacy flat fields for older stored audits.
  const ms = data.market_size;
  const coreCityVerified = ms?.core_city?.verified_business_count ?? ms?.verified_business_count ?? null;
  const coreCityApprox = ms?.core_city?.approximate_business_count ?? ms?.approximate_business_count ?? null;
  const prospectUniverse = ms?.prospect_universe;
  const prospectUniverseVerified = prospectUniverse?.verified_business_count ?? null;
  const prospectUniverseApprox = prospectUniverse?.approximate_business_count ?? null;
  const detailedSampleSize = ms?.detailed_sample_size ?? sampled.length;
  const hasProspectUniverse = prospectUniverse != null;

  const handleDeriveFromSampled = async (idx: number) => {
    const b = sampled[idx];
    if (!b) return;
    setDerivingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: b.business_name,
        rating: b.google?.rating ?? undefined,
        review_count: b.google?.review_count ?? undefined,
        location: b.address ?? b.city ?? undefined,
        detected_signals: b.detected_signals,
      });
      router.push(`/settings/admin/marketing-ops/campaigns/${child.id}`);
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
      setDerivingIdx(null);
    }
  };

  const handleDeriveCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    setDerivingCustom(true);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: name,
      });
      router.push(`/settings/admin/marketing-ops/campaigns/${child.id}`);
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
      setDerivingCustom(false);
    }
  };

  const handleAddToQueue = async (idx: number) => {
    const b = sampled[idx];
    if (!b) return;
    setQueueingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const result = await service.addToQueue({
        business_name: b.business_name,
        source_kind: 'city_category_audit',
        source_campaign_id: campaignId,
        source_audit_id: audit.id,
        audit_date: audit.created_at,
        business_snapshot: {
          ...b,
          rating: b.google?.rating ?? null,
          review_count: b.google?.review_count ?? null,
          location: b.address ?? b.city ?? null,
        },
        detected_signals: b.detected_signals,
      } as any);
      setQueuedFeedback((prev) => ({
        ...prev,
        [idx]: result.kind === 'campaign_exists' ? 'exists' : result.kind === 'already_queued' ? 'already' : 'queued',
      }));
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to add to queue');
    } finally {
      setQueueingIdx(null);
    }
  };

  const handleCopyAngle = () => {
    navigator.clipboard.writeText(outreachAngle);
    setCopiedAngle(true);
    setTimeout(() => setCopiedAngle(false), 2000);
  };

  const handleSaveToNotes = () => {
    const noteText = `[${new Date(audit.created_at).toLocaleDateString()}] Outreach angle: ${outreachAngle}`;
    import('@/services/MarketingOpsService').then(({ default: service }) => {
      service.getCampaign(campaignId).then((campaign) => {
        const existingNotes = campaign.notes || '';
        const newNotes = existingNotes ? `${existingNotes}\n${noteText}` : noteText;
        service.updateCampaign(campaignId, { notes: newNotes }).then(() => {
          setSavedNotes(true);
          setTimeout(() => setSavedNotes(false), 3000);
        });
      });
    });
  };

  const seekPromptHref = `/settings/admin/marketing-ops/prompts?campaignId=${encodeURIComponent(campaignId)}&angle=${encodeURIComponent(outreachAngle)}`;

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/30 dark:bg-emerald-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-gray-900 dark:text-white">City Category Digital Audit</span>
          <span className="text-xs text-gray-400">
            {categoryLabel} · {marketLabel}
          </span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{data.summary}</p>
      )}

      {/* Market size + opportunity score — V2 shows core city vs prospect universe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric
          label={hasProspectUniverse ? 'Core city (verified)' : 'Verified businesses'}
          value={String(coreCityVerified ?? '—')}
        />
        <Metric
          label={hasProspectUniverse ? 'Core city (approx)' : 'Approx market size'}
          value={String(coreCityApprox ?? '—')}
        />
        {hasProspectUniverse ? (
          <Metric
            label="Prospect universe"
            value={prospectUniverseVerified != null ? String(prospectUniverseVerified) : prospectUniverseApprox != null ? `~${prospectUniverseApprox}` : '—'}
            title={prospectUniverse ? `inside ${prospectUniverse.inside_city_count ?? '?'} · adjacent ${prospectUniverse.adjacent_city_count ?? '?'} · metro ${prospectUniverse.metro_area_count ?? '?'}` : undefined}
          />
        ) : (
          <Metric label="Detailed sample" value={String(detailedSampleSize ?? '—')} />
        )}
        <Metric
          label="Opportunity score"
          value={score ? `${score.score}/10 (${score.classification ?? '—'})` : '—'}
          highlight={score?.classification === 'high' || score?.classification === 'very_high'}
        />
      </div>

      {/* Prospect universe geographic breakdown (V2) */}
      {hasProspectUniverse && (prospectUniverse?.inside_city_count != null || prospectUniverse?.adjacent_city_count != null || prospectUniverse?.metro_area_count != null) && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Metric label="Inside city" value={String(prospectUniverse?.inside_city_count ?? '—')} />
          <Metric label="Adjacent city" value={String(prospectUniverse?.adjacent_city_count ?? '—')} />
          <Metric label="Metro area" value={String(prospectUniverse?.metro_area_count ?? '—')} />
        </div>
      )}

      {/* Category benchmarks */}
      {data.category_benchmarks && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Metric
            label="Avg Google rating"
            value={data.category_benchmarks.google?.average_rating != null ? Number(data.category_benchmarks.google.average_rating).toFixed(2) : '—'}
          />
          <Metric
            label="Avg review count"
            value={data.category_benchmarks.google?.average_review_count != null ? String(Math.round(Number(data.category_benchmarks.google.average_review_count))) : '—'}
          />
          <Metric
            label="Website adoption"
            value={data.category_benchmarks.website?.working_website_percent != null ? `${data.category_benchmarks.website.working_website_percent}%` : '—'}
          />
          <Metric
            label="GBP claimed"
            value={data.category_benchmarks.google?.claimed_or_likely_claimed_percent != null ? `${data.category_benchmarks.google.claimed_or_likely_claimed_percent}%` : '—'}
          />
        </div>
      )}

      {/* Competitive landscape */}
      {data.competitive_landscape && (
        <div className="mb-4 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Competitive landscape</p>
            <span className="text-xs text-gray-500 capitalize">{data.competitive_landscape.concentration?.replace(/_/g, ' ')}</span>
          </div>
          {data.competitive_landscape.market_leader && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Market leader:</span> {data.competitive_landscape.market_leader}
              {data.competitive_landscape.highest_google_review_count != null && (
                <span className="ml-2">({data.competitive_landscape.highest_google_review_count} reviews)</span>
              )}
            </p>
          )}
          {data.competitive_landscape.competitive_summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{data.competitive_landscape.competitive_summary}</p>
          )}
        </div>
      )}

      {/* Top competitors */}
      {competitors.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top competitors</p>
          <div className="space-y-1">
            {competitors.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-neutral-800 rounded px-2 py-1.5 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 dark:text-white truncate">#{c.rank} {c.business_name}</span>
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {c.google?.rating != null && <>{Number(c.google.rating).toFixed(1)} ★</>}
                    {c.google?.review_count != null && <> · {c.google.review_count} reviews</>}
                    {c.ownership_type && <> · {c.ownership_type.replace(/_/g, ' ')}</>}
                  </span>
                </div>
                {c.competitive_visibility_score?.score != null && (
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                    visibility: {c.competitive_visibility_score.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sampled businesses with spawn buttons — sorted by signal count (priority) */}
      {sampled.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Sampled businesses ({sampled.length})
            {sampled.some((b) => (b.signal_count ?? b.detected_signals?.length ?? 0) > 0) && (
              <span className="ml-2 text-[10px] text-gray-400">sorted by signal count</span>
            )}
          </p>
          <div className="space-y-1">
            {[...sampled]
              .map((b, originalIdx) => ({ b, originalIdx }))
              .sort((a, z) => (z.b.signal_count ?? z.b.detected_signals?.length ?? 0) - (a.b.signal_count ?? a.b.detected_signals?.length ?? 0))
              .map(({ b, originalIdx }, displayIdx) => {
                const signals = b.detected_signals ?? [];
                const signalCount = b.signal_count ?? signals.length;
                const hasCrisis = signals.includes('RA_BBB_GRADE_SUPPRESSION') || signals.includes('RA_UNANSWERED_COMPLAINTS');
                const priorityColors: Record<string, string> = {
                  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                  insufficient_evidence: 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
                };
                const locStatusColors: Record<string, string> = {
                  inside_city: 'text-emerald-600 dark:text-emerald-400',
                  adjacent_city: 'text-blue-600 dark:text-blue-400',
                  metro_area: 'text-purple-600 dark:text-purple-400',
                  outside_city_serving_city: 'text-blue-600 dark:text-blue-400',
                  unable_to_verify: 'text-gray-400',
                };
                return (
                  <div
                    key={originalIdx}
                    className={`flex items-center justify-between text-xs bg-white dark:bg-neutral-800 rounded px-2 py-1.5 border ${
                      hasCrisis
                        ? 'border-red-300 dark:border-red-800'
                        : signalCount > 0
                          ? 'border-amber-200 dark:border-amber-800'
                          : 'border-gray-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white truncate">{b.business_name}</span>
                        {b.google?.rating != null && (
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                            <Star className="w-3 h-3 text-amber-400" />
                            {Number(b.google.rating).toFixed(1)}
                          </span>
                        )}
                        {b.google?.review_count != null && (
                          <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{b.google.review_count} reviews</span>
                        )}
                        {b.location_status && (
                          <span className={`flex-shrink-0 text-[9px] font-medium ${locStatusColors[b.location_status] ?? 'text-gray-400'}`}>
                            {b.location_status.replace(/_/g, ' ')}
                          </span>
                        )}
                        {b.prospect_priority && (
                          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${priorityColors[b.prospect_priority] ?? priorityColors.insufficient_evidence}`}>
                            {b.prospect_priority.replace(/_/g, ' ')}
                          </span>
                        )}
                        {signalCount > 0 && !b.prospect_priority && (
                          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            hasCrisis
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {signalCount} signal{signalCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-gray-500 dark:text-gray-400">
                        {b.address && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="w-3 h-3" />
                            {b.address}
                          </span>
                        )}
                        {b.city && b.city !== market?.city && (
                          <span className="flex-shrink-0">{b.city}{b.state ? `, ${b.state}` : ''}</span>
                        )}
                        {b.distance_from_market_center_miles != null && (
                          <span className="flex-shrink-0 text-[10px]">{Number(b.distance_from_market_center_miles).toFixed(1)} mi</span>
                        )}
                        {b.nap_status && b.nap_status !== 'consistent' && (
                          <span className="text-amber-600 dark:text-amber-400">NAP: {b.nap_status.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                      {signals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {signals.map((code) => {
                            const family = code.split('_')[0];
                            const familyColors: Record<string, string> = {
                              RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                              DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                              WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                              CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
                              VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
                            };
                            return (
                              <span
                                key={code}
                                className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${familyColors[family] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                                title={code}
                              >
                                {code}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button
                        onClick={() => handleAddToQueue(originalIdx)}
                        disabled={queueingIdx !== null || queuedFeedback[originalIdx] === 'queued'}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-900/40 disabled:opacity-50"
                        title={queuedFeedback[originalIdx] === 'queued' ? 'Added to queue' : `Add ${b.business_name} to the prospect queue for later`}
                      >
                        {queueingIdx === originalIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : queuedFeedback[originalIdx] === 'queued' ? <Check className="w-3 h-3 text-green-600" /> : <Inbox className="w-3 h-3" />}
                        {queuedFeedback[originalIdx] === 'queued' ? 'Queued' : 'Queue'}
                      </button>
                      {queuedFeedback[originalIdx] === 'already' && (
                        <span className="text-[10px] text-slate-400" title="Already in the queue">already queued</span>
                      )}
                      {queuedFeedback[originalIdx] === 'exists' && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400" title="A campaign already exists for this business">campaign exists</span>
                      )}
                      <button
                        onClick={() => handleDeriveFromSampled(originalIdx)}
                        disabled={derivingIdx !== null}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40 disabled:opacity-50"
                        title={`Create a business-scope campaign for ${b.business_name}${signals.length > 0 ? ` (auto-triaged with ${signals.length} signals)` : ''}`}
                      >
                        {derivingIdx === originalIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Campaign
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Outreach recommendation */}
      {outreachAngle && (
        <div className="mb-4 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Recommended outreach angle</p>
          <p className="text-sm text-gray-900 dark:text-white">{outreachAngle}</p>
          {data.outreach_recommendation?.problem_to_reference && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              <span className="font-medium">Problem to reference:</span> {data.outreach_recommendation.problem_to_reference}
            </p>
          )}
          {data.outreach_recommendation?.suggested_service_package && data.outreach_recommendation.suggested_service_package.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Suggested service package:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mt-0.5">
                {data.outreach_recommendation.suggested_service_package.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {fee && fee.minimum != null && fee.maximum != null && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              <span className="font-medium">Estimated monthly fee:</span> ${fee.minimum}–${fee.maximum} {fee.currency ?? 'USD'}
            </p>
          )}
        </div>
      )}

      {/* Prospect discovery (V2) */}
      {prospectDiscovery && (
        <div className="mb-4 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Prospect discovery</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <Metric label="Total prospects" value={String(prospectDiscovery.total_qualifying_prospects ?? '—')} />
            <Metric label="High priority" value={String(prospectDiscovery.high_priority_count ?? 0)} highlight={(prospectDiscovery.high_priority_count ?? 0) > 0} />
            <Metric label="Medium priority" value={String(prospectDiscovery.medium_priority_count ?? 0)} />
            <Metric label="Insufficient evidence" value={String(prospectDiscovery.insufficient_evidence_count ?? 0)} />
          </div>
          {prospectDiscovery.recommended_for_business_audit && prospectDiscovery.recommended_for_business_audit.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recommended for Business Audit:</p>
              <div className="space-y-1">
                {prospectDiscovery.recommended_for_business_audit.map((r, i) => (
                  <div key={i} className="text-xs text-gray-700 dark:text-gray-300 bg-emerald-50/50 dark:bg-emerald-900/10 rounded px-2 py-1 border border-emerald-100 dark:border-emerald-900/30">
                    <span className="font-medium">{r.business_name}</span>
                    {r.city && <span className="text-gray-500 dark:text-gray-400"> · {r.city}</span>}
                    {r.location_status && <span className="text-gray-400"> · {r.location_status.replace(/_/g, ' ')}</span>}
                    {r.prospect_priority && <span className="ml-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{r.prospect_priority}</span>}
                    {r.reason && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{r.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {prospectDiscovery.highest_signal_businesses && prospectDiscovery.highest_signal_businesses.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Highest-signal businesses:</p>
              <div className="flex flex-wrap gap-1">
                {prospectDiscovery.highest_signal_businesses.map((h, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded px-1.5 py-0.5 border border-amber-200 dark:border-amber-800/50">
                    {h.business_name} · {h.signal_count} signals
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {outreachAngle && (
          <button
            onClick={handleCopyAngle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
          >
            {copiedAngle ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedAngle ? 'Copied!' : 'Copy angle'}
          </button>
        )}
        {outreachAngle && (
          <button
            onClick={handleSaveToNotes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
          >
            <StickyNote className="w-3.5 h-3.5" />
            {savedNotes ? 'Saved!' : 'Save to notes'}
          </button>
        )}
        <button
          onClick={() => setShowCustomDerive((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 dark:bg-neutral-800 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCustomDerive ? 'Cancel' : 'Business campaign…'}
        </button>
        <Link
          href={seekPromptHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Create seek prompt
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Custom business-name derive form */}
      {showCustomDerive && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Business name (e.g. Acme HVAC)"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onKeyDown={(e) => { if (e.key === 'Enter') handleDeriveCustom(); }}
          />
          <button
            onClick={handleDeriveCustom}
            disabled={derivingCustom || !customName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {derivingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Create
          </button>
          <button
            onClick={() => { setShowCustomDerive(false); setCustomName(''); setDeriveError(null); }}
            className="inline-flex items-center px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Derive error */}
      {deriveError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{deriveError}</p>
      )}
    </div>
  );
}

function Metric({ label, value, highlight, title }: { label: string; value: string; highlight?: boolean; title?: string }) {
  return (
    <div className={`rounded-lg bg-white dark:bg-neutral-800 border p-2 ${highlight ? 'border-emerald-300 dark:border-emerald-700' : 'border-gray-200 dark:border-neutral-700'}`} title={title}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}
