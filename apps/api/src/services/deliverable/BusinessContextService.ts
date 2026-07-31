/**
 * BusinessContextService — Assembles full business context for deliverable
 * response prompts. Extends NAP with category, services, hours, GBP
 * categories, and other context from audit data + campaign fields.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §2.4
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import type { BusinessContextFields } from './prompts';

export class BusinessContextService extends BaseService {
  private static instance: BusinessContextService;

  private constructor() { super(); }

  static getInstance(): BusinessContextService {
    if (!BusinessContextService.instance) {
      BusinessContextService.instance = new BusinessContextService();
    }
    return BusinessContextService.instance;
  }

  /**
   * Assemble the full business context block from campaign + audit data.
   * This feeds into every review response draft prompt.
   */
  async getBusinessContext(campaignId: string, ctx?: RequestCtx): Promise<BusinessContextFields> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: {
            where: { platform: 'business_analysis' },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const auditData = campaign.mkt_audits_list?.[0]?.audit_data as any;

      // Start with campaign fields
      const context: BusinessContextFields = {
        businessName: campaign.business_name ?? 'your business',
        businessCategory: campaign.category ?? 'local business',
        city: campaign.city ?? null,
        state: campaign.state ?? null,
        phone: campaign.phone ?? null,
        websiteUrl: campaign.website_url ?? null,
        campaignTone: campaign.tone || 'short informal',
      };

      // Enrich with audit data if available
      if (auditData) {
        // Override category if audit has a more specific one
        if (auditData.audit_metadata?.business_category) {
          context.businessCategory = auditData.audit_metadata.business_category;
        }

        // Pull services from recommended_services or audit metadata
        if (auditData.recommended_services && Array.isArray(auditData.recommended_services)) {
          // Don't override category, but we could extend context here
        }

        // Pull hours from GBP data if available
        const gbpData = auditData.platforms?.google;
        if (gbpData?.hours) {
          // Could add hours to context — for now, the prompt uses what's available
        }
      }

      logger.info('Business context assembled', ctx, {
        campaignId,
        businessName: context.businessName,
        category: context.businessCategory,
      });

      return context;
    } catch (error) {
      logger.error('Failed to assemble business context', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get the latest business_analysis audit data for a campaign.
   * Used by ReviewSlotService and DeliverableSectionService.
   */
  async getLatestAuditData(campaignId: string, ctx?: RequestCtx): Promise<{ auditData: any; auditId: string } | null> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: {
            where: { platform: 'business_analysis' },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!campaign) return null;
      const latest = campaign.mkt_audits_list?.[0];
      if (!latest) return null;

      return {
        auditData: latest.audit_data as any,
        auditId: latest.id,
      };
    } catch (error) {
      logger.error('Failed to get latest audit data', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }
}

export default BusinessContextService.getInstance();
