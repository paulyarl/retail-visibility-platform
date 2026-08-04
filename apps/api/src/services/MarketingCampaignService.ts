/**
 * MarketingCampaignService — Campaign CRUD + stage transitions + pipeline queries
 *
 * Manages the campaign journey lifecycle from prospecting through retainer.
 * Enforces stage transition rules and logs all transitions to stage history.
 *
 * Pattern: singleton extends BaseService (mirrors CouponService.ts)
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { generateCampaignId, generateStageHistoryId, generateMarketingRevenueId, generateMarketingAuditId } from '../lib/id-generator';
import CampaignTriageService from './CampaignTriageService';
import MarketingCategoryToneService from './MarketingCategoryToneService';
import DemoTenantService from './DemoTenantService';
import { unifiedConfig } from '../config/unifiedConfig';
import { getBillingNotificationService } from './subscription/BillingNotificationService';
import { MarketingScorecardService } from './MarketingScorecardService';
import MarketingServiceCategoryService from './MarketingServiceCategoryService';

// ====================
// TYPES
// ====================

export type CampaignStage =
  | 'seek'
  | 'preview_built'
  | 'shown'
  | 'paid'
  | 'delivered'
  | 'retainer_pitched'
  | 'retainer_won'
  | 'lost'
  | 'dead'
  | 'tenant_onboarded';

// Recovery Management stages live on the same mkt_campaigns_list.stage
// column (VARCHAR(50), no DB enum). The literals are centralized in
// recoveryStages.ts; the transition map is below. A campaign's
// campaign_category determines which transition table governs it.
export type CampaignCategory = 'review_management' | 'recovery_management' | 'profile_repair' | 'triage_management';

export type RepairTrack = 'standard' | 'escalated';

export const CAMPAIGN_CATEGORY_DEFAULT: CampaignCategory = 'review_management';

export type RetainerStatus = 'not_pitched' | 'pitched' | 'won' | 'declined';

export type ConversionSource =
  | 'qr_deliverable'
  | 'demo_storefront'
  | 'gbp_enhancer'
  | 'directory_preview'
  | 'manual'
  | 'external'
  | 'portal_checkout';

export type CampaignOrigin = 'prospect' | 'upsell';

export type CampaignScope = 'business' | 'category' | 'city';

// Review track — existing sales-pipeline machine (unchanged).
const REVIEW_TRANSITIONS: Record<string, string[]> = {
  seek:           ['preview_built', 'dead'],
  preview_built:  ['shown', 'dead'],
  shown:          ['paid', 'lost', 'tenant_onboarded'],
  paid:           ['delivered', 'tenant_onboarded'],
  delivered:      ['retainer_pitched', 'closed', 'tenant_onboarded'],
  retainer_pitched: ['retainer_won', 'closed'],
  retainer_won:   ['lost', 'tenant_onboarded'],
  lost:           ['seek', 'tenant_onboarded'],   // resurrection: late QR/demo conversion (G1)
  dead:           ['seek', 'tenant_onboarded'],   // resurrection: re-engaged prospect converts (G1)
};

// Recovery track — dispute intake machine (Recovery Engine Sprint 1).
// awaiting_owner_intake allows re-dispatch to outreach_dispatched (token
// expired / cascade re-touch) and dead (cascade exhaustion / timeout).
// dead resurrects to audit_identified (re-engage after cooldown).
const RECOVERY_TRANSITIONS: Record<string, string[]> = {
  audit_identified:            ['framework_preview_generated', 'dead'],
  framework_preview_generated: ['outreach_dispatched', 'dead'],
  outreach_dispatched:         ['awaiting_owner_intake', 'dead'],
  awaiting_owner_intake:       ['intake_submitted', 'outreach_dispatched', 'dead'],
  intake_submitted:            ['final_resolution_drafted'],
  final_resolution_drafted:    ['owner_approved'],
  owner_approved:              ['resolved_and_closed'],
  resolved_and_closed:         [],
  dead:                        ['audit_identified'],
};

/**
 * Returns the transition map for the given campaign category + repair track.
 * - review_management → review machine
 * - recovery_management → recovery machine
 * - profile_repair + NULL (triage) → review machine (safe default)
 * - profile_repair + 'standard' → review machine
 * - profile_repair + 'escalated' → recovery machine
 * - triage_management → review machine (campaign stays in 'seek' until the
 *   operator accepts a triage recommendation, at which point the category is
 *   re-written to the playbook's category; see roadmap Risk 4)
 * Defaults to review_management so every existing caller that does not
 * pass a category gets unchanged behavior.
 */
export function transitionsFor(
  category: CampaignCategory = CAMPAIGN_CATEGORY_DEFAULT,
  repairTrack?: RepairTrack | null,
): Record<string, string[]> {
  if (category === 'recovery_management') return RECOVERY_TRANSITIONS;
  if (category === 'profile_repair' && repairTrack === 'escalated') return RECOVERY_TRANSITIONS;
  return REVIEW_TRANSITIONS;
}

/**
 * Derives the pipeline name for a campaign — used by the web app to
 * filter Openers/Follow-Ups (review pipeline) vs Recovery tab
 * (recovery pipeline) without re-implementing the dispatch rule.
 *
 * triage_management maps to 'review' until the operator accepts a triage
 * recommendation that re-categorizes the campaign.
 */
export function pipelineFor(
  category: CampaignCategory = CAMPAIGN_CATEGORY_DEFAULT,
  repairTrack?: RepairTrack | null,
): 'review' | 'recovery' {
  if (category === 'recovery_management') return 'recovery';
  if (category === 'profile_repair' && repairTrack === 'escalated') return 'recovery';
  return 'review';
}

const RESURRECTION_STAGES = ['lost', 'dead'];

const STAGE_DATE_FIELDS: Record<string, string> = {
  preview_built:    'date_preview_built',
  shown:            'date_shown',
  paid:             'date_paid',
  delivered:        'date_delivered',
  retainer_pitched: 'date_retainer_pitched',
  retainer_won:     'date_retainer_won',
  tenant_onboarded: 'date_tenant_onboarded',
};

export interface CampaignInput {
  scope?: CampaignScope;
  campaignCategory?: CampaignCategory;
  repairTrack?: RepairTrack | null;
  repairIssueType?: string;
  businessName?: string;
  category: string;
  city: string;
  neighborhood?: string;
  contactMethod?: string;
  contactInfo?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  socialProfiles?: { platform: string; url: string }[];
  ownerNames?: string[];
  phones?: { label: string; number: string }[];
  displayId?: string;
  gbpClaimed?: boolean;
  unaddressedReviews?: number;
  lastReviewDate?: Date | null;
  hasWebsite?: string;
  napConsistent?: boolean;
  estimatedTier?: string;
  estimatedFeeCents?: number;
  painScore?: number;
  tone?: string;
  retainer?: 'Fast' | 'Medium' | 'Slow';
  attributes?: string[];
  assignedTo?: string;
  notes?: string;
  parentCampaignId?: string;
}

