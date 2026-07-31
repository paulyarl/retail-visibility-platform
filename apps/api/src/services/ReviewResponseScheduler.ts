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
  async run(ctx?: RequestCtx): Promise<{ advanced: number; gatesChecked: number; followUpsScheduled: number; staleClosed: number; promotedToMonitoring: number }> {
    const cadenceDays = unifiedConfig.marketingOpsReviewResponseFollowUpCadenceDays;
    const staleCutoffDays = unifiedConfig.marketingOpsReviewResponseStaleThreadCutoffDays;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let advanced = 0;
    let gatesChecked = 0;
    let followUpsScheduled = 0;
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

      // 2. Follow-up scheduling + stale thread closure.
      const staleCutoffDate = new Date(today);
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

      // 3. Promote 'closed' pipelines to 'monitoring' after cadence window.
      const cadenceAgo = new Date(today);
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

      logger.info(`Review response scheduler complete: ${advanced} advanced, ${gatesChecked} gates checked, ${followUpsScheduled} follow-ups scheduled, ${staleClosed} stale closed, ${promotedToMonitoring} promoted to monitoring`, ctx, {
        advanced, gatesChecked, followUpsScheduled, staleClosed, promotedToMonitoring, cadenceDays, staleCutoffDays,
      });
      return { advanced, gatesChecked, followUpsScheduled, staleClosed, promotedToMonitoring };
    } catch (error) {
      logger.error('Review response scheduler failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}
