/**
 * ReviewResponseService
 *
 * Platform-agnostic review-response pipeline (Option B). Each
 * (campaign_id, platform) pair is its own pipeline row tracking a
 * gated progression:
 *
 *   backlog -> responding -> follow_up -> closed -> monitoring
 *
 * Gate criteria (enforced before a pipeline advances stage):
 *   - unanswered_count <= gateUnansweredThreshold
 *   - follow_ups_open = 0
 *   - response_rate >= gateResponseRateTarget
 *
 * Follow-up engagement is part of the gate: a customer who replied to
 * our response creates an open thread that must be closed (second touch
 * or marked thread_closed) before the platform advances. Stale threads
 * older than staleThreadCutoffDays get a single acknowledgment, not an
 * active back-and-forth.
 *
 * Pattern: singleton extends BaseService (mirrors MarketingOutreachService).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { unifiedConfig } from '../config/unifiedConfig';
import { generateReviewResponsePipelineId, generateReviewResponseLogId } from '../lib/id-generator';

export type ReviewPlatform = 'google' | 'yelp' | 'facebook' | 'other';
export type ReviewPipelineStage = 'backlog' | 'responding' | 'follow_up' | 'closed' | 'monitoring';
export type ResponseType = 'first_response' | 'follow_up' | 'acknowledgment';

export interface CreatePipelineInput {
  campaignId: string;
  platform: ReviewPlatform;
  totalReviews?: number;
  unansweredCount?: number;
  responseRate?: number;
  averageRating?: number | null;
  metadata?: Record<string, any> | null;
}

export interface UpdatePipelineMetricsInput {
  totalReviews?: number;
  unansweredCount?: number;
  responseRate?: number;
  averageRating?: number | null;
  metadata?: Record<string, any> | null;
}

export type FollowUpOutcome = 'converted_paid' | 'customer_responded' | 'no_response' | 'duplicate' | 'out_of_scope' | 'other';

export interface LogResponseInput {
  pipelineId: string;
  platformReviewId?: string;
  responseText?: string;
  responseType: ResponseType;
  respondedBy?: string;
  notes?: string;
}

export interface ScheduleFollowUpInput {
  pipelineId: string;
  scheduledFor: string; // ISO datetime
  notes?: string;
  respondedBy?: string;
}

export interface GateCheckResult {
  gateMet: boolean;
  reasons: string[];
  unansweredCount: number;
  followUpsOpen: number;
  responseRate: number;
}

const STAGE_ORDER: ReviewPipelineStage[] = ['backlog', 'responding', 'follow_up', 'closed', 'monitoring'];

export class ReviewResponseService extends BaseService {
  private static instance: ReviewResponseService;

  private constructor() {
    super();
  }

  static getInstance(): ReviewResponseService {
    if (!ReviewResponseService.instance) {
      ReviewResponseService.instance = new ReviewResponseService();
    }
    return ReviewResponseService.instance;
  }

  /**
   * Create a pipeline row for a (campaign, platform) pair. Idempotent —
   * if a pipeline already exists for the pair, returns the existing row.
   */
  async createPipeline(input: CreatePipelineInput, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });
      if (!campaign) throw new NotFoundError('Campaign not found');

      const existing = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: {
          campaign_id_platform: { campaign_id: input.campaignId, platform: input.platform },
        },
      });
      if (existing) return existing;

      const priority = unifiedConfig.marketingOpsReviewResponsePlatformPriority[input.platform] ?? 99;
      const staleCutoff = new Date();
      staleCutoff.setDate(staleCutoff.getDate() - unifiedConfig.marketingOpsReviewResponseStaleThreadCutoffDays);

      const pipeline = await this.prisma.mkt_review_response_pipeline.create({
        data: {
          id: generateReviewResponsePipelineId(),
          campaign_id: input.campaignId,
          platform: input.platform,
          stage: 'backlog',
          priority,
          total_reviews: input.totalReviews ?? 0,
          unanswered_count: input.unansweredCount ?? 0,
          response_rate: input.responseRate ?? 0,
          average_rating: input.averageRating ?? null,
          stale_thread_cutoff_at: staleCutoff,
          metadata: (input.metadata ?? undefined) as any,
        },
      });

      logger.info('Review response pipeline created', ctx, {
        campaignId: input.campaignId,
        platform: input.platform,
        pipelineId: pipeline.id,
      });
      return pipeline;
    } catch (error) {
      logger.error('Failed to create review response pipeline', ctx, {
        error: (error as Error).message,
        campaignId: input.campaignId,
        platform: input.platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List all pipelines for a campaign, ordered by priority.
   */
  async listPipelines(campaignId: string, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_review_response_pipeline.findMany({
        where: { campaign_id: campaignId },
        orderBy: { priority: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to list review response pipelines', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get a single pipeline by id.
   */
  async getPipeline(pipelineId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: pipelineId },
      });
      if (!pipeline) throw new NotFoundError('Review response pipeline not found');
      return pipeline;
    } catch (error) {
      logger.error('Failed to get review response pipeline', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Update platform metrics on a pipeline (e.g., after a sync). Does NOT
   * change stage — use checkGate / advanceStage for that.
   */
  async updateMetrics(pipelineId: string, input: UpdatePipelineMetricsInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_pipeline.findUnique({ where: { id: pipelineId } });
      if (!existing) throw new NotFoundError('Review response pipeline not found');

      const data: any = { updated_at: new Date() };
      if (input.totalReviews !== undefined) data.total_reviews = input.totalReviews;
      if (input.unansweredCount !== undefined) data.unanswered_count = input.unansweredCount;
      if (input.responseRate !== undefined) data.response_rate = input.responseRate;
      if (input.averageRating !== undefined) data.average_rating = input.averageRating;
      if (input.metadata !== undefined) data.metadata = (input.metadata ?? undefined) as any;

      const updated = await this.prisma.mkt_review_response_pipeline.update({
        where: { id: pipelineId },
        data,
      });
      return updated;
    } catch (error) {
      logger.error('Failed to update review response metrics', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Log a review response (first response, follow-up, or acknowledgment).
   * Updates pipeline rollups: unanswered_count, follow_ups_open,
   * last_activity_at, next_follow_up_at.
   */
  async logResponse(input: LogResponseInput, ctx?: RequestCtx): Promise<any> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: input.pipelineId },
      });
      if (!pipeline) throw new NotFoundError('Review response pipeline not found');

      const now = new Date();
      const log = await this.prisma.mkt_review_response_log.create({
        data: {
          id: generateReviewResponseLogId(),
          pipeline_id: input.pipelineId,
          platform_review_id: input.platformReviewId || null,
          response_text: input.responseText || null,
          response_type: input.responseType,
          responded_by: input.respondedBy || null,
          responded_at: now,
          notes: input.notes || null,
        },
      });

      // Decrement unanswered_count on a first_response (we answered one).
      let unansweredDelta = 0;
      if (input.responseType === 'first_response') {
        unansweredDelta = -1;
      }

      // Recompute rollups.
      await this.recomputeRollups(input.pipelineId, ctx, unansweredDelta);

      logger.info('Review response logged', ctx, {
        pipelineId: input.pipelineId,
        logId: log.id,
        responseType: input.responseType,
      });
      return log;
    } catch (error) {
      logger.error('Failed to log review response', ctx, { error: (error as Error).message, pipelineId: input.pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Schedule a future follow-up at a predetermined time (e.g., 48h, 1 week).
   * Creates a log row with status='scheduled' and scheduled_for set. Multiple
   * scheduled follow-ups can be queued per pipeline — the pipeline's
   * next_follow_up_at rollup becomes MIN(scheduled_for) WHERE status='scheduled'.
   */
  async scheduleFollowUp(input: ScheduleFollowUpInput, ctx?: RequestCtx): Promise<any> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: input.pipelineId },
      });
      if (!pipeline) throw new NotFoundError('Review response pipeline not found');

      const scheduledFor = new Date(input.scheduledFor);
      if (isNaN(scheduledFor.getTime())) {
        throw new Error('Invalid scheduled_for datetime');
      }

      const now = new Date();
      const log = await this.prisma.mkt_review_response_log.create({
        data: {
          id: generateReviewResponseLogId(),
          pipeline_id: input.pipelineId,
          response_type: 'follow_up',
          responded_at: now, // when the follow-up was scheduled (not when it fires)
          responded_by: input.respondedBy || null,
          notes: input.notes || null,
          scheduled_for: scheduledFor,
          status: 'scheduled',
        },
      });

      // Recompute rollups so next_follow_up_at reflects the new scheduled entry.
      await this.recomputeRollups(input.pipelineId, ctx);

      logger.info('Review response follow-up scheduled', ctx, {
        pipelineId: input.pipelineId,
        logId: log.id,
        scheduledFor: scheduledFor.toISOString(),
      });
      return log;
    } catch (error) {
      logger.error('Failed to schedule review response follow-up', ctx, { error: (error as Error).message, pipelineId: input.pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Update a scheduled follow-up's time and/or notes in place. Only works
   * on entries with status='scheduled' (completed/skipped are immutable).
   * Recomputes rollups so next_follow_up_at reflects the new time.
   */
  async updateScheduledFollowUp(logId: string, input: { scheduledFor?: string; notes?: string }, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Review response log entry not found');
      if (existing.status !== 'scheduled') {
        throw new Error(`Cannot update follow-up with status '${existing.status}' (only 'scheduled' entries can be edited)`);
      }

      const data: any = {};
      if (input.scheduledFor !== undefined) {
        const scheduledFor = new Date(input.scheduledFor);
        if (isNaN(scheduledFor.getTime())) {
          throw new Error('Invalid scheduled_for datetime');
        }
        data.scheduled_for = scheduledFor;
      }
      if (input.notes !== undefined) {
        data.notes = input.notes || null;
      }

      const updated = await this.prisma.mkt_review_response_log.update({
        where: { id: logId },
        data,
      });

      await this.recomputeRollups(existing.pipeline_id, ctx);

      logger.info('Scheduled review response follow-up updated', ctx, { logId, pipelineId: existing.pipeline_id });
      return updated;
    } catch (error) {
      logger.error('Failed to update scheduled follow-up', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Mark a scheduled follow-up as completed (the operator sent the follow-up).
   * Sets status='completed' and recomputes rollups so next_follow_up_at
   * advances to the next scheduled entry (or null if none remain).
   * If outcome='converted_paid', triggers campaign stage advancement.
   */
  async completeScheduledFollowUp(logId: string, responseText?: string, ctx?: RequestCtx, outcome?: FollowUpOutcome): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Review response log entry not found');
      if (existing.status === 'completed') return existing; // idempotent

      const now = new Date();
      const updated = await this.prisma.mkt_review_response_log.update({
        where: { id: logId },
        data: {
          status: 'completed',
          responded_at: now, // actual send time
          response_text: responseText || existing.response_text,
          outcome: outcome || null,
        },
      });

      await this.recomputeRollups(existing.pipeline_id, ctx);

      // If the customer converted to paid, advance the campaign stage.
      if (outcome === 'converted_paid') {
        await this.handlePaidConversion(existing.pipeline_id, ctx);
      }

      logger.info('Scheduled review response follow-up completed', ctx, { logId, pipelineId: existing.pipeline_id, outcome });
      return updated;
    } catch (error) {
      logger.error('Failed to complete scheduled follow-up', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Skip a scheduled follow-up (operator decided no further action needed).
   * Sets status='skipped' and recomputes rollups.
   * If outcome='converted_paid', triggers campaign stage advancement.
   */
  async skipScheduledFollowUp(logId: string, reason?: string, ctx?: RequestCtx, outcome?: FollowUpOutcome): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Review response log entry not found');
      if (existing.status !== 'scheduled') return existing; // idempotent

      const updated = await this.prisma.mkt_review_response_log.update({
        where: { id: logId },
        data: {
          status: 'skipped',
          notes: reason ? `${existing.notes || ''}\nSkipped: ${reason}`.trim() : existing.notes,
          outcome: outcome || null,
        },
      });

      await this.recomputeRollups(existing.pipeline_id, ctx);

      // If the customer converted to paid, advance the campaign stage.
      if (outcome === 'converted_paid') {
        await this.handlePaidConversion(existing.pipeline_id, ctx);
      }

      logger.info('Scheduled review response follow-up skipped', ctx, { logId, pipelineId: existing.pipeline_id, reason, outcome });
      return updated;
    } catch (error) {
      logger.error('Failed to skip scheduled follow-up', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Handle a paid conversion outcome: look up the pipeline's campaign and
   * advance its stage to 'paid' if it's in a pre-paid stage. Best-effort —
   * if the transition is invalid (e.g., already paid), we log and continue
   * without throwing, since the follow-up completion itself already succeeded.
   */
  private async handlePaidConversion(pipelineId: string, ctx?: RequestCtx): Promise<void> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: pipelineId },
        select: { campaign_id: true },
      });
      if (!pipeline) return;

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: pipeline.campaign_id },
        select: { stage: true },
      });
      if (!campaign) return;

      const currentStage = campaign.stage as string;
      const PRE_PAID_STAGES = ['seek', 'preview_built', 'shown'];
      if (!PRE_PAID_STAGES.includes(currentStage)) {
        logger.info('Review response paid conversion: campaign not in pre-paid stage, skipping stage transition', ctx, {
          pipelineId, campaignId: pipeline.campaign_id, currentStage,
        });
        return;
      }

      // Dynamically import to avoid circular dependency at module load time.
      const { MarketingCampaignService } = await import('./MarketingCampaignService.js');
      await MarketingCampaignService.getInstance().transitionStage({
        campaignId: pipeline.campaign_id,
        toStage: 'paid',
        triggerType: 'system',
        notes: `Converted via review response follow-up on ${pipelineId}`,
      }, ctx);

      logger.info('Review response paid conversion: campaign advanced to paid', ctx, {
        pipelineId, campaignId: pipeline.campaign_id, fromStage: currentStage,
      });
    } catch (error) {
      // Best-effort: don't fail the follow-up completion if the stage transition fails.
      logger.error('Review response paid conversion: stage transition failed (best-effort)', ctx, {
        error: (error as Error).message, pipelineId,
      });
    }
  }

  /**
   * Mark a customer reply on an existing log entry (the customer replied
   * to our response, creating an open follow-up thread). Sets
   * customer_replied=true and increments follow_ups_open on the pipeline.
   */
  async markCustomerReply(logId: string, customerReplyAt?: Date, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Review response log entry not found');
      if (existing.customer_replied) return existing; // idempotent

      const now = new Date();
      const updated = await this.prisma.mkt_review_response_log.update({
        where: { id: logId },
        data: {
          customer_replied: true,
          customer_reply_at: customerReplyAt ?? now,
        },
      });

      await this.prisma.mkt_review_response_pipeline.update({
        where: { id: existing.pipeline_id },
        data: {
          follow_ups_open: { increment: 1 },
          last_activity_at: now,
          updated_at: now,
        },
      });

      logger.info('Customer reply marked on review response log', ctx, { logId, pipelineId: existing.pipeline_id });
      return updated;
    } catch (error) {
      logger.error('Failed to mark customer reply', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Close a follow-up thread (operator sent the second touch or decided
   * no further action needed). Decrements follow_ups_open.
   */
  async closeThread(logId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_review_response_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Review response log entry not found');
      if (existing.thread_closed) return existing; // idempotent

      const now = new Date();
      const updated = await this.prisma.mkt_review_response_log.update({
        where: { id: logId },
        data: {
          thread_closed: true,
          thread_closed_at: now,
        },
      });

      await this.prisma.mkt_review_response_pipeline.update({
        where: { id: existing.pipeline_id },
        data: {
          follow_ups_open: { increment: -1 },
          follow_ups_completed: { increment: 1 },
          last_activity_at: now,
          updated_at: now,
        },
      });

      logger.info('Review response thread closed', ctx, { logId, pipelineId: existing.pipeline_id });
      return updated;
    } catch (error) {
      logger.error('Failed to close review response thread', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Check whether a pipeline meets the gate criteria to advance to the
   * next stage. Does NOT mutate — returns the result for the caller
   * (scheduler or UI) to act on.
   */
  async checkGate(pipelineId: string, ctx?: RequestCtx): Promise<GateCheckResult> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: pipelineId },
      });
      if (!pipeline) throw new NotFoundError('Review response pipeline not found');

      const threshold = unifiedConfig.marketingOpsReviewResponseGateUnansweredThreshold;
      const rateTarget = unifiedConfig.marketingOpsReviewResponseGateResponseRateTarget;

      const reasons: string[] = [];
      if (pipeline.unanswered_count > threshold) {
        reasons.push(`unanswered_count ${pipeline.unanswered_count} > threshold ${threshold}`);
      }
      if (pipeline.follow_ups_open > 0) {
        reasons.push(`follow_ups_open ${pipeline.follow_ups_open} > 0`);
      }
      if (pipeline.response_rate < rateTarget) {
        reasons.push(`response_rate ${pipeline.response_rate}% < target ${rateTarget}%`);
      }

      const gateMet = reasons.length === 0;

      // Persist gate state if it changed.
      if (gateMet !== pipeline.gate_met) {
        await this.prisma.mkt_review_response_pipeline.update({
          where: { id: pipelineId },
          data: {
            gate_met: gateMet,
            gate_met_at: gateMet ? new Date() : null,
            updated_at: new Date(),
          },
        });
      }

      return {
        gateMet,
        reasons,
        unansweredCount: pipeline.unanswered_count,
        followUpsOpen: pipeline.follow_ups_open,
        responseRate: pipeline.response_rate,
      };
    } catch (error) {
      logger.error('Failed to check review response gate', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Advance a pipeline to the next stage in the progression. Refuses to
   * advance if the gate is not met (unless force=true). 'monitoring' is
   * terminal — it does not advance further.
   */
  async advanceStage(pipelineId: string, force = false, ctx?: RequestCtx): Promise<any> {
    try {
      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: pipelineId },
      });
      if (!pipeline) throw new NotFoundError('Review response pipeline not found');

      const currentIdx = STAGE_ORDER.indexOf(pipeline.stage as ReviewPipelineStage);
      if (currentIdx < 0) throw new Error(`Unknown stage: ${pipeline.stage}`);
      if (pipeline.stage === 'monitoring') {
        return pipeline; // terminal
      }

      if (!force) {
        const gate = await this.checkGate(pipelineId, ctx);
        if (!gate.gateMet) {
          throw new Error(`Gate not met: ${gate.reasons.join('; ')}`);
        }
      }

      const nextStage = STAGE_ORDER[currentIdx + 1];
      const now = new Date();
      const updated = await this.prisma.mkt_review_response_pipeline.update({
        where: { id: pipelineId },
        data: {
          stage: nextStage,
          gate_met: false, // reset for the next gate
          gate_met_at: null,
          updated_at: now,
        },
      });

      logger.info('Review response pipeline advanced', ctx, {
        pipelineId,
        fromStage: pipeline.stage,
        toStage: nextStage,
        forced: force,
      });
      return updated;
    } catch (error) {
      logger.error('Failed to advance review response stage', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Recompute rollup columns on a pipeline from the log table. Called
   * after every log write. unansweredDelta is applied in addition to the
   * recomputed value (for first_response decrements).
   */
  private async recomputeRollups(pipelineId: string, ctx?: RequestCtx, unansweredDelta = 0): Promise<void> {
    try {
      const openThreads = await this.prisma.mkt_review_response_log.count({
        where: { pipeline_id: pipelineId, thread_closed: false, customer_replied: true },
      });

      // next_follow_up_at = MIN(scheduled_for) WHERE status='scheduled'
      // This supports multiple queued follow-ups at predetermined times.
      const earliestScheduled = await this.prisma.mkt_review_response_log.findFirst({
        where: { pipeline_id: pipelineId, status: 'scheduled' },
        orderBy: { scheduled_for: 'asc' },
        select: { scheduled_for: true },
      });

      const latest = await this.prisma.mkt_review_response_log.findFirst({
        where: { pipeline_id: pipelineId },
        orderBy: { responded_at: 'desc' },
      });

      const now = new Date();
      const nextFollowUp = earliestScheduled?.scheduled_for ?? null;

      const pipeline = await this.prisma.mkt_review_response_pipeline.findUnique({
        where: { id: pipelineId },
        select: { unanswered_count: true },
      });

      await this.prisma.mkt_review_response_pipeline.update({
        where: { id: pipelineId },
        data: {
          follow_ups_open: openThreads,
          last_activity_at: latest?.responded_at ?? now,
          next_follow_up_at: nextFollowUp,
          unanswered_count: Math.max(0, (pipeline?.unanswered_count ?? 0) + unansweredDelta),
          updated_at: now,
        },
      });
    } catch (error) {
      logger.error('Failed to recompute review response rollups', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List the response log for a pipeline, newest first.
   */
  async listLog(pipelineId: string, ctx?: RequestCtx, limit = 50): Promise<any[]> {
    try {
      return await this.prisma.mkt_review_response_log.findMany({
        where: { pipeline_id: pipelineId },
        orderBy: { responded_at: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to list review response log', ctx, { error: (error as Error).message, pipelineId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get pipelines with follow-ups due (for the scheduler / dashboard).
   */
  async getFollowUpsDue(opts: { from: Date; to: Date }, ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_review_response_pipeline.findMany({
        where: {
          next_follow_up_at: { gte: opts.from, lte: opts.to },
          stage: { in: ['responding', 'follow_up'] },
        },
        orderBy: { next_follow_up_at: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get review response follow-ups due', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}

export default ReviewResponseService.getInstance();
