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
import { generateDeliverableTemplateId, generateDeliverableId } from '../lib/id-generator';

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
}

export default MarketingDeliverableService.getInstance();
