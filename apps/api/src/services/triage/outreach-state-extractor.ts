/**
 * OutreachStateSignalExtractor — derives OX_* signals from outreach tables
 *
 * Unlike the prospect-problem signal extractor (signal-extractor.ts) which
 * reads audit_data JSON, this extractor queries the outreach execution
 * tables (mkt_outreach_openers_list, mkt_outreach_pitches_list,
 * mkt_outreach_log) and derives outreach-state signals:
 *   OX_OPENER_SENT, OX_FOLLOWUP_SENT, OX_PITCH_ASSEMBLED,
 *   OX_NO_REPLY_AFTER_OPENER, OX_NO_REPLY_AFTER_FOLLOWUP_N,
 *   OX_CONTACT_LOGGED
 *
 * These signals are DISPLAY-ONLY in the triage card. They do NOT feed
 * playbook rule evaluation (the triage engine skips OX_* signals).
 *
 * Pattern: singleton extends BaseService (mirrors signal-extractor pattern
 * but with DB access since it reads live outreach state).
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md §5.2
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import type { SignalCode } from './signal-taxonomy';

// ─── Types ──────────────────────────────────────────────────────────────

export interface OutreachState {
  /** Count of openers (message_type IS NULL) for the campaign */
  openerCount: number;
  /** Count of follow-ups (message_type = 'follow_up') for the campaign */
  followupCount: number;
  /** Count of assembled pitches for the campaign */
  pitchCount: number;
  /** Count of contact log entries for the campaign */
  contactLogCount: number;
  /** Date of the latest opener (null if none) */
  latestOpenerAt: Date | null;
  /** Days since the latest opener was executed (-1 if none) */
  daysSinceOpener: number;
  /** Date of the latest follow-up (null if none) */
  latestFollowupAt: Date | null;
  /** True if an opener exists */
  hasOpener: boolean;
  /** True if at least one follow-up exists */
  hasFollowup: boolean;
  /** True if at least one assembled pitch exists */
  hasPitch: boolean;
  /** True if at least one contact log entry exists */
  hasContactLog: boolean;
  /** True if opener sent 3+ days ago with no follow-up yet */
  noReplyAfterOpener: boolean;
  /** True if 2+ follow-ups sent with no reply */
  noReplyAfterFollowupN: boolean;
  /** The derived OX_* signal codes */
  signals: SignalCode[];
}

// ─── Thresholds ─────────────────────────────────────────────────────────

const NO_REPLY_OPENER_DAYS = 3;
const NO_REPLY_FOLLOWUP_THRESHOLD = 2;

// ─── Service ────────────────────────────────────────────────────────────

export class OutreachStateSignalExtractor extends BaseService {
  private static instance: OutreachStateSignalExtractor;

  private constructor() {
    super();
  }

  static getInstance(): OutreachStateSignalExtractor {
    if (!OutreachStateSignalExtractor.instance) {
      OutreachStateSignalExtractor.instance = new OutreachStateSignalExtractor();
    }
    return OutreachStateSignalExtractor.instance;
  }

  /**
   * Query the outreach tables for a campaign and derive the OX_* signal set.
   * Returns a zero-state OutreachState if the campaign has no outreach artifacts.
   */
  async extractOutreachState(campaignId: string, ctx?: RequestCtx): Promise<OutreachState> {
    try {
      // Query openers + follow-ups (same table, distinguished by message_type)
      const openersAndFollowups = await this.prisma.mkt_outreach_openers_list.findMany({
        where: { campaign_id: campaignId },
        select: {
          id: true,
          message_type: true,
          followup_number: true,
          executed_at: true,
        },
        orderBy: { executed_at: 'desc' },
      }) as any[];

      // Query pitches
      const pitches = await this.prisma.mkt_outreach_pitches_list.findMany({
        where: { campaign_id: campaignId },
        select: { id: true, created_at: true },
      }) as any[];

      // Query contact log
      const contactLogs = await this.prisma.mkt_outreach_log.findMany({
        where: { campaign_id: campaignId },
        select: { id: true },
      }) as any[];

      const openers = openersAndFollowups.filter((o) => !o.message_type);
      const followups = openersAndFollowups.filter((o) => o.message_type === 'follow_up');

      const openerCount = openers.length;
      const followupCount = followups.length;
      const pitchCount = pitches.length;
      const contactLogCount = contactLogs.length;

      const latestOpenerAt = openers.length > 0
        ? new Date(openers[0].executed_at)
        : null;
      const latestFollowupAt = followups.length > 0
        ? new Date(followups[0].executed_at)
        : null;

      const daysSinceOpener = latestOpenerAt
        ? Math.floor((Date.now() - latestOpenerAt.getTime()) / (1000 * 60 * 60 * 24))
        : -1;

      const hasOpener = openerCount > 0;
      const hasFollowup = followupCount > 0;
      const hasPitch = pitchCount > 0;
      const hasContactLog = contactLogCount > 0;

      // No reply after opener: opener exists, 3+ days old, no follow-up yet
      const noReplyAfterOpener = hasOpener && !hasFollowup && daysSinceOpener >= NO_REPLY_OPENER_DAYS;

      // No reply after N follow-ups: 2+ follow-ups sent
      const noReplyAfterFollowupN = followupCount >= NO_REPLY_FOLLOWUP_THRESHOLD;

      // Derive signals
      const signals: SignalCode[] = [];
      if (hasOpener) signals.push('OX_OPENER_SENT');
      if (hasFollowup) signals.push('OX_FOLLOWUP_SENT');
      if (hasPitch) signals.push('OX_PITCH_ASSEMBLED');
      if (noReplyAfterOpener) signals.push('OX_NO_REPLY_AFTER_OPENER');
      if (noReplyAfterFollowupN) signals.push('OX_NO_REPLY_AFTER_FOLLOWUP_N');
      if (hasContactLog) signals.push('OX_CONTACT_LOGGED');

      return {
        openerCount,
        followupCount,
        pitchCount,
        contactLogCount,
        latestOpenerAt,
        daysSinceOpener,
        latestFollowupAt,
        hasOpener,
        hasFollowup,
        hasPitch,
        hasContactLog,
        noReplyAfterOpener,
        noReplyAfterFollowupN,
        signals,
      };
    } catch (error) {
      logger.error('Failed to extract outreach state', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }
}

export default OutreachStateSignalExtractor.getInstance();