export interface CampaignUpdateInput {
  scope?: CampaignScope;
  campaignCategory?: CampaignCategory;
  businessName?: string;
  category?: string;
  city?: string;
  neighborhood?: string;
  contactMethod?: string;
  contactInfo?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  socialProfiles?: { platform: string; url: string }[];
  ownerNames?: string[];
  phones?: { label: string; number: string }[];
  gbpClaimed?: boolean;
  unaddressedReviews?: number;
  lastReviewDate?: Date | null;
  hasWebsite?: string;
  napConsistent?: boolean;
  estimatedTier?: string;
  estimatedFeeCents?: number;
  painScore?: number;
  assignedTo?: string;
  notes?: string;
  tone?: string;
  retainer?: 'Fast' | 'Medium' | 'Slow';
  attributes?: string[];
  stage?: CampaignStage;
  retainerStatus?: RetainerStatus;
  retainerAmountCents?: number;
  retainerStartDate?: Date | null;
  amountPaidCents?: number;
  packageDelivered?: string;
  campaignOrigin?: CampaignOrigin;
  packagePriceCents?: number;
  subscriptionTierId?: string;
  couponCode?: string;
  serviceCategory?: string;
}

export interface ContactReadiness {
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasSocial: boolean;
  complete: boolean;
}

export interface LinkTenantInput {
  campaignId: string;
  tenantId: string;
  conversionSource: ConversionSource;
  changedBy?: string;
}

export interface DemoStorefrontResult {
  demoTenantId: string;
  slug: string;
  template: string;
  expiresAt: Date;
  previewToken: string;
  previewUrl: string;
  demoUrl: string;
}

export interface StageTransitionInput {
  campaignId: string;
  // Accepts both review (CampaignStage) and recovery stage literals.
  // Recovery stages are centralized in recoveryStages.ts.
  toStage: CampaignStage | string;
  notes?: string;
  triggerType?: 'manual' | 'automated' | 'system';
  changedBy?: string;
}

export interface CampaignListFilters {
  stage?: CampaignStage;
  scope?: CampaignScope;
  campaignCategory?: CampaignCategory;
  category?: string;
  city?: string;
  assignedTo?: string;
  tone?: string;
  retainer?: 'Fast' | 'Medium' | 'Slow';
  attributes?: string[];
  search?: string;
  page?: number;
  limit?: number;
  parentCampaignId?: string;
}

export interface MarkCampaignPaidInput {
  campaignId: string;
  amountCents: number;
  discountCents: number;
  orderId?: string;
  gatewayType: string;
  gatewayTransactionId?: string;
  source: ConversionSource;
  couponCode?: string;
  subscriptionTierId?: string;
  serviceCategory?: string;
  changedBy?: string;
}

// ====================
// SERVICE
// ====================

export class MarketingCampaignService extends BaseService {
  private static instance: MarketingCampaignService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingCampaignService {
    if (!MarketingCampaignService.instance) {
      MarketingCampaignService.instance = new MarketingCampaignService();
    }
    return MarketingCampaignService.instance;
  }

  // ====================
  // VALIDATION
  // ====================

  isValidTransition(
    from: string | null,
    to: string,
    category: CampaignCategory = CAMPAIGN_CATEGORY_DEFAULT,
    repairTrack?: RepairTrack | null,
  ): boolean {
    if (!from) return true;
    const allowed = transitionsFor(category, repairTrack)[from];
    return allowed ? allowed.includes(to) : false;
  }

  // ====================
  // CREATE
  // ====================

  async createCampaign(input: CampaignInput, ctx?: RequestCtx): Promise<any> {
    const id = generateCampaignId();
    try {
      let tone = input.tone;
      if (!tone) {
        const preset = await MarketingCategoryToneService.getPresetByCategory(input.category);
        tone = preset?.tone || undefined;
      }

      const campaignCategory = input.campaignCategory || CAMPAIGN_CATEGORY_DEFAULT;
      const initialStage = campaignCategory === 'recovery_management' ? 'audit_identified' : 'seek';
      // profile_repair starts in 'seek' (triage) — the track is decided later

      const campaign = await this.prisma.mkt_campaigns_list.create({
        data: {
          id,
          display_id: input.displayId || null,
          scope: input.scope ?? 'business',
          campaign_category: campaignCategory,
          repair_track: input.repairTrack || null,
          repair_issue_type: input.repairIssueType || null,
          business_name: input.businessName || null,
          category: input.category,
          city: input.city,
          neighborhood: input.neighborhood || null,
          contact_method: input.contactMethod || null,
          contact_info: input.contactInfo || null,
          phone: input.phone || null,
          email: input.email || null,
          website_url: input.websiteUrl || null,
          social_profiles: (input.socialProfiles ?? undefined) as any,
          owner_names: (input.ownerNames ?? undefined) as any,
          phones: (input.phones ?? undefined) as any,
          gbp_claimed: input.gbpClaimed || false,
          unaddressed_reviews: input.unaddressedReviews || 0,
          last_review_date: input.lastReviewDate || null,
          has_website: input.websiteUrl ? 'yes' : (input.hasWebsite || null),
          nap_consistent: input.napConsistent ?? null,
          estimated_tier: input.estimatedTier || null,
          estimated_fee_cents: input.estimatedFeeCents || 0,
          pain_score: input.painScore || 0,
          tone: tone || null,
          retainer: input.retainer || null,
          attributes: input.attributes || [],
          assigned_to: input.assignedTo || null,
          notes: input.notes || null,
          parent_campaign_id: input.parentCampaignId || null,
          stage: initialStage,
          stage_entered_at: new Date(),
        },
      });

      await this.logStageTransition({
        campaignId: id,
        fromStage: null,
        toStage: initialStage,
        triggerType: 'system',
        changedBy: input.assignedTo,
      });

      logger.info('Marketing campaign created', ctx, { campaignId: id, businessName: input.businessName });

      // Sprint 3: evaluate pain_score fallback for hot-prospect flagging
      try {
        const { MarketingHotProspectService } = await import('./MarketingHotProspectService.js');
        await MarketingHotProspectService.getInstance().evaluatePainScoreFallback(id, ctx);
      } catch (fbErr) {
        logger.error('pain_score fallback eval failed (best-effort)', ctx, { error: (fbErr as Error).message, campaignId: id });
      }

      return campaign;
    } catch (error) {
      logger.error('Failed to create marketing campaign', ctx, { error: (error as Error).message, businessName: input.businessName });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // READ
  // ====================

  async getCampaign(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id },
        include: {
          mkt_audits_list: true,
          mkt_files_list: { orderBy: { uploaded_at: 'desc' } },
          mkt_stage_history_list: { orderBy: { changed_at: 'desc' }, take: 20 },
          parent: { select: { id: true, business_name: true, category: true, city: true, scope: true, stage: true } },
          mkt_campaigns_list_parent_campaign_idTomkt_campaigns_list: {
            select: { id: true, business_name: true, scope: true, stage: true, created_at: true },
            orderBy: { created_at: 'desc' },
          },
          mkt_outreach_log: { orderBy: { contact_date: 'desc' }, take: 20 },
        },
      });
      if (!campaign) return null;

