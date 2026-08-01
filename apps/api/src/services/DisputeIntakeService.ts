/**
 * DisputeIntakeService — Recovery Management intake portal business logic.
 *
 * Composes DisputeIntakeRepository for persistence + MarketingCampaignService
 * for stage transitions. Token-gated (no account auth) — the access_token IS
 * the trust boundary, mirroring mkt_deliverable_preview_tokens.
 *
 * Sprint 2 — Recovery Management Engine.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import { DisputeIntakeRepository } from '../repositories/DisputeIntakeRepository';
import MarketingCampaignService from './MarketingCampaignService';
import type { RequestCtx } from '../context';
import type { IntakeSubmitInput } from '../validators/recovery-intake.schema';

// ====================
// TYPES
// ====================

export interface IntakeContext {
  intakeId: string;
  campaignId: string;
  businessName: string | null;
  category: string;
  city: string;
  complaintSummary: string | null;
  serviceDate: string | null;
  expiresAt: string;
  alreadySubmitted: boolean;
  expired: boolean;
}

export interface SubmitResult {
  intakeId: string;
  campaignId: string;
  stage: string;
  alreadySubmitted: boolean;
}

// ====================
// SERVICE
// ====================

export class DisputeIntakeService extends BaseService {
  private static instance: DisputeIntakeService;
  private repo: DisputeIntakeRepository;

  private constructor() {
    super();
    this.repo = DisputeIntakeRepository.getInstance();
  }

  static getInstance(): DisputeIntakeService {
    if (!DisputeIntakeService.instance) {
      DisputeIntakeService.instance = new DisputeIntakeService();
    }
    return DisputeIntakeService.instance;
  }

  // ====================
  // GENERATE INTAKE LINK
  // ====================

  async generateIntakeLink(campaignId: string, ctx?: RequestCtx): Promise<{ intakeId: string; token: string; url: string }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Reuse existing intake row if one exists (campaign_id is UNIQUE).
      // Reissue the token + reset expiry rather than creating a duplicate.
      const existing = await this.repo.findByCampaign(campaignId, ctx);
      if (existing) {
        const reissued = await this.repo.reissueToken(existing.id, undefined, ctx);
        const url = this.buildIntakeUrl(reissued.access_token);
        logger.info('Dispute intake link reissued', ctx, { campaignId, intakeId: existing.id });
        return { intakeId: existing.id, token: reissued.access_token, url };
      }

      const record = await this.repo.create({
        campaignId,
        tenantId: campaign.tenant_id || undefined,
      }, ctx);

      const url = this.buildIntakeUrl(record.access_token);
      logger.info('Dispute intake link generated', ctx, { campaignId, intakeId: record.id });
      return { intakeId: record.id, token: record.access_token, url };
    } catch (error) {
      logger.error('Failed to generate dispute intake link', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // RESOLVE INTAKE (context header for the form)
  // ====================

  async resolveIntake(token: string, ctx?: RequestCtx): Promise<IntakeContext | { expired: true } | null> {
    try {
      const record = await this.repo.findByToken(token, ctx);
      if (!record) return null;

      const now = new Date();
      const expired = record.expires_at < now;
      if (expired) {
        return { expired: true };
      }

      // Stamp viewed_at on first resolve (mirrors GET /pay handler)
      if (!record.viewed_at) {
        await this.repo.markViewed(record.id, ctx);
      }

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: record.campaign_id },
      });

      const alreadySubmitted = record.submitted_at !== null;

      return {
        intakeId: record.id,
        campaignId: record.campaign_id,
        businessName: campaign?.business_name || null,
        category: campaign?.category || '',
        city: campaign?.city || '',
        complaintSummary: record.owner_statement || null,
        serviceDate: record.service_date ? record.service_date.toISOString().split('T')[0] : null,
        expiresAt: record.expires_at.toISOString(),
        alreadySubmitted,
        expired: false,
      };
    } catch (error) {
      logger.error('Failed to resolve dispute intake', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // SUBMIT INTAKE
  // ====================

  async submitIntake(input: IntakeSubmitInput, ctx?: RequestCtx): Promise<SubmitResult> {
    try {
      const record = await this.repo.findByToken(input.token, ctx);
      if (!record) {
        throw new Error('Invalid or expired token');
      }

      const now = new Date();
      if (record.expires_at < now) {
        throw new Error('Token has expired');
      }

      // Idempotency: if already submitted, return the existing submission
      // without re-persisting or re-transitioning.
      if (record.submitted_at) {
        const campaign = await this.prisma.mkt_campaigns_list.findUnique({
          where: { id: record.campaign_id },
        });
        logger.info('Dispute intake double-submit blocked (idempotent)', ctx, { intakeId: record.id });
        return {
          intakeId: record.id,
          campaignId: record.campaign_id,
          stage: campaign?.stage || 'intake_submitted',
          alreadySubmitted: true,
        };
      }

      // Persist the submission
      await this.repo.submitIntake(record.id, {
        ownerStatement: input.ownerStatement,
        serviceDate: input.serviceDate || null,
        proposedResolution: input.proposedResolution,
        statusFlag: input.statusFlag || undefined,
      }, ctx);

      // Transition the campaign to intake_submitted
      const updated = await MarketingCampaignService.getInstance().transitionStage({
        campaignId: record.campaign_id,
        toStage: 'intake_submitted',
        triggerType: 'system',
        notes: 'Owner submitted dispute intake',
      }, ctx);

      // S3 stub: enqueue recovery resolution job (body implemented in S3)
      // For now, just log that the job would be enqueued.
      logger.info('Dispute intake submitted — recovery resolution job would be enqueued (S3 stub)', ctx, {
        intakeId: record.id,
        campaignId: record.campaign_id,
      });

      return {
        intakeId: record.id,
        campaignId: record.campaign_id,
        stage: updated.stage,
        alreadySubmitted: false,
      };
    } catch (error) {
      logger.error('Failed to submit dispute intake', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // REISSUE LINK
  // ====================

  async reissueLink(campaignId: string, ctx?: RequestCtx): Promise<{ intakeId: string; token: string; url: string }> {
    try {
      const existing = await this.repo.findByCampaign(campaignId, ctx);
      if (!existing) {
        // No intake row yet — generate a fresh one
        return this.generateIntakeLink(campaignId, ctx);
      }

      const reissued = await this.repo.reissueToken(existing.id, undefined, ctx);
      const url = this.buildIntakeUrl(reissued.access_token);
      logger.info('Dispute intake link reissued via reissue endpoint', ctx, { campaignId, intakeId: existing.id });
      return { intakeId: existing.id, token: reissued.access_token, url };
    } catch (error) {
      logger.error('Failed to reissue dispute intake link', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // UPLOAD ATTACHMENT
  // ====================

  async uploadAttachment(
    token: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    ctx?: RequestCtx,
  ): Promise<{ attachmentId: string; fileUrl: string; fileName: string; fileType: string; fileSize: number }> {
    try {
      const record = await this.repo.findByToken(token, ctx);
      if (!record) {
        throw new Error('Invalid or expired token');
      }

      const now = new Date();
      if (record.expires_at < now) {
        throw new Error('Token has expired');
      }

      if (record.submitted_at) {
        throw new Error('Cannot upload attachments after submission');
      }

      // Upload to Supabase DISPUTES bucket
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = unifiedConfig.supabaseUrl;
      const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Storage backend not configured');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { StorageBuckets } = await import('../storage-config');
      const { mimeToFileType } = await import('../validators/recovery-intake.schema');

      const fileType = mimeToFileType(file.mimetype);
      const pathKey = `intake-${record.id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from(StorageBuckets.DISPUTES.name)
        .upload(pathKey, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const attachment = await this.repo.addAttachment(record.id, {
        fileUrl: pathKey,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
      }, ctx);

      logger.info('Dispute attachment uploaded', ctx, {
        intakeId: record.id,
        attachmentId: attachment.id,
        fileName: file.originalname,
      });

      return {
        attachmentId: attachment.id,
        fileUrl: pathKey,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
      };
    } catch (error) {
      logger.error('Failed to upload dispute attachment', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DOWNLOAD ATTACHMENT
  // ====================

  async downloadAttachment(token: string, attachmentId: string, ctx?: RequestCtx): Promise<{ buffer: Buffer; fileName: string; fileType: string } | null> {
    try {
      const record = await this.repo.findByToken(token, ctx);
      if (!record) return null;

      const now = new Date();
      if (record.expires_at < now && !record.submitted_at) {
        return null;
      }

      const attachments = await this.repo.listAttachments(record.id, ctx);
      const attachment = attachments.find((a: any) => a.id === attachmentId);
      if (!attachment) return null;

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = unifiedConfig.supabaseUrl;
      const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Storage backend not configured');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { StorageBuckets } = await import('../storage-config');

      const { data, error: downloadError } = await supabase.storage
        .from(StorageBuckets.DISPUTES.name)
        .download(attachment.file_url);

      if (downloadError || !data) {
        throw new Error(`Storage download failed: ${downloadError?.message || 'no data'}`);
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return {
        buffer,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
      };
    } catch (error) {
      logger.error('Failed to download dispute attachment', ctx, {
        error: (error as Error).message,
        attachmentId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  private buildIntakeUrl(token: string): string {
    const webUrl = unifiedConfig.webUrl;
    return `${webUrl}/recovery/intake?token=${encodeURIComponent(token)}`;
  }
}

export default DisputeIntakeService.getInstance();
