/**
 * MarketingAuditService — Per-platform audit data CRUD for campaigns
 *
 * Manages audit records for each platform (google, yelp, facebook, etc.)
 * associated with a campaign. Multiple audits per campaign are supported.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateMarketingAuditId } from '../lib/id-generator';

export interface AuditInput {
  campaignId: string;
  platform: string;
  reviewCount?: number;
  averageRating?: number;
  unaddressedReviews?: number;
  ownerResponseRate?: number;
  photoCount?: number;
  claimed?: boolean;
  activePage?: boolean;
  hasBooking?: boolean;
  hasContactForm?: boolean;
  mobileFriendly?: boolean;
  auditData?: any;
  /** Free-form import metadata (model, provider, run_id, notes). */
  importMetadata?: any;
}

export class MarketingAuditService extends BaseService {
  private static instance: MarketingAuditService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingAuditService {
    if (!MarketingAuditService.instance) {
      MarketingAuditService.instance = new MarketingAuditService();
    }
    return MarketingAuditService.instance;
  }

  async createAudit(input: AuditInput, ctx?: RequestCtx): Promise<any> {
    const id = generateMarketingAuditId();
    try {
      const audit = await this.prisma.mkt_audits_list.create({
        data: {
          id,
          campaign_id: input.campaignId,
          platform: input.platform,
          review_count: input.reviewCount || 0,
          average_rating: input.averageRating ?? null,
          unaddressed_reviews: input.unaddressedReviews || 0,
          owner_response_rate: input.ownerResponseRate || 0,
          photo_count: input.photoCount || 0,
          claimed: input.claimed || false,
          active_page: input.activePage || false,
          has_booking: input.hasBooking || false,
          has_contact_form: input.hasContactForm || false,
          mobile_friendly: input.mobileFriendly ?? null,
          audit_data: input.auditData || null,
          import_metadata: input.importMetadata ?? null,
        },
      });
      logger.info('Marketing audit created', ctx, { auditId: id, campaignId: input.campaignId, platform: input.platform });
      return audit;
    } catch (error) {
      logger.error('Failed to create audit', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getAuditsByCampaign(campaignId: string, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_audits_list.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list audits', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async updateAudit(id: string, input: Partial<AuditInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.reviewCount !== undefined) data.review_count = input.reviewCount;
    if (input.averageRating !== undefined) data.average_rating = input.averageRating;
    if (input.unaddressedReviews !== undefined) data.unaddressed_reviews = input.unaddressedReviews;
    if (input.ownerResponseRate !== undefined) data.owner_response_rate = input.ownerResponseRate;
    if (input.photoCount !== undefined) data.photo_count = input.photoCount;
    if (input.claimed !== undefined) data.claimed = input.claimed;
    if (input.activePage !== undefined) data.active_page = input.activePage;
    if (input.hasBooking !== undefined) data.has_booking = input.hasBooking;
    if (input.hasContactForm !== undefined) data.has_contact_form = input.hasContactForm;
    if (input.mobileFriendly !== undefined) data.mobile_friendly = input.mobileFriendly;
    if (input.auditData !== undefined) data.audit_data = input.auditData;
    if (input.importMetadata !== undefined) data.import_metadata = input.importMetadata;

    try {
      return await this.prisma.mkt_audits_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update audit', ctx, { error: (error as Error).message, auditId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteAudit(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_audits_list.delete({ where: { id } });
      logger.info('Audit deleted', ctx, { auditId: id });
    } catch (error) {
      logger.error('Failed to delete audit', ctx, { error: (error as Error).message, auditId: id });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingAuditService.getInstance();
