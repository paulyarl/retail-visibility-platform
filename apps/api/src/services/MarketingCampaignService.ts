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
import { generateCampaignId, generateStageHistoryId } from '../lib/id-generator';

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
  | 'dead';

export type RetainerStatus = 'not_pitched' | 'pitched' | 'won' | 'declined';

const VALID_TRANSITIONS: Record<string, string[]> = {
  seek:           ['preview_built', 'dead'],
  preview_built:  ['shown', 'dead'],
  shown:          ['paid', 'lost'],
  paid:           ['delivered'],
  delivered:      ['retainer_pitched', 'closed'],
  retainer_pitched: ['retainer_won', 'closed'],
  retainer_won:   ['lost'],
  lost:           ['seek'],
  dead:           ['seek'],
};

const STAGE_DATE_FIELDS: Record<string, string> = {
  preview_built:    'date_preview_built',
  shown:            'date_shown',
  paid:             'date_paid',
  delivered:        'date_delivered',
  retainer_pitched: 'date_retainer_pitched',
  retainer_won:     'date_retainer_won',
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
  stage?: CampaignStage;
  retainerStatus?: RetainerStatus;
  retainerAmountCents?: number;
  retainerStartDate?: Date | null;
  amountPaidCents?: number;
  packageDelivered?: string;
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
  search?: string;
  page?: number;
  limit?: number;
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
      return await this.prisma.mkt_campaigns_list.findUnique({
        where: { id },
        include: {
          mkt_audits_list: true,
          mkt_files_list: { orderBy: { uploaded_at: 'desc' } },
          mkt_stage_history_list: { orderBy: { changed_at: 'desc' }, take: 20 },
        },
      });
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
    if (input.retainerStatus !== undefined) data.retainer_status = input.retainerStatus;
    if (input.retainerAmountCents !== undefined) data.retainer_amount_cents = input.retainerAmountCents;
    if (input.retainerStartDate !== undefined) data.retainer_start_date = input.retainerStartDate;
    if (input.amountPaidCents !== undefined) data.amount_paid_cents = input.amountPaidCents;
    if (input.packageDelivered !== undefined) data.package_delivered = input.packageDelivered;

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

      const stageMap: Record<string, number> = {};
      stageCounts.forEach((s: any) => { stageMap[s.stage] = s._count.id; });

      return {
        totalCampaigns,
        activeCampaigns,
        stageCounts: stageMap,
        totalRevenueCents: totalRevenue._sum.amount_paid_cents || 0,
        totalRetainerRevenueCents: totalRetainerRevenue._sum.retainer_amount_cents || 0,
        totalRetainersWon: retainersWon,
        conversionRate,
        weeklyRevenueCents: weeklyRevenue._sum.amount_paid_cents || 0,
        weeklyPreviews,
        weeklyDelivered,
        recentTransitions,
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // AUTO-ADVANCE (called by scheduled job)
  // ====================

  async autoAdvanceStaleShownCampaigns(days: number = 7, ctx?: RequestCtx): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const stale = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          stage: 'shown',
          stage_entered_at: { lt: cutoff },
        },
        select: { id: true },
      });

      let count = 0;
      for (const campaign of stale) {
        try {
          await this.transitionStage({
            campaignId: campaign.id,
            toStage: 'lost',
            triggerType: 'automated',
            notes: `Auto-advanced: no response after ${days} days`,
          });
          count++;
        } catch (error) {
          logger.error('Failed to auto-advance campaign', ctx, { error: (error as Error).message, campaignId: campaign.id });
        }
      }

      logger.info(`Auto-advanced ${count} stale shown campaigns to lost`, ctx, { count, days });
      return count;
    } catch (error) {
      logger.error('Failed to auto-advance stale campaigns', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingCampaignService.getInstance();
