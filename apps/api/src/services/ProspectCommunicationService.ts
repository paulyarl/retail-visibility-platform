/**
 * ProspectCommunicationService
 *
 * Prospect-scoped communication history — one timeline that spans the whole
 * relationship, from pre-campaign seed touches (the "is this business even
 * real / who do I talk to" phone calls) through campaign outreach log rows.
 *
 * The two source records are keyed differently and carry different channel
 * vocabularies, so this service is a read-only aggregator + normalizer:
 *
 *   - directory_seed_outreach_touches (pre-campaign; keyed by seed_id)
 *     channel: call | email | sms | mail | form | referral | visit | other
 *   - mkt_outreach_log (post-campaign; keyed by campaign_id)
 *     channel: phone | email | website | social | in_person | other
 *
 * A "prospect" is anchored on the queue entry (mkt_prospect_queue) — the
 * queue is the prospect registry and carries both the seed link (pre-campaign)
 * and the processed campaign link (post-campaign). Sibling campaigns that
 * share a business_prospect_id are folded in so multi-archetype outreach
 * shows as a single conversation.
 *
 * Read-only: no writes, no new tables, no migrations.
 *
 * Pattern: singleton extends BaseService (Prisma directly, RequestCtx
 * logging, handleError). Mirrors MarketingProspectQueueService.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { NotFoundError } from '../middleware/errorHandler';
import DirectoryPresenceSeedService from './DirectoryPresenceSeedService';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProspectCommunicationEvent {
  id: string;
  /** Which record the event came from. */
  source: 'campaign_outreach' | 'seed_touch';
  occurred_at: string;
  /** Normalized channel vocabulary (see CHANNEL_ALIASES). */
  channel: string;
  /** The channel exactly as stored on the source row. */
  raw_channel: string;
  outcome: string | null;
  outcome_label: string;
  subject: string | null;
  message: string | null;
  notes: string | null;
  contacted_by: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  stage_at_time: string | null;
  follow_up_date: string | null;
  follow_up_completed_at: string | null;
  delivery_status: string | null;
  call_details: Record<string, any> | null;
  /** Recording URL when the call details carry one (nullable until recordings ship). */
  recording_url: string | null;
  anchor_snapshot: Record<string, any> | null;
  verification_results: Record<string, any>[] | null;
  /** True for machine-generated rows (auto follow-ups, report delivery). */
  system_generated: boolean;
}

export interface ProspectCommunicationSummary {
  total_events: number;
  first_contact_at: string | null;
  last_contact_at: string | null;
  days_since_last_contact: number | null;
  last_outcome: string | null;
  last_channel: string | null;
  by_channel: Record<string, number>;
  by_source: { campaign_outreach: number; seed_touch: number };
  next_follow_up_at: string | null;
}

export interface ProspectSummary {
  /** Queue entry id — the prospect anchor. */
  id: string;
  business_name: string | null;
  title: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  seed_id: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  campaign_stage: string | null;
  business_prospect_id: string | null;
  last_contact_at: string | null;
  contact_count: number;
}

export interface ProspectTimeline {
  prospect: ProspectSummary;
  summary: ProspectCommunicationSummary;
  events: ProspectCommunicationEvent[];
  /** Every campaign folded into this timeline (processed + siblings). */
  campaigns: Array<{ id: string; title: string | null; stage: string | null }>;
}

export interface ListProspectsFilters {
  status?: string[];
  category?: string;
  city?: string;
  search?: string;
  limit?: number;
}

// ─── Channel normalization ──────────────────────────────────────────────

// Seed-touch channels → the ecosystem display vocabulary. Campaign
// outreach-log channels already use it. Mirrors the mapping in
// ProvingGroundCadenceService (CHANNEL_TO_OUTREACH), kept separate because
// that one collapses mail→other for the campaign-log taxonomy, whereas the
// operator-facing history should preserve the real channel.
const CHANNEL_ALIASES: Record<string, string> = {
  call: 'phone',
  visit: 'in_person',
};

