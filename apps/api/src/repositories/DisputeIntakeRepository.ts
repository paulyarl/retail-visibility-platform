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
  generateIntakeShortCode,
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
  intakeKind?: string;
}

export interface SubmitIntakeInput {
  ownerStatement: string;
  ownerEmail: string;
  ownerPhone?: string | null;
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
  owner_email: string | null;
  owner_phone: string | null;
  service_date: Date | null;
  proposed_resolution: string | null;
  status_flag: string | null;
  submitted_at: Date | null;
  viewed_at: Date | null;
  intake_kind: string;
  evidence_payload: any;
  short_code: string | null;
  viewed_count: number;
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

    // Mint a 6-char short code for tracked /i/{code} links. Retry on the
    // partial-unique index — 32^6 ≈ 1B codes, collisions are rare but cheap
    // to retry.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = generateIntakeShortCode();
      try {
        const record = await prisma.mkt_dispute_intake.create({
          data: {
            id,
            campaign_id: input.campaignId,
            tenant_id: input.tenantId || null,
            access_token: accessToken,
            expires_at: expiresAt,
            intake_kind: input.intakeKind || 'dispute',
            short_code: shortCode,
          },
        });
        logger.info('Dispute intake created', ctx, { intakeId: id, campaignId: input.campaignId });
        return record as unknown as DisputeIntakeRecord;
      } catch (error: any) {
        lastError = error;
        const isShortCodeCollision =
          error?.code === 'P2002' &&
          String(error?.meta?.target ?? '').includes('short_code');
        if (!isShortCodeCollision) break;
        logger.warn('Intake short code collision — retrying', ctx, { attempt });
      }
    }

    logger.error('Failed to create dispute intake', ctx, {
      error: (lastError as Error)?.message,
      campaignId: input.campaignId,
    });
    throw lastError;
  }

  /**
   * Mint (or return the existing) short code for an intake row. Used to
   * backfill rows created before migration 301.
   */
  async ensureShortCode(id: string, ctx?: RequestCtx): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = generateIntakeShortCode();
      try {
        const record = await prisma.mkt_dispute_intake.update({
          where: { id, short_code: null },
          data: { short_code: shortCode },
        });
        return record.short_code;
      } catch (error: any) {
        // P2025 = row not matched (already has a code) — read it back
        if (error?.code === 'P2025') {
          const existing = await prisma.mkt_dispute_intake.findUnique({
            where: { id },
            select: { short_code: true },
          });
          return existing?.short_code ?? null;
        }
        const isShortCodeCollision =
          error?.code === 'P2002' &&
          String(error?.meta?.target ?? '').includes('short_code');
        if (!isShortCodeCollision) {
          logger.error('Failed to mint intake short code', ctx, {
            error: error?.message,
            intakeId: id,
          });
          throw error;
        }
      }
    }
    return null;
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

  async findByCampaign(campaignId: string, intakeKind?: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord | null> {
    try {
      // campaign_id is no longer UNIQUE (composite UNIQUE(campaign_id, intake_kind)
      // as of migration 173). Use findFirst with optional kind filter.
      const record = await prisma.mkt_dispute_intake.findFirst({
        where: intakeKind
          ? { campaign_id: campaignId, intake_kind: intakeKind }
          : { campaign_id: campaignId },
        include: { mkt_dispute_attachments: true },
        orderBy: { created_at: 'asc' },
      });
      return record as unknown as DisputeIntakeRecord | null;
    } catch (error) {
      logger.error('Failed to find dispute intake by campaign', ctx, {
        error: (error as Error).message,
        campaignId,
        intakeKind,
      });
      throw error;
    }
  }

  async findByShortCode(shortCode: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord | null> {
    try {
      const record = await prisma.mkt_dispute_intake.findFirst({
        where: { short_code: shortCode },
        include: { mkt_dispute_attachments: true },
      });
      return record as unknown as DisputeIntakeRecord | null;
    } catch (error) {
      logger.error('Failed to find dispute intake by short code', ctx, { error: (error as Error).message });
      throw error;
    }
  }

  async findAllByCampaign(campaignId: string, ctx?: RequestCtx): Promise<DisputeIntakeRecord[]> {
    try {
      const records = await prisma.mkt_dispute_intake.findMany({
        where: { campaign_id: campaignId },
        include: { mkt_dispute_attachments: true },
        orderBy: { created_at: 'asc' },
      });
      return records as unknown as DisputeIntakeRecord[];
    } catch (error) {
      logger.error('Failed to find all dispute intakes by campaign', ctx, {
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

  /**
   * Record an intake-link open: viewed_at stamps the first open (mirrors
   * markViewed), viewed_count increments on every open (migration 301).
   */
  async recordView(id: string, isFirstView: boolean, ctx?: RequestCtx): Promise<void> {
    try {
      await prisma.mkt_dispute_intake.update({
        where: { id },
        data: {
          viewed_count: { increment: 1 },
          ...(isFirstView ? { viewed_at: new Date() } : {}),
        },
      });
    } catch (error) {
      logger.error('Failed to record intake view', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  /**
   * Backfill tenant_id on an intake row that was created before the
   * campaign's seed link (or tenant) existed. No-op when the row already
   * carries a tenant.
   */
  async backfillTenantId(id: string, tenantId: string, ctx?: RequestCtx): Promise<void> {
    try {
      await prisma.mkt_dispute_intake.update({
        where: { id },
        data: { tenant_id: tenantId },
      });
    } catch (error) {
      logger.error('Failed to backfill intake tenant', ctx, { error: (error as Error).message, intakeId: id });
      throw error;
    }
  }

  async submitIntake(id: string, input: SubmitIntakeInput, ctx?: RequestCtx): Promise<DisputeIntakeRecord> {
    try {
      const record = await prisma.mkt_dispute_intake.update({
        where: { id },
        data: {
          owner_statement: input.ownerStatement,
          owner_email: input.ownerEmail,
          owner_phone: input.ownerPhone || null,
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
