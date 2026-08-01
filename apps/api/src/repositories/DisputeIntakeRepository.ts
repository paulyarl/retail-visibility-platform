/**
 * DisputeIntakeRepository — Prisma data access for mkt_dispute_intake +
 * mkt_dispute_attachments.
 *
 * Thin data-access layer for the Recovery Management intake pipeline.
 * The S2 DisputeIntakeService composes this repository for all persistence
 * concerns; no Prisma client access leaks into controllers or the service
 * layer directly (per backend-dev-guidelines §7).
 *
 * Sprint 1 — Recovery Management Engine.
 * Tables added in migration 149_marketing_ops_recovery_intake.sql.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import {
  generateDisputeIntakeId,
  generateDisputeAttachmentId,
  generateDisputeToken,
} from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import type { RequestCtx } from '../context';

// ====================
// TYPES
// ====================

export interface CreateDisputeIntakeInput {
  campaignId: string;
  tenantId?: string;
  ttlDays?: number;
}

export interface SubmitIntakeInput {
  ownerStatement: string;
  serviceDate?: Date | null;
  proposedResolution?: string;
  statusFlag?: string;
}

export interface AddAttachmentInput {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface DisputeIntakeRecord {
  id: string;
  campaign_id: string;
  tenant_id: string | null;
  access_token: string;
  expires_at: Date;
  owner_statement: string | null;
  service_date: Date | null;
  proposed_resolution: string | null;
  status_flag: string | null;
  submitted_at: Date | null;
  viewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ====================
// REPOSITORY
// ====================

export class DisputeIntakeRepository {
  private static instance: DisputeIntakeRepository;

  private constructor() {}

  static getInstance(): DisputeIntakeRepository {
    if (!DisputeIntakeRepository.instance) {
      DisputeIntakeRepository.instance = new DisputeIntakeRepository();
    }
    return DisputeIntakeRepository.instance;
  }

  // ====================
  // CREATE
  // ====================

  async create(input: CreateDisputeIntakeInput, ctx?: RequestCtx): Promise<DisputeIntakeRecord> {
    const id = generateDisputeIntakeId();
    const accessToken = generateDisputeToken();
    const ttlDays = input.ttlDays ?? unifiedConfig.recoveryIntakeTokenTtlDays;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    try {
      const record = await prisma.mkt_dispute_intake.create({
        data: {
          id,
          campaign_id: input.campaignId,
          tenant_id: input.tenantId || null,
          access_token: accessToken,
          expires_at: expiresAt,
        },
      });
      logger.info('Dispute intake created', ctx, { intakeId: id, campaignId: input.campaignId });
      return record as unknown as DisputeIntakeRecord;
    } catch (error) {
      logger.error('Failed to create dispute intake', ctx, {
        error: (error as Error).message,
        campaignId: input.campaignId,
      });
      throw error;
    }
  }

  // ====================
  // READ
  // ====================

  async findById(id: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord | null> {
    try {
      const record = await prisma.mkt_dispute_intake.findUnique({
        where: { id },
        include: { mkt_dispute_attachments: true },
      });
      return record as unknown as DisputeIntakeRecord | null;
    } catch (error) {
      logger.error('Failed to find dispute intake by id', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  async findByToken(token: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord | null> {
    try {
      const record = await prisma.mkt_dispute_intake.findUnique({
        where: { access_token: token },
        include: { mkt_dispute_attachments: true },
      });
      if (!record) return null;
      return record as unknown as DisputeIntakeRecord;
    } catch (error) {
      logger.error('Failed to find dispute intake by token', ctx, { error: (error as Error).message });
      throw error;
    }
  }

  async findByCampaign(campaignId: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord | null> {
    try {
      const record = await prisma.mkt_dispute_intake.findUnique({
        where: { campaign_id: campaignId },
        include: { mkt_dispute_attachments: true },
      });
      return record as unknown as DisputeIntakeRecord | null;
    } catch (error) {
      logger.error('Failed to find dispute intake by campaign', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw error;
    }
  }

  // ====================
  // UPDATE
  // ====================

  async markViewed(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await prisma.mkt_dispute_intake.update({
        where: { id },
        data: { viewed_at: new Date() },
      });
    } catch (error) {
      logger.error('Failed to mark dispute intake viewed', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  async submitIntake(id: string, input: SubmitIntakeInput, ctx?: RequestCtx): Promise<DisputeIntakeRecord> {
    try {
      const record = await prisma.mkt_dispute_intake.update({
        where: { id },
        data: {
          owner_statement: input.ownerStatement,
          service_date: input.serviceDate || null,
          proposed_resolution: input.proposedResolution || null,
          status_flag: input.statusFlag || null,
          submitted_at: new Date(),
        },
      });
      logger.info('Dispute intake submitted', ctx, { intakeId: id });
      return record as unknown as DisputeIntakeRecord;
    } catch (error) {
      logger.error('Failed to submit dispute intake', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  async reissueToken(id: string, ttlDays?: number, ctx?: RequestCtx): Promise<DisputeIntakeRecord> {
    const newToken = generateDisputeToken();
    const ttl = ttlDays ?? unifiedConfig.recoveryIntakeTokenTtlDays;
    const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

    try {
      const record = await prisma.mkt_dispute_intake.update({
        where: { id },
        data: {
          access_token: newToken,
          expires_at: expiresAt,
        },
      });
      logger.info('Dispute intake token reissued', ctx, { intakeId: id });
      return record as unknown as DisputeIntakeRecord;
    } catch (error) {
      logger.error('Failed to reissue dispute intake token', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  // ====================
  // ATTACHMENTS
  // ====================

  async addAttachment(intakeId: string, input: AddAttachmentInput, ctx?: RequestCtx): Promise<any> {
    const id = generateDisputeAttachmentId();
    try {
      const record = await prisma.mkt_dispute_attachments.create({
        data: {
          id,
          dispute_intake_id: intakeId,
          file_url: input.fileUrl,
          file_name: input.fileName,
          file_type: input.fileType,
          file_size: input.fileSize || null,
        },
      });
      logger.info('Dispute attachment added', ctx, { attachmentId: id, intakeId });
      return record;
    } catch (error) {
      logger.error('Failed to add dispute attachment', ctx, { error: (error as Error).message, intakeId });
      throw error;
    }
  }

  async listAttachments(intakeId: string, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await prisma.mkt_dispute_attachments.findMany({
        where: { dispute_intake_id: intakeId },
        orderBy: { uploaded_at: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to list dispute attachments', ctx, { error: (error as Error).message, intakeId });
      throw error;
    }
  }
}

export default DisputeIntakeRepository.getInstance();