      const service_category_label = await MarketingServiceCategoryService.getLabel(
        campaign.service_category || '',
        ctx,
      );
      // Normalize Prisma relation keys to the client-expected names so the
      // campaign detail page's Audits / Files / Stage History tabs render.
      // Without this, the raw `mkt_audits_list` / `mkt_files_list` /
      // `mkt_stage_history_list` keys are dropped at the web client boundary
      // (which expects `audits` / `files` / `stage_history`) and the tabs
      // appear empty for every campaign.
      const {
        mkt_audits_list,
        mkt_files_list,
        mkt_stage_history_list,
        mkt_campaigns_list_parent_campaign_idTomkt_campaigns_list: children,
        mkt_outreach_log,
        parent,
        ...rest
      } = campaign as any;
      return {
        ...rest,
        audits: mkt_audits_list ?? [],
        files: mkt_files_list ?? [],
        stage_history: mkt_stage_history_list ?? [],
        outreach_log: mkt_outreach_log ?? [],
        parent_campaign: parent ?? null,
        children: children ?? [],
        service_category_label,
      };
    } catch (error) {
      logger.error('Failed to get campaign', ctx, { error: (error as Error).message, campaignId: id });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Returns contact readiness flags for a campaign.
   * A campaign is "contact complete" if it has at least one of phone or email
   * (a reachable channel for outreach), plus a website or social profile for
   * context. Phone alone is sufficient for cold-call workflows.
   */
  async getContactReadiness(id: string, ctx?: RequestCtx): Promise<ContactReadiness> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id },
        select: { phone: true, email: true, website_url: true, social_profiles: true },
      });
      if (!campaign) {
        throw new NotFoundError('Campaign not found');
      }
      const hasSocial = Array.isArray(campaign.social_profiles) && campaign.social_profiles.length > 0;
      const hasPhone = !!campaign.phone;
      const hasEmail = !!campaign.email;
      const hasWebsite = !!campaign.website_url;
      const complete = hasPhone || hasEmail;
      return { hasPhone, hasEmail, hasWebsite, hasSocial, complete };
    } catch (error) {
      logger.error('Failed to get contact readiness', ctx, { error: (error as Error).message, campaignId: id });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Derive a business-scope child campaign from a parent category/city/business
   * campaign, seeded with a discovered competitor's data. The child starts at
   * `seek` stage — it needs a business-scope analysis (full contact details,
   * GBP audit) before reaching `preview_built`.
   *
   * Inherited from parent: category, city, neighborhood, tone, attributes.
   * Seeded from payload: business_name, estimated_tier (derived from
   * rating/review count), notes (references parent + outreach angle if
   * available from the parent's latest category_analysis audit).
   *
   * Recursion is allowed: a business-scope parent can spawn business children
   * (e.g. from competitors uncovered by a business scan). The parent link is
   * an optional lineage reference only.
   *
   * Rejects spawning category/city children from a business parent (no use
   * case; prevents confusion) — but this method always creates a business
   * child, so that guard is enforced by the fixed `scope='business'` here.
   */
  async deriveBusinessCampaign(input: {
    parentId: string;
    businessName: string;
    rating?: number;
    reviewCount?: number;
    location?: string;
    detectedSignals?: string[];
    assignedTo?: string;
  }, ctx?: RequestCtx): Promise<any> {
    try {
      const parent = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: input.parentId },
        include: {
          mkt_audits_list: {
            where: { platform: { in: ['category_analysis', 'city_category_analysis'] } },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });
      if (!parent) {
        throw new NotFoundError(`Parent campaign ${input.parentId} not found`);
      }

      // Derive estimated_tier from rating + review count heuristics.
      const tier = this.inferTierFromMetrics(input.rating, input.reviewCount);

      // Build notes referencing the parent + outreach angle (if available).
      // Supports both the legacy market_analysis shape and the newer
      // city_category_opportunity shape (outreach_recommendation.primary_angle).
      const latestAudit = parent.mkt_audits_list[0];
      const auditData = latestAudit?.audit_data as any;
      const outreachAngle =
        auditData?.outreach_recommendation?.primary_angle ??
        auditData?.market_analysis?.recommended_outreach_angle;
      const noteParts = [
        `Derived from parent campaign ${parent.display_id ?? parent.id} (${parent.scope} scope).`,
        input.location ? `Discovered location: ${input.location}` : null,
        input.rating != null ? `Rating: ${input.rating.toFixed(1)}` : null,
        input.reviewCount != null ? `Reviews: ${input.reviewCount}` : null,
        outreachAngle ? `Outreach angle: ${outreachAngle}` : null,
        input.detectedSignals?.length ? `Detected signals: ${input.detectedSignals.join(', ')}` : null,
      ].filter(Boolean);
      const notes = noteParts.join('\n');

      const child = await this.createCampaign({
        scope: 'business',
        businessName: input.businessName,
        category: parent.category,
        city: parent.city,
        neighborhood: parent.neighborhood ?? undefined,
        tone: parent.tone ?? undefined,
        attributes: (parent.attributes as string[]) ?? undefined,
        estimatedTier: tier ?? undefined,
        assignedTo: input.assignedTo,
        notes,
        parentCampaignId: input.parentId,
      }, ctx);

      // If the caller passed detected_signals (from the category audit's
      // per-business detected_signals[]), create a business_analysis audit
      // on the child so the triage engine can read them, then auto-trigger
      // triage to assign a playbook immediately — the "spawn pre-triaged"
      // flow.
      if (input.detectedSignals && input.detectedSignals.length > 0) {
        const auditId = generateMarketingAuditId();
        await this.prisma.mkt_audits_list.create({
          data: {
            id: auditId,
            campaign_id: child.id,
            platform: 'business_analysis',
            audit_data: {
              audit_metadata: {
                business_name: input.businessName,
                source: 'derived_from_parent',
                parent_campaign_id: input.parentId,
              },
              detected_signals: input.detectedSignals,
              summary: `Derived from parent campaign with ${input.detectedSignals.length} detected signals.`,
            } as any,
          },
        });
        logger.info('Derived audit with signals created', ctx, {
          campaignId: child.id,
          auditId,
          signalCount: input.detectedSignals.length,
        });

        // Auto-trigger triage so the campaign is born with a playbook.
        try {
          const triageResult = await CampaignTriageService.evaluateTriageForCampaign({
            campaignId: child.id,
          }, ctx);
          logger.info('Auto-triage completed for derived campaign', ctx, {
            campaignId: child.id,
            playbookCode: triageResult.recommendedPlaybook.code,
          });
        } catch (triageError) {
          // Non-fatal — the campaign is created; triage can be re-run.
          logger.warn('Auto-triage failed for derived campaign (non-fatal)', ctx, {
            campaignId: child.id,
            error: (triageError as Error).message,
          });
        }
      }

      return child;
    } catch (error) {
      logger.error('Failed to derive business campaign', ctx, {
        error: (error as Error).message,
        parentId: input.parentId,
        businessName: input.businessName,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Infer an estimated tier from GBP rating + review count.
   *   - High: rating >= 4.5 AND review_count >= 200
   *   - Mid:  rating >= 4.0 OR review_count >= 50
   *   - Low:  everything else (or insufficient data)
   */
  private inferTierFromMetrics(rating?: number, reviewCount?: number): string | null {
    if (rating == null && reviewCount == null) return null;
    const r = rating ?? 0;
    const rc = reviewCount ?? 0;
    if (r >= 4.5 && rc >= 200) return 'High';
    if (r >= 4.0 || rc >= 50) return 'Mid';
    return 'Low';
  }

  async listCampaigns(filters: CampaignListFilters = {}, ctx?: RequestCtx): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.stage) where.stage = filters.stage;
    if (filters.scope) where.scope = filters.scope;
    if (filters.campaignCategory) where.campaign_category = filters.campaignCategory;
    if (filters.category) where.category = filters.category;
    if (filters.city) where.city = filters.city;
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters.tone) where.tone = filters.tone;
    if (filters.retainer) where.retainer = filters.retainer;
    if (filters.parentCampaignId) where.parent_campaign_id = filters.parentCampaignId;
    if (filters.attributes && filters.attributes.length > 0) {
      where.attributes = { hasEvery: filters.attributes };
    }
    if (filters.search) {
      where.OR = [
        { business_name: { contains: filters.search, mode: 'insensitive' } },
        { display_id: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        this.prisma.mkt_campaigns_list.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date_entered: 'desc' },
        }),
        this.prisma.mkt_campaigns_list.count({ where }),
      ]);

      // Derive the pipeline field for each campaign so the web app
      // can filter Openers/Follow-Ups (review) vs Recovery tab (recovery)
      // without re-implementing the dispatch rule.
      const itemsWithPipeline = items.map((item: any) => ({
        ...item,
        pipeline: pipelineFor(
          (item.campaign_category as CampaignCategory) || CAMPAIGN_CATEGORY_DEFAULT,
          (item.repair_track as RepairTrack | null) ?? null,
        ),
      }));

      return {
        items: itemsWithPipeline,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to list campaigns', ctx, { error: (error as Error).message, filters });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // UPDATE
  // ====================

  async updateCampaign(id: string, input: CampaignUpdateInput, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.scope !== undefined) data.scope = input.scope;
    if (input.campaignCategory !== undefined) data.campaign_category = input.campaignCategory;
    if (input.businessName !== undefined) data.business_name = input.businessName || null;
    if (input.category !== undefined) data.category = input.category;
    if (input.city !== undefined) data.city = input.city;
    if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
    if (input.contactMethod !== undefined) data.contact_method = input.contactMethod;
    if (input.contactInfo !== undefined) data.contact_info = input.contactInfo;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.websiteUrl !== undefined) {
      data.website_url = input.websiteUrl || null;
      if (input.websiteUrl) data.has_website = 'yes';
    }
    if (input.socialProfiles !== undefined) data.social_profiles = (input.socialProfiles || undefined) as any;
    if (input.ownerNames !== undefined) data.owner_names = (input.ownerNames || undefined) as any;
    if (input.phones !== undefined) data.phones = (input.phones || undefined) as any;
    if (input.gbpClaimed !== undefined) data.gbp_claimed = input.gbpClaimed;
    if (input.unaddressedReviews !== undefined) data.unaddressed_reviews = input.unaddressedReviews;
    if (input.lastReviewDate !== undefined) data.last_review_date = input.lastReviewDate;
    if (input.hasWebsite !== undefined) data.has_website = input.hasWebsite;
    if (input.napConsistent !== undefined) data.nap_consistent = input.napConsistent;
    if (input.estimatedTier !== undefined) data.estimated_tier = input.estimatedTier;
    if (input.estimatedFeeCents !== undefined) data.estimated_fee_cents = input.estimatedFeeCents;
    if (input.painScore !== undefined) data.pain_score = input.painScore;
    if (input.assignedTo !== undefined) data.assigned_to = input.assignedTo;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.tone !== undefined) data.tone = input.tone;
    if (input.retainer !== undefined) data.retainer = input.retainer;
    if (input.attributes !== undefined) data.attributes = input.attributes;
    if (input.retainerStatus !== undefined) data.retainer_status = input.retainerStatus;
    if (input.retainerAmountCents !== undefined) data.retainer_amount_cents = input.retainerAmountCents;
    if (input.retainerStartDate !== undefined) data.retainer_start_date = input.retainerStartDate;
    if (input.amountPaidCents !== undefined) data.amount_paid_cents = input.amountPaidCents;
    if (input.packageDelivered !== undefined) data.package_delivered = input.packageDelivered;
    if (input.campaignOrigin !== undefined) data.campaign_origin = input.campaignOrigin;
    if (input.packagePriceCents !== undefined) data.package_price_cents = input.packagePriceCents;
    if (input.subscriptionTierId !== undefined) data.subscription_tier_id = input.subscriptionTierId;
    if (input.couponCode !== undefined) data.coupon_code = input.couponCode;
    if (input.serviceCategory !== undefined) data.service_category = input.serviceCategory;

    try {
      const updated = await this.prisma.mkt_campaigns_list.update({ where: { id }, data });

      // Sprint 3: evaluate pain_score fallback for hot-prospect flagging
      if (input.painScore !== undefined) {
        try {
          const { MarketingHotProspectService } = await import('./MarketingHotProspectService.js');
          await MarketingHotProspectService.getInstance().evaluatePainScoreFallback(id, ctx);
        } catch (fbErr) {
          logger.error('pain_score fallback eval failed (best-effort)', ctx, { error: (fbErr as Error).message, campaignId: id });
        }
      }

      return updated;
    } catch (error) {
      logger.error('Failed to update campaign', ctx, { error: (error as Error).message, campaignId: id });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // STAGE TRANSITION
  // ====================

  async transitionStage(input: StageTransitionInput, ctx?: RequestCtx): Promise<any> {
    const { campaignId, toStage, notes, triggerType = 'manual', changedBy } = input;

    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const fromStage = campaign.stage as string;
      const category = (campaign.campaign_category as CampaignCategory) || CAMPAIGN_CATEGORY_DEFAULT;
      const repairTrack = (campaign.repair_track as RepairTrack | null) ?? null;
      if (!this.isValidTransition(fromStage, toStage, category, repairTrack)) {
        throw new Error(`Invalid stage transition: ${fromStage} → ${toStage}`);
      }

      // Best-effort GBP enrichment on seek → preview_built when no phone AND
      // no website_url are present. Soft gate: enrichment failure must NOT
      // block the transition (some campaigns advance on in-person context).
      if (fromStage === 'seek' && toStage === 'preview_built' && !campaign.phone && !campaign.website_url) {
        try {
          const { MarketingGbpEnhancerService } = await import('./MarketingGbpEnhancerService.js');
          await MarketingGbpEnhancerService.getInstance().populateContactFields(campaignId, ctx);
          logger.info('Best-effort GBP enrichment completed for seek → preview_built', ctx, { campaignId });
        } catch (enrichError) {
          logger.warn('Best-effort GBP enrichment failed, proceeding with transition', ctx, {
            campaignId,
            error: (enrichError as Error).message,
          });
        }
      }

      // Recovery Engine: auto-generate dispute intake link when a recovery
      // campaign (or escalated profile repair campaign) enters
      // outreach_dispatched. The link URL is included in the outreach
      // opener payload so the owner can submit their side of the dispute.
      // Best-effort — failure must NOT block the transition.
      if (
        toStage === 'outreach_dispatched' &&
        (category === 'recovery_management' || (category === 'profile_repair' && repairTrack === 'escalated'))
      ) {
        try {
          const { DisputeIntakeService } = await import('./DisputeIntakeService.js');
          const intakeKind = category === 'profile_repair' ? 'profile_repair' : 'dispute';
          await DisputeIntakeService.getInstance().generateIntakeLink(campaignId, ctx, intakeKind);
          logger.info('Intake link auto-generated for outreach_dispatched', ctx, { campaignId, intakeKind });
        } catch (intakeError) {
          logger.warn('Intake link generation failed, proceeding with transition', ctx, {
            campaignId,
            error: (intakeError as Error).message,
          });
        }
      }

      const updateData: any = {
        stage: toStage,
        stage_entered_at: new Date(),
      };

      const dateField = STAGE_DATE_FIELDS[toStage];
      if (dateField) {
        updateData[dateField] = new Date();
      }

      if (toStage === 'retainer_won') {
        updateData.retainer_status = 'won';
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: updateData,
      });

      await this.logStageTransition({
        campaignId,
        fromStage,
        toStage,
        notes,
        triggerType,
        changedBy,
      });

      logger.info('Campaign stage transitioned', ctx, { campaignId, fromStage, toStage, triggerType });
      return updated;
    } catch (error) {
      logger.error('Failed to transition campaign stage', ctx, { error: (error as Error).message, campaignId, toStage });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PROFILE REPAIR — TRACK SWITCHING
  // ====================

  /**
   * Stage remap table for track switches (§4.3 of spec).
   * Review → Recovery: seek → audit_identified, preview_built → framework_preview_generated,
   *   shown → outreach_dispatched. paid+ → BLOCKED.
   * Recovery → Review: audit_identified → seek, framework_preview_generated → preview_built,
   *   outreach_dispatched → shown (BLOCKED — reverse not allowed),
   *   awaiting_owner_intake → shown (allowed — de-escalation before intake).
   *   intake_submitted+ → BLOCKED.
   */
  private static readonly TRACK_REMAP_REVIEW_TO_RECOVERY: Record<string, string | null> = {
    seek: 'audit_identified',
    preview_built: 'framework_preview_generated',
    shown: 'outreach_dispatched',
    // paid and later → blocked (return null)
  };

  private static readonly TRACK_REMAP_RECOVERY_TO_REVIEW: Record<string, string | null> = {
    audit_identified: 'seek',
    framework_preview_generated: 'preview_built',
    outreach_dispatched: 'shown',
    awaiting_owner_intake: 'shown', // de-escalation before intake — allowed
    // intake_submitted and later → blocked (return null)
  };

  /**
   * Switch a profile_repair campaign between standard (review pipeline)
   * and escalated (recovery pipeline) tracks. Remaps the current stage
   * to its counterpart in the target machine, with guardrails.
   */
  async switchRepairTrack(input: {
    campaignId: string;
    toTrack: RepairTrack;
    issueType?: string;
    reason: string;
    changedBy?: string;
  }, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: input.campaignId },
      });
      if (!campaign) throw new Error(`Campaign ${input.campaignId} not found`);

      if (campaign.campaign_category !== 'profile_repair') {
        throw new Error('Track switching is only available for profile_repair campaigns');
      }

      const fromTrack = (campaign.repair_track as RepairTrack | null) ?? null;
      const fromStage = campaign.stage as string;
      const toTrack = input.toTrack;

      if (fromTrack === toTrack) {
        throw new Error(`Campaign is already on the ${toTrack} track`);
      }

      if (!input.reason || input.reason.trim().length === 0) {
        throw new Error('A reason is required for track switches');
      }

      // Determine the remapped stage
      let remappedStage: string | null;
      if (toTrack === 'escalated') {
        // Review → Recovery
        remappedStage = MarketingCampaignService.TRACK_REMAP_REVIEW_TO_RECOVERY[fromStage] ?? null;
        if (!remappedStage) {
          throw new Error(
            `Cannot escalate from stage '${fromStage}'. Escalate before payment or refund first (operator procedure).`
          );
        }
      } else {
        // Recovery → Review (de-escalation)
        remappedStage = MarketingCampaignService.TRACK_REMAP_RECOVERY_TO_REVIEW[fromStage] ?? null;
        if (!remappedStage) {
          throw new Error(
            `Cannot de-escalate from stage '${fromStage}'. Evidence already collected — finish on the recovery track.`
          );
        }
      }

      // If switching TO escalated while entering outreach_dispatched equivalent,
      // we need to auto-generate the intake link (same hook as transitionStage).
      // The remapped stage for 'shown' → 'outreach_dispatched' triggers this.
      const needsIntakeLink = toTrack === 'escalated' && remappedStage === 'outreach_dispatched';

      // If switching AWAY from escalated during awaiting_owner_intake,
      // void the outstanding intake token.
      const needsTokenVoid = fromTrack === 'escalated' && fromStage === 'awaiting_owner_intake';

      const updateData: any = {
        repair_track: toTrack,
        stage: remappedStage,
        stage_entered_at: new Date(),
        track_decided_at: new Date(),
        track_decision_reason: input.reason,
      };

      if (input.issueType) {
        updateData.repair_issue_type = input.issueType;
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: input.campaignId },
        data: updateData,
      });

      // Log the track switch in stage history
      await this.logStageTransition({
        campaignId: input.campaignId,
        fromStage,
        toStage: remappedStage,
        notes: `Track switch: ${fromTrack ?? 'triage'} → ${toTrack}. Reason: ${input.reason}`,
        triggerType: 'track_switch',
        changedBy: input.changedBy,
      });

      // Auto-generate intake link if needed
      if (needsIntakeLink) {
        try {
          const { DisputeIntakeService } = await import('./DisputeIntakeService.js');
          await DisputeIntakeService.getInstance().generateIntakeLink(input.campaignId, ctx, 'profile_repair');
          logger.info('Intake link auto-generated for track switch to escalated', ctx, { campaignId: input.campaignId });
        } catch (intakeError) {
          logger.warn('Intake link generation failed during track switch', ctx, {
            campaignId: input.campaignId,
            error: (intakeError as Error).message,
          });
        }
      }

      // Void outstanding intake token if de-escalating from awaiting_owner_intake
      if (needsTokenVoid) {
        try {
          await this.prisma.mkt_dispute_intake.updateMany({
            where: {
              campaign_id: input.campaignId,
              submitted_at: null,
              expires_at: { gt: new Date() },
            },
            data: { expires_at: new Date() },
          });
          logger.info('Outstanding intake token voided during de-escalation', ctx, { campaignId: input.campaignId });
        } catch (voidError) {
          logger.warn('Failed to void intake token during de-escalation', ctx, {
            campaignId: input.campaignId,
            error: (voidError as Error).message,
          });
        }
      }

      logger.info('Profile repair track switched', ctx, {
        campaignId: input.campaignId,
        fromTrack,
        toTrack,
        fromStage,
        remappedStage,
      });

      return updated;
    } catch (error) {
      logger.error('Failed to switch repair track', ctx, {
        error: (error as Error).message,
        campaignId: input.campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  private async logStageTransition(params: {
    campaignId: string;
    fromStage: string | null;
    toStage: string;
    notes?: string;
    triggerType?: string;
    changedBy?: string;
  }): Promise<void> {
    try {
      await this.prisma.mkt_stage_history_list.create({
        data: {
          id: generateStageHistoryId(),
          campaign_id: params.campaignId,
          from_stage: params.fromStage,
          to_stage: params.toStage,
          notes: params.notes || null,
          trigger_type: params.triggerType || 'manual',
          changed_by: params.changedBy || null,
        },
      });
    } catch (error) {
      logger.error('Failed to log stage transition', undefined, { error: (error as Error).message, campaignId: params.campaignId });
    }
  }

  // ====================
  // DELETE
  // ====================

  async deleteCampaign(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_campaigns_list.delete({ where: { id } });
      logger.info('Campaign deleted', ctx, { campaignId: id });
    } catch (error) {
      logger.error('Failed to delete campaign', ctx, { error: (error as Error).message, campaignId: id });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DASHBOARD
  // ====================

  async getDashboardStats(ctx?: RequestCtx): Promise<any> {
    try {
      const stageCounts = await this.prisma.mkt_campaigns_list.groupBy({
        by: ['stage'],
        _count: { id: true },
      });

      const totalRevenue = await this.prisma.mkt_campaigns_list.aggregate({
        _sum: { amount_paid_cents: true },
      });

      const totalRetainerRevenue = await this.prisma.mkt_campaigns_list.aggregate({
        _sum: { retainer_amount_cents: true },
        where: { retainer_status: 'won' },
      });

      const totalCampaigns = await this.prisma.mkt_campaigns_list.count();

      const activeStages = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched'];
      const activeCampaigns = await this.prisma.mkt_campaigns_list.count({
        where: { stage: { in: activeStages } },
      });

      const retainersWon = await this.prisma.mkt_campaigns_list.count({
        where: { retainer_status: 'won' },
      });

      const paidCount = await this.prisma.mkt_campaigns_list.count({
        where: { stage: { in: ['paid', 'delivered', 'retainer_pitched', 'retainer_won'] } },
      });
      const shownCount = await this.prisma.mkt_campaigns_list.count({
        where: { stage: { in: ['shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won'] } },
      });
      const conversionRate = shownCount > 0 ? paidCount / shownCount : 0;

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyRevenue = await this.prisma.mkt_campaigns_list.aggregate({
        _sum: { amount_paid_cents: true },
        where: { date_paid: { gte: weekAgo } },
      });

      // Also aggregate from marketing_revenue table for payment-confirmed revenue
      const marketingRevenueAgg = await (this.prisma as any).marketing_revenue.aggregate({
        _sum: { amount_cents: true },
        _count: { id: true },
      }).catch(() => ({ _sum: { amount_cents: 0 }, _count: { id: 0 } }));

      const weeklyMarketingRevenue = await (this.prisma as any).marketing_revenue.aggregate({
        _sum: { amount_cents: true },
        where: { recorded_at: { gte: weekAgo } },
      }).catch(() => ({ _sum: { amount_cents: 0 } }));

      const weeklyPreviews = await this.prisma.mkt_campaigns_list.count({
        where: {
          stage: { in: ['preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won'] },
          date_entered: { gte: weekAgo },
        },
      });

      const weeklyDelivered = await this.prisma.mkt_campaigns_list.count({
        where: {
          stage: { in: ['delivered', 'retainer_pitched', 'retainer_won'] },
          date_entered: { gte: weekAgo },
        },
      });

      const recentTransitions = await this.prisma.mkt_stage_history_list.findMany({
        take: 10,
        orderBy: { changed_at: 'desc' },
        include: { mkt_campaigns_list: { select: { business_name: true, display_id: true } } },
      });

      const totalConversions = await this.prisma.mkt_campaigns_list.count({
        where: { tenant_id: { not: null } },
      });

      const resurrectedConversions = await this.prisma.mkt_stage_history_list.count({
        where: { to_stage: 'tenant_onboarded', from_stage: { in: RESURRECTION_STAGES } },
      });

      const stageMap: Record<string, number> = {};
      stageCounts.forEach((s: any) => { stageMap[s.stage] = s._count.id; });

      return {
        totalCampaigns,
        activeCampaigns,
        stageCounts: stageMap,
        totalRevenueCents: totalRevenue._sum.amount_paid_cents || 0,
        marketingRevenueCents: marketingRevenueAgg._sum.amount_cents || 0,
        marketingRevenueCount: marketingRevenueAgg._count.id || 0,
        totalRetainerRevenueCents: totalRetainerRevenue._sum.retainer_amount_cents || 0,
        totalRetainersWon: retainersWon,
        conversionRate,
        weeklyRevenueCents: weeklyRevenue._sum.amount_paid_cents || 0,
        weeklyMarketingRevenueCents: weeklyMarketingRevenue._sum.amount_cents || 0,
        weeklyPreviews,
        weeklyDelivered,
        recentTransitions,
        totalConversions,
        resurrectedConversions,
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // AUTO-ADVANCE (called by scheduled job)
  // ====================

  async autoAdvanceStaleShownCampaigns(days: number = 7, ctx?: RequestCtx): Promise<{ advanced: number; skipped: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const stale = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          stage: 'shown',
          stage_entered_at: { lt: cutoff },
        },
        select: { id: true, next_follow_up_at: true, last_contacted_at: true },
      });

      // G1 guard: skip campaigns with live unconverted preview tokens —
      // 30-day tokens outlive the 7-day stale window; late QR conversions
      // must not land on a 'lost' campaign (resurrection transitions are the safety net)
      const staleIds = stale.map((c: any) => c.id);
      const liveTokenCampaigns = staleIds.length > 0
        ? await this.prisma.mkt_deliverable_preview_tokens.findMany({
            where: {
              campaign_id: { in: staleIds },
              converted_at: null,
              expires_at: { gt: new Date() },
            },
            select: { campaign_id: true },
            distinct: ['campaign_id'],
          })
        : [];
      const guardedIds = new Set(liveTokenCampaigns.map((t: any) => t.campaign_id));

      let advanced = 0;
      let skipped = 0;
      const now = new Date();
      for (const campaign of stale) {
        if (guardedIds.has(campaign.id)) {
          skipped++;
          logger.info('Auto-advance skipped: campaign has live unconverted preview tokens', ctx, { campaignId: campaign.id });
          continue;
        }

        // Sprint 2 follow-up guard: respect scheduled follow-ups.
        //  - next_follow_up_at in the future → skip (do not auto-lose)
        //  - next_follow_up_at in the past AND last_contacted_at is older than
        //    the follow-up date → auto-advance (follow-up was missed)
        //  - no next_follow_up_at → keep existing 7-day rule
        const nextFu = campaign.next_follow_up_at ? new Date(campaign.next_follow_up_at) : null;
        if (nextFu) {
          if (nextFu > now) {
            skipped++;
            logger.info('Auto-advance skipped: future follow-up scheduled', ctx, { campaignId: campaign.id, next_follow_up_at: nextFu, reason: 'follow_up_scheduled' });
            continue;
          }
          // Follow-up is in the past — only auto-advance if the operator
          // hasn't contacted since the follow-up was due.
          const lastContact = campaign.last_contacted_at ? new Date(campaign.last_contacted_at) : null;
          if (lastContact && lastContact >= nextFu) {
            skipped++;
            logger.info('Auto-advance skipped: contacted after follow-up due date', ctx, { campaignId: campaign.id, last_contacted_at: lastContact, reason: 'recent_contact' });
            continue;
          }
        }

        try {
          await this.transitionStage({
            campaignId: campaign.id,
            toStage: 'lost',
            triggerType: 'automated',
            notes: `Auto-advanced: no response after ${days} days`,
          });
          advanced++;
        } catch (error) {
          logger.error('Failed to auto-advance campaign', ctx, { error: (error as Error).message, campaignId: campaign.id });
        }
      }

      logger.info(`Auto-advanced ${advanced} stale shown campaigns to lost (${skipped} skipped — live tokens / follow-ups / recent contacts)`, ctx, { advanced, skipped, days });
      return { advanced, skipped };
    } catch (error) {
      logger.error('Failed to auto-advance stale campaigns', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // TENANT CONVERSION (Tenant Prospecting Channel — Sprint 5A)
  // ====================

  mapCategoryToDemoTemplate(category: string): 'grocery' | 'convenience' | 'specialty_retail' {
    const c = (category || '').toLowerCase();
    if (c.includes('grocery') || c.includes('supermarket') || c.includes('food')) return 'grocery';
    if (c.includes('convenience') || c.includes('corner') || c.includes('bodega')) return 'convenience';
    return 'specialty_retail';
  }

  async linkTenant(input: LinkTenantInput, ctx?: RequestCtx): Promise<any> {
    const { campaignId, tenantId, conversionSource, changedBy } = input;
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const fromStage = campaign.stage as string;
      const category = (campaign.campaign_category as CampaignCategory) || CAMPAIGN_CATEGORY_DEFAULT;
      if (fromStage !== 'tenant_onboarded' && !this.isValidTransition(fromStage, 'tenant_onboarded', category)) {
        throw new Error(`Invalid stage transition: ${fromStage} → tenant_onboarded`);
      }

      const resurrected = RESURRECTION_STAGES.includes(fromStage);
      const notes = resurrected
        ? `Resurrected: converted via ${conversionSource} after ${fromStage}`
        : `Converted via ${conversionSource}`;

      const updateData: any = {
        tenant_id: tenantId,
        last_touch_source: conversionSource,
        stage: 'tenant_onboarded',
        stage_entered_at: new Date(),
        date_tenant_onboarded: new Date(),
      };
      if (!campaign.first_touch_source) {
        updateData.first_touch_source = conversionSource;
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: updateData,
      });

      if (fromStage !== 'tenant_onboarded') {
        await this.logStageTransition({
          campaignId,
          fromStage,
          toStage: 'tenant_onboarded',
          notes,
          triggerType: conversionSource === 'manual' ? 'manual' : 'system',
          changedBy,
        });
      }

      this.fireConversionNotification(updated, tenantId, conversionSource, resurrected, ctx);

      logger.info('Campaign linked to tenant', ctx, { campaignId, tenantId, conversionSource, resurrected });
      return updated;
    } catch (error) {
      logger.error('Failed to link campaign to tenant', ctx, { error: (error as Error).message, campaignId, tenantId });
      throw this.handleError(error, ctx);
    }
  }

  private fireConversionNotification(campaign: any, tenantId: string, conversionSource: ConversionSource, resurrected: boolean, ctx?: RequestCtx): void {
    (async () => {
      try {
        await getBillingNotificationService().sendNotification({
          tenantId,
          type: 'marketing_campaign_converted',
          metadata: {
            campaignId: campaign.id,
            displayId: campaign.display_id,
            businessName: campaign.business_name,
            conversionSource,
            resurrected,
          },
        });
      } catch (error) {
        logger.error('Failed to fire conversion notification', ctx, { error: (error as Error).message, campaignId: campaign.id, tenantId });
      }
    })();
  }

  async generateDemoStorefront(campaignId: string, ctx?: RequestCtx): Promise<DemoStorefrontResult> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const { default: deliverableService } = await import('./MarketingDeliverableService');

      // Reuse existing active demo if still live
      if (campaign.demo_tenant_id) {
        const existingDemo = await this.prisma.tenants.findUnique({
          where: { id: campaign.demo_tenant_id },
          select: { id: true, slug: true, is_demo: true, location_status: true, demo_expires_at: true, demo_template: true },
        });
        if (existingDemo?.is_demo && existingDemo.location_status === 'active'
          && existingDemo.demo_expires_at && existingDemo.demo_expires_at > new Date()) {
          const token = await deliverableService.generateCampaignToken(campaignId, 'demo_storefront');
          return {
            demoTenantId: existingDemo.id,
            slug: existingDemo.slug || '',
            template: existingDemo.demo_template || 'specialty_retail',
            expiresAt: existingDemo.demo_expires_at,
            previewToken: token.token,
            previewUrl: `${unifiedConfig.webUrl}/p/deliverable/${token.token}`,
            demoUrl: `${unifiedConfig.webUrl}/t/${existingDemo.slug}?ptoken=${token.token}`,
          };
        }
      }

      const template = this.mapCategoryToDemoTemplate(campaign.category);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const demo = await DemoTenantService.createDemoTenant({
        template,
        businessName: campaign.business_name ?? undefined,
        expiresAt,
      });

      await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: { demo_tenant_id: demo.tenantId },
      });

      const token = await deliverableService.generateCampaignToken(campaignId, 'demo_storefront');

      logger.info('Demo storefront generated for campaign', ctx, { campaignId, demoTenantId: demo.tenantId, template });

      return {
        demoTenantId: demo.tenantId,
        slug: demo.slug,
        template: demo.template,
        expiresAt: demo.expiresAt,
        previewToken: token.token,
        previewUrl: `${unifiedConfig.webUrl}/p/deliverable/${token.token}`,
        demoUrl: `${unifiedConfig.webUrl}/t/${demo.slug}?ptoken=${token.token}`,
      };
    } catch (error) {
      logger.error('Failed to generate demo storefront', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getConversionStats(ctx?: RequestCtx): Promise<any> {
    try {
      const totalConversions = await this.prisma.mkt_campaigns_list.count({
        where: { tenant_id: { not: null } },
      });

      const lastTouchGroups = await this.prisma.mkt_campaigns_list.groupBy({
        by: ['last_touch_source'],
        where: { tenant_id: { not: null } },
        _count: { id: true },
      });

      const firstTouchGroups = await this.prisma.mkt_campaigns_list.groupBy({
        by: ['first_touch_source'],
        where: { tenant_id: { not: null } },
        _count: { id: true },
      });

      const originGroups = await this.prisma.mkt_campaigns_list.groupBy({
        by: ['campaign_origin'],
        where: { tenant_id: { not: null } },
        _count: { id: true },
      });

      const resurrectedConversions = await this.prisma.mkt_stage_history_list.count({
        where: { to_stage: 'tenant_onboarded', from_stage: { in: RESURRECTION_STAGES } },
      });

      const funnelStages = ['shown', 'paid', 'delivered', 'retainer_won', 'tenant_onboarded'];
      const funnelCount = await this.prisma.mkt_campaigns_list.count({
        where: { stage: { in: funnelStages } },
      });
      const conversionRate = funnelCount > 0 ? totalConversions / funnelCount : 0;

      const tokensIssued = await this.prisma.mkt_deliverable_preview_tokens.count();
      const tokensViewed = await this.prisma.mkt_deliverable_preview_tokens.count({ where: { viewed_at: { not: null } } });
      const tokensConverted = await this.prisma.mkt_deliverable_preview_tokens.count({ where: { converted_at: { not: null } } });
      const demoTokensIssued = await this.prisma.mkt_deliverable_preview_tokens.count({ where: { token_type: 'demo_storefront' } });
      const demoTokensConverted = await this.prisma.mkt_deliverable_preview_tokens.count({ where: { token_type: 'demo_storefront', converted_at: { not: null } } });

      const converted = await this.prisma.mkt_campaigns_list.findMany({
        where: { tenant_id: { not: null }, date_tenant_onboarded: { not: null } },
        select: { date_entered: true, date_tenant_onboarded: true },
      });
      let avgDaysToConvert = 0;
      if (converted.length > 0) {
        const totalMs = converted.reduce((sum: number, c: any) =>
          sum + (c.date_tenant_onboarded.getTime() - c.date_entered.getTime()), 0);
        avgDaysToConvert = totalMs / converted.length / (24 * 60 * 60 * 1000);
      }

      const toMap = (groups: any[], key: string) => {
        const map: Record<string, number> = {};
        groups.forEach((g: any) => { map[g[key] || 'unknown'] = g._count.id; });
        return map;
      };

      return {
        totalConversions,
        conversionRate,
        byLastTouchSource: toMap(lastTouchGroups, 'last_touch_source'),
        byFirstTouchSource: toMap(firstTouchGroups, 'first_touch_source'),
        byOrigin: toMap(originGroups, 'campaign_origin'),
        resurrectedConversions,
        tokensIssued,
        tokensViewed,
        tokensConverted,
        qrViewRate: tokensIssued > 0 ? tokensViewed / tokensIssued : 0,
        qrConversionRate: tokensViewed > 0 ? tokensConverted / tokensViewed : 0,
        demoTokensIssued,
        demoClaimRate: demoTokensIssued > 0 ? demoTokensConverted / demoTokensIssued : 0,
        avgDaysToConvert: Math.round(avgDaysToConvert * 10) / 10,
      };
    } catch (error) {
      logger.error('Failed to get conversion stats', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PAYMENT COLLECTION (Payment Collection Sprint)
  // ====================

  async markCampaignPaid(input: MarkCampaignPaidInput, ctx?: RequestCtx): Promise<any> {
    const {
      campaignId,
      amountCents,
      discountCents,
      orderId,
      gatewayType,
      gatewayTransactionId,
      source,
      couponCode,
      subscriptionTierId,
      serviceCategory,
      changedBy,
    } = input;

    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const fromStage = campaign.stage as string;
      const validPaidTransitions = ['shown', 'preview_built', 'paid', 'delivered', 'lost', 'dead'];
      if (!validPaidTransitions.includes(fromStage)) {
        throw new Error(`Cannot mark campaign paid from stage: ${fromStage}`);
      }

      const isResurrection = fromStage === 'lost' || fromStage === 'dead';
      const updateData: any = {
        stage: 'paid',
        stage_entered_at: new Date(),
        date_paid: new Date(),
        amount_paid_cents: amountCents,
        last_touch_source: source,
      };
      if (!campaign.first_touch_source) {
        updateData.first_touch_source = source;
      }
      if (couponCode) {
        updateData.coupon_code = couponCode;
      }
      if (subscriptionTierId) {
        updateData.subscription_tier_id = subscriptionTierId;
      }
      if (serviceCategory) {
        updateData.service_category = serviceCategory;
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: updateData,
      });

      await this.logStageTransition({
        campaignId,
        fromStage,
        toStage: 'paid',
        notes: isResurrection
          ? `Resurrected: paid via ${source} after ${fromStage} (${gatewayType})`
          : `Paid via ${source} (${gatewayType})`,
        triggerType: source === 'manual' ? 'manual' : 'system',
        changedBy,
      });

      await this.recordMarketingRevenue({
        campaignId,
        amountCents,
        discountCents,
        orderId,
        gatewayType,
        gatewayTransactionId,
        source,
        subscriptionTierId,
        serviceCategory: serviceCategory || campaign.service_category || undefined,
      }, ctx);

      this.firePaymentNotification(updated, gatewayType, amountCents, source, ctx);

      const scorecardService = MarketingScorecardService.getInstance();
      const today = new Date();
      const existingScorecard = await scorecardService.getScorecard(campaign.assigned_to || 'system', today, ctx);
      await scorecardService.upsertScorecard({
        userId: campaign.assigned_to || 'system',
        date: today,
        packagesPaid: (existingScorecard?.packages_paid || 0) + 1,
        revenueCollectedCents: (existingScorecard?.revenue_collected_cents || 0) + amountCents,
      }, ctx);

      logger.info('Campaign marked paid', ctx, {
        campaignId,
        amountCents,
        gatewayType,
        source,
        fromStage,
        isResurrection,
      });
      return updated;
    } catch (error) {
      logger.error('Failed to mark campaign paid', ctx, { error: (error as Error).message, campaignId, amountCents });
      throw this.handleError(error, ctx);
    }
  }

  async recordMarketingRevenue(params: {
    campaignId: string;
    amountCents: number;
    discountCents: number;
    orderId?: string;
    gatewayType: string;
    gatewayTransactionId?: string;
    source: string;
    subscriptionTierId?: string;
    serviceCategory?: string;
  }, ctx?: RequestCtx): Promise<any> {
    try {
      const revenue = await this.prisma.marketing_revenue.create({
        data: {
          id: generateMarketingRevenueId(),
          campaign_id: params.campaignId,
          order_id: params.orderId || null,
          amount_cents: params.amountCents,
          discount_cents: params.discountCents,
          gateway_type: params.gatewayType,
          gateway_transaction_id: params.gatewayTransactionId || null,
          source: params.source,
          subscription_tier_id: params.subscriptionTierId || null,
          service_category: params.serviceCategory || null,
        },
      });
      logger.info('Marketing revenue recorded', ctx, {
        campaignId: params.campaignId,
        amountCents: params.amountCents,
        gatewayType: params.gatewayType,
        source: params.source,
      });
      return revenue;
    } catch (error) {
      logger.error('Failed to record marketing revenue', ctx, { error: (error as Error).message, campaignId: params.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  private firePaymentNotification(campaign: any, gatewayType: string, amountCents: number, source: string, ctx?: RequestCtx): void {
    (async () => {
      try {
        const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
          campaign.service_category || '',
          ctx,
        );
        const tenantId = campaign.tenant_id || campaign.demo_tenant_id;
        if (tenantId) {
          await getBillingNotificationService().sendNotification({
            tenantId,
            type: 'marketing_package_paid' as any,
            metadata: {
              campaignId: campaign.id,
              displayId: campaign.display_id,
              businessName: campaign.business_name,
              amountCents,
              gatewayType,
              source,
              serviceCategory: serviceCategoryLabel,
            },
          });
        }
      } catch (error) {
        logger.error('Failed to fire payment notification', ctx, { error: (error as Error).message, campaignId: campaign.id });
      }
    })();
  }

  async getCampaignRevenue(campaignId: string, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.marketing_revenue.findMany({
        where: { campaign_id: campaignId },
        orderBy: { recorded_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get campaign revenue', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingCampaignService.getInstance();