export function normalizeChannel(channel: string | null | undefined): string {
  if (!channel) return 'other';
  return CHANNEL_ALIASES[channel] ?? channel;
}

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Phone',
  email: 'Email',
  sms: 'SMS',
  mail: 'Mail',
  form: 'Form',
  referral: 'Referral',
  in_person: 'In person',
  website: 'Website',
  social: 'Social',
  other: 'Other',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// ─── Outcome labels ─────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<string, string> = {
  // campaign outreach-log outcomes
  reached: 'Reached',
  no_answer: 'No answer',
  left_message: 'Left message',
  interested: 'Interested',
  not_interested: 'Not interested',
  callback_scheduled: 'Callback scheduled',
  auto_follow_up_scheduled: 'Auto follow-up scheduled',
  wrong_number: 'Wrong number',
  disconnected_number: 'Disconnected',
  seed_outreach_scheduled: 'Seed outreach scheduled',
  freshness_verified: 'Freshness verified',
  freshness_failed: 'Freshness failed',
  // seed-touch outcomes
  connected: 'Connected',
  no_response: 'No response',
  no_reply: 'No reply',
  voicemail: 'Voicemail',
  bad_number: 'Bad number',
  bounce: 'Bounced',
  unread: 'Unread',
  read_no_reply: 'Read, no reply',
  form_submitted: 'Form submitted',
  referral_asked: 'Referral asked',
  claimed: 'Claimed',
  report_delivered: 'Report delivered',
  report_viewed: 'Report viewed',
  report_claimed: 'Report claimed',
  report_declined: 'Report declined',
  claim_qr_generated: 'Claim QR generated',
  other: 'Other',
};

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'Logged';
  return OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, ' ');
}

// Machine-generated events — auto follow-ups and report-delivery touches.
// Surfaced with a "System" badge so they don't read as operator activity.
const SYSTEM_OUTCOMES = new Set([
  'auto_follow_up_scheduled',
  'report_delivered',
  'report_viewed',
  'report_claimed',
  'report_declined',
  'claim_qr_generated',
]);

// ─── Service ────────────────────────────────────────────────────────────

class ProspectCommunicationServiceClass extends BaseService {
  private static instance: ProspectCommunicationServiceClass;

  private constructor() {
    super();
  }

  static getInstance(): ProspectCommunicationServiceClass {
    if (!ProspectCommunicationServiceClass.instance) {
      ProspectCommunicationServiceClass.instance = new ProspectCommunicationServiceClass();
    }
    return ProspectCommunicationServiceClass.instance;
  }

