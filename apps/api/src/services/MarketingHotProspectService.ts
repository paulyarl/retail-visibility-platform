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
import { generateMarketingAuditId, generateCampaignId } from '../lib/id-generator';
import { addressParser } from '../lib/address-parser';
import CampaignTriageService from './CampaignTriageService';

// ─── Types ──────────────────────────────────────────────────────────────

interface BusinessJson {
  rank?: number;
  business_name: string;
  category: string;
  ownership_type?: string;
  address?: string | null;
  business_phone?: string | null;
  detected_signals?: string[];
  platforms?: {
    google?: {
      profile_status?: string;
      rating?: number | null;
      total_reviews?: number | null;
      observable_unanswered_reviews?: number | null;
      data_status?: string;
      displayed_name?: string | null;
      displayed_phone?: string | null;
      displayed_address?: string | null;
      displayed_website?: string | null;
      primary_category?: string | null;
    };
    yelp?: PlatformAuditJson | any;
    facebook?: PlatformAuditJson | any;
    bbb?: PlatformAuditJson | any;
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
  nap_consistency?: {
    status?: string;
    canonical_name?: string | null;
    canonical_phone?: string | null;
    canonical_address?: string | null;
  };
  audit_metadata?: {
    matched_business?: {
      business_name?: string | null;
      category?: string | null;
      phone?: string | null;
      address?: string | null;
      website?: string | null;
    };
    requested_business?: {
      business_name?: string | null;
      category?: string | null;
      phone?: string | null;
      address?: string | null;
    };
  };
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

/**
 * Common shape of per-platform entries in `audit_data.platforms` for the
 * business_analysis audit (google/yelp/bbb/facebook). All fields optional
 * because the audit marks unavailable platforms with `data_status:
 * 'unavailable'` and leaves the rest null.
 */
interface PlatformAuditJson {
  data_status?: string;
  displayed_name?: string | null;
  displayed_phone?: string | null;
  displayed_address?: string | null;
  displayed_website?: string | null;
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

export interface AuditSyncReport {
  campaignId: string;
  auditId: string;
  fieldsSynced: string[];
  contactsSynced: string[];
  hotProspectMarked: boolean;
  hotProspectReason: string | null;
  identityStatus: string | null;
  skipped: boolean;
  skipReason?: string;
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

      // Sprint 5: persist the sync report on the execution record so the UI
      // can retrieve it without re-running the sync.
      try {
        await this.prisma.mkt_prompt_executions_list.update({
          where: { id: executionId },
          data: { sync_report: { ...report, syncedAt: new Date().toISOString() } as any },
        });
      } catch (persistErr) {
        logger.error('Failed to persist sync report (best-effort)', ctx, { error: (persistErr as Error).message, executionId });
      }

      logger.info('City Pain Scan sync complete', ctx, report);
      return report;
    } catch (error) {
      logger.error('syncFromExecution failed', ctx, { error: (error as Error).message, executionId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Sprint 5: Retrieve the persisted sync report for an execution.
   * Returns null if no sync has run for this execution.
   */
  async getSyncReport(executionId: string, ctx?: RequestCtx): Promise<(SyncReport & { syncedAt: string }) | null> {
    try {
      const execution = await this.prisma.mkt_prompt_executions_list.findUnique({
        where: { id: executionId },
        select: { sync_report: true },
      });
      if (!execution || !execution.sync_report) return null;
      return execution.sync_report as any;
    } catch (error) {
      logger.error('getSyncReport failed', ctx, { error: (error as Error).message, executionId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Parse the execution output, tolerating markdown code fences and
   * leading/trailing prose. Returns null if no valid JSON is found.
   */
  /**
   * Parse the City Pain Scan execution output, tolerating markdown fences
   * and leading/trailing prose. Returns null if no valid JSON is found.
   * Public so the routes layer can reuse it for bulk-derive (Sprint 5).
   */
  parseOutputJson(raw: string): CityScanOutput | null {
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
   * Sync contact fields (business_name, phone, website_url, address) from a
   * business_analysis audit onto the campaign.
   *
   * Source priority (first non-null wins) for each field:
   *   business_name : nap_consistency.canonical_name → matched_business.business_name → business.business_name
   *   phone         : nap_consistency.canonical_phone → platforms.google.displayed_phone → matched_business.phone → business.business_phone
   *   website_url   : website.url → matched_business.website → platforms.google.displayed_website
   *   address       : nap_consistency.canonical_address → platforms.google.displayed_address → matched_business.address → business.address
   *
   * Overwrite policy (per the audit → campaign contact sync spec):
   *   - If the audit's `data_quality.verified_fields` mentions the field
   *     (by keyword: "business name", "phone", "website", "address"), the
   *     audit-derived value OVERWRITES the existing campaign value.
   *   - Otherwise, the audit value only fills a NULL campaign field (never
   *     clobbers operator- or GBP-enriched values).
   *
   * Address is parsed from the single-line canonical string into the
   * structured campaign fields (address_line1/city/state/zip/country) using
   * the same address-parser middleware the frontend paste flow uses.
   */
  private async syncContactFields(campaign: any, business: BusinessJson, _ctx?: RequestCtx): Promise<void> {
    const dq = business.data_quality ?? {};
    const verified = new Set((dq.verified_fields ?? []).map((f) => f.toLowerCase()));
    const isVerified = (keyword: string): boolean =>
      Array.from(verified).some((f) => f.includes(keyword));

    const data: any = {};

    // ── business_name ───────────────────────────────────────────────────
    const canonicalName = business.nap_consistency?.canonical_name ?? null;
    const matchedName = business.audit_metadata?.matched_business?.business_name ?? null;
    const businessName = canonicalName ?? matchedName ?? business.business_name ?? null;
    if (businessName) {
      const canOverwrite = isVerified('business name');
      if (canOverwrite || !campaign.business_name) {
        data.business_name = businessName;
      }
    }

    // ── phone ───────────────────────────────────────────────────────────
    const canonicalPhone = business.nap_consistency?.canonical_phone ?? null;
    const googlePhone = business.platforms?.google?.displayed_phone ?? null;
    const matchedPhone = business.audit_metadata?.matched_business?.phone ?? null;
    const scanPhone = business.business_phone ?? null;
    const phone = canonicalPhone ?? googlePhone ?? matchedPhone ?? scanPhone ?? null;
    if (phone) {
      const canOverwrite = isVerified('phone');
      if (canOverwrite || !campaign.phone) {
        data.phone = phone;
      }
    }

    // ── website_url ─────────────────────────────────────────────────────
    const websiteUrl = business.website?.url
      ?? business.audit_metadata?.matched_business?.website
      ?? business.platforms?.google?.displayed_website
      ?? null;
    if (websiteUrl) {
      const canOverwrite = isVerified('website');
      if (canOverwrite || !campaign.website_url) {
        data.website_url = websiteUrl;
        data.has_website = 'yes';
      }
    }

    // ── address (parsed into structured fields) ─────────────────────────
    const canonicalAddress = business.nap_consistency?.canonical_address ?? null;
    const googleAddress = business.platforms?.google?.displayed_address ?? null;
    const matchedAddress = business.audit_metadata?.matched_business?.address ?? null;
    const scanAddress = business.address ?? null;
    const addressStr = canonicalAddress ?? googleAddress ?? matchedAddress ?? scanAddress ?? null;
    if (addressStr) {
      const canOverwrite = isVerified('address');
      // Only sync address components if we're allowed to overwrite, OR if the
      // campaign has no address_line1 yet (fill-null). Per-component fill-null
      // would risk creating half-populated addresses, so we treat address as
      // an all-or-nothing unit.
      if (canOverwrite || !campaign.address_line1) {
        const parsed = addressParser.parse(addressStr);
        if (parsed.address_line1) {
          data.address_line1 = parsed.address_line1;
          if (parsed.address_line2) data.address_line2 = parsed.address_line2;
          if (parsed.city) data.address_city = parsed.city;
          if (parsed.state) data.address_state = parsed.state;
          if (parsed.postal_code) data.address_zip = parsed.postal_code;
          if (parsed.country_code) data.address_country = parsed.country_code;
        }
      }
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

  /**
   * Sprint 4: Sync a single already-created `business_analysis` (seek) audit
   * onto its campaign. Reuses the same data_quality-gated field sync,
   * null-only contact sync, and hotness derivation as `syncFromExecution`.
   *
   * Checks `audit_data.audit_metadata.identity_status` — skips sync entirely
   * when `mismatched` and `skipMismatchedIdentity` config is true. For
   * `ambiguous` identity, syncs normally but includes "identity ambiguous"
   * in the hot_prospect_reason.
   */
  async syncFromAudit(auditId: string, ctx?: RequestCtx): Promise<AuditSyncReport> {
    const report: AuditSyncReport = {
      campaignId: '',
      auditId,
      fieldsSynced: [],
      contactsSynced: [],
      hotProspectMarked: false,
      hotProspectReason: null,
      identityStatus: null,
      skipped: false,
    };

    try {
      const audit = await this.prisma.mkt_audits_list.findUnique({
        where: { id: auditId },
        include: { mkt_campaigns_list: true },
      });
      if (!audit) throw new NotFoundError('Audit not found');
      if (audit.platform !== 'business_analysis') {
        throw new Error(`Audit ${auditId} is not a business_analysis audit (platform=${audit.platform})`);
      }

      const campaign = audit.mkt_campaigns_list;
      if (!campaign) throw new NotFoundError('Campaign not found for audit');

      report.campaignId = campaign.id;

      const data = (audit.audit_data ?? {}) as any;
      const identityStatus = data.audit_metadata?.identity_status ?? null;
      report.identityStatus = identityStatus;

      // Identity mismatch → skip sync entirely
      if (
        identityStatus === 'mismatched'
        && unifiedConfig.marketingOpsHotProspectSkipMismatchedIdentity
      ) {
        report.skipped = true;
        report.skipReason = 'identity_status is mismatched — audit appears to be about a different business';
        logger.info('syncFromAudit skipped: mismatched identity', ctx, { auditId, campaignId: campaign.id });
        return report;
      }

      // Build a BusinessJson-shaped object from the seek audit so we can reuse
      // the same private helpers as syncFromExecution. The seek schema is a
      // superset of the City Pain Scan per-business shape for the shared fields.
      const business: BusinessJson = {
        business_name: data.audit_metadata?.matched_business?.business_name
          ?? data.audit_metadata?.requested_business?.business_name,
        category: data.audit_metadata?.matched_business?.category
          ?? data.audit_metadata?.requested_business?.category,
        business_phone: data.audit_metadata?.matched_business?.phone ?? null,
        platforms: data.platforms,
        combined_review_metrics: data.combined_review_metrics,
        website: data.website,
        nap_consistency: data.nap_consistency,
        audit_metadata: data.audit_metadata,
        digital_opportunity_score: data.digital_opportunity_score,
        high_attention: data.high_attention,
        high_attention_reasons: data.high_attention_reasons,
        recommended_tier: data.recommended_tier,
        estimated_monthly_service_fee: data.estimated_monthly_service_fee,
        data_quality: data.data_quality,
        negative_review_themes: data.negative_review_themes,
        opportunities: data.opportunities,
      };

      // Track which fields would be synced by inspecting the data object
      const beforeKeys = new Set(Object.keys((campaign as any) ?? {}));
      await this.syncCampaignFields(campaign, business, ctx);
      const afterCampaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaign.id } });
      if (afterCampaign) {
        for (const k of ['pain_score', 'estimated_tier', 'estimated_fee_cents', 'gbp_claimed', 'has_website', 'nap_consistent', 'unaddressed_reviews']) {
          if ((afterCampaign as any)[k] !== (campaign as any)[k] && (afterCampaign as any)[k] != null) {
            report.fieldsSynced.push(k);
          }
        }
      }
      void beforeKeys;

      // Sync contacts (overwrite-if-verified, otherwise fill-null)
      const beforeContacts = {
        business_name: (campaign as any).business_name,
        phone: (campaign as any).phone,
        website_url: (campaign as any).website_url,
        address_line1: (campaign as any).address_line1,
        address_city: (campaign as any).address_city,
        address_state: (campaign as any).address_state,
        address_zip: (campaign as any).address_zip,
        address_country: (campaign as any).address_country,
      };
      await this.syncContactFields(campaign, business, ctx);
      const afterContacts = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaign.id },
        select: {
          business_name: true,
          phone: true,
          website_url: true,
          address_line1: true,
          address_city: true,
          address_state: true,
          address_zip: true,
          address_country: true,
        },
      });
      if (afterContacts) {
        if (afterContacts.business_name && afterContacts.business_name !== beforeContacts.business_name) {
          report.contactsSynced.push('business_name');
        }
        if (afterContacts.phone && afterContacts.phone !== beforeContacts.phone) {
          report.contactsSynced.push('phone');
        }
        if (afterContacts.website_url && afterContacts.website_url !== beforeContacts.website_url) {
          report.contactsSynced.push('website_url');
        }
        if (afterContacts.address_line1 && afterContacts.address_line1 !== beforeContacts.address_line1) {
          report.contactsSynced.push('address');
        }
      }

      // Derive hotness (seek has no top_opportunities — pass empty collections)
      const threshold = unifiedConfig.marketingOpsHotProspectThreshold;
      const hotReason = this.deriveHotness(business, new Set(), new Map(), threshold);
      if (hotReason) {
        // Append identity ambiguity note if applicable
        const reason = identityStatus === 'ambiguous'
          ? `seek audit (identity ambiguous): ${hotReason}`
          : `seek audit: ${hotReason}`;
        await this.prisma.mkt_campaigns_list.update({
          where: { id: campaign.id },
          data: {
            is_hot_prospect: true,
            hot_prospect_reason: reason,
            hot_prospect_set_at: new Date(),
            hot_prospect_deprioritized: false,
          },
        });
        report.hotProspectMarked = true;
        report.hotProspectReason = reason;
      }

      logger.info('syncFromAudit complete', ctx, report);
      return report;
    } catch (error) {
      logger.error('syncFromAudit failed', ctx, { error: (error as Error).message, auditId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Sync a `category_identification` audit onto its campaign. Unlike
   * `syncFromAudit` (which handles `business_analysis` audits with pain
   * scores, tiers, and hotness derivation), category-identification audits
   * only produce NAP + category context — so this method syncs contact
   * fields only (no metric fields, no hotness).
   *
   * NAP source priority (first non-null wins):
   *   business_name : nap.canonical_name → business_name (top-level) → audit_metadata.requested_business.business_name
   *   phone         : nap.phone → audit_metadata.requested_business.phone
   *   website_url   : nap.website → digital_footprint.website_url
   *   address       : nap.address_line1 (structured, no parsing needed)
   *
   * Overwrite policy (mirrors syncContactFields but uses nap.field_confidence
   * instead of data_quality.verified_fields):
   *   - If the field's confidence in `nap.field_confidence` is 'high', the
   *     audit-derived value OVERWRITES the existing campaign value.
   *   - Otherwise, the audit value only fills a NULL/empty campaign field.
   *
   * Best-effort: logs failures but does not throw to the caller (the import
   * hook wraps this in a try/catch too).
   */
  async syncFromCategoryIdentificationAudit(auditId: string, ctx?: RequestCtx): Promise<AuditSyncReport> {
    const report: AuditSyncReport = {
      campaignId: '',
      auditId,
      fieldsSynced: [],
      contactsSynced: [],
      hotProspectMarked: false,
      hotProspectReason: null,
      identityStatus: null,
      skipped: false,
    };

    try {
      const audit = await this.prisma.mkt_audits_list.findUnique({
        where: { id: auditId },
        include: { mkt_campaigns_list: true },
      });
      if (!audit) throw new NotFoundError('Audit not found');
      if (audit.platform !== 'category_identification') {
        throw new Error(`Audit ${auditId} is not a category_identification audit (platform=${audit.platform})`);
      }

      const campaign = audit.mkt_campaigns_list;
      if (!campaign) throw new NotFoundError('Campaign not found for audit');

      report.campaignId = campaign.id;

      const data = (audit.audit_data ?? {}) as any;
      const nap = data.nap ?? {};
      const requestedBusiness = data.audit_metadata?.requested_business ?? {};
      const digitalFootprint = data.digital_footprint ?? {};

      // Build a confidence lookup from nap.field_confidence
      const fieldConfidence = new Map<string, 'high' | 'medium' | 'low'>();
      for (const fc of (nap.field_confidence ?? [])) {
        if (fc?.field && fc?.confidence) {
          fieldConfidence.set(fc.field.toLowerCase(), fc.confidence);
        }
      }
      const isHighConfidence = (field: string): boolean =>
        fieldConfidence.get(field.toLowerCase()) === 'high';

      const updateData: any = {};

      // ── business_name ───────────────────────────────────────────────
      const businessName =
        nap.canonical_name
        ?? data.business_name
        ?? requestedBusiness.business_name
        ?? null;
      if (businessName) {
        if (isHighConfidence('business_name') || !campaign.business_name) {
          updateData.business_name = businessName;
        }
      }

      // ── phone ───────────────────────────────────────────────────────
      const phone = nap.phone ?? requestedBusiness.phone ?? null;
      if (phone) {
        if (isHighConfidence('phone') || !campaign.phone) {
          updateData.phone = phone;
        }
      }

      // ── website_url ─────────────────────────────────────────────────
      const websiteUrl = nap.website ?? digitalFootprint.website_url ?? null;
      if (websiteUrl) {
        if (isHighConfidence('website') || !campaign.website_url) {
          updateData.website_url = websiteUrl;
          updateData.has_website = 'yes';
        }
      }

      // ── address (structured — no parsing needed) ────────────────────
      // Treat address as an all-or-nothing unit (same as syncContactFields):
      // only sync if we can overwrite (high confidence) OR the campaign has
      // no address_line1 yet (fill-null).
      const addressLine1 = nap.address_line1 ?? null;
      if (addressLine1) {
        const canOverwrite = isHighConfidence('address_line1');
        if (canOverwrite || !campaign.address_line1) {
          updateData.address_line1 = addressLine1;
          if (nap.address_line2) updateData.address_line2 = nap.address_line2;
          if (nap.city) updateData.address_city = nap.city;
          if (nap.state) updateData.address_state = nap.state;
          if (nap.postal_code) updateData.address_zip = nap.postal_code;
          if (nap.country_code) updateData.address_country = nap.country_code;
        }
      }

      if (Object.keys(updateData).length > 0) {
        const beforeContacts = {
          business_name: campaign.business_name,
          phone: campaign.phone,
          website_url: campaign.website_url,
          address_line1: campaign.address_line1,
        };
        await this.prisma.mkt_campaigns_list.update({
          where: { id: campaign.id },
          data: updateData,
        });
        // Report which contact fields changed
        if (updateData.business_name && updateData.business_name !== beforeContacts.business_name) {
          report.contactsSynced.push('business_name');
        }
        if (updateData.phone && updateData.phone !== beforeContacts.phone) {
          report.contactsSynced.push('phone');
        }
        if (updateData.website_url && updateData.website_url !== beforeContacts.website_url) {
          report.contactsSynced.push('website_url');
        }
        if (updateData.address_line1 && updateData.address_line1 !== beforeContacts.address_line1) {
          report.contactsSynced.push('address');
        }
      }

      logger.info('syncFromCategoryIdentificationAudit complete', ctx, report);
      return report;
    } catch (error) {
      logger.error('syncFromCategoryIdentificationAudit failed', ctx, { error: (error as Error).message, auditId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Sprint 5: Create a business-scope child campaign from an unmatched City
   * Pain Scan business, seeding all scan-derived fields + creating the
   * `city_analysis` audit on the child. The child starts at `seek` stage
   * with hot-prospect already derived.
   *
   * Deduplication: if a campaign already exists with the same business_name
   * + city + category + scope='business', returns the existing one instead
   * of creating a duplicate (AC84).
   */
  async deriveBusinessCampaignFromScanBusiness(
    parentId: string,
    business: BusinessJson,
    ctx?: RequestCtx,
    options?: { note?: string },
  ): Promise<{ campaign: any; created: boolean }> {
    try {
      const parent = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundError(`Parent campaign ${parentId} not found`);
      }

      const businessName = business.business_name?.trim() || '';
      if (!businessName) {
        throw new Error('business_name is required');
      }
      const category = business.category || parent.category;
      const city = parent.city;
      const state = (parent as any).state ?? null;

      // Deduplication: check for existing business-scope campaign with same
      // business_name + city + category (AC84).
      const existing = await this.prisma.mkt_campaigns_list.findFirst({
        where: {
          scope: 'business',
          business_name: { equals: businessName, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
          category: { equals: category, mode: 'insensitive' },
        },
      });
      if (existing) {
        logger.info('deriveBusinessCampaignFromScanBusiness: returning existing campaign', ctx, {
          parentId, existingId: existing.id, businessName,
        });
        return { campaign: existing, created: false };
      }

      // Map scan fields onto campaign columns (reusing private helpers).
      const score = business.digital_opportunity_score?.score ?? 0;
      const tier = business.recommended_tier ?? null;
      const fee = business.estimated_monthly_service_fee;
      const feeCents = fee?.minimum != null ? Math.round(fee.minimum * 100) : 0;
      const gbpClaimed = this.mapProfileStatusToClaimed(business.platforms?.google?.profile_status) ?? false;
      const hasWebsite = this.mapWebsiteStatusToHasWebsite(business.website?.status) ?? null;
      const napConsistent = this.mapNapStatus(business.nap_consistency?.status) ?? null;
      const unaddressed = business.platforms?.google?.observable_unanswered_reviews
        ?? business.combined_review_metrics?.observable_unanswered_reviews
        ?? 0;
      const phone = business.business_phone ?? null;
      const websiteUrl = business.website?.url ?? null;

      // Derive hotness (no top_opportunities context for single derive).
      const threshold = unifiedConfig.marketingOpsHotProspectThreshold;
      const hotReason = this.deriveHotness(business, new Set(), new Map(), threshold);
      const isHot = !!hotReason;

      const campaignId = generateCampaignId();
      const campaign = await this.prisma.mkt_campaigns_list.create({
        data: {
          id: campaignId,
          scope: 'business',
          business_name: businessName,
          category,
          city,
          state,
          neighborhood: parent.neighborhood ?? null,
          tone: parent.tone ?? null,
          attributes: (parent.attributes as any) ?? [],
          estimated_tier: tier,
          estimated_fee_cents: feeCents,
          pain_score: score,
          gbp_claimed: gbpClaimed,
          has_website: hasWebsite,
          nap_consistent: napConsistent,
          unaddressed_reviews: unaddressed,
          phone: phone,
          website_url: websiteUrl,
          is_hot_prospect: isHot,
          hot_prospect_reason: hotReason,
          hot_prospect_set_at: isHot ? new Date() : null,
          parent_campaign_id: parentId,
          stage: 'seek',
          stage_entered_at: new Date(),
          notes: [
            `Derived from parent campaign ${parent.display_id ?? parent.id} (${parent.scope} scope) via City Pain Scan sync.`,
            options?.note ? `Operator note: ${options.note}` : null,
          ].filter(Boolean).join('\n'),
        },
      });

      // Create the city_analysis audit on the child with the full business JSON.
      const auditId = generateMarketingAuditId();
      await this.prisma.mkt_audits_list.create({
        data: {
          id: auditId,
          campaign_id: campaignId,
          platform: 'city_analysis',
          review_count: business.combined_review_metrics?.observable_total_reviews
            ?? business.platforms?.google?.total_reviews
            ?? 0,
          average_rating: business.platforms?.google?.rating ?? undefined,
          unaddressed_reviews: unaddressed,
          owner_response_rate: 0,
          photo_count: 0,
          audit_data: business as any,
        },
      });

      logger.info('deriveBusinessCampaignFromScanBusiness: created child campaign', ctx, {
        parentId, campaignId, businessName, isHot,
      });

      // If the scan business has detected_signals, create a business_analysis
      // audit with them and auto-trigger triage — the "spawn pre-triaged"
      // flow. The city_analysis audit above preserves the full business JSON;
      // this business_analysis audit is what the triage extractor reads.
      if (business.detected_signals && business.detected_signals.length > 0) {
        const triageAuditId = generateMarketingAuditId();
        await this.prisma.mkt_audits_list.create({
          data: {
            id: triageAuditId,
            campaign_id: campaignId,
            platform: 'business_analysis',
            audit_data: {
              audit_metadata: {
                business_name: businessName,
                source: 'derived_from_city_scan',
                parent_campaign_id: parentId,
              },
              detected_signals: business.detected_signals,
              summary: `Derived from city scan with ${business.detected_signals.length} detected signals.`,
            } as any,
          },
        });

        try {
          const triageResult = await CampaignTriageService.evaluateTriageForCampaign({
            campaignId,
          }, ctx);
          logger.info('Auto-triage completed for scan-derived campaign', ctx, {
            campaignId, playbookCode: triageResult.recommendedPlaybook.code,
          });
        } catch (triageError) {
          logger.warn('Auto-triage failed for scan-derived campaign (non-fatal)', ctx, {
            campaignId, error: (triageError as Error).message,
          });
        }
      }

      return { campaign, created: true };
    } catch (error) {
      logger.error('deriveBusinessCampaignFromScanBusiness failed', ctx, {
        error: (error as Error).message, parentId, businessName: business.business_name,
      });
      throw this.handleError(error, ctx);
    }
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
