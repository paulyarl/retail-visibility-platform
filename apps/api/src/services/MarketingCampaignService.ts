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
import { generateCampaignId, generateStageHistoryId, generateMarketingRevenueId } from '../lib/id-generator';
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

export type RetainerStatus = 'not_pitched' | 'pitched' | 'won' | 'declined';

export type ConversionSource =
  | 'qr_deliverable'
  | 'demo_storefront'
  | 'gbp_enhancer'
  | 'directory_preview'
  | 'manual'
  | 'external';

export type CampaignOrigin = 'prospect' | 'upsell';

const VALID_TRANSITIONS: Record<string, string[]> = {
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
  businessName: string;
  category: string;
  city: string;
  neighborhood?: string;
  contactMethod?: string;
  contactInfo?: string;
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
}

export interface CampaignUpdateInput {
  businessName?: string;
  category?: string;
  city?: string;
  neighborhood?: string;
  contactMethod?: string;
  contactInfo?: string;
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
  toStage: CampaignStage;
  notes?: string;
  triggerType?: 'manual' | 'automated' | 'system';
  changedBy?: string;
}

export interface CampaignListFilters {
  stage?: CampaignStage;
  category?: string;
  city?: string;
  assignedTo?: string;
  tone?: string;
  retainer?: 'Fast' | 'Medium' | 'Slow';
  attributes?: string[];
  search?: string;
  page?: number;
  limit?: number;
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

  isValidTransition(from: string | null, to: string): boolean {
    if (!from) return true;
    const allowed = VALID_TRANSITIONS[from];
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

      const campaign = await this.prisma.mkt_campaigns_list.create({
        data: {
          id,
          display_id: input.displayId || null,
          business_name: input.businessName,
          category: input.category,
          city: input.city,
          neighborhood: input.neighborhood || null,
          contact_method: input.contactMethod || null,
          contact_info: input.contactInfo || null,
          gbp_claimed: input.gbpClaimed || false,
          unaddressed_reviews: input.unaddressedReviews || 0,
          last_review_date: input.lastReviewDate || null,
          has_website: input.hasWebsite || null,
          nap_consistent: input.napConsistent ?? null,
          estimated_tier: input.estimatedTier || null,
          estimated_fee_cents: input.estimatedFeeCents || 0,
          pain_score: input.painScore || 0,
          tone: tone || null,
          retainer: input.retainer || null,
          attributes: input.attributes || [],
          assigned_to: input.assignedTo || null,
          notes: input.notes || null,
          stage: 'seek',
          stage_entered_at: new Date(),
        },
      });

      await this.logStageTransition({
        campaignId: id,
        fromStage: null,
        toStage: 'seek',
        triggerType: 'system',
        changedBy: input.assignedTo,
      });

      logger.info('Marketing campaign created', ctx, { campaignId: id, businessName: input.businessName });
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
        },
      });
      if (!campaign) return null;

      const service_category_label = await MarketingServiceCategoryService.getLabel(
        campaign.service_category || '',
        ctx,
      );
      return { ...campaign, service_category_label };
    } catch (error) {
      logger.error('Failed to get campaign', ctx, { error: (error as Error).message, campaignId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listCampaigns(filters: CampaignListFilters = {}, ctx?: RequestCtx): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.stage) where.stage = filters.stage;
    if (filters.category) where.category = filters.category;
    if (filters.city) where.city = filters.city;
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters.tone) where.tone = filters.tone;
    if (filters.retainer) where.retainer = filters.retainer;
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

      return {
        items,
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
    if (input.businessName !== undefined) data.business_name = input.businessName;
    if (input.category !== undefined) data.category = input.category;
    if (input.city !== undefined) data.city = input.city;
    if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
    if (input.contactMethod !== undefined) data.contact_method = input.contactMethod;
    if (input.contactInfo !== undefined) data.contact_info = input.contactInfo;
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
      return await this.prisma.mkt_campaigns_list.update({ where: { id }, data });
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
      if (!this.isValidTransition(fromStage, toStage)) {
        throw new Error(`Invalid stage transition: ${fromStage} → ${toStage}`);
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
        select: { id: true },
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
      for (const campaign of stale) {
        if (guardedIds.has(campaign.id)) {
          skipped++;
          logger.info('Auto-advance skipped: campaign has live unconverted preview tokens', ctx, { campaignId: campaign.id });
          continue;
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

      logger.info(`Auto-advanced ${advanced} stale shown campaigns to lost (${skipped} skipped — live tokens)`, ctx, { advanced, skipped, days });
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
      if (fromStage !== 'tenant_onboarded' && !this.isValidTransition(fromStage, 'tenant_onboarded')) {
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
        businessName: campaign.business_name,
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
