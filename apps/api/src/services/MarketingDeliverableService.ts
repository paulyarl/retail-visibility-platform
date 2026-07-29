/**
 * MarketingDeliverableService — Deliverable template + generated deliverable CRUD
 *
 * Manages jsPDF-compatible deliverable templates (v3 — JSON layout specs,
 * not HTML+Handlebars) and generated deliverable records. Actual PDF
 * generation uses existing jsPDF pattern in Sprint 3.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateDeliverableTemplateId, generateDeliverableId, generatePreviewTokenId, generatePreviewToken } from '../lib/id-generator';
import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';
import { MarketingBrandingService } from './MarketingBrandingService';
import MarketingCampaignService from './MarketingCampaignService';

export type DeliverableType =
  | 'review_responses'
  | 'service_menu'
  | 'gbp_audit'
  | 'testimonial_cards'
  | 'nap_report'
  | 'seo_content'
  | 'lead_magnet';

export interface DeliverableTemplateInput {
  name: string;
  deliverableType: DeliverableType;
  category?: string;
  layoutSpec: any;
  pageSize?: string;
  orientation?: string;
  isDefault?: boolean;
  createdBy?: string;
}

export interface DeliverableInput {
  campaignId: string;
  executionId?: string;
  templateId?: string;
  deliverableType: DeliverableType;
  status: string;
  fileName: string;
  storagePath: string;
  fileSize?: number;
  mimeType?: string;
  isWatermarked?: boolean;
  brandingApplied?: any;
  generatedBy?: string;
  sentAt?: Date;
  sentMethod?: string;
}

export class MarketingDeliverableService extends BaseService {
  private static instance: MarketingDeliverableService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingDeliverableService {
    if (!MarketingDeliverableService.instance) {
      MarketingDeliverableService.instance = new MarketingDeliverableService();
    }
    return MarketingDeliverableService.instance;
  }

  // ====================
  // DELIVERABLE TEMPLATES
  // ====================

  async createTemplate(input: DeliverableTemplateInput, ctx?: RequestCtx): Promise<any> {
    const id = generateDeliverableTemplateId();
    try {
      if (input.isDefault) {
        await this.clearDefaultForType(input.deliverableType, input.category);
      }
      const template = await this.prisma.mkt_deliverable_templates_list.create({
        data: {
          id,
          name: input.name,
          deliverable_type: input.deliverableType,
          category: input.category || null,
          version: 1,
          layout_spec: input.layoutSpec,
          page_size: input.pageSize || 'letter',
          orientation: input.orientation || 'portrait',
          is_active: true,
          is_default: input.isDefault || false,
          created_by: input.createdBy || null,
        },
      });
      logger.info('Deliverable template created', ctx, { templateId: id, name: input.name, type: input.deliverableType });
      return template;
    } catch (error) {
      logger.error('Failed to create deliverable template', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async getTemplate(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_deliverable_templates_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get deliverable template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listTemplates(filters: { deliverableType?: DeliverableType; category?: string; isActive?: boolean } = {}, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (filters.deliverableType) where.deliverable_type = filters.deliverableType;
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    try {
      return await this.prisma.mkt_deliverable_templates_list.findMany({
        where,
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });
    } catch (error) {
      logger.error('Failed to list deliverable templates', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateTemplate(id: string, input: Partial<DeliverableTemplateInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.deliverableType !== undefined) data.deliverable_type = input.deliverableType;
    if (input.category !== undefined) data.category = input.category;
    if (input.layoutSpec !== undefined) data.layout_spec = input.layoutSpec;
    if (input.pageSize !== undefined) data.page_size = input.pageSize;
    if (input.orientation !== undefined) data.orientation = input.orientation;
    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        const template = await this.prisma.mkt_deliverable_templates_list.findUnique({ where: { id } });
        if (template) {
          await this.clearDefaultForType(template.deliverable_type, template.category);
        }
      }
      data.is_default = input.isDefault;
    }

    try {
      return await this.prisma.mkt_deliverable_templates_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update deliverable template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteTemplate(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_deliverable_templates_list.delete({ where: { id } });
      logger.info('Deliverable template deleted', ctx, { templateId: id });
    } catch (error) {
      logger.error('Failed to delete deliverable template', ctx, { error: (error as Error).message, templateId: id });
      throw this.handleError(error, ctx);
    }
  }

  private async clearDefaultForType(deliverableType: string, category: string | null | undefined): Promise<void> {
    await this.prisma.mkt_deliverable_templates_list.updateMany({
      where: {
        deliverable_type: deliverableType,
        is_default: true,
        ...(category ? { category } : {}),
      },
      data: { is_default: false },
    });
  }

  // ====================
  // GENERATED DELIVERABLES
  // ====================

  async createDeliverable(input: DeliverableInput, ctx?: RequestCtx): Promise<any> {
    const id = generateDeliverableId();
    try {
      const deliverable = await this.prisma.mkt_deliverables_list.create({
        data: {
          id,
          campaign_id: input.campaignId,
          execution_id: input.executionId || null,
          template_id: input.templateId || null,
          deliverable_type: input.deliverableType,
          status: input.status,
          file_name: input.fileName,
          storage_path: input.storagePath,
          file_size: input.fileSize || null,
          mime_type: input.mimeType || 'application/pdf',
          is_watermarked: input.isWatermarked || false,
          branding_applied: input.brandingApplied || null,
          generated_by: input.generatedBy || null,
          sent_at: input.sentAt || null,
          sent_method: input.sentMethod || null,
        },
      });
      logger.info('Deliverable created', ctx, { deliverableId: id, campaignId: input.campaignId, type: input.deliverableType });
      return deliverable;
    } catch (error) {
      logger.error('Failed to create deliverable', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getDeliverable(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_deliverables_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get deliverable', ctx, { error: (error as Error).message, deliverableId: id });
      throw this.handleError(error, ctx);
    }
  }

  async listDeliverables(filters: { campaignId?: string; status?: string; deliverableType?: string } = {}, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (filters.campaignId) where.campaign_id = filters.campaignId;
    if (filters.status) where.status = filters.status;
    if (filters.deliverableType) where.deliverable_type = filters.deliverableType;
    try {
      return await this.prisma.mkt_deliverables_list.findMany({
        where,
        orderBy: { generated_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list deliverables', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async updateDeliverable(id: string, input: Partial<DeliverableInput>, ctx?: RequestCtx): Promise<any> {
    const data: any = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.fileName !== undefined) data.file_name = input.fileName;
    if (input.storagePath !== undefined) data.storage_path = input.storagePath;
    if (input.fileSize !== undefined) data.file_size = input.fileSize;
    if (input.mimeType !== undefined) data.mime_type = input.mimeType;
    if (input.isWatermarked !== undefined) data.is_watermarked = input.isWatermarked;
    if (input.brandingApplied !== undefined) data.branding_applied = input.brandingApplied;
    if (input.sentAt !== undefined) data.sent_at = input.sentAt;
    if (input.sentMethod !== undefined) data.sent_method = input.sentMethod;

    try {
      return await this.prisma.mkt_deliverables_list.update({ where: { id }, data });
    } catch (error) {
      logger.error('Failed to update deliverable', ctx, { error: (error as Error).message, deliverableId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteDeliverable(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_deliverables_list.delete({ where: { id } });
      logger.info('Deliverable deleted', ctx, { deliverableId: id });
    } catch (error) {
      logger.error('Failed to delete deliverable', ctx, { error: (error as Error).message, deliverableId: id });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PDF GENERATION
  // ====================

  async generateDeliverable(input: {
    campaignId: string;
    templateId?: string;
    executionId?: string;
    deliverableType: DeliverableType;
    isPreview: boolean;
    content?: string;
    generatedBy?: string;
  }, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
      if (!campaign) {
        throw new Error(`Campaign ${input.campaignId} not found`);
      }

      let template: any = null;
      if (input.templateId) {
        template = await this.getTemplate(input.templateId, ctx);
        if (!template) {
          throw new Error(`Template ${input.templateId} not found`);
        }
      }

      const brandingConfig = await MarketingBrandingService.getInstance().getActiveConfig(ctx);

      const orientation = template?.orientation || 'portrait';
      const pageSize = template?.page_size || 'letter';
      const doc = new jsPDF({ orientation: orientation as 'portrait' | 'landscape', unit: 'mm', format: pageSize });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 25;

      if (brandingConfig) {
        yPos = MarketingBrandingService.applyBrandingToDoc(doc, brandingConfig, {
          pageWidth,
          margin,
          startY: yPos,
        });
      }

      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(template?.name || this.formatDeliverableType(input.deliverableType), margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Campaign: ${campaign.business_name}`, margin, yPos);
      yPos += 5;
      doc.text(`${campaign.category} - ${campaign.city}`, margin, yPos);
      yPos += 5;
      const dateStr = new Date().toLocaleDateString();
      doc.text(`Generated: ${dateStr}${input.isPreview ? ' (PREVIEW)' : ''}`, margin, yPos);
      yPos += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      const content = input.content || await this.extractContentFromExecution(input.executionId, ctx);
      const layoutSpec = template?.layout_spec || this.getDefaultLayoutSpec(input.deliverableType);

      yPos = this.renderLayoutSections(doc, layoutSpec, content, {
        margin,
        pageWidth,
        pageHeight,
        yPos,
        isPreview: input.isPreview,
      });

      if (brandingConfig?.footer_disclaimer) {
        yPos = pageHeight - 25;
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        const footerLines = doc.splitTextToSize(brandingConfig.footer_disclaimer, pageWidth - 2 * margin);
        doc.text(footerLines, margin, yPos);
      }

      if (input.isPreview) {
        MarketingBrandingService.applyWatermark(doc, pageWidth, pageHeight);
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      const displayId = campaign.display_id || campaign.id.substring(0, 8);
      const fileType = input.isPreview ? 'preview' : 'paid';
      const fileName = `${displayId}_${fileType}_${dateStr.replace(/\//g, '-')}.pdf`;

      const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
      const deliverableDir = path.join(uploadDir, 'marketing-ops', input.campaignId);
      if (!fs.existsSync(deliverableDir)) {
        fs.mkdirSync(deliverableDir, { recursive: true });
      }
      const filePath = path.join(deliverableDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);

      const deliverable = await this.createDeliverable({
        campaignId: input.campaignId,
        executionId: input.executionId,
        templateId: input.templateId,
        deliverableType: input.deliverableType,
        status: input.isPreview ? 'preview' : 'paid',
        fileName,
        storagePath: `/uploads/marketing-ops/${input.campaignId}/${fileName}`,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        isWatermarked: input.isPreview,
        brandingApplied: brandingConfig ? { operatorName: brandingConfig.operator_name, primaryColor: brandingConfig.primary_color } : null,
        generatedBy: input.generatedBy,
      }, ctx);

      logger.info('Deliverable generated', ctx, {
        deliverableId: deliverable.id,
        campaignId: input.campaignId,
        type: input.deliverableType,
        isPreview: input.isPreview,
        fileSize: pdfBuffer.length,
      });

      return deliverable;
    } catch (error) {
      logger.error('Failed to generate deliverable', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getDeliverableFilePath(deliverableId: string, ctx?: RequestCtx): Promise<{ filePath: string; fileName: string; mimeType: string } | null> {
    try {
      const deliverable = await this.getDeliverable(deliverableId, ctx);
      if (!deliverable) return null;

      const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
      const fullPath = path.join(uploadDir, deliverable.storage_path.replace('/uploads/', ''));
      if (!fs.existsSync(fullPath)) return null;

      return {
        filePath: fullPath,
        fileName: deliverable.file_name,
        mimeType: deliverable.mime_type || 'application/pdf',
      };
    } catch (error) {
      logger.error('Failed to get deliverable file path', ctx, { error: (error as Error).message, deliverableId });
      throw this.handleError(error, ctx);
    }
  }

  async markAsSent(deliverableId: string, sentMethod: string, ctx?: RequestCtx): Promise<any> {
    try {
      return await this.updateDeliverable(deliverableId, {
        sentAt: new Date(),
        sentMethod,
      }, ctx);
    } catch (error) {
      logger.error('Failed to mark deliverable as sent', ctx, { error: (error as Error).message, deliverableId });
      throw this.handleError(error, ctx);
    }
  }

  private formatDeliverableType(type: DeliverableType): string {
    const labels: Record<DeliverableType, string> = {
      review_responses: 'Review Responses',
      service_menu: 'Service Menu',
      gbp_audit: 'GBP Audit Report',
      testimonial_cards: 'Testimonial Cards',
      nap_report: 'NAP Consistency Report',
      seo_content: 'SEO Content',
      lead_magnet: 'Lead Magnet',
    };
    return labels[type] || type;
  }

  private getDefaultLayoutSpec(type: DeliverableType): any {
    return {
      sections: [
        { type: 'heading', text: this.formatDeliverableType(type) },
        { type: 'body', text: 'Content will be populated from AI execution output.' },
      ],
    };
  }

  private renderLayoutSections(
    doc: jsPDF,
    layoutSpec: any,
    content: string,
    opts: { margin: number; pageWidth: number; pageHeight: number; yPos: number; isPreview: boolean },
  ): number {
    const { margin, pageWidth, pageHeight } = opts;
    let yPos = opts.yPos;
    const sections = layoutSpec?.sections || [];

    for (const section of sections) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 25;
      }

      const text = section.text || (section.type === 'body' ? String(content) : '');

      switch (section.type) {
        case 'heading':
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(text, margin, yPos);
          yPos += 8;
          break;
        case 'subheading':
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(50, 50, 50);
          doc.text(text, margin, yPos);
          yPos += 6;
          break;
        case 'body':
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
          for (const line of lines) {
            if (yPos > pageHeight - 30) {
              doc.addPage();
              yPos = 25;
            }
            doc.text(line, margin, yPos);
            yPos += 5;
          }
          yPos += 3;
          break;
        case 'divider':
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;
          break;
        case 'spacing':
          yPos += section.height || 5;
          break;
      }
    }

    return yPos;
  }

  private async extractContentFromExecution(executionId: string | undefined, ctx?: RequestCtx): Promise<string> {
    if (!executionId) return '';
    try {
      const execution = await this.prisma.mkt_prompt_executions_list.findUnique({
        where: { id: executionId },
        select: { filtered_output: true, raw_output: true },
      });
      return execution?.filtered_output || execution?.raw_output || '';
    } catch {
      return '';
    }
  }

  // ====================
  // PREVIEW TOKENS (Tenant Prospecting Channel — G2)
  // ====================

  /**
   * Shared token factory — single issuance path for ALL public CTAs
   * (QR deliverable links and demo storefront banners). The campaign_id is
   * the trust anchor: public pages carry only the token; campaign + source
   * are always resolved server-side.
   */
  async generateCampaignToken(
    campaignId: string,
    tokenType: 'deliverable' | 'demo_storefront',
    deliverableId?: string,
    expiryDays: number = 30,
    ctx?: RequestCtx
  ): Promise<any> {
    try {
      const token = await this.prisma.mkt_deliverable_preview_tokens.create({
        data: {
          id: generatePreviewTokenId(),
          campaign_id: campaignId,
          deliverable_id: deliverableId || null,
          token_type: tokenType,
          token: generatePreviewToken(),
          expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        },
      });

      logger.info('Preview token generated', ctx, { campaignId, tokenType, deliverableId, expiresAt: token.expires_at });
      return token;
    } catch (error) {
      logger.error('Failed to generate preview token', ctx, { error: (error as Error).message, campaignId, tokenType });
      throw this.handleError(error, ctx);
    }
  }

  async hasLiveTokens(campaignId: string): Promise<boolean> {
    const count = await this.prisma.mkt_deliverable_preview_tokens.count({
      where: {
        campaign_id: campaignId,
        converted_at: null,
        expires_at: { gt: new Date() },
      },
    });
    return count > 0;
  }
}

export default MarketingDeliverableService.getInstance();
