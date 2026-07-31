/**
 * ReviewResponseScheduler
 *
 * Runs on a configurable interval (default 6h) to:
 *   1. Check gates on all active pipelines (backlog/responding/follow_up).
 *      If a gate is met, auto-advance the stage.
 *   2. For pipelines in 'responding'/'follow_up' with open customer-reply
 *      threads past the follow-up cadence, schedule the next follow-up
 *      (set next_follow_up_at). Stale threads (older than
 *      staleThreadCutoffDays) are auto-closed with an acknowledgment
 *      expectation rather than active back-and-forth.
 *   3. For pipelines in 'closed' with no new activity, advance to
 *      'monitoring' after the follow-up cadence window passes.
 *
 * Pattern: singleton extends BaseService (mirrors
 * MarketingAutoFollowUpScheduler).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { unifiedConfig } from '../config/unifiedConfig';
import { ReviewResponseService } from './ReviewResponseService';

export class ReviewResponseScheduler extends BaseService {
  private static instance: ReviewResponseScheduler;

  private constructor() {
    super();
  }

  static getInstance(): ReviewResponseScheduler {
    if (!ReviewResponseScheduler.instance) {
      ReviewResponseScheduler.instance = new ReviewResponseScheduler();
    }
    return ReviewResponseScheduler.instance;
  }

  /**
   * Run one pass of the scheduler. Returns counts for observability.
   */
  async run(ctx?: RequestCtx): Promise<{ advanced: number; gatesChecked: number; followUpsFired: number; staleClosed: number; promotedToMonitoring: number }> {
    const cadenceDays = unifiedConfig.marketingOpsReviewResponseFollowUpCadenceDays;
    const staleCutoffDays = unifiedConfig.marketingOpsReviewResponseStaleThreadCutoffDays;
    const now = new Date();

    let advanced = 0;
    let gatesChecked = 0;
    let followUpsFired = 0;
    let staleClosed = 0;
    let promotedToMonitoring = 0;

    try {
      const service = ReviewResponseService.getInstance();

      // 1. Gate checks + auto-advance on active pipelines.
      const activePipelines = await this.prisma.mkt_review_response_pipeline.findMany({
        where: { stage: { in: ['backlog', 'responding', 'follow_up'] } },
        select: { id: true, stage: true, platform: true, campaign_id: true },
      });

      for (const pipeline of activePipelines) {
        try {
          const gate = await service.checkGate(pipeline.id, ctx);
          gatesChecked++;
          if (gate.gateMet) {
            await service.advanceStage(pipeline.id, false, ctx);
            advanced++;
          }
        } catch (err) {
          logger.error('Review response scheduler: gate check failed', ctx, {
            error: (err as Error).message,
            pipelineId: pipeline.id,
          });
        }
      }

      // 2. Fire due scheduled follow-ups (scheduled_for <= now, status='scheduled').
      // The scheduler marks them as ready for operator action by logging a
      // notification; the operator completes them via completeScheduledFollowUp.
      const dueFollowUps = await this.prisma.mkt_review_response_log.findMany({
        where: {
          status: 'scheduled',
          scheduled_for: { lte: now },
        },
        select: { id: true, pipeline_id: true },
      });

      for (const fu of dueFollowUps) {
        try {
          // Mark the scheduled follow-up as completed by the system (it's due).
          // In a full implementation, this would notify the operator; for now
          // we auto-complete so the pipeline's next_follow_up_at advances.
          await service.completeScheduledFollowUp(fu.id, undefined, ctx);
          followUpsFired++;
        } catch (err) {
          logger.error('Review response scheduler: scheduled follow-up fire failed', ctx, {
            error: (err as Error).message,
            logId: fu.id,
          });
        }
      }

      // 3. Stale thread closure.
      const staleCutoffDate = new Date(now);
      staleCutoffDate.setDate(staleCutoffDate.getDate() - staleCutoffDays);

      const openThreads = await this.prisma.mkt_review_response_log.findMany({
        where: {
          thread_closed: false,
          customer_replied: true,
          customer_reply_at: { lt: staleCutoffDate },
        },
        select: { id: true, pipeline_id: true },
      });

      for (const thread of openThreads) {
        try {
          await service.closeThread(thread.id, ctx);
          staleClosed++;
        } catch (err) {
          logger.error('Review response scheduler: stale close failed', ctx, {
            error: (err as Error).message,
            logId: thread.id,
          });
        }
      }

      // 4. Promote 'closed' pipelines to 'monitoring' after cadence window.
      const cadenceAgo = new Date(now);
      cadenceAgo.setDate(cadenceAgo.getDate() - cadenceDays);

      const closedPipelines = await this.prisma.mkt_review_response_pipeline.findMany({
        where: {
          stage: 'closed',
          last_activity_at: { lt: cadenceAgo },
        },
        select: { id: true },
      });

      for (const pipeline of closedPipelines) {
        try {
          await service.advanceStage(pipeline.id, true, ctx); // force: closed -> monitoring is a time-based promotion, not gate-based
          promotedToMonitoring++;
        } catch (err) {
          logger.error('Review response scheduler: monitoring promotion failed', ctx, {
            error: (err as Error).message,
            pipelineId: pipeline.id,
          });
        }
      }

      logger.info(`Review response scheduler complete: ${advanced} advanced, ${gatesChecked} gates checked, ${followUpsFired} follow-ups fired, ${staleClosed} stale closed, ${promotedToMonitoring} promoted to monitoring`, ctx, {
        advanced, gatesChecked, followUpsFired, staleClosed, promotedToMonitoring, cadenceDays, staleCutoffDays,
      });
      return { advanced, gatesChecked, followUpsFired, staleClosed, promotedToMonitoring };
    } catch (error) {
      logger.error('Review response scheduler failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}
