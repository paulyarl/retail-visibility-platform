'use client';

import { Sparkles, MapPin, Building2, TrendingUp, AlertCircle, Target, MessageSquare } from 'lucide-react';
import type { CampaignDetail, Audit } from '@/services/MarketingOpsService';

/**
 * CategoryOverviewSection — scope-aware Overview content for category-scope
 * campaigns. Renders the market analysis (industry, location, market size,
 * GBP metrics, top competitors, pain points, opportunity gaps, outreach angle)
 * sourced from the latest `category_analysis` audit's `audit_data`.
 *
 * Business-scope fields (GBP claimed, NAP, pain score, fees/retainer) are
 * intentionally omitted — they are null for category campaigns and would
 * render as a blank grid. Those fields belong to the child business-scope
 * campaigns derived from this analysis.
 */
interface MarketAnalysisData {
  market_analysis: {
    location: string;
    industry: string;
    total_approximate_businesses: number;
    average_gbp_metrics: {
      average_rating: number;
      average_review_count: number;
    };
    gbp_claimed_percentage: number;
    website_presence_percentage: number;
    top_5_competitors: {
      name: string;
      approximate_rating: number;
      approximate_review_count: number;
      location_status: string;
    }[];
    common_pain_points: string[];
    opportunity_gaps: string[];
    recommended_outreach_angle: string;
  };
}

function findLatestMarketAnalysis(audits: Audit[] | undefined): MarketAnalysisData | null {
  if (!audits || audits.length === 0) return null;
  // Audits are returned newest-first by the API (orderBy created_at desc in
  // getCampaign's include). Find the first category_analysis audit with
  // market_analysis data.
  for (const audit of audits) {
    if (
      audit.platform === 'category_analysis' &&
      audit.audit_data != null &&
      typeof audit.audit_data === 'object' &&
      'market_analysis' in audit.audit_data
    ) {
      return audit.audit_data as MarketAnalysisData;
    }
  }
  return null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function CategoryOverviewSection({ campaign }: { campaign: CampaignDetail }) {
  const ma = findLatestMarketAnalysis(campaign.audits);
  const data = ma?.market_analysis;

  return (
    <div className="space-y-6">
      {/* Market Context */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-violet-500" />
          Market Context
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Industry / Category</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{data?.industry ?? campaign.category ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-0.5">
              {data?.location ?? campaign.city ?? '—'}
            </dd>
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

      {!data ? (
        <div className="rounded-lg bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No market analysis imported yet. Run a category-scope prompt template
            and import the external result to populate this view.
          </p>
        </div>
      ) : (
        <>
          {/* Market Size & GBP Metrics */}
          <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              Market Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Total businesses" value={String(data.total_approximate_businesses)} />
              <Metric label="Avg rating" value={data.average_gbp_metrics.average_rating.toFixed(1)} />
              <Metric label="Avg reviews" value={String(data.average_gbp_metrics.average_review_count)} />
              <Metric label="GBP claimed" value={`${data.gbp_claimed_percentage}%`} />
              <Metric label="Website presence" value={`${data.website_presence_percentage}%`} />
            </div>
          </div>

          {/* Top Competitors */}
          {data.top_5_competitors.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-violet-500" />
                Top Competitors
              </h3>
              <div className="space-y-1">
                {data.top_5_competitors.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-white dark:bg-neutral-800 rounded px-2 py-1.5 border border-gray-200 dark:border-neutral-700"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {c.approximate_rating.toFixed(1)} ★ · {c.approximate_review_count} reviews · {c.location_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pain Points + Opportunity Gaps */}
          <div className="pt-4 border-t border-gray-200 dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.common_pain_points.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Common Pain Points
                </h3>
                <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                  {data.common_pain_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {data.opportunity_gaps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-500" />
                  Opportunity Gaps
                </h3>
                <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                  {data.opportunity_gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Outreach Angle */}
          <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              Recommended Outreach Angle
            </h3>
            <p className="text-sm text-gray-900 dark:text-white bg-violet-50/30 dark:bg-violet-900/10 rounded-lg border border-violet-200 dark:border-violet-800 p-3">
              {data.recommended_outreach_angle}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
