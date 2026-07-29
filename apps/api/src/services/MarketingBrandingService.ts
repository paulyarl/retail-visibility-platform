/**
 * MarketingBrandingService — Operator branding config CRUD
 *
 * Manages the single active branding configuration used for deliverable
 * generation (operator name, logo URL, colors, fonts, footer disclaimer).
 * Only one config row can be active at a time (enforced by partial unique index).
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateBrandingConfigId } from '../lib/id-generator';

export interface BrandingConfigInput {
  operatorName: string;
  operatorLogoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  fontFamily?: string;
  footerDisclaimer?: string;
  isActive?: boolean;
}

export class MarketingBrandingService extends BaseService {
  private static instance: MarketingBrandingService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingBrandingService {
    if (!MarketingBrandingService.instance) {
      MarketingBrandingService.instance = new MarketingBrandingService();
    }
    return MarketingBrandingService.instance;
  }

  async createConfig(input: BrandingConfigInput, ctx?: RequestCtx): Promise<any> {
    const id = generateBrandingConfigId();
    try {
      if (input.isActive) {
        await this.deactivateAllConfigs();
      }
      const config = await this.prisma.mkt_branding_config.create({
        data: {
          id,
          operator_name: input.operatorName,
          operator_logo_url: input.operatorLogoUrl || null,
          primary_color: input.primaryColor || '#111827',
          accent_color: input.accentColor || '#3B82F6',
          text_color: input.textColor || '#1F2937',
          font_family: input.fontFamily || null,
          footer_disclaimer: input.footerDisclaimer || null,
          is_active: input.isActive ?? true,
        },
      });
      logger.info('Branding config created', ctx, { configId: id, operatorName: input.operatorName });
      return config;
    } catch (error) {
      logger.error('Failed to create branding config', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getActiveConfig(ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_branding_config.findFirst({
        where: { is_active: true },
      });
    } catch (error) {
      logger.error('Failed to get active branding config', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getConfig(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_branding_config.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get branding config', ctx, { error: (error as Error).message, configId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listConfigs(ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_branding_config.findMany({
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list branding configs', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateConfig(id: string, input: Partial<BrandingConfigInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.operatorName !== undefined) data.operator_name = input.operatorName;
    if (input.operatorLogoUrl !== undefined) data.operator_logo_url = input.operatorLogoUrl;
    if (input.primaryColor !== undefined) data.primary_color = input.primaryColor;
    if (input.accentColor !== undefined) data.accent_color = input.accentColor;
    if (input.textColor !== undefined) data.text_color = input.textColor;
    if (input.fontFamily !== undefined) data.font_family = input.fontFamily;
    if (input.footerDisclaimer !== undefined) data.footer_disclaimer = input.footerDisclaimer;
    if (input.isActive !== undefined) {
      if (input.isActive) {
        await this.deactivateAllConfigs();
      }
      data.is_active = input.isActive;
    }

    try {
      return await this.prisma.mkt_branding_config.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update branding config', ctx, { error: (error as Error).message, configId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteConfig(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_branding_config.delete({ where: { id } });
      logger.info('Branding config deleted', ctx, { configId: id });
    } catch (error) {
      logger.error('Failed to delete branding config', ctx, { error: (error as Error).message, configId: id });
      throw this.handleError(error, ctx);
    }
  }

  private async deactivateAllConfigs(): Promise<void> {
    await this.prisma.mkt_branding_config.updateMany({
      where: { is_active: true },
      data: { is_active: false },
    });
  }
}

export default MarketingBrandingService.getInstance();
