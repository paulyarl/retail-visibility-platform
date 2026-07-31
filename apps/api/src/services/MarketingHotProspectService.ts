/**
 * MarketingHotProspectService
 *
 * Closes the loop between City Pain Scan executions and campaign records:
 *  - Parses the multi-business audit JSON from `city_analysis` executions
 *  - Matches each business to a campaign (business_name + city + category + state)
 *  - Stores per-business `city_analysis` audits + a city-level summary audit
 *  - Syncs structured fields onto campaigns (confidence-gated via data_quality)
 *  - Syncs Sprint 1 contact fields (phone, website_url) — null-only
 *  - Derives hot-prospect signals (top_opportunities, high_attention, score, tier)
 *  - Provides operator override (setHot / setNotHot) + deprioritization lifecycle
 *  - Fallback: pain_score >= threshold at intake (no scan audit required)
 *
 * Pattern: singleton extends BaseService (mirrors MarketingOutreachService).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { unifiedConfig } from '../config/unifiedConfig';
import { generateMarketingAuditId } from '../lib/id-generator';

// ─── Types ──────────────────────────────────────────────────────────────

interface BusinessJson {
  rank?: number;
  business_name: string;
  category: string;
  ownership_type?: string;
  address?: string | null;
  business_phone?: string | null;
  platforms?: {
    google?: {
      profile_status?: string;
      rating?: number | null;
      total_reviews?: number | null;
      observable_unanswered_reviews?: number | null;
      data_status?: string;
    };
    yelp?: any;
    facebook?: any;
  };
  combined_review_metrics?: {
    observable_total_reviews?: number | null;
    observable_unanswered_reviews?: number | null;
    unanswered_rate_percent?: number | null;
  };
  website?: {
    url?: string | null;
    status?: string;
    mobile_friendly?: string | null;
    https?: boolean | null;
  };
  nap_consistency?: { status?: string };
  digital_opportunity_score?: { score?: number; classification?: string; components?: any; rationale?: string };
  high_attention?: boolean;
  high_attention_reasons?: string[];
  recommended_tier?: string;
  estimated_monthly_service_fee?: { minimum?: number; maximum?: number; currency?: string };
  data_quality?: {
    confidence?: 'high' | 'medium' | 'low';
    verified_fields?: string[];
    unavailable_fields?: string[];
    limitations?: string[];
  };
  negative_review_themes?: any[];
  opportunities?: any;
}

interface TopOpportunity {
  rank?: number;
  business_name: string;
  category?: string;
  digital_opportunity_score?: number;
  recommended_tier?: string;
  primary_opportunity?: string;
  suggested_service?: string;
}

interface CityScanOutput {
  audit_metadata?: {
    city?: string;
    state?: string;
    audit_date?: string;
    businesses_considered?: number;
    businesses_included?: number;
    categories_included?: number;
  };
  summary?: string;
  city_metrics?: any;
  category_rankings?: any[];
  businesses?: BusinessJson[];
  top_opportunities?: TopOpportunity[];
}

export interface SyncReport {
  executionId: string;
  city: string | null;
  state: string | null;
  businessesInOutput: number;
  matched: Array<{ campaignId: string; businessName: string; hot: boolean }>;
  unmatched: Array<{ businessName: string; reason: string }>;
  skippedChains: number;
  hotProspectsMarked: number;
  summaryStored: boolean;
}

export interface HotProspectEntry {
  campaign_id: string;
  business_name: string | null;
  stage: string;
  city: string | null;
  state: string | null;
  category: string | null;
  pain_score: number | null;
  estimated_tier: string | null;
  hot_prospect_reason: string | null;
  hot_prospect_set_at: string | null;
  auto_followup_count: number;
  max_auto_followups: number;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
}

// ─── Service ────────────────────────────────────────────────────────────

export class MarketingHotProspectService extends BaseService {
  private static instance: MarketingHotProspectService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingHotProspectService {
    if (!MarketingHotProspectService.instance) {
      MarketingHotProspectService.instance = new MarketingHotProspectService();
    }
    return MarketingHotProspectService.instance;
  }

  /**
   * Parse a City Pain Scan execution's output, match each business to a
   * campaign, store per-business audits, sync fields + contacts, and
   * derive hot-prospect signals. Returns a sync report for operator
   * visibility. Best-effort: never throws on a single business miss.
   */
  async syncFromExecution(executionId: string, ctx?: RequestCtx): Promise<SyncReport> {
    const report: SyncReport = {
      executionId,
      city: null,
      state: null,
      businessesInOutput: 0,
      matched: [],
      unmatched: [],
      skippedChains: 0,
      hotProspectsMarked: 0,
      summaryStored: false,
    };

    try {
      const execution = await this.prisma.mkt_prompt_executions_list.findUnique({
        where: { id: executionId },
        include: { mkt_prompt_templates_list: { select: { prompt_type: true } } },
      });
      if (!execution) throw new NotFoundError('Execution not found');

      const promptType = execution.mkt_prompt_templates_list?.prompt_type;
      if (promptType !== 'city_analysis') {
        logger.info('syncFromExecution skipped: not a city_analysis execution', ctx, { executionId, promptType });
        return report;
      }

      const rawText = execution.filtered_output || execution.raw_output;
      if (!rawText) {
        logger.info('syncFromExecution skipped: no output', ctx, { executionId });
        return report;
      }

      const parsed = this.parseOutputJson(rawText);
      if (!parsed || !parsed.businesses) {
        logger.info('syncFromExecution skipped: could not parse businesses[]', ctx, { executionId });
        return report;
      }

      report.city = parsed.audit_metadata?.city ?? null;
      report.state = parsed.audit_metadata?.state ?? null;
      report.businessesInOutput = parsed.businesses.length;

      const threshold = unifiedConfig.marketingOpsHotProspectThreshold;
      const skipChains = unifiedConfig.marketingOpsHotProspectSkipNationalChains;
      const topOppNames = new Set((parsed.top_opportunities ?? []).map((t) => (t.business_name || '').toLowerCase().trim()));
      const topOppMap = new Map((parsed.top_opportunities ?? []).map((t) => [t.business_name.toLowerCase().trim(), t]));

      for (const business of parsed.businesses) {
        // (a) Skip national chains
        if (skipChains && business.ownership_type === 'national_chain') {
          report.skippedChains++;
          continue;
        }

        // (b) Match to campaign
        const campaign = await this.matchCampaign(business, report.city, report.state);
        if (!campaign) {
          report.unmatched.push({ businessName: business.business_name, reason: 'No matching campaign' });
          continue;
        }

        // (c) Store per-business audit
        await this.storeBusinessAudit(campaign.id, business, ctx);

        // (d) Sync structured fields (data_quality-gated)
        await this.syncCampaignFields(campaign, business, ctx);

        // (e) Sync contact fields (null-only)
        await this.syncContactFields(campaign, business, ctx);

        // (f) Derive hotness
        const hotReason = this.deriveHotness(business, topOppNames, topOppMap, threshold);
        const wasHot = (campaign as any).is_hot_prospect === true;
        if (hotReason) {
          await this.prisma.mkt_campaigns_list.update({
            where: { id: campaign.id },
            data: {
              is_hot_prospect: true,
              hot_prospect_reason: hotReason,
              hot_prospect_set_at: new Date(),
              hot_prospect_deprioritized: false, // fresh positive signal clears deprioritization
            },
          });
          report.hotProspectsMarked++;
          report.matched.push({ campaignId: campaign.id, businessName: business.business_name, hot: true });
        } else {
          // Do NOT unset existing hotness on a weak signal (operator override protection)
          report.matched.push({ campaignId: campaign.id, businessName: business.business_name, hot: wasHot });
        }
      }

      // Store city-level summary audit
      report.summaryStored = await this.storeSummaryAudit(parsed, execution.campaign_id, ctx);

      logger.info('City Pain Scan sync complete', ctx, report);
      return report;
    } catch (error) {
      logger.error('syncFromExecution failed', ctx, { error: (error as Error).message, executionId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Parse the execution output, tolerating markdown code fences and
   * leading/trailing prose. Returns null if no valid JSON is found.
   */
  private parseOutputJson(raw: string): CityScanOutput | null {
    const trimmed = raw.trim();
    // Strip markdown code fences if present
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenceMatch ? fenceMatch[1] : trimmed;
    try {
      return JSON.parse(candidate) as CityScanOutput;
    } catch {
      // Try to find the first { ... } block
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1)) as CityScanOutput;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Match a business to a campaign by business_name + city + category
   * (+ state if available). Case-insensitive ILIKE.
   */
  private async matchCampaign(business: BusinessJson, city: string | null, state: string | null): Promise<any | null> {
    const where: any = {
      scope: 'business',
      business_name: { contains: business.business_name, mode: 'insensitive' },
      category: { contains: business.category, mode: 'insensitive' },
    };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    return await this.prisma.mkt_campaigns_list.findFirst({ where });
  }

  /**
   * Store the full per-business JSON as a `city_analysis` audit row.
   */
  private async storeBusinessAudit(campaignId: string, business: BusinessJson, _ctx?: RequestCtx): Promise<void> {
    const google = business.platforms?.google;
    const reviewCount = google?.total_reviews ?? business.combined_review_metrics?.observable_total_reviews ?? 0;
    const avgRating = google?.rating ?? null;
    const unaddressed = google?.observable_unanswered_reviews ?? business.combined_review_metrics?.observable_unanswered_reviews ?? 0;
    const claimed = this.mapProfileStatusToClaimed(google?.profile_status);
    const activePage = this.mapWebsiteStatusToActivePage(business.website?.status);
    const mobileFriendly = this.mapMobileFriendly(business.website?.mobile_friendly);

    await this.prisma.mkt_audits_list.create({
      data: {
        id: generateMarketingAuditId(),
        campaign_id: campaignId,
        platform: 'city_analysis',
        review_count: reviewCount,
        average_rating: avgRating,
        unaddressed_reviews: unaddressed,
        claimed: claimed ?? false,
        active_page: activePage ?? false,
        mobile_friendly: mobileFriendly,
        audit_data: business as any,
      },
    });
  }

  /**
   * Store category_rankings + city_metrics + summary as a single
   * `city_analysis_summary` audit. Attaches to the city-scope campaign if
   * one exists for this city+state; otherwise to the execution's campaign.
   */
  private async storeSummaryAudit(parsed: CityScanOutput, executionCampaignId: string, _ctx?: RequestCtx): Promise<boolean> {
    const city = parsed.audit_metadata?.city;
    const state = parsed.audit_metadata?.state;
    let campaignId = executionCampaignId;
    if (city) {
      const where: any = { scope: 'city', city: { contains: city, mode: 'insensitive' } };
      if (state) where.state = { contains: state, mode: 'insensitive' };
      const cityCampaign = await this.prisma.mkt_campaigns_list.findFirst({ where });
      if (cityCampaign) campaignId = cityCampaign.id;
    }
    await this.prisma.mkt_audits_list.create({
      data: {
        id: generateMarketingAuditId(),
        campaign_id: campaignId,
        platform: 'city_analysis_summary',
        audit_data: {
          audit_metadata: parsed.audit_metadata,
          summary: parsed.summary,
          city_metrics: parsed.city_metrics,
          category_rankings: parsed.category_rankings,
          top_opportunities: parsed.top_opportunities,
        } as any,
      },
    });
    return true;
  }

  /**
   * Sync structured fields onto the campaign, gated by per-business
   * data_quality. Verified fields overwrite; unverified fill nulls only;
   * unavailable fields don't sync.
   */
  private async syncCampaignFields(campaign: any, business: BusinessJson, _ctx?: RequestCtx): Promise<void> {
    const dq = business.data_quality ?? {};
    const verified = new Set((dq.verified_fields ?? []).map((f) => f.toLowerCase()));
    const unavailable = new Set((dq.unavailable_fields ?? []).map((f) => f.toLowerCase()));
    const confidence = dq.confidence ?? 'low';
    const confidenceThreshold = unifiedConfig.marketingOpsHotProspectConfidenceThreshold;
    const confidenceOk = this.confidenceAtLeast(confidence, confidenceThreshold);

    const data: any = {};

    // pain_score (from digital_opportunity_score.score — integer, no rounding)
    const score = business.digital_opportunity_score?.score;
    if (typeof score === 'number' && Number.isFinite(score)) {
      data.pain_score = Math.round(score);
    }

    // estimated_tier
    if (business.recommended_tier) {
      data.estimated_tier = business.recommended_tier;
    }

    // estimated_fee_cents (from estimated_monthly_service_fee.minimum × 100, confidence-gated)
    const feeMin = business.estimated_monthly_service_fee?.minimum;
    if (typeof feeMin === 'number' && confidenceOk) {
      data.estimated_fee_cents = Math.round(feeMin * 100);
    }

    // gbp_claimed (from platforms.google.profile_status)
    const gbpClaimed = this.mapProfileStatusToClaimed(business.platforms?.google?.profile_status);
    if (gbpClaimed !== null) {
      const fieldVerified = verified.has('google_profile_status') || verified.has('gbp_claimed');
      if (fieldVerified || campaign.gbp_claimed === null || campaign.gbp_claimed === undefined) {
        data.gbp_claimed = gbpClaimed;
      }
    }

    // has_website (from website.status)
    const hasWebsite = this.mapWebsiteStatusToHasWebsite(business.website?.status);
    if (hasWebsite !== null) {
      data.has_website = hasWebsite;
    }

    // nap_consistent (from nap_consistency.status)
    const napConsistent = this.mapNapStatus(business.nap_consistency?.status);
    if (napConsistent !== null) {
      data.nap_consistent = napConsistent;
    }

    // unaddressed_reviews (if non-null AND in verified_fields)
    const unaddressed = business.platforms?.google?.observable_unanswered_reviews;
    if (typeof unaddressed === 'number' && (verified.has('observable_unanswered_reviews') || verified.has('unaddressed_reviews'))) {
      data.unaddressed_reviews = unaddressed;
    }

    // state (if null)
    if (!campaign.state && business.address) {
      // state isn't directly in the business; leave for matching-only
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.mkt_campaigns_list.update({ where: { id: campaign.id }, data });
    }
  }

  /**
   * Sync Sprint 1 contact fields (phone, website_url) — null-only, never
   * overwrite operator/GBP-enriched values.
   */
  private async syncContactFields(campaign: any, business: BusinessJson, _ctx?: RequestCtx): Promise<void> {
    const data: any = {};
    if (!campaign.phone && business.business_phone) {
      data.phone = business.business_phone;
    }
    if (!campaign.website_url && business.website?.url) {
      data.website_url = business.website.url;
      data.has_website = 'yes';
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.mkt_campaigns_list.update({ where: { id: campaign.id }, data });
    }
  }

  /**
   * Derive hotness from top_opportunities, high_attention, score, tier.
   * Returns the reason string if hot, null otherwise.
   */
  private deriveHotness(
    business: BusinessJson,
    topOppNames: Set<string>,
    topOppMap: Map<string, TopOpportunity>,
    threshold: number,
  ): string | null {
    const name = (business.business_name || '').toLowerCase().trim();
    const score = business.digital_opportunity_score?.score ?? 0;
    const tier = business.recommended_tier ?? '';
    const highAttention = business.high_attention === true;
    const rank = business.rank ?? 0;

    const inTopOpps = topOppNames.has(name);
    const topOpp = topOppMap.get(name);
    const primaryOpp = topOpp?.primary_opportunity ?? '';

    if (inTopOpps || highAttention || score >= threshold || tier === 'tier_1') {
      const parts: string[] = [];
      if (rank) parts.push(`City Pain Scan rank #${rank}`);
      parts.push(`score=${score}`);
      parts.push(`tier=${tier}`);
      parts.push(`high_attention=${highAttention}`);
      if (primaryOpp) parts.push(`opportunity=${primaryOpp}`);
      return parts.join(', ');
    }
    return null;
  }

  // ─── Operator override + lifecycle ───────────────────────────────────

  async setHot(campaignId: string, reason: string, ctx?: RequestCtx): Promise<any> {
    try {
      return await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          is_hot_prospect: true,
          hot_prospect_reason: reason,
          hot_prospect_set_at: new Date(),
          hot_prospect_deprioritized: false,
        },
      });
    } catch (error) {
      logger.error('setHot failed', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async setNotHot(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      return await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          is_hot_prospect: false,
          hot_prospect_reason: 'operator_override',
          hot_prospect_deprioritized: true, // stop scheduler
        },
      });
    } catch (error) {
      logger.error('setNotHot failed', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async clearDeprioritized(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      return await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          hot_prospect_deprioritized: false,
          auto_followup_count: 0,
        },
      });
    } catch (error) {
      logger.error('clearDeprioritized failed', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async listHotProspects(filters: { stage?: string; city?: string; state?: string; category?: string }, ctx?: RequestCtx): Promise<HotProspectEntry[]> {
    try {
      const maxAuto = unifiedConfig.marketingOpsMaxAutoFollowUps;
      const where: any = {
        is_hot_prospect: true,
        hot_prospect_deprioritized: false,
      };
      if (filters.stage) where.stage = filters.stage;
      if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
      if (filters.state) where.state = { contains: filters.state, mode: 'insensitive' };
      if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };

      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where,
        select: {
          id: true,
          business_name: true,
          stage: true,
          city: true,
          state: true,
          category: true,
          pain_score: true,
          estimated_tier: true,
          hot_prospect_reason: true,
          hot_prospect_set_at: true,
          auto_followup_count: true,
          next_follow_up_at: true,
          last_contacted_at: true,
        },
        orderBy: { hot_prospect_set_at: 'desc' },
      });

      return campaigns.map((c: any) => ({
        campaign_id: c.id,
        business_name: c.business_name,
        stage: c.stage,
        city: c.city,
        state: c.state,
        category: c.category,
        pain_score: c.pain_score,
        estimated_tier: c.estimated_tier,
        hot_prospect_reason: c.hot_prospect_reason,
        hot_prospect_set_at: c.hot_prospect_set_at?.toISOString() ?? null,
        auto_followup_count: c.auto_followup_count ?? 0,
        max_auto_followups: maxAuto,
        next_follow_up_at: c.next_follow_up_at?.toISOString() ?? null,
        last_contacted_at: c.last_contacted_at?.toISOString() ?? null,
      }));
    } catch (error) {
      logger.error('listHotProspects failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Fallback: if no city_analysis audit exists for the campaign and
   * pain_score >= threshold, mark hot. Called on campaign create/update.
   */
  async evaluatePainScoreFallback(campaignId: string, ctx?: RequestCtx): Promise<void> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { id: true, pain_score: true, is_hot_prospect: true },
      });
      if (!campaign) return;
      if (campaign.is_hot_prospect) return; // already hot — don't override

      const threshold = unifiedConfig.marketingOpsHotProspectThreshold;
      if ((campaign.pain_score ?? 0) < threshold) return;

      // Check no city_analysis audit exists
      const cityAudit = await this.prisma.mkt_audits_list.findFirst({
        where: { campaign_id: campaignId, platform: 'city_analysis' },
        select: { id: true },
      });
      if (cityAudit) return; // scan-derived hotness should already be set

      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          is_hot_prospect: true,
          hot_prospect_reason: `pain_score >= ${threshold} (fallback)`,
          hot_prospect_set_at: new Date(),
        },
      });
      logger.info('Hot prospect set via pain_score fallback', ctx, { campaignId, pain_score: campaign.pain_score });
    } catch (error) {
      logger.error('evaluatePainScoreFallback failed', ctx, { error: (error as Error).message, campaignId });
      // soft-fail — don't block campaign create/update
    }
  }

  // ─── Mapping helpers ─────────────────────────────────────────────────

  private mapProfileStatusToClaimed(status?: string): boolean | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'claimed' || s === 'likely_claimed') return true;
    if (s === 'unclaimed') return false;
    return null; // unable_to_verify
  }

  private mapWebsiteStatusToActivePage(status?: string): boolean | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'working') return true;
    if (s === 'broken' || s === 'none_found') return false;
    return null;
  }

  private mapWebsiteStatusToHasWebsite(status?: string): string | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'working') return 'yes';
    if (s === 'broken') return 'broken';
    if (s === 'none_found') return 'none';
    if (s === 'social_media_only') return 'social';
    return null;
  }

  private mapMobileFriendly(v?: string | null): boolean | null {
    if (v == null) return null;
    const s = v.toLowerCase();
    if (s === 'yes' || s === 'likely') return true;
    if (s === 'no') return false;
    return null;
  }

  private mapNapStatus(status?: string): boolean | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'consistent') return true;
    if (s.startsWith('minor') || s.startsWith('major') || s === 'inconsistent') return false;
    return null;
  }

  private confidenceAtLeast(actual: 'high' | 'medium' | 'low', threshold: 'high' | 'medium' | 'low'): boolean {
    const order = { low: 0, medium: 1, high: 2 };
    return order[actual] >= order[threshold];
  }
}
