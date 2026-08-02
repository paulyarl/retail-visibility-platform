'use client';

import { useState } from 'react';
import { Copy, Check, ArrowRight, Sparkles, StickyNote, Plus, Loader2, X, MapPin, Star, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Audit } from '@/services/MarketingOpsService';

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
  address?: string;
  phone?: string | null;
  website?: string | null;
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

interface TopCompetitor {
  rank: number;
  business_name: string;
  ownership_type?: string;
  address?: string;
  website?: string | null;
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
  };
  summary?: string;
  market_size?: {
    verified_business_count?: number;
    approximate_business_count?: number;
    detailed_sample_size?: number;
    estimate_confidence?: string;
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
        location: b.address ?? undefined,
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
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{data.summary}</p>
      )}

      {/* Market size + opportunity score */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Verified businesses" value={String(data.market_size?.verified_business_count ?? '—')} />
        <Metric label="Approx market size" value={String(data.market_size?.approximate_business_count ?? '—')} />
        <Metric label="Detailed sample" value={String(data.market_size?.detailed_sample_size ?? sampled.length ?? '—')} />
        <Metric
          label="Opportunity score"
          value={score ? `${score.score}/10 (${score.classification ?? '—'})` : '—'}
          highlight={score?.classification === 'high' || score?.classification === 'very_high'}
        />
      </div>

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

      {/* Sampled businesses with spawn buttons */}
      {sampled.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Sampled businesses ({sampled.length})
          </p>
          <div className="space-y-1">
            {sampled.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-neutral-800 rounded px-2 py-1.5 border border-gray-200 dark:border-neutral-700">
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
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-500 dark:text-gray-400">
                    {b.address && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="w-3 h-3" />
                        {b.address}
                      </span>
                    )}
                    {b.nap_status && b.nap_status !== 'consistent' && (
                      <span className="text-amber-600 dark:text-amber-400">NAP: {b.nap_status.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeriveFromSampled(i)}
                  disabled={derivingIdx !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40 disabled:opacity-50 flex-shrink-0 ml-2"
                  title={`Create a business-scope campaign for ${b.business_name}`}
                >
                  {derivingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Campaign
                </button>
              </div>
            ))}
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

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg bg-white dark:bg-neutral-800 border p-2 ${highlight ? 'border-emerald-300 dark:border-emerald-700' : 'border-gray-200 dark:border-neutral-700'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}
