/**
 * HasDataGroundTruthService — opt-in Google Maps ground-truth packets
 * (OUTREACH_TOUCH_LADDER_SPEC §14).
 *
 * The `google_maps_ground_truth` directive fetches a live Maps packet —
 * rating, review corpus, owner-response stats, topics, posts — and injects
 * it into the audit prompt as the `=== GOOGLE MAPS GROUND TRUTH ===` +
 * `=== REVIEW CORPUS ===` context blocks. It manufactures the audit's
 * attributable pains (§2.1): findings the prospect can verify on their
 * own surface.
 *
 * Credits are a managed spend (§14.2):
 * - Explicit directive only — never implicit per-render.
 * - Cache-first: `mkt_ground_truth_packets` (migration 354) keyed
 *   (campaign_id, level), TTL PACKET_TTL_DAYS. Resolved place_id/data_id
 *   persist on the row so refreshes skip the paid search call.
 * - latest-N reviews by default; 'deep' adds posts/photos for forensics.
 * - Missing HASDATA_API_KEY → unavailable, never a hard failure.
 *
 * Pattern: singleton extends BaseService
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { unifiedConfig } from '../config/unifiedConfig';
import { generateOutreachIntelligenceId } from '../lib/id-generator';

// ─── Constants ──────────────────────────────────────────────────────────

const API_BASE = 'https://api.hasdata.com/scrape/google-maps';
const PACKET_TTL_DAYS = 30;
/** ~10 credits per endpoint call (validated against the MCP/REST parity). */
const CREDITS_PER_CALL = 10;

export type GroundTruthLevel = 'latest' | 'deep';

export interface GroundTruthReview {
  rating: number | null;
  date: string | null;
  text: string | null;
  owner_responded: boolean;
}

export interface GroundTruthPacket {
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  primary_type: string | null;
  types: string[];
  place_id: string | null;
  data_id: string | null;
  reviews: GroundTruthReview[];
  topics: string[];
  posts_count: number | null;
  photos_count: number | null;
  /** Derived: share of observable reviews with an owner response. */
  owner_response_rate_observable: number | null;
  review_corpus_size: number;
  latest_review_at: string | null;
  fetched_at: string;
  level: GroundTruthLevel;
  credits_spent: number;
}

export interface PacketStatus {
  cached: boolean;
  level: GroundTruthLevel | null;
  fetched_at: string | null;
  est_credits: number;
  configured: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────

export class HasDataGroundTruthService extends BaseService {
  private static instance: HasDataGroundTruthService;

  private constructor() {
    super();
  }

  static getInstance(): HasDataGroundTruthService {
    if (!HasDataGroundTruthService.instance) {
      HasDataGroundTruthService.instance = new HasDataGroundTruthService();
    }
    return HasDataGroundTruthService.instance;
  }

  /**
   * Cache status + cost estimate for the workspace knob (§14.1a): the
   * checkbox shows "cached packet · 0 credits" vs "~35 credits".
   */
  async getPacketStatus(campaignId: string, level: GroundTruthLevel): Promise<PacketStatus> {
    const configured = !!unifiedConfig.hasdataApiKey;
    const cached = await this.readFreshPacket(campaignId, level);
    // Cost estimate: cached → 0; place_id already on file → details +
    // reviews (+posts/photos on deep) without the paid search resolve.
    const hasPlace = !!cached?.place_id || !!(await this.readAnyPacket(campaignId))?.place_id;
    const calls = hasPlace ? (level === 'deep' ? 4 : 2) : level === 'deep' ? 5 : 3;
    return {
      cached: !!cached,
      level: cached ? level : null,
      fetched_at: cached?.fetched_at ?? null,
      est_credits: cached ? 0 : calls * CREDITS_PER_CALL,
      configured,
    };
  }

