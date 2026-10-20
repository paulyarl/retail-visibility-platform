/**
 * SeedAnnounceService — the announce marker + queue for the four-act cascade.
 *
 * The courtesy-window `outreach_state` machine cannot distinguish a delivered
 * announce from any other contact attempt (`owner_contacted` is written for
 * voicemail and no-answer too). The queue therefore reads two explicit marker
 * outcomes on the canonical seed touch ledger:
 *
 *   announce_scheduled  — written at publish (the announce is queued)
 *   announce_delivered  — written when the operator records the actual announce
 *
 * The queue is: status published/invited AND announce_scheduled present AND
 * announce_delivered absent. A `no_response` seed without the delivered marker
 * stays in the queue.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §2.0 / §11 B1/B3.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { unifiedConfig } from '../config/unifiedConfig';
import { loadAnnounceBranding } from './PlatformBrandingService';
import { resolveClaimUrlForSeed } from './outreach-openers/outreach-link-vars';

export interface SeedAnnounceCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export type AnnounceChannel = 'call' | 'email' | 'other';

export interface AnnounceQueueRow {
  seedId: string;
  tenantId: string;
  status: string;
  businessName: string | null;
  category: string;
  city: string;
  state: string;
  publishedAt: string | null;
  ageDays: number | null;
  announceScheduledAt: string | null;
  channel: string | null;
  claimUrl: string | null;
  placeUrl: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  listingPhone: string | null;
  listingEmail: string | null;
}

export interface ScheduleAnnounceResult {
  scheduled: boolean;
  reason?: 'seed_not_found' | 'seed_not_public' | 'already_scheduled' | 'branding_incomplete';
  channel?: AnnounceChannel;
  claimUrl?: string | null;
  missingRequired?: string[];
}

export interface MarkDeliveredResult {
  delivered: boolean;
  reason?: 'seed_not_found' | 'already_delivered' | 'no_primary_seed';
  channel?: AnnounceChannel;
}

interface SeedRow {
  id: string;
  tenant_id: string;
  status: string;
  owner_phone: string | null;
  owner_email: string | null;
  published_at: Date | null;
  business_name: string | null;
  listing_phone: string | null;
  listing_email: string | null;
  slug: string | null;
  category: string;
  city: string;
  state: string;
}

const PUBLIC_STATUSES = new Set(['published', 'invited']);
const TERMINAL_STATES = new Set(['claimed', 'suppressed', 'freshness_verified', 'freshness_failed']);

function baseUrl(): string {
  return (unifiedConfig.frontendUrl || unifiedConfig.webUrl || '').replace(/\/+$/, '');
}

function toTouchChannel(channel: AnnounceChannel): 'call' | 'email' | 'other' {
  return channel;
}

export class SeedAnnounceService extends BaseService {
  private static instance: SeedAnnounceService;

  private constructor() {
    super();
  }

  static getInstance(): SeedAnnounceService {
    if (!SeedAnnounceService.instance) {
      SeedAnnounceService.instance = new SeedAnnounceService();
    }
    return SeedAnnounceService.instance;
  }

  private async loadSeed(seedId: string): Promise<SeedRow | null> {
    const rows = await prisma.$queryRaw<SeedRow[]>`
      SELECT
        dps.id,
        dps.tenant_id,
        dps.status,
        dps.owner_phone,
        dps.owner_email,
        dps.published_at,
        dps.category,
        dps.city,
        dps.state,
        dl.business_name,
        dl.phone AS listing_phone,
        dl.email AS listing_email,
        dl.slug
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private resolveChannel(seed: SeedRow): AnnounceChannel {
    if (seed.owner_phone || seed.listing_phone) return 'call';
    if (seed.owner_email || seed.listing_email) return 'email';
    return 'other';
  }

  /**
   * Write the `announce_scheduled` marker for a published seed. Idempotent:
   * a seed with a scheduled or delivered marker is skipped.
   */
  async scheduleForSeed(seedId: string, ctx?: SeedAnnounceCtx): Promise<ScheduleAnnounceResult> {
    const seed = await this.loadSeed(seedId);
    if (!seed) return { scheduled: false, reason: 'seed_not_found' };
    if (!PUBLIC_STATUSES.has(seed.status)) {
      return { scheduled: false, reason: 'seed_not_public' };
    }

    const existing = await prisma.$queryRaw<any[]>`
      SELECT outcome FROM directory_seed_outreach_touches
      WHERE seed_id = ${seedId}
        AND outcome IN ('announce_scheduled', 'announce_delivered')
      LIMIT 1
    `;
    if (existing[0]) {
      return { scheduled: false, reason: 'already_scheduled' };
    }

    const branding = await loadAnnounceBranding();
    if (branding.missingRequired.length > 0) {
      logger.warn('SeedAnnounceService: announce blocked — identification incomplete', undefined, {
        seedId,
        missingRequired: branding.missingRequired,
      });
      return { scheduled: false, reason: 'branding_incomplete', missingRequired: branding.missingRequired };
    }

    const channel = this.resolveChannel(seed);
    const claimUrl = await resolveClaimUrlForSeed(seedId).catch(() => null);
    const base = baseUrl();
    const placeUrl = seed.slug ? `${base}/place/${seed.slug}` : null;

    const messageParts: string[] = [
      `${branding.platformName} published a listing for ${seed.business_name || 'your business'}${placeUrl ? ` at ${placeUrl}` : ''}.`,
    ];
    if (claimUrl) {
      messageParts.push(`If this is your business, you can claim it here: ${claimUrl}`);
    }
    messageParts.push(
      `Questions? ${branding.contactPhone} · ${branding.contactEmail}`,
    );

    const metadata = {
      trigger_source: 'publish',
      channel,
      claim_url: claimUrl,
      place_url: placeUrl,
      identification: {
        platform_name: branding.platformName,
        contact_email: branding.contactEmail,
        contact_phone: branding.contactPhone,
        contact_address: branding.contactAddress,
        contact_website: branding.contactWebsite,
        socials: branding.socials,
      },
      identification_source: branding.source,
      identification_snapshot_date: branding.snapshotDate,
      missing_social: branding.missingSocial,
      operator_note: claimUrl
        ? null
        : 'No active claim token — use Generate Claim Invite before sending the tracked /qe/ link.',
    };

    const { default: seedService } = await import('./DirectoryPresenceSeedService.js');
    await seedService.addOutreachTouch(
      seedId,
      {
        channel: toTouchChannel(channel),
        outcome: 'announce_scheduled',
        notes: messageParts.join('\n\n'),
        metadata,
      },
      { actorId: ctx?.actorId || 'system', actorType: ctx?.actorType || 'system' },
    );
    await seedService.setOutreachState(seedId, 'outreach_scheduled', {
      actorId: ctx?.actorId || 'system',
      actorType: ctx?.actorType || 'system',
    });

    audit({
      actor: ctx?.actorId || 'system',
      actorType: ctx?.actorType || 'system',
      action: 'directory_presence_seed.announce_scheduled',
      payload: { seedId, channel, claimUrl, placeUrl },
    });

    logger.info('SeedAnnounceService.scheduleForSeed', undefined, {
      seedId,
      channel,
      claimUrl,
      hasBrandingSocial: !branding.missingSocial,
    });

    return { scheduled: true, channel, claimUrl };
  }

  /**
   * Record the announce as delivered. Idempotent; does not overwrite terminal
   * or freshness states.
   */
  async markDelivered(
    seedId: string,
    input: {
      channel?: AnnounceChannel;
      notes?: string;
      verificationResults?: Array<Record<string, any>>;
      metadata?: Record<string, any>;
    } = {},
    ctx?: SeedAnnounceCtx,
  ): Promise<MarkDeliveredResult> {
    const seed = await this.loadSeed(seedId);
    if (!seed) return { delivered: false, reason: 'seed_not_found' };

    const existing = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM directory_seed_outreach_touches
      WHERE seed_id = ${seedId} AND outcome = 'announce_delivered'
      LIMIT 1
    `;
    if (existing[0]) {
      return { delivered: false, reason: 'already_delivered' };
    }

    const channel = input.channel || this.resolveChannel(seed);
    const metadata = {
      trigger_source: 'operator',
      channel,
      delivered_at: new Date().toISOString(),
      delivered_by: ctx?.actorId || null,
      verification_results: input.verificationResults ?? null,
      ...(input.metadata ?? {}),
    };

    const { default: seedService } = await import('./DirectoryPresenceSeedService.js');
    await seedService.addOutreachTouch(
      seedId,
      {
        channel: toTouchChannel(channel),
        outcome: 'announce_delivered',
        notes: input.notes,
        metadata,
      },
      { actorId: ctx?.actorId || 'system', actorType: ctx?.actorType || 'system' },
    );

    // Keep the courtesy/verification state coherent, but never regress a
    // freshness verdict or a terminal state.
    const current = await prisma.$queryRaw<any[]>`
      SELECT outreach_state FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    const currentState = current[0]?.outreach_state;
    if (currentState && !TERMINAL_STATES.has(currentState) && currentState !== 'owner_contacted') {
      await seedService.setOutreachState(seedId, 'owner_contacted', {
        actorId: ctx?.actorId || 'system',
        actorType: ctx?.actorType || 'system',
      });
    }

    audit({
      actor: ctx?.actorId || 'system',
      actorType: ctx?.actorType || 'system',
      action: 'directory_presence_seed.announce_delivered',
      payload: { seedId, channel, verificationResults: input.verificationResults ?? null },
    });

    logger.info('SeedAnnounceService.markDelivered', undefined, { seedId, channel });

    return { delivered: true, channel };
  }

  /**
   * Resolve the campaign's primary-linked seed and record delivery. Used by
   * the campaign outreach route when the operator ticks "announce delivered".
   */
  async markDeliveredForCampaign(
    campaignId: string,
    input: {
      channel?: AnnounceChannel;
      notes?: string;
      verificationResults?: Array<Record<string, any>>;
      metadata?: Record<string, any>;
    } = {},
    ctx?: SeedAnnounceCtx,
  ): Promise<MarkDeliveredResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT seed_id FROM directory_seed_campaign_links
      WHERE campaign_id = ${campaignId}
        AND link_role = 'primary'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows[0]) return { delivered: false, reason: 'no_primary_seed' };
    return this.markDelivered(rows[0].seed_id, input, ctx);
  }

  async isAnnounced(seedId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM directory_seed_outreach_touches
      WHERE seed_id = ${seedId} AND outcome = 'announce_delivered'
      LIMIT 1
    `;
    return !!rows[0];
  }

  /**
   * The announce queue: published/invited seeds with a scheduled marker and
   * no delivered marker, oldest first by published_at.
   */
  async listQueue(options: { limit?: number; offset?: number } = {}): Promise<AnnounceQueueRow[]> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dps.id AS seed_id,
        dps.tenant_id,
        dps.status,
        dps.category,
        dps.city,
        dps.state,
        dps.published_at,
        dps.owner_phone,
        dps.owner_email,
        dl.business_name,
        dl.phone AS listing_phone,
        dl.email AS listing_email,
        sched.occurred_at AS announce_scheduled_at,
        sched.metadata->>'channel' AS channel,
        sched.metadata->>'claim_url' AS claim_url,
        sched.metadata->>'place_url' AS place_url
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      JOIN LATERAL (
        SELECT occurred_at, metadata
        FROM directory_seed_outreach_touches
        WHERE seed_id = dps.id AND outcome = 'announce_scheduled'
        ORDER BY occurred_at DESC
        LIMIT 1
      ) sched ON true
      WHERE dps.status IN ('published', 'invited')
        AND NOT EXISTS (
          SELECT 1 FROM directory_seed_outreach_touches d
          WHERE d.seed_id = dps.id AND d.outcome = 'announce_delivered'
        )
      ORDER BY dps.published_at ASC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    return rows.map((r) => {
      const publishedAt = r.published_at ? new Date(r.published_at) : null;
      const ageDays = publishedAt
        ? Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000))
        : null;
      return {
        seedId: r.seed_id,
        tenantId: r.tenant_id,
        status: r.status,
        businessName: r.business_name ?? null,
        category: r.category,
        city: r.city,
        state: r.state,
        publishedAt: publishedAt ? publishedAt.toISOString() : null,
        ageDays,
        announceScheduledAt: r.announce_scheduled_at
          ? new Date(r.announce_scheduled_at).toISOString()
          : null,
        channel: r.channel ?? null,
        claimUrl: r.claim_url ?? null,
        placeUrl: r.place_url ?? null,
        ownerPhone: r.owner_phone ?? null,
        ownerEmail: r.owner_email ?? null,
        listingPhone: r.listing_phone ?? null,
        listingEmail: r.listing_email ?? null,
      };
    });
  }
}

export default SeedAnnounceService.getInstance();
