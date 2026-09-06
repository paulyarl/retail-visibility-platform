/**
 * ProvingGroundCadenceService — the authoritative signal→wait table
 * (Migration 262, spec §4.6–§4.8).
 *
 * One engine owns "when next" for proving-ground prospects:
 *
 *   - logTouch(queueEntryId, {channel, outcome?, notes?}) writes the
 *     canonical touch on the seed (directory_seed_outreach_touches — the
 *     funnel's `touches`/`cacEstimate` numerator), advances the channel
 *     ladder, stamps next_touch_at, applies the 3-consuming-touches/30d cap
 *     (→ hold +60d), and exits to 'in_thread' on live contact.
 *   - Write-through: every logged outcome also updates the seed's
 *     migration-257 outreach_state machine so the seed-side queue and the
 *     proving-ground worklist never diverge.
 *   - Post-graduation: mirrors the touch into mkt_outreach_log so campaign
 *     pages keep their outreach history (the log is campaign-keyed, so the
 *     mirror only applies once processed_campaign_id exists).
 *
 * Cadence table (spec §4.7) — business-day semantics where flagged:
 *   bad_number/bounce  → mark rung dead, advance, +0d, no slot consumed
 *   no_answer          → +1d, retry same rung (max 2 no-answers → advance)
 *   voicemail          → +3 business days, advance
 *   unread             → +2d, mark dead, advance (abandon channel)
 *   read_no_reply      → +5d, advance
 *   no_reply (email)   → +5 business days, advance
 *   form_submitted     → +7d, advance
 *   referral_asked     → +14d, advance
 *   mail (channel)     → +10d, stay on rung (at-due QR-scan check is the
 *                        operator's call — second postcard vs advance)
 *   connected/claimed  → in_thread (cadence exits; the thread drives moves)
 *   not_interested     → dismissed (bad_fit)
 *   ladder exhausted   → hold, next_touch_at +60d
 *   touch cap (3/30d)  → hold, next_touch_at +60d
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import DirectoryPresenceSeedService from './DirectoryPresenceSeedService';
import { generateOutreachLogId } from '../lib/id-generator';

// ─── Types ───────────────────────────────────────────────────────────────

export type TouchChannel = 'call' | 'email' | 'sms' | 'mail' | 'form' | 'referral' | 'other';
export type TouchOutcome =
  | 'connected' | 'no_response' | 'no_answer' | 'no_reply' | 'voicemail'
  | 'bad_number' | 'bounce' | 'unread' | 'read_no_reply' | 'form_submitted'
  | 'referral_asked' | 'claimed' | 'not_interested';

export interface ChannelRung {
  channel: TouchChannel;
  contact?: string;
  evidence?: string;
  status: 'verified' | 'unverified' | 'dead';
}

export interface LogTouchInput {
  channel: TouchChannel;
  outcome?: TouchOutcome;
  notes?: string;
}

export interface LogTouchResult {
  touchId: string;
  queueEntryId: string;
  status: string;
  currentChannelIndex: number;
  nextTouchAt: Date | null;
  channelSequence: ChannelRung[];
}

// ─── Cadence map ─────────────────────────────────────────────────────────

interface CadenceRule {
  waitDays: number;
  businessDays?: boolean;
  markDead?: boolean;
  advance?: boolean;
  consumesSlot: boolean;
  toStatus?: 'in_thread' | 'dismissed';
}

const HOLD_DAYS = 60;
const TOUCH_CAP = 3;
const TOUCH_CAP_WINDOW_DAYS = 30;
const NO_ANSWER_MAX_RETRIES = 2;

const CADENCE: Record<string, CadenceRule> = {
  bad_number:     { waitDays: 0,  markDead: true, advance: true, consumesSlot: false },
  bounce:         { waitDays: 0,  markDead: true, advance: true, consumesSlot: false },
  no_answer:      { waitDays: 1,  consumesSlot: true },
  no_response:    { waitDays: 1,  consumesSlot: true }, // legacy alias of no_answer
  voicemail:      { waitDays: 3,  businessDays: true, advance: true, consumesSlot: true },
  unread:         { waitDays: 2,  markDead: true, advance: true, consumesSlot: true },
  read_no_reply:  { waitDays: 5,  advance: true, consumesSlot: true },
  no_reply:       { waitDays: 5,  businessDays: true, advance: true, consumesSlot: true },
  form_submitted: { waitDays: 7,  advance: true, consumesSlot: true },
  referral_asked: { waitDays: 14, advance: true, consumesSlot: true },
  connected:      { waitDays: 0,  consumesSlot: true, toStatus: 'in_thread' },
  claimed:        { waitDays: 0,  consumesSlot: false, toStatus: 'in_thread' },
  not_interested: { waitDays: 0,  consumesSlot: false, toStatus: 'dismissed' },
};

const DEAD_SIGNALS = new Set(['bad_number', 'bounce']);

// Seed-touch channel → campaign outreach-log channel (mkt_outreach_log
// taxonomy: phone | email | website | social | in_person | other).
const CHANNEL_TO_OUTREACH: Record<TouchChannel, string> = {
  call: 'phone', email: 'email', sms: 'social',
  mail: 'other', form: 'website', referral: 'other', other: 'other',
};

// Seed-touch outcome → campaign outreach-log outcome.
const OUTCOME_TO_OUTREACH: Record<string, string> = {
  connected: 'reached', claimed: 'reached',
  no_answer: 'no_answer', no_response: 'no_answer', no_reply: 'no_answer',
  unread: 'no_answer', read_no_reply: 'no_answer',
  voicemail: 'left_message',
  bad_number: 'wrong_number',
  bounce: 'other', form_submitted: 'other', referral_asked: 'other',
  not_interested: 'not_interested',
};

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

// ─── Service ─────────────────────────────────────────────────────────────

class ProvingGroundCadenceServiceClass extends BaseService {
  private static instance: ProvingGroundCadenceServiceClass;
  private constructor() { super(); }
  static getInstance(): ProvingGroundCadenceServiceClass {
    if (!ProvingGroundCadenceServiceClass.instance) {
      ProvingGroundCadenceServiceClass.instance = new ProvingGroundCadenceServiceClass();
    }
    return ProvingGroundCadenceServiceClass.instance;
  }

  /**
   * Log an outreach touch for a queue row. The seed touch is the canonical
   * record; the queue row's cadence state + the seed's outreach_state are
   * projections of it.
   */
  async logTouch(queueEntryId: string, input: LogTouchInput, ctx?: RequestCtx): Promise<LogTouchResult> {
    try {
      const entry = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: queueEntryId },
      });
      if (!entry) throw new NotFoundError(`Queue entry ${queueEntryId} not found`);
      if (!entry.seed_id) {
        throw new ConflictError('not_seeded — run the preflight seeding step first (spec §4.4)');
      }
      if (entry.status === 'dismissed' || entry.status === 'campaign_created') {
        throw new ConflictError(`entry_${entry.status}`);
      }

      const now = new Date();

      // 1. Canonical record — the seed touch.
      const touch = await DirectoryPresenceSeedService.addOutreachTouch(
        entry.seed_id,
        {
          channel: input.channel,
          outcome: input.outcome,
          notes: input.notes,
          occurredAt: now,
        },
        ctx ? { actorId: ctx.userId, actorType: 'user' } : undefined,
      );

      // 2. Cadence resolution.
      const rule = this.resolveRule(input.channel, input.outcome);
      const ladder = this.parseLadder(entry.channel_sequence);
      let currentIndex = entry.current_channel_index ?? 0;
      let status: string = entry.status as string;
      let nextTouchAt: Date | null;

      // A hold whose date has passed re-enters the cadence (spec §4.6).
      const holdDue = entry.status === 'hold' && entry.next_touch_at && new Date(entry.next_touch_at) <= now;
      if (entry.status === 'hold' && !holdDue) {
        throw new ConflictError('entry_on_hold');
      }
      if (holdDue) status = 'queued';
      if (entry.status === 'in_thread' && input.outcome !== 'not_interested') {
        // Live-thread logging keeps the row in_thread — record the touch,
        // don't restart the cadence.
        return this.persistTouchResult(entry.id, ladder, currentIndex, 'in_thread', null, touch.id, input, entry, ctx);
      }

      if (rule.markDead && ladder[currentIndex]) {
        ladder[currentIndex] = { ...ladder[currentIndex], status: 'dead' };
      }

      if (rule.toStatus === 'in_thread' || rule.toStatus === 'dismissed') {
        status = rule.toStatus;
        nextTouchAt = null;
      } else {
        let advance = rule.advance === true;
        // no_answer retry cap: >NO_ANSWER_MAX_RETRIES consecutive no-answers
        // on this channel → advance anyway (spec §4.7).
        if (!advance && (input.outcome === 'no_answer' || input.outcome === 'no_response')) {
          const retries = await this.countConsecutiveNoAnswers(entry.seed_id, input.channel);
          if (retries >= NO_ANSWER_MAX_RETRIES) advance = true;
        }
        if (advance) {
          currentIndex = this.nextLiveRung(ladder, currentIndex);
          if (currentIndex === -1) {
            // Ladder exhausted → hold +60d (spec §4.7).
            status = 'hold';
            nextTouchAt = addDays(now, HOLD_DAYS);
          } else {
            nextTouchAt = rule.businessDays ? addBusinessDays(now, rule.waitDays) : addDays(now, rule.waitDays);
          }
        } else {
          nextTouchAt = rule.businessDays ? addBusinessDays(now, rule.waitDays) : addDays(now, rule.waitDays);
        }
      }

      // 3. Touch cap — 3 consuming touches per rolling 30d → hold +60d
      //    (dead-channel signals excluded; spec §4.7).
      if (status === 'queued' || status === 'verify_then_outreach') {
        const consuming = await this.countConsumingTouches(entry.seed_id);
        if (consuming >= TOUCH_CAP) {
          status = 'hold';
          nextTouchAt = addDays(now, HOLD_DAYS);
        }
      }

      // 4. Write-through to the seed's outreach_state machine (spec §4.6).
      await this.writeThroughSeedState(entry.seed_id, input.outcome, ctx);

      // 5. Post-graduation mirror to mkt_outreach_log (spec §4.8).
      await this.mirrorToOutreachLog(entry, input, now, ctx);

      return this.persistTouchResult(entry.id, ladder, currentIndex, status, nextTouchAt, touch.id, input, entry, ctx, status === 'dismissed');
    } catch (error) {
      logger.error('logTouch failed', ctx, { error: (error as Error).message, queueEntryId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Release holds whose next_touch_at has passed — called by a scheduled
   * job or lazily. Returns the released ids.
   */
  async releaseDueHolds(ctx?: RequestCtx): Promise<string[]> {
    const rows = await this.prisma.mkt_prospect_queue.findMany({
      where: { status: 'hold', next_touch_at: { lte: new Date() } },
      select: { id: true },
    });
    const ids = rows.map((r: any) => r.id);
    if (ids.length) {
      await this.prisma.mkt_prospect_queue.updateMany({
        where: { id: { in: ids } },
        data: { status: 'queued' },
      });
      logger.info('releaseDueHolds: released', ctx, { count: ids.length });
    }
    return ids;
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private resolveRule(channel: TouchChannel, outcome?: TouchOutcome): CadenceRule {
    // Mail touches key on the channel, not the outcome (spec §4.7).
    if (channel === 'mail') return { waitDays: 10, consumesSlot: true };
    if (!outcome) return { waitDays: 2, consumesSlot: true };
    return CADENCE[outcome] ?? { waitDays: 2, consumesSlot: true };
  }

  private parseLadder(raw: any): ChannelRung[] {
    if (Array.isArray(raw)) return raw as ChannelRung[];
    return [];
  }

  private nextLiveRung(ladder: ChannelRung[], from: number): number {
    for (let i = from + 1; i < ladder.length; i++) {
      if (ladder[i].status !== 'dead') return i;
    }
    return -1;
  }

  private async countConsecutiveNoAnswers(seedId: string, channel: string): Promise<number> {
    const rows = await this.prisma.directory_seed_outreach_touches.findMany({
      where: { seed_id: seedId, channel },
      orderBy: { occurred_at: 'desc' },
      take: 10,
      select: { outcome: true },
    });
    let count = 0;
    for (const r of rows) {
      if (r.outcome === 'no_answer' || r.outcome === 'no_response') count++;
      else break;
    }
    return count;
  }

  private async countConsumingTouches(seedId: string): Promise<number> {
    const since = addDays(new Date(), -TOUCH_CAP_WINDOW_DAYS);
    return this.prisma.directory_seed_outreach_touches.count({
      where: {
        seed_id: seedId,
        occurred_at: { gte: since },
        OR: [{ outcome: null }, { outcome: { notIn: [...DEAD_SIGNALS] } }],
      },
    });
  }

  private async writeThroughSeedState(seedId: string, outcome: TouchOutcome | undefined, ctx?: RequestCtx): Promise<void> {
    // Every operator touch = 'owner_contacted' in the seed machine (any
    // outcome except freshness-fail/claimed/suppressed — spec §4.6). Don't
    // regress terminal-ish states.
    try {
      const seed = await this.prisma.directory_presence_seeds.findUnique({
        where: { id: seedId },
        select: { outreach_state: true },
      });
      const current = (seed as any)?.outreach_state;
      if (current === 'claimed' || current === 'suppressed') return;
      await DirectoryPresenceSeedService.setOutreachState(seedId, 'owner_contacted', {
        actorId: ctx?.userId,
        actorType: 'user',
      });
    } catch (err) {
      logger.warn('writeThroughSeedState failed (non-fatal)', ctx, {
        seedId, outcome, error: (err as Error).message,
      });
    }
  }

  private async mirrorToOutreachLog(entry: any, input: LogTouchInput, contactDate: Date, ctx?: RequestCtx): Promise<void> {
    const campaignId = entry.processed_campaign_id;
    if (!campaignId) return;
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { stage: true },
      });
      await this.prisma.mkt_outreach_log.create({
        data: {
          id: generateOutreachLogId(),
          campaign_id: campaignId,
          stage_at_time: (campaign?.stage as string) ?? 'seek',
          contact_channel: CHANNEL_TO_OUTREACH[input.channel] ?? 'other',
          contact_date: contactDate,
          outcome: (input.outcome && OUTCOME_TO_OUTREACH[input.outcome]) || 'other',
          notes: input.notes ?? null,
          contacted_by: ctx?.userId ?? null,
          delivery_status: 'sent',
        },
      });
    } catch (err) {
      logger.warn('mirrorToOutreachLog failed (non-fatal)', ctx, {
        queueEntryId: entry.id, error: (err as Error).message,
      });
    }
  }

  private async persistTouchResult(
    queueEntryId: string,
    ladder: ChannelRung[],
    currentIndex: number,
    status: string,
    nextTouchAt: Date | null,
    touchId: string,
    input: LogTouchInput,
    entry: any,
    ctx?: RequestCtx,
    dismissed = false,
  ): Promise<LogTouchResult> {
    await this.prisma.mkt_prospect_queue.update({
      where: { id: queueEntryId },
      data: {
        channel_sequence: ladder.length ? (ladder as any) : entry.channel_sequence,
        current_channel_index: currentIndex === -1 ? entry.current_channel_index : currentIndex,
        next_touch_at: nextTouchAt,
        status,
        ...(dismissed ? { dismissed_reason: 'bad_fit' } : {}),
        updated_at: new Date(),
      },
    });

    logger.info('logTouch: applied', ctx, {
      queueEntryId, touchId, status, currentIndex, nextTouchAt,
    });

    return {
      touchId,
      queueEntryId,
      status,
      currentChannelIndex: currentIndex === -1 ? (entry.current_channel_index ?? 0) : currentIndex,
      nextTouchAt,
      channelSequence: ladder,
    };
  }
}

export default ProvingGroundCadenceServiceClass.getInstance();