  /**
   * Fetch-or-cache a packet for a campaign. Returns null when the key is
   * unconfigured, the business can't be resolved, or the fetch fails —
   * callers degrade to `ground_truth: unavailable`, never throw.
   */
  async getPacket(
    campaignId: string,
    level: GroundTruthLevel,
    ctx?: RequestCtx,
  ): Promise<GroundTruthPacket | null> {
    const apiKey = unifiedConfig.hasdataApiKey;
    if (!apiKey) {
      logger.warn('HASDATA_API_KEY not configured; ground truth unavailable', ctx, { campaignId });
      return null;
    }

    // 1. Cache-first — fresh packet within TTL
    const cached = await this.readFreshPacket(campaignId, level);
    if (cached) return cached.packet as GroundTruthPacket;

    // 2. Load campaign identity for the resolve query
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { business_name: true, address_line1: true, address_city: true, address_state: true, city: true, state: true, phone: true, website: true },
    });
    if (!campaign?.business_name) {
      logger.warn('Ground-truth fetch skipped — campaign has no business_name', ctx, { campaignId });
      return null;
    }

    // 3. Resolve the place — reuse a persisted place_id/data_id from any
    //    prior packet row to skip the paid search call.
    const prior = await this.readAnyPacket(campaignId);
    let placeId: string | null = prior?.place_id ?? null;
    let dataId: string | null = prior?.data_id ?? null;
    let credits = 0;

