/**
 * MarketingOutreachService
 *
 * Per-campaign outreach log + follow-up rollups for the Marketing Ops
 * pipeline. Tracks each contact attempt during `preview_built`/`shown`
 * (channel, date, outcome, message + fresh-data snapshot) and maintains
 * rollup columns (`last_contacted_at`, `next_follow_up_at`,
 * `last_contact_channel`) on the campaign for at-a-glance visibility.
 *
 * Design constraints (see sprint plan §14):
 *  - `next_follow_up_at` = latest open follow-up (min follow_up_date where
 *    follow_up_completed_at IS NULL); cleared when a new contact fulfills it
 *  - `buildFreshSnapshot` re-fetches audit data so every preview uses fresh
 *    data, not stale campaign columns
 *  - Soft-fail on audit miss: returns partial snapshot
 *
 * Pattern: singleton extends BaseService (mirrors MarketingCampaignService).
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import { generateOutreachLogId } from '../lib/id-generator';

export type ContactChannel = 'phone' | 'email' | 'website' | 'social' | 'in_person' | 'other';
export type ContactOutcome = 'reached' | 'no_answer' | 'left_message' | 'interested' | 'not_interested' | 'callback_scheduled' | 'other' | 'auto_follow_up_scheduled';

export interface LogContactInput {
  campaignId: string;
  contactChannel: ContactChannel;
  contactDate: string; // ISO date (YYYY-MM-DD)
  outcome: ContactOutcome;
  followUpDate?: string; // ISO date (YYYY-MM-DD), optional
  notes?: string;
  messageSnapshot?: string;
  messageSubject?: string;
  previewToken?: string;
  contactedBy?: string;
}

export interface FreshSnapshot {
  dataSnapshot: {
    review_count?: number;
    average_rating?: number | null;
    unaddressed_reviews?: number;
    last_review_date?: string | null;
    gbp_claimed?: boolean;
    photo_count?: number;
  } | null;
  dataFreshAt: Date;
}

export interface FollowUpsDueResult {
  overdue: FollowUpEntry[];
  dueToday: FollowUpEntry[];
  thisWeek: FollowUpEntry[];
}

export interface FollowUpEntry {
  campaign_id: string;
  business_name: string | null;
  next_follow_up_at: string;
  days_overdue?: number;
  assigned_to: string | null;
}

export class MarketingOutreachService extends BaseService {
  private static instance: MarketingOutreachService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingOutreachService {
    if (!MarketingOutreachService.instance) {
      MarketingOutreachService.instance = new MarketingOutreachService();
    }
    return MarketingOutreachService.instance;
  }

  /**
   * Log a contact attempt. Inserts the log row, captures a fresh-data
   * snapshot server-side, updates campaign rollups, and marks any prior
   * open follow-up as completed (this contact fulfills it).
   */
  async logContact(input: LogContactInput, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: input.campaignId },
        select: { id: true, stage: true },
      });
      if (!campaign) throw new NotFoundError('Campaign not found');

      // Capture fresh-data snapshot at log time so the historical record
      // reflects the data that was true when the operator reached out.
      const { dataSnapshot, dataFreshAt } = await this.buildFreshSnapshot(input.campaignId, ctx);

      const now = new Date();
      const contactDate = new Date(input.contactDate);
      const followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;

      // Mark any prior open follow-up as completed by this contact.
      const priorOpenFollowUp = await this.prisma.mkt_outreach_log.findFirst({
        where: {
          campaign_id: input.campaignId,
          follow_up_date: { not: null },
          follow_up_completed_at: null,
        },
        orderBy: { follow_up_date: 'asc' },
      });

      const log = await this.prisma.mkt_outreach_log.create({
        data: {
          id: generateOutreachLogId(),
          campaign_id: input.campaignId,
          stage_at_time: campaign.stage as string,
          contact_channel: input.contactChannel,
          contact_date: contactDate,
          outcome: input.outcome,
          follow_up_date: followUpDate,
          notes: input.notes || null,
          contacted_by: input.contactedBy || null,
          message_snapshot: input.messageSnapshot || null,
          message_subject: input.messageSubject || null,
          data_snapshot: (dataSnapshot ?? undefined) as any,
          data_fresh_at: dataFreshAt,
          preview_token: input.previewToken || null,
        },
      });

      if (priorOpenFollowUp) {
        await this.prisma.mkt_outreach_log.update({
          where: { id: priorOpenFollowUp.id },
          data: { follow_up_completed_at: now },
        });
      }

      // Update campaign rollups.
      await this.recomputeRollups(input.campaignId, ctx);
      await this.prisma.mkt_campaigns_list.update({
        where: { id: input.campaignId },
        data: {
          last_contacted_at: now,
          last_contact_channel: input.contactChannel,
        },
      });

      logger.info('Outreach contact logged', ctx, {
        campaignId: input.campaignId,
        logId: log.id,
        channel: input.contactChannel,
        outcome: input.outcome,
        followUp: !!followUpDate,
      });
      return log;
    } catch (error) {
      logger.error('Failed to log outreach contact', ctx, { error: (error as Error).message, campaignId: input.campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List the outreach log for a campaign, newest first.
   */
  async listLog(campaignId: string, ctx?: RequestCtx, limit = 50): Promise<any[]> {
    try {
      return await this.prisma.mkt_outreach_log.findMany({
        where: { campaign_id: campaignId },
        orderBy: { contact_date: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to list outreach log', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Edit a log entry (notes, outcome, follow-up date). Recomputes rollups
   * if the follow-up date changed.
   */
  async editLog(logId: string, input: Partial<Pick<LogContactInput, 'contactChannel' | 'contactDate' | 'outcome' | 'followUpDate' | 'notes' | 'messageSnapshot' | 'messageSubject' | 'previewToken'>>, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_outreach_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Outreach log entry not found');

      const data: any = {};
      if (input.contactChannel !== undefined) data.contact_channel = input.contactChannel;
      if (input.contactDate !== undefined) data.contact_date = new Date(input.contactDate);
      if (input.outcome !== undefined) data.outcome = input.outcome;
      if (input.notes !== undefined) data.notes = input.notes || null;
      if (input.messageSnapshot !== undefined) data.message_snapshot = input.messageSnapshot || null;
      if (input.messageSubject !== undefined) data.message_subject = input.messageSubject || null;
      if (input.previewToken !== undefined) data.preview_token = input.previewToken || null;
      const followUpChanged = input.followUpDate !== undefined;
      if (followUpChanged) data.follow_up_date = input.followUpDate ? new Date(input.followUpDate) : null;

      const updated = await this.prisma.mkt_outreach_log.update({
        where: { id: logId },
        data,
      });

      if (followUpChanged) {
        await this.recomputeRollups(existing.campaign_id, ctx);
      }
      return updated;
    } catch (error) {
      logger.error('Failed to edit outreach log', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Delete a log entry. Recomputes rollups.
   */
  async deleteLog(logId: string, ctx?: RequestCtx): Promise<void> {
    try {
      const existing = await this.prisma.mkt_outreach_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Outreach log entry not found');
      await this.prisma.mkt_outreach_log.delete({ where: { id: logId } });
      await this.recomputeRollups(existing.campaign_id, ctx);
    } catch (error) {
      logger.error('Failed to delete outreach log', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Mark a follow-up as completed (operator actioned it). Recomputes
   * `next_follow_up_at` to the next open follow-up (or null).
   */
  async completeFollowUp(logId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_outreach_log.findUnique({ where: { id: logId } });
      if (!existing) throw new NotFoundError('Outreach log entry not found');

      const updated = await this.prisma.mkt_outreach_log.update({
        where: { id: logId },
        data: { follow_up_completed_at: new Date() },
      });

      await this.recomputeRollups(existing.campaign_id, ctx);
      return updated;
    } catch (error) {
      logger.error('Failed to complete follow-up', ctx, { error: (error as Error).message, logId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Recompute `next_follow_up_at` = min(follow_up_date) where
   * follow_up_completed_at IS NULL. Used after every log write/edit/delete.
   */
  async recomputeRollups(campaignId: string, _ctx?: RequestCtx): Promise<void> {
    const nextOpen = await this.prisma.mkt_outreach_log.findFirst({
      where: {
        campaign_id: campaignId,
        follow_up_date: { not: null },
        follow_up_completed_at: null,
      },
      orderBy: { follow_up_date: 'asc' },
    });
    await this.prisma.mkt_campaigns_list.update({
      where: { id: campaignId },
      data: { next_follow_up_at: nextOpen?.follow_up_date ?? null },
    });
  }

  /**
   * Re-fetch the campaign's latest audit data so every preview uses fresh
   * data, not stale campaign columns. Returns a snapshot object + the
   * fetch timestamp. Soft-fails to null snapshot if no audits exist.
   */
  async buildFreshSnapshot(campaignId: string, _ctx?: RequestCtx): Promise<FreshSnapshot> {
    const latestAudit = await this.prisma.mkt_audits_list.findFirst({
      where: { campaign_id: campaignId },
      orderBy: { created_at: 'desc' },
    });

    if (!latestAudit) {
      return { dataSnapshot: null, dataFreshAt: new Date() };
    }

    return {
      dataSnapshot: {
        review_count: latestAudit.review_count,
        average_rating: latestAudit.average_rating ? Number(latestAudit.average_rating) : null,
        unaddressed_reviews: latestAudit.unaddressed_reviews,
        last_review_date: null, // not stored on audit row; available in audit_data if needed
        gbp_claimed: latestAudit.claimed,
        photo_count: latestAudit.photo_count,
      },
      dataFreshAt: new Date(),
    };
  }

  /**
   * Returns campaigns with `next_follow_up_at` in [from, to] AND stage IN
   * (preview_built, shown), grouped into overdue / dueToday / thisWeek
   * buckets for the dashboard widget.
   */
  async getFollowUpsDue(opts: { from: Date; to: Date; assignedTo?: string }, ctx?: RequestCtx): Promise<FollowUpsDueResult> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const where: any = {
        stage: { in: ['preview_built', 'shown'] },
        next_follow_up_at: { not: null },
      };
      if (opts.assignedTo) where.assigned_to = opts.assignedTo;

      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where,
        select: {
          id: true,
          business_name: true,
          next_follow_up_at: true,
          assigned_to: true,
        },
        orderBy: { next_follow_up_at: 'asc' },
      });

      const overdue: FollowUpEntry[] = [];
      const dueToday: FollowUpEntry[] = [];
      const thisWeek: FollowUpEntry[] = [];

      for (const c of campaigns) {
        const fu = c.next_follow_up_at ? new Date(c.next_follow_up_at) : null;
        if (!fu) continue;
        fu.setHours(0, 0, 0, 0);
        const entry: FollowUpEntry = {
          campaign_id: c.id,
          business_name: c.business_name,
          next_follow_up_at: c.next_follow_up_at as unknown as string,
          assigned_to: c.assigned_to,
        };
        if (fu < today) {
          entry.days_overdue = Math.round((today.getTime() - fu.getTime()) / (24 * 60 * 60 * 1000));
          overdue.push(entry);
        } else if (fu.getTime() === today.getTime()) {
          dueToday.push(entry);
        } else if (fu >= today && fu <= opts.to) {
          thisWeek.push(entry);
        }
      }

      return { overdue, dueToday, thisWeek };
    } catch (error) {
      logger.error('Failed to get follow-ups due', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }
}
