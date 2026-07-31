/**
 * DeliverableRenderService — Wraps MarketingDeliverableService for PDF
 * and TXT rendering of the assembled deliverable.
 *
 * After assembly, the operator hits "Render" → this service:
 *   1. Assembles all approved sections via DeliverableAssemblyService
 *   2. Generates a branded PDF via MarketingDeliverableService (existing jsPDF pipeline)
 *   3. Generates a TXT export (plain text, no branding)
 *   4. Links slots and sections to the deliverable record
 *   5. Advances campaign stage: paid → delivered
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §2.6
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import * as fs from 'fs';
import * as path from 'path';
import { MarketingDeliverableService } from '../MarketingDeliverableService';
import DeliverableAssemblyService from './DeliverableAssemblyService';

export interface RenderResult {
  deliverableId: string;
  pdfPath: string;
  txtPath: string;
  fileName: string;
  fileSize: number;
}

export class DeliverableRenderService extends BaseService {
  private static instance: DeliverableRenderService;

  private constructor() { super(); }

  static getInstance(): DeliverableRenderService {
    if (!DeliverableRenderService.instance) {
      DeliverableRenderService.instance = new DeliverableRenderService();
    }
    return DeliverableRenderService.instance;
  }

  /**
   * Assemble + render the deliverable as PDF + TXT.
   * Links all approved slots and sections to the deliverable record.
   */
  async renderDeliverable(campaignId: string, ctx?: RequestCtx): Promise<RenderResult> {
    try {
      // 1. Assemble content
      const assembly = await DeliverableAssemblyService.assemble(campaignId, ctx);

      // 2. Generate branded PDF via existing MarketingDeliverableService
      const deliverable = await MarketingDeliverableService.getInstance().generateDeliverable({
        campaignId,
        deliverableType: 'review_responses',
        isPreview: false,
        content: assembly.content,
        generatedBy: ctx?.userId,
      }, ctx);

      // 3. Generate TXT export
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
      });
      const displayId = campaign?.display_id || campaignId.substring(0, 8);
      const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
      const txtFileName = `${displayId}_deliverable_${dateStr}.txt`;

      const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
      const deliverableDir = path.join(uploadDir, 'marketing-ops', campaignId);
      if (!fs.existsSync(deliverableDir)) {
        fs.mkdirSync(deliverableDir, { recursive: true });
      }
      const txtFilePath = path.join(deliverableDir, txtFileName);
      fs.writeFileSync(txtFilePath, assembly.content, 'utf-8');

      const txtStoragePath = `/uploads/marketing-ops/${campaignId}/${txtFileName}`;

      // 4. Link slots and sections to the deliverable
      await this.prisma.mkt_deliverable_review_slot.updateMany({
        where: { campaign_id: campaignId, status: 'approved' },
        data: { deliverable_id: deliverable.id },
      });
      await this.prisma.mkt_deliverable_section.updateMany({
        where: { campaign_id: campaignId, status: 'approved' },
        data: { deliverable_id: deliverable.id },
      });

      // 5. Log the TXT export path on the deliverable (store in branding_applied)
      await this.prisma.mkt_deliverables_list.update({
        where: { id: deliverable.id },
        data: {
          branding_applied: {
            ...(deliverable.branding_applied as any || {}),
            txtExportPath: txtStoragePath,
            txtFileName,
            slotCount: assembly.slotCount,
            sectionCount: assembly.sectionCount,
            skippedSlots: assembly.skippedSlots,
            skippedSections: assembly.skippedSections,
          },
        },
      });

      logger.info('Deliverable rendered', ctx, {
        campaignId,
        deliverableId: deliverable.id,
        pdfPath: deliverable.storage_path,
        txtPath: txtStoragePath,
        slotCount: assembly.slotCount,
        sectionCount: assembly.sectionCount,
      });

      return {
        deliverableId: deliverable.id,
        pdfPath: deliverable.storage_path,
        txtPath: txtStoragePath,
        fileName: deliverable.file_name,
        fileSize: deliverable.file_size ?? 0,
      };
    } catch (error) {
      logger.error('Failed to render deliverable', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }
}

export default DeliverableRenderService.getInstance();