    try {
      if (!placeId && !dataId) {
        const q = [campaign.business_name, campaign.address_city ?? campaign.city, campaign.address_state ?? campaign.state]
          .filter(Boolean)
          .join(', ');
        const search = await this.hasdata(apiKey, '/search', { q });
        credits += CREDITS_PER_CALL;
        const hit = (search?.localResults?.[0] ?? search?.local_results?.[0] ?? search?.results?.[0]) as any;
        placeId = hit?.placeId ?? hit?.place_id ?? null;
        dataId = hit?.dataId ?? hit?.data_id ?? null;
        if (!placeId && !dataId) {
          logger.warn('Ground-truth resolve found no place', ctx, { campaignId, q });
          return null;
        }
      }

      const idParam: Record<string, string> = placeId ? { placeId } : { dataId: dataId! };
      const details = await this.hasdata(apiKey, '/details', idParam);
      credits += CREDITS_PER_CALL;
      const reviews = await this.hasdata(apiKey, '/reviews', { ...idParam, sort: 'newestFirst' });
      credits += CREDITS_PER_CALL;
      let posts: any = null;
      let photos: any = null;
      if (level === 'deep') {
        posts = await this.hasdata(apiKey, '/posts', idParam).catch(() => null);
        photos = await this.hasdata(apiKey, '/photos', idParam).catch(() => null);
        credits += CREDITS_PER_CALL * 2;
      }

      const packet = this.normalizePacket(details, reviews, posts, photos, { placeId, dataId, level, credits });
      await this.persistPacket(campaignId, packet, ctx);
      return packet;
    } catch (err) {
      logger.warn('Ground-truth fetch failed (non-fatal)', ctx, {
        campaignId,
        level,
        error: (err as Error).message,
      });
      return null;
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async hasdata(apiKey: string, path: string, params: Record<string, string>): Promise<any> {
    const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`hasdata ${path} → ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  private async readFreshPacket(campaignId: string, level: GroundTruthLevel): Promise<any | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, packet, place_id, data_id, fetched_at
        FROM mkt_ground_truth_packets
        WHERE campaign_id = ${campaignId}
          AND level = ${level}
          AND fetched_at > now() - make_interval(days => ${PACKET_TTL_DAYS})
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch {
      // Cache table may not exist on envs without migration 354 — degrade
      // to a live fetch rather than failing the render.
      return null;
    }
  }

  /** Any prior packet regardless of level/freshness — used for place-id reuse. */
  private async readAnyPacket(campaignId: string): Promise<any | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, place_id, data_id, packet, fetched_at
        FROM mkt_ground_truth_packets
        WHERE campaign_id = ${campaignId}
        ORDER BY fetched_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  private normalizePacket(
    details: any,
    reviews: any,
    posts: any,
    photos: any,
    meta: { placeId: string | null; dataId: string | null; level: GroundTruthLevel; credits: number },
  ): GroundTruthPacket {
    const reviewRows = ((reviews?.reviews ?? reviews?.userReviews?.reviews ?? []) as any[])
      .slice(0, 20)
      .map((r) => ({
        rating: typeof r?.rating === 'number' ? r.rating : null,
        date: r?.date ?? r?.datetime ?? r?.reviewDate ?? null,
        text: r?.snippet ?? r?.text ?? r?.description ?? null,
        owner_responded: !!(r?.responseFromOwnerText ?? r?.response_from_owner ?? r?.ownerResponse),
      }));
    const responded = reviewRows.filter((r) => r.owner_responded).length;
    const topics = ((details?.userReviews?.topics ?? details?.topics ?? []) as any[])
      .map((t) => (typeof t === 'string' ? t : t?.keyword ?? t?.name))
      .filter((t): t is string => typeof t === 'string' && !!t);
    const postsArr = posts?.posts ?? posts;
    const photosArr = photos?.photos ?? photos;

    return {
      business_name: details?.name ?? null,
      address: details?.address ?? details?.fullAddress ?? null,
      phone: details?.phone ?? details?.phoneNumber ?? null,
      website: details?.website ?? details?.websiteUrl ?? null,
      rating: typeof details?.rating === 'number' ? details.rating : null,
      review_count: typeof details?.reviewCount === 'number' ? details.reviewCount : (details?.reviews ?? null),
      primary_type: details?.type ?? null,
      types: Array.isArray(details?.types) ? details.types : [],
      place_id: meta.placeId,
      data_id: meta.dataId,
      reviews: reviewRows,
      topics,
      posts_count: Array.isArray(postsArr) ? postsArr.length : null,
      photos_count: Array.isArray(photosArr) ? photosArr.length : (typeof photosArr?.photosCount === 'number' ? photosArr.photosCount : null),
      owner_response_rate_observable: reviewRows.length > 0 ? responded / reviewRows.length : null,
      review_corpus_size: reviewRows.length,
      latest_review_at: reviewRows[0]?.date ?? null,
      fetched_at: new Date().toISOString(),
      level: meta.level,
      credits_spent: meta.credits,
    };
  }

  private async persistPacket(
    campaignId: string,
    packet: GroundTruthPacket,
    ctx?: RequestCtx,
  ): Promise<void> {
    try {
      const id = generateOutreachIntelligenceId();
    await this.prisma.$executeRaw`
      INSERT INTO mkt_ground_truth_packets (
        id, campaign_id, place_id, data_id, level, packet, credits_spent, fetched_at, fetched_by
      ) VALUES (
        ${id}, ${campaignId}, ${packet.place_id}, ${packet.data_id}, ${packet.level},
        ${JSON.stringify(packet)}::jsonb, ${packet.credits_spent}, ${packet.fetched_at}::timestamptz,
        ${ctx?.userId ?? null}
      )
      ON CONFLICT (campaign_id, level) DO UPDATE SET
        place_id      = EXCLUDED.place_id,
        data_id       = EXCLUDED.data_id,
        packet        = EXCLUDED.packet,
        credits_spent = EXCLUDED.credits_spent,
        fetched_at    = EXCLUDED.fetched_at,
        fetched_by    = EXCLUDED.fetched_by,
        updated_at    = now()
    `;
      logger.info('Ground-truth packet persisted', ctx, {
        campaignId,
        level: packet.level,
        credits: packet.credits_spent,
        reviewCorpus: packet.review_corpus_size,
      });
    } catch (err) {
      // Cache persistence is best-effort — the packet still serves this
      // render even when the row can't be written.
      logger.warn('Ground-truth packet persist failed (non-fatal)', ctx, {
        campaignId,
        error: (err as Error).message,
      });
    }
  }
}

export default HasDataGroundTruthService.getInstance();
