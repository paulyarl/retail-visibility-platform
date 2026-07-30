/**
 * MarketingCategoryToneService — Category / tone preset CRUD
 *
 * Stores the default tone per category and other category-level metadata used
 * to auto-fill campaigns and scope prompt templates.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_category_tone_alignment_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateCategoryTonePresetId } from '../lib/id-generator';

export interface CategoryTonePresetInput {
  category: string;
  tone: string;
  description?: string;
  isActive?: boolean;
  createdBy?: string;
}

export class MarketingCategoryToneService extends BaseService {
  private static instance: MarketingCategoryToneService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingCategoryToneService {
    if (!MarketingCategoryToneService.instance) {
      MarketingCategoryToneService.instance = new MarketingCategoryToneService();
    }
    return MarketingCategoryToneService.instance;
  }

  async upsertPreset(input: CategoryTonePresetInput, ctx?: RequestCtx): Promise<any> {
    const { category, tone, description, isActive = true, createdBy } = input;
    const normalizedCategory = category.trim().toLowerCase();
    const normalizedTone = tone.trim();

    try {
      const existing = await this.prisma.mkt_category_tone_presets_list.findFirst({
        where: { category: normalizedCategory, tone: normalizedTone },
      });

      if (existing) {
        const updated = await this.prisma.mkt_category_tone_presets_list.update({
          where: { id: existing.id },
          data: {
            description: description ?? existing.description,
            is_active: isActive,
            updated_at: new Date(),
          },
        });
        logger.info('Category tone preset updated', ctx, { presetId: existing.id, category, tone });
        return updated;
      }

      const preset = await this.prisma.mkt_category_tone_presets_list.create({
        data: {
          id: generateCategoryTonePresetId(),
          category: normalizedCategory,
          tone: normalizedTone,
          description: description || null,
          is_active: isActive,
          created_by: createdBy || null,
        },
      });
      logger.info('Category tone preset created', ctx, { presetId: preset.id, category, tone });
      return preset;
    } catch (error) {
      logger.error('Failed to upsert category tone preset', ctx, { error: (error as Error).message, category, tone });
      throw this.handleError(error, ctx);
    }
  }

  async getPresetByCategory(category: string, ctx?: RequestCtx): Promise<any | null> {
    const normalizedCategory = category.trim().toLowerCase();
    try {
      return await this.prisma.mkt_category_tone_presets_list.findFirst({
        where: { category: normalizedCategory, is_active: true },
        orderBy: { updated_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get category tone preset', ctx, { error: (error as Error).message, category });
      throw this.handleError(error, ctx);
    }
  }

  async listPresets(ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_category_tone_presets_list.findMany({
        where: { is_active: true },
        orderBy: { category: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to list category tone presets', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async deletePreset(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_category_tone_presets_list.delete({ where: { id } });
      logger.info('Category tone preset deleted', ctx, { presetId: id });
    } catch (error) {
      logger.error('Failed to delete category tone preset', ctx, { error: (error as Error).message, presetId: id });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingCategoryToneService.getInstance();
