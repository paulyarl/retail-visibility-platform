/**
 * MarketingAutoFollowUpScheduler
 *
 * For hot prospects in `preview_built`/`shown` whose latest contact had a
 * no-response outcome and whose `next_follow_up_at` is null/past, this
 * scheduler automatically writes a new outreach log entry with
 * `outcome = 'auto_follow_up_scheduled'` and a `follow_up_date` at the
 * configured cadence (default 3 days). After `maxAutoFollowUps` (default
 * 5), the campaign is flagged `hot_prospect_deprioritized` and the
 * scheduler stops.
 *
 * Reuses Sprint 2's `MarketingOutreachService.logContact` so rollups +
 * dashboard machinery work unchanged.
 *
 * Pattern: singleton extends BaseService.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { unifiedConfig } from '../config/unifiedConfig';
import { MarketingOutreachService } from './MarketingOutreachService';

const NO_RESPONSE_OUTCOMES = new Set(['no_answer', 'left_message', 'seed_outreach_scheduled']);

export class MarketingAutoFollowUpScheduler extends BaseService {
  private static instance: MarketingAutoFollowUpScheduler;

  private constructor() {
    super();
  }

  static getInstance(): MarketingAutoFollowUpScheduler {
    if (!MarketingAutoFollowUpScheduler.instance) {
      MarketingAutoFollowUpScheduler.instance = new MarketingAutoFollowUpScheduler();
    }
    return MarketingAutoFollowUpScheduler.instance;
  }

  /**
   * Run one pass of the auto-follow-up scheduler. Returns counts for
   * observability. Idempotent within a single day — will not create
   * duplicate `auto_follow_up_scheduled` entries for the same campaign.
   */
  async run(ctx?: RequestCtx): Promise<{ scheduled: number; skipped: number; deprioritized: number }> {
    const cadenceDays = unifiedConfig.marketingOpsAutoFollowUpCadenceDays;
    const maxAuto = unifiedConfig.marketingOpsMaxAutoFollowUps;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let scheduled = 0;
    let skipped = 0;
    let deprioritized = 0;

    try {
      const hotProspects = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          is_hot_prospect: true,
          hot_prospect_deprioritized: false,
          cascade_enabled: false, // skip cascade-opted campaigns — ReviewCascadeService handles them
          stage: { in: ['preview_built', 'shown'] },
        },
        select: {
          id: true,
          business_name: true,
          auto_followup_count: true,
          next_follow_up_at: true,
          last_contact_channel: true,
          stage: true,
        },
      });

      for (const campaign of hotProspects) {
        try {
          // Skip if next_follow_up_at is in the future — a follow-up is already scheduled
          const nextFu = campaign.next_follow_up_at ? new Date(campaign.next_follow_up_at) : null;
          if (nextFu && nextFu > today) {
            skipped++;
            continue;
          }

          // Idempotency: skip if an auto_follow_up_scheduled entry already exists with follow_up_date >= today
          const existingAuto = await this.prisma.mkt_outreach_log.findFirst({
            where: {
              campaign_id: campaign.id,
              outcome: 'auto_follow_up_scheduled',
              follow_up_date: { gte: today },
            },
            select: { id: true },
          });
          if (existingAuto) {
            skipped++;
            continue;
          }

          // Fetch the latest outreach log entry to check the outcome
          const latestContact = await this.prisma.mkt_outreach_log.findFirst({
            where: { campaign_id: campaign.id },
            orderBy: { contact_date: 'desc' },
          });

          // Determine if the latest contact was a no-response
          const isNoResponse = latestContact
            ? NO_RESPONSE_OUTCOMES.has(latestContact.outcome)
              || (latestContact.outcome === 'callback_scheduled'
                && latestContact.follow_up_date
                && new Date(latestContact.follow_up_date) < today
                && !latestContact.follow_up_completed_at)
            : false;

          // If there's no contact at all, we can still schedule (first touch)
          // but only if the campaign is hot — the operator should reach out.
          // However, the spec says "latest contact had a no-response outcome"
          // — so if no contact exists, skip (operator hasn't tried yet).
          if (latestContact && !isNoResponse) {
            skipped++;
            continue;
          }
          if (!latestContact) {
            skipped++;
            continue;
          }

          const followUpDate = new Date(today);
          followUpDate.setDate(followUpDate.getDate() + cadenceDays);
          const newCount = (campaign.auto_followup_count ?? 0) + 1;
          const channel = (campaign.last_contact_channel || latestContact.contact_channel) as any;

          await MarketingOutreachService.getInstance().logContact({
            campaignId: campaign.id,
            contactChannel: channel,
            contactDate: today.toISOString().split('T')[0],
            outcome: 'auto_follow_up_scheduled',
            followUpDate: followUpDate.toISOString().split('T')[0],
            contactedBy: 'system',
            notes: `Auto-scheduled follow-up (hot prospect, attempt ${newCount})`,
          }, ctx);

          // Increment count; deprioritize if cap reached
          if (newCount >= maxAuto) {
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaign.id },
              data: {
                auto_followup_count: newCount,
                hot_prospect_deprioritized: true,
              },
            });
            deprioritized++;
            logger.info('Hot prospect deprioritized after reaching auto-follow-up cap', ctx, {
              campaignId: campaign.id,
              count: newCount,
              maxAuto,
            });
          } else {
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaign.id },
              data: { auto_followup_count: newCount },
            });
          }

          scheduled++;
        } catch (err) {
          logger.error('Auto-follow-up scheduler: campaign failed', ctx, {
            error: (err as Error).message,
            campaignId: campaign.id,
          });
          skipped++;
        }
      }

      logger.info(`Auto-follow-up scheduler complete: ${scheduled} scheduled, ${skipped} skipped, ${deprioritized} deprioritized`, ctx, { scheduled, skipped, deprioritized, cadenceDays, maxAuto });
      return { scheduled, skipped, deprioritized };
    } catch (error) {
      logger.error('Auto-follow-up scheduler failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}
