/**
 * MarketingFileService — File attachment metadata CRUD for campaigns
 *
 * Manages metadata for files attached to campaigns (previews, deliverables,
 * runsheets, invoices, audit outputs). Actual file storage uses existing
 * platform upload infrastructure.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateMarketingFileId } from '../lib/id-generator';
import type { BriefingTopicSnapshot } from '../lib/briefing-topics';

export interface FileInput {
  campaignId: string;
  fileType: string;
  fileName: string;
  storagePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  /** Resolved briefing-topic snapshot (lib/briefing-topics) — NULL leaves the
   *  screenshot untagged ("General"). */
  briefingTopic?: BriefingTopicSnapshot | null;
}

export class MarketingFileService extends BaseService {
  private static instance: MarketingFileService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingFileService {
    if (!MarketingFileService.instance) {
      MarketingFileService.instance = new MarketingFileService();
    }
    return MarketingFileService.instance;
  }

  async createFile(input: FileInput, ctx?: RequestCtx): Promise<any> {
    const id = generateMarketingFileId();
    try {
      const file = await this.prisma.mkt_files_list.create({
        data: {
          id,
          campaign_id: input.campaignId,
          file_type: input.fileType,
          file_name: input.fileName,
          storage_path: input.storagePath,
          file_size: input.fileSize || null,
          mime_type: input.mimeType || null,
          uploaded_by: input.uploadedBy || null,
          briefing_topic: (input.briefingTopic ?? null) as any,
        },
      });
      logger.info('Marketing file created', ctx, { fileId: id, campaignId: input.campaignId, fileType: input.fileType });
      return file;
    } catch (error) {
      logger.error('Failed to create file', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getFilesByCampaign(campaignId: string, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_files_list.findMany({
        where: { campaign_id: campaignId },
        orderBy: { uploaded_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list files', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Re-tag (or clear, topic = null) a screenshot's briefing-topic link.
   * The caller resolves the {auditId, kind, index} ref into a snapshot —
   * this method only persists.
   */
  async setBriefingTopic(
    id: string,
    topic: BriefingTopicSnapshot | null,
    ctx?: RequestCtx,
  ): Promise<any> {
    try {
      const file = await this.prisma.mkt_files_list.update({
        where: { id },
        data: { briefing_topic: topic as any },
      });
      logger.info('Marketing file briefing topic updated', ctx, { fileId: id, tagged: topic != null });
      return file;
    } catch (error) {
      logger.error('Failed to update file briefing topic', ctx, { error: (error as Error).message, fileId: id });
      throw this.handleError(error, ctx);
    }
  }

  async deleteFile(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_files_list.delete({ where: { id } });
      logger.info('Marketing file deleted', ctx, { fileId: id });
    } catch (error) {
      logger.error('Failed to delete file', ctx, { error: (error as Error).message, fileId: id });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingFileService.getInstance();