  /**
   * List prospects for the picker. Anchored on mkt_prospect_queue, decorated
   * with the processed campaign and rolled-up contact counts. All statuses
   * are included by default — a dismissed prospect still has a history worth
   * reading.
   */
  async listProspects(filters: ListProspectsFilters = {}, ctx?: RequestCtx): Promise<ProspectSummary[]> {
    try {
      const where: any = {};
      if (filters.status?.length) where.status = { in: filters.status };
      if (filters.category) where.category = { equals: filters.category, mode: 'insensitive' };
      if (filters.city) where.city = { equals: filters.city, mode: 'insensitive' };
      if (filters.search?.trim()) {
        const q = filters.search.trim();
        where.OR = [
          { business_name: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ];
      }

      const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));

      const entries = await this.prisma.mkt_prospect_queue.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
        take: limit,
        include: {
          mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list: {
            select: { id: true, title: true, business_name: true, stage: true, business_prospect_id: true },
          },
        },
      });

      if (entries.length === 0) return [];

      // Roll up contact counts + last-contact in two grouped queries rather
      // than N per-prospect queries.
      const seedIds = entries.map((e) => e.seed_id).filter((v): v is string => !!v);
      const campaignIds = entries
        .map((e) => e.processed_campaign_id)
        .filter((v): v is string => !!v);

      const seedStats = new Map<string, { count: number; last: Date | null }>();
      if (seedIds.length) {
        const rows = await this.prisma.directory_seed_outreach_touches.groupBy({
          by: ['seed_id'],
          where: { seed_id: { in: seedIds } },
          _count: { _all: true },
          _max: { occurred_at: true },
        });
        for (const r of rows as any[]) {
          seedStats.set(r.seed_id, { count: r._count?._all ?? 0, last: r._max?.occurred_at ?? null });
        }
      }

      const campaignStats = new Map<string, { count: number; last: Date | null }>();
      if (campaignIds.length) {
        const rows = await this.prisma.mkt_outreach_log.groupBy({
          by: ['campaign_id'],
          where: { campaign_id: { in: campaignIds } },
          _count: { _all: true },
          _max: { contact_date: true },
        });
        for (const r of rows as any[]) {
          campaignStats.set(r.campaign_id, { count: r._count?._all ?? 0, last: r._max?.contact_date ?? null });
        }
      }

      return entries.map((e) => {
        const campaign = (e as any)
          .mkt_campaigns_list_mkt_prospect_queue_processed_campaign_idTomkt_campaigns_list;
        const seed = e.seed_id ? seedStats.get(e.seed_id) : undefined;
        const camp = e.processed_campaign_id ? campaignStats.get(e.processed_campaign_id) : undefined;
        const lastDates = [seed?.last, camp?.last].filter((d): d is Date => !!d);
        const last = lastDates.length
          ? new Date(Math.max(...lastDates.map((d) => d.getTime())))
          : null;
        return {
          id: e.id,
          business_name: e.business_name ?? null,
          title: e.title ?? null,
          category: e.category ?? null,
          city: e.city ?? null,
          state: e.state ?? null,
          status: e.status,
          priority: e.priority,
          assigned_to: e.assigned_to ?? null,
          seed_id: e.seed_id ?? null,
          campaign_id: e.processed_campaign_id ?? null,
          campaign_title: campaign?.title ?? campaign?.business_name ?? null,
          campaign_stage: campaign?.stage ?? null,
          business_prospect_id: campaign?.business_prospect_id ?? null,
          last_contact_at: last ? last.toISOString() : null,
          contact_count: (seed?.count ?? 0) + (camp?.count ?? 0),
        };
      });
    } catch (error) {
      logger.error('Failed to list prospects for communications', ctx, {
        error: (error as Error).message,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Build the unified communication timeline for a prospect (queue entry).
   * Folds in the processed campaign plus any sibling campaigns sharing its
   * business_prospect_id, and the prospect's seed touches.
   */
  async getTimeline(queueEntryId: string, ctx?: RequestCtx): Promise<ProspectTimeline> {
    try {
      const entry = await this.prisma.mkt_prospect_queue.findUnique({
        where: { id: queueEntryId },
      });
      if (!entry) throw new NotFoundError(`Prospect ${queueEntryId} not found`);

      // Resolve the campaign set: the processed campaign plus siblings that
      // share a business_prospect_id (multi-archetype outreach is one
      // conversation from the prospect's side).
      const campaignIds = new Set<string>();
      if (entry.processed_campaign_id) campaignIds.add(entry.processed_campaign_id);

      let businessProspectId: string | null = null;
      if (entry.processed_campaign_id) {
        const primary = await this.prisma.mkt_campaigns_list.findUnique({
          where: { id: entry.processed_campaign_id },
          select: { business_prospect_id: true },
        });
        businessProspectId = primary?.business_prospect_id ?? null;
        if (businessProspectId) {
          const siblings = await this.prisma.mkt_campaigns_list.findMany({
            where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
            select: { id: true },
          });
          for (const s of siblings) campaignIds.add(s.id);
        }
      }

      const idList = [...campaignIds];
      const campaigns = idList.length
        ? await this.prisma.mkt_campaigns_list.findMany({
            where: { id: { in: idList } },
            select: { id: true, title: true, business_name: true, stage: true },
          })
        : [];
      const campaignById = new Map(campaigns.map((c) => [c.id, c]));

      const [logs, touches] = await Promise.all([
        idList.length
          ? this.prisma.mkt_outreach_log.findMany({
              where: { campaign_id: { in: idList } },
              orderBy: { contact_date: 'desc' },
            })
          : Promise.resolve([] as any[]),
        entry.seed_id
          ? DirectoryPresenceSeedService.listOutreachTouches(entry.seed_id)
          : Promise.resolve([] as any[]),
      ]);

      const events: ProspectCommunicationEvent[] = [
        ...logs.map((l: any) => this.campaignEvent(l, campaignById)),
        ...touches.map((t: any) => this.seedEvent(t)),
      ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      const summary = this.buildSummary(events, logs as any[]);

      const processed = entry.processed_campaign_id
        ? campaignById.get(entry.processed_campaign_id)
        : undefined;

      const prospect: ProspectSummary = {
        id: entry.id,
        business_name: entry.business_name ?? null,
        title: entry.title ?? null,
        category: entry.category ?? null,
        city: entry.city ?? null,
        state: entry.state ?? null,
        status: entry.status,
        priority: entry.priority,
        assigned_to: entry.assigned_to ?? null,
        seed_id: entry.seed_id ?? null,
        campaign_id: entry.processed_campaign_id ?? null,
        campaign_title: processed?.title ?? processed?.business_name ?? null,
        campaign_stage: processed?.stage ?? null,
        business_prospect_id: businessProspectId,
        last_contact_at: summary.last_contact_at,
        contact_count: summary.total_events,
      };

      return {
        prospect,
        summary,
        events,
        campaigns: campaigns.map((c) => ({
          id: c.id,
          title: c.title ?? c.business_name ?? null,
          stage: c.stage,
        })),
      };
    } catch (error) {
      logger.error('Failed to build prospect timeline', ctx, {
        error: (error as Error).message,
        queueEntryId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ─── Mappers ──────────────────────────────────────────────────────────

  private campaignEvent(
    log: any,
    campaignById: Map<string, { id: string; title: string | null; business_name: string | null; stage: string }>,
  ): ProspectCommunicationEvent {
    const campaign = campaignById.get(log.campaign_id);
    const callDetails = (log.call_details ?? null) as Record<string, any> | null;
    const channel = normalizeChannel(log.contact_channel);
    return {
      id: log.id,
      source: 'campaign_outreach',
      occurred_at: new Date(log.contact_date).toISOString(),
      channel,
      raw_channel: log.contact_channel,
      outcome: log.outcome ?? null,
      outcome_label: outcomeLabel(log.outcome ?? null),
      subject: log.message_subject ?? null,
      message: log.message_snapshot ?? null,
      notes: log.notes ?? null,
      contacted_by: log.contacted_by ?? null,
      campaign_id: log.campaign_id,
      campaign_title: campaign?.title ?? campaign?.business_name ?? null,
      stage_at_time: log.stage_at_time ?? null,
      follow_up_date: log.follow_up_date ? new Date(log.follow_up_date).toISOString() : null,
      follow_up_completed_at: log.follow_up_completed_at
        ? new Date(log.follow_up_completed_at).toISOString()
        : null,
      delivery_status: log.delivery_status ?? null,
      call_details: callDetails,
      recording_url: (callDetails?.recording_url as string) ?? null,
      anchor_snapshot: (log.anchor_snapshot ?? null) as Record<string, any> | null,
      verification_results: (log.verification_results ?? null) as Record<string, any>[] | null,
      system_generated: SYSTEM_OUTCOMES.has(log.outcome ?? ''),
    };
  }

  private seedEvent(touch: any): ProspectCommunicationEvent {
    const channel = normalizeChannel(touch.channel);
    return {
      id: touch.id,
      source: 'seed_touch',
      occurred_at: new Date(touch.occurred_at).toISOString(),
      channel,
      raw_channel: touch.channel,
      outcome: touch.outcome ?? null,
      outcome_label: outcomeLabel(touch.outcome ?? null),
      subject: null,
      message: null,
      notes: touch.notes ?? null,
      contacted_by: touch.operator_id ?? null,
      campaign_id: null,
      campaign_title: null,
      stage_at_time: null,
      follow_up_date: null,
      follow_up_completed_at: null,
      delivery_status: null,
      call_details: null,
      recording_url: null,
      anchor_snapshot: null,
      verification_results: null,
      system_generated: SYSTEM_OUTCOMES.has(touch.outcome ?? ''),
    };
  }

  private buildSummary(
    events: ProspectCommunicationEvent[],
    logs: any[],
  ): ProspectCommunicationSummary {
    const byChannel: Record<string, number> = {};
    for (const e of events) byChannel[e.channel] = (byChannel[e.channel] ?? 0) + 1;

    const first = events.length ? events[events.length - 1].occurred_at : null;
    const last = events.length ? events[0].occurred_at : null;
    const daysSince = last
      ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
      : null;

    // Next open follow-up across every campaign in the set.
    const openFollowUps = logs
      .filter((l) => l.follow_up_date && !l.follow_up_completed_at)
      .map((l) => new Date(l.follow_up_date).getTime());
    const nextFollowUp = openFollowUps.length ? new Date(Math.min(...openFollowUps)) : null;

    return {
      total_events: events.length,
      first_contact_at: first,
      last_contact_at: last,
      days_since_last_contact: daysSince,
      last_outcome: events[0]?.outcome_label ?? null,
      last_channel: events[0]?.channel ?? null,
      by_channel: byChannel,
      by_source: {
        campaign_outreach: events.filter((e) => e.source === 'campaign_outreach').length,
        seed_touch: events.filter((e) => e.source === 'seed_touch').length,
      },
      next_follow_up_at: nextFollowUp ? nextFollowUp.toISOString() : null,
    };
  }
}

export const ProspectCommunicationService = ProspectCommunicationServiceClass.getInstance();
export default ProspectCommunicationService;
