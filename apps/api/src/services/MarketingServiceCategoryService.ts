/**
 * MarketingServiceCategoryService — Service category code / label lookup
 *
 * Stores the display label for each service category code used in campaign
 * pricing and public payment/receipt flows. Backing the form with a DB table
 * means new categories added by admins immediately appear in receipts.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

export interface ServiceCategoryInput {
  value: string;
  label: string;
  isActive?: boolean;
}

const HARDCODED_FALLBACK: Record<string, string> = {
  gbp_optimization: 'Google Business Profile Optimization',
  review_management: 'Review Management Setup',
  website_audit: 'Website Audit & Report',
  local_seo: 'Local SEO Package',
  social_media_setup: 'Social Media Setup',
  branding_package: 'Branding Package',
  content_creation: 'Content Creation Package',
};

export class MarketingServiceCategoryService extends BaseService {
  private static instance: MarketingServiceCategoryService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingServiceCategoryService {
    if (!MarketingServiceCategoryService.instance) {
      MarketingServiceCategoryService.instance = new MarketingServiceCategoryService();
    }
    return MarketingServiceCategoryService.instance;
  }

  async listCategories(ctx?: RequestCtx): Promise<{ value: string; label: string }[]> {
    try {
      const rows = await this.prisma.mkt_service_categories_list.findMany({
        where: { is_active: true },
        orderBy: { value: 'asc' },
        select: { value: true, label: true },
      });
      return rows;
    } catch (error) {
      logger.error('Failed to list service categories', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getLabel(value: string, ctx?: RequestCtx): Promise<string> {
    const normalized = value?.trim();
    if (!normalized) return 'Marketing Package';

    try {
      const row = await this.prisma.mkt_service_categories_list.findUnique({
        where: { value: normalized },
        select: { label: true },
      });
      if (row?.label) return row.label;
      return HARDCODED_FALLBACK[normalized] || normalized;
    } catch (error) {
      logger.error('Failed to get service category label', ctx, { error: (error as Error).message, value });
      return HARDCODED_FALLBACK[normalized] || normalized;
    }
  }

  async upsertCategory(input: ServiceCategoryInput, ctx?: RequestCtx): Promise<{ value: string; label: string }> {
    const { value, label, isActive = true } = input;
    const normalizedValue = value.trim();
    const normalizedLabel = label.trim();

    try {
      const row = await this.prisma.mkt_service_categories_list.upsert({
        where: { value: normalizedValue },
        update: {
          label: normalizedLabel,
          is_active: isActive,
          updated_at: new Date(),
        },
        create: {
          value: normalizedValue,
          label: normalizedLabel,
          is_active: isActive,
        },
      });
      logger.info('Service category upserted', ctx, { value: row.value, label: row.label });
      return { value: row.value, label: row.label };
    } catch (error) {
      logger.error('Failed to upsert service category', ctx, { error: (error as Error).message, value, label });
      throw this.handleError(error, ctx);
    }
  }

  async deleteCategory(value: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_service_categories_list.update({
        where: { value },
        data: { is_active: false, updated_at: new Date() },
      });
      logger.info('Service category deactivated', ctx, { value });
    } catch (error) {
      logger.error('Failed to delete service category', ctx, { error: (error as Error).message, value });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingServiceCategoryService.getInstance();
