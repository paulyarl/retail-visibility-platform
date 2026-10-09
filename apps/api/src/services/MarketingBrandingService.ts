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
import { loadPlatformBranding } from './marketing/MarketingReceiptPdfService';
import { jsPDF } from 'jspdf';

/**
 * Sentinel for operator_logo_url meaning "no logo — print the operator name".
 * Matches the codebase's double-underscore sentinel convention ('__all__',
 * '__location__'). Empty string/null is NOT none — it's the platform-logo
 * fallback. The branding zod schema accepts any string, so no migration.
 */
export const NO_LOGO_URL = '__none__';

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

  // ====================
  // STATIC PDF HELPERS
  // ====================

  static async applyBrandingToDoc(
    doc: jsPDF,
    config: any,
    opts: { pageWidth: number; margin: number; startY: number },
  ): Promise<number> {
    let yPos = opts.startY;

    const logoUrl = await MarketingBrandingService.resolveLogoUrl(config);
    const embedded = logoUrl
      ? await MarketingBrandingService.embedLogo(doc, logoUrl, opts.margin, yPos, 15)
      : false;

    if (embedded) {
      yPos += 18;
    } else {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const hex = config.primary_color || '#111827';
      const rgb = MarketingBrandingService.hexToRgb(hex);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.text(config.operator_name || 'Operator', opts.margin, yPos);
      yPos += 8;
    }

    if (config.accent_color) {
      const accentRgb = MarketingBrandingService.hexToRgb(config.accent_color);
      doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
      doc.setLineWidth(0.5);
      doc.line(opts.margin, yPos, opts.pageWidth - opts.margin, yPos);
      yPos += 5;
    }

    doc.setTextColor(0, 0, 0);
    return yPos;
  }

  /**
   * Resolve the logo to render for a config. Three scenarios:
   *   - a URL              → the operator's custom logo
   *   - NO_LOGO_URL        → no logo (operator-name text header)
   *   - empty/null         → the platform logo (platform_settings_list.logo_url,
   *                          the same source the QR kits and receipts use)
   */
  private static async resolveLogoUrl(config: any): Promise<string | null> {
    const url = config.operator_logo_url?.trim();
    if (url === NO_LOGO_URL) return null;
    if (url) return url;
    try {
      const platform = await loadPlatformBranding();
      return platform.logoUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Embed a logo into the doc. Accepts a data URI directly or fetches a
   * remote URL and converts it (the receipt/postcard pattern — jsPDF cannot
   * resolve remote URLs itself). Returns false on any failure so the caller
   * can fall back to the operator-name text header.
   */
  private static async embedLogo(
    doc: jsPDF,
    logoUrl: string,
    x: number,
    y: number,
    height: number,
  ): Promise<boolean> {
    try {
      let dataUri: string;
      if (logoUrl.startsWith('data:')) {
        dataUri = logoUrl;
      } else {
        const res = await fetch(logoUrl);
        if (!res.ok) return false;
        const contentType = res.headers.get('content-type') || 'image/png';
        const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
        dataUri = `data:${contentType};base64,${base64}`;
      }
      const props = doc.getImageProperties(dataUri);
      const width = height * (props.width / props.height);
      const format = /jpe?g/i.test(dataUri.slice(0, 30)) ? 'JPEG' : 'PNG';
      doc.addImage(dataUri, format, x, y, width, height);
      return true;
    } catch {
      return false;
    }
  }

  static applyWatermark(doc: jsPDF, pageWidth: number, pageHeight: number): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setFontSize(50);
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'bold');
      doc.text('PREVIEW', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16) || 0;
    const g = parseInt(cleaned.substring(2, 4), 16) || 0;
    const b = parseInt(cleaned.substring(4, 6), 16) || 0;
    return { r, g, b };
  }
}

export default MarketingBrandingService.getInstance();
