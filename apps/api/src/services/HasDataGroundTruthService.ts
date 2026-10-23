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
 * - Cache-first: `mkt_ground_truth_packets` (migration 354) written per
 *   (campaign_id, level) but READ at prospect scope — siblings sharing
 *   business_prospect_id serve each other's freshest packet within
 *   TTL PACKET_TTL_DAYS. Resolved place_id/data_id persist on the row so
 *   refreshes skip the paid search call; writes stay per-campaign to
 *   keep credit attribution honest.
 * - In-flight dedupe: renders that land together for the same
 *   prospect+level share one fetch, so a resolved-prompt preview and the
 *   Execute that follows it cannot both pay for the same packet.
 * - `fetchPacket` reports `cached` + the credits THIS call consumed;
 *   `getPacket` is the packet-only wrapper for existing callers.
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

export const PACKET_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
type PacketDay = (typeof PACKET_DAYS)[number];

export interface GroundTruthDayHours {
  open: string;
  close: string;
  closed: boolean;
}

/** Canonical day grid — the same shape the audit's business_hours contract emits. */
export type GroundTruthHours = Partial<Record<PacketDay, GroundTruthDayHours>> & {
  timezone?: string;
};

const MERIDIEM_RE = /(a\.?m\.?|p\.?m\.?)/i;

function parseTimeToken(token: string, fallbackMeridiem?: 'am' | 'pm'): number | null {
  const m = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] ? m[3].replace(/\./g, '').toLowerCase() : fallbackMeridiem) as 'am' | 'pm' | undefined;
  if (h > 24 || h === 0 || min > 59) return null;
  if (!mer) {
    // Bare hour with no meridiem anywhere — treat only unambiguous 24h
    // tokens (>12) as times; a bare "8" can't be resolved honestly.
    if (h <= 12) return null;
    return h * 60 + min;
  }
  if (mer === 'am') h = h === 12 ? 0 : h;
  else h = h === 12 ? 12 : h + 12;
  return h * 60 + min;
}

const fmtMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * Converts HasData's `/place` `workingHours` payload —
 * `{ timezone, days: [{ day: "Friday", time: "10 AM–8 PM" | "Closed" }] }` —
 * into the canonical day grid. Returns null when nothing parses so the
 * packet reads "not measured" rather than carrying a wrong schedule.
 *
 * Split-day ranges ("9 AM–12 PM, 4–8 PM") collapse to the day's outer
 * span — the flat grid holds one open/close pair; intra-day breaks are
 * the owner's special-hours surface post-claim. Overnight closes
 * (10 AM–12 AM) render as 00:00.
 */
export function parseHasDataWorkingHours(wh: any): GroundTruthHours | null {
  const days = wh?.days;
  if (!Array.isArray(days) || days.length === 0) return null;
  const out: GroundTruthHours = {};
  if (typeof wh.timezone === 'string' && wh.timezone) out.timezone = wh.timezone;

  for (const d of days) {
    const key = String(d?.day ?? '').trim().toLowerCase() as PacketDay;
    if (!(PACKET_DAYS as readonly string[]).includes(key)) continue;
    const raw = String(d?.time ?? '').trim();
    if (!raw || /^closed$/i.test(raw)) {
      // Placeholder times mirror the EMPTY_HOURS closed-day convention.
      out[key] = { open: '09:00', close: '18:00', closed: true };
      continue;
    }
    if (/open\s*24\s*hours/i.test(raw)) {
      out[key] = { open: '00:00', close: '23:59', closed: false };
      continue;
    }
    const ranges = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const opens: number[] = [];
    const closes: number[] = [];
    let overnight = false;
    for (const r of ranges) {
      const parts = r.split(/\s*[–—−-]\s*/);
      if (parts.length !== 2) continue;
      const closeMer = MERIDIEM_RE.test(parts[1]) ? (parts[1].toLowerCase().includes('p') ? 'pm' : 'am') : undefined;
      const openMer = MERIDIEM_RE.test(parts[0]) ? (parts[0].toLowerCase().includes('p') ? 'pm' : 'am') : undefined;
      const closeM = parseTimeToken(parts[1], openMer);
      const openM = parseTimeToken(parts[0], closeMer);
      if (openM === null || closeM === null) continue;
      opens.push(openM);
      closes.push(closeM);
      if (closeM <= openM) overnight = true;
    }
    if (!opens.length) continue;
    out[key] = {
      open: fmtMinutes(Math.min(...opens)),
      close: overnight ? '00:00' : fmtMinutes(Math.max(...closes)),
      closed: false,
    };
  }

  return PACKET_DAYS.some((d) => out[d]) ? out : null;
}

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
  /** Listing's live open-state string, e.g. "Closed · Opens 10 AM". */
  open_state: string | null;
  /** Measured weekly schedule in the canonical day-grid shape, null when the listing exposes none. */
  hours: GroundTruthHours | null;
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
  /** Credits this render will spend — 0 while the cached row is fresh. */
  est_credits: number;
  /** Credits a forced refresh would spend (what the knob's price is). */
  refresh_credits: number;
  configured: boolean;
}

/**
 * Fetch-or-cache outcome. `credits_spent` is what THIS call actually
 * consumed — 0 on a cache hit and 0 when the call joined a concurrent
 * render's in-flight fetch, so a caller logging it reports real spend
 * rather than the packet's historical `credits_spent`.
 */
export interface GroundTruthFetchResult {
  packet: GroundTruthPacket | null;
  cached: boolean;
  credits_spent: number;
}

// ─── Service ────────────────────────────────────────────────────────────

export class HasDataGroundTruthService extends BaseService {
  private static instance: HasDataGroundTruthService;

  /** prospect|level → the fetch currently running, so concurrent renders share it. */
  private inFlight = new Map<string, Promise<GroundTruthPacket | null>>();

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
   * checkbox shows "cached packet · 0 credits" vs the live-fetch estimate.
   */
  async getPacketStatus(campaignId: string, level: GroundTruthLevel): Promise<PacketStatus> {
    const configured = !!unifiedConfig.hasdataApiKey;
    const cached = await this.readFreshPacket(campaignId, level);
    // Cost estimate: cached → 0; place_id already on file → details +
    // reviews (+posts/photos on deep) without the paid search resolve.
    const hasPlace = !!cached?.place_id || !!(await this.readAnyPacket(campaignId))?.place_id;
    const calls = hasPlace ? (level === 'deep' ? 4 : 2) : level === 'deep' ? 5 : 3;
    const freshCredits = calls * CREDITS_PER_CALL;
    return {
      cached: !!cached,
      level: cached ? level : null,
      fetched_at: cached?.fetched_at ?? null,
      est_credits: cached ? 0 : freshCredits,
      // Cached renders spend 0, but the knob still needs the price of a
      // forced refresh — reporting est_credits there would say "~0 credits".
      refresh_credits: freshCredits,
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
    return (await this.fetchPacket(campaignId, level, ctx)).packet;
  }

  /**
   * Fetch-or-cache with provenance: `cached` distinguishes a 0-credit DB
   * hit from a live fetch, and `credits_spent` reports what this call
   * actually consumed. Concurrent renders for the same prospect+level
   * share one fetch — the joined callers report 0 credits because the
   * leader already paid.
   */
  async fetchPacket(
    campaignId: string,
    level: GroundTruthLevel,
    ctx?: RequestCtx,
  ): Promise<GroundTruthFetchResult> {
    const apiKey = unifiedConfig.hasdataApiKey;
    if (!apiKey) {
      logger.warn('HASDATA_API_KEY not configured; ground truth unavailable', ctx, { campaignId });
      return { packet: null, cached: false, credits_spent: 0 };
    }

    // 1. Cache-first — fresh packet within TTL
    const cached = await this.readFreshPacket(campaignId, level);
    if (cached) return { packet: cached.packet as GroundTruthPacket, cached: true, credits_spent: 0 };

    // 2. Campaign identity — the resolve query needs it, and its
    //    business_prospect_id keys the in-flight map so sibling campaigns
    //    on one prospect share a single paid fetch.
    let campaign: any = null;
    try {
      campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { business_name: true, address_line1: true, address_city: true, address_state: true, city: true, state: true, phone: true, website_url: true, business_prospect_id: true },
      });
    } catch (err) {
      logger.warn('Ground-truth campaign lookup failed (non-fatal)', ctx, {
        campaignId,
        error: (err as Error).message,
      });
    }
    if (!campaign?.business_name) {
      logger.warn('Ground-truth fetch skipped — campaign has no business_name', ctx, { campaignId });
      return { packet: null, cached: false, credits_spent: 0 };
    }

    // 3. In-flight dedupe — two renders landing together (a resolved-prompt
    //    preview followed by Execute, or sibling campaigns on one prospect)
    //    must not both pay for the same packet.
    const key = campaign.business_prospect_id
      ? `prospect:${campaign.business_prospect_id}:${level}`
      : `campaign:${campaignId}:${level}`;
    const joined = this.inFlight.get(key);
    if (joined) {
      logger.info('Ground-truth fetch joined an in-flight request', ctx, { campaignId, level, key });
      return { packet: await joined, cached: false, credits_spent: 0 };
    }

    const task = this.fetchAndPersist(campaignId, level, apiKey, campaign, ctx);
    this.inFlight.set(key, task);
    try {
      const packet = await task;
      return { packet, cached: false, credits_spent: packet?.credits_spent ?? 0 };
    } finally {
      if (this.inFlight.get(key) === task) this.inFlight.delete(key);
    }
  }

  /**
   * Live fetch + persist. Separated so the in-flight map can hold the
   * promise itself; never throws (callers get null on failure).
   */
  private async fetchAndPersist(
    campaignId: string,
    level: GroundTruthLevel,
    apiKey: string,
    campaign: any,
    ctx?: RequestCtx,
  ): Promise<GroundTruthPacket | null> {
    // Resolve the place — reuse a persisted place_id/data_id from any
    // prior packet row to skip the paid search call.
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
        // placeResults is the hit object for a single-result query (array
        // when ambiguous) — verified against the live REST contract.
        const pr = search?.placeResults;
        const hit = (Array.isArray(pr) ? pr[0] : (pr?.placeId || pr?.dataId ? pr : null))
          ?? search?.localResults?.[0] ?? search?.local_results?.[0] ?? search?.results?.[0];
        placeId = hit?.placeId ?? hit?.place_id ?? null;
        dataId = hit?.dataId ?? hit?.data_id ?? null;
        if (!placeId && !dataId) {
          logger.warn('Ground-truth resolve found no place', ctx, { campaignId, q });
          return null;
        }
      }

      const idParam: Record<string, string> = placeId ? { placeId } : { dataId: dataId! };
      const details = await this.hasdata(apiKey, '/place', idParam);
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

  /**
   * Fresh packet within TTL, scoped to the PROSPECT — a sibling campaign's
   * fresh packet (same business_prospect_id) serves this render too, so one
   * fetch covers every campaign looking at the same listing.
   */
  private async readFreshPacket(campaignId: string, level: GroundTruthLevel): Promise<any | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT p.id, p.packet, p.place_id, p.data_id, p.fetched_at
        FROM mkt_ground_truth_packets p
        JOIN mkt_campaigns_list c ON c.id = p.campaign_id
        WHERE p.level = ${level}
          AND p.fetched_at > now() - make_interval(days => ${PACKET_TTL_DAYS}::int)
          AND (
            p.campaign_id = ${campaignId}
            OR (
              c.business_prospect_id IS NOT NULL
              AND c.business_prospect_id = (
                SELECT business_prospect_id FROM mkt_campaigns_list WHERE id = ${campaignId}
              )
            )
          )
        ORDER BY p.fetched_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    } catch {
      // Cache table may not exist on envs without migration 354 — degrade
      // to a live fetch rather than failing the render.
      return null;
    }
  }

  /**
   * Any prior packet across the prospect regardless of level/freshness —
   * used for place-id reuse so a sibling's resolve skips the paid /search.
   */
  private async readAnyPacket(campaignId: string): Promise<any | null> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT p.id, p.place_id, p.data_id, p.packet, p.fetched_at
        FROM mkt_ground_truth_packets p
        JOIN mkt_campaigns_list c ON c.id = p.campaign_id
        WHERE p.campaign_id = ${campaignId}
           OR (
             c.business_prospect_id IS NOT NULL
             AND c.business_prospect_id = (
               SELECT business_prospect_id FROM mkt_campaigns_list WHERE id = ${campaignId}
             )
           )
        ORDER BY p.fetched_at DESC
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
    // Live contract (verified): /place → { placeResults: {title, rating,
    // reviews, type, types[], address, phone, website, ...} }; /reviews →
    // { topics: [{keyword, mentions}], reviews: [{rating, isoDate, date,
    // snippet, response?: {snippet}}] }.
    const d = details?.placeResults ?? details;
    const reviewRows = ((reviews?.reviews ?? reviews?.userReviews?.reviews ?? []) as any[])
      .slice(0, 20)
      .map((r) => ({
        rating: typeof r?.rating === 'number' ? r.rating : null,
        date: r?.isoDate ?? r?.date ?? r?.datetime ?? r?.reviewDate ?? null,
        text: r?.snippet ?? r?.text ?? r?.description ?? null,
        owner_responded: !!(r?.response?.snippet ?? r?.response ?? r?.responseFromOwnerText ?? r?.response_from_owner ?? r?.ownerResponse),
      }));
    const responded = reviewRows.filter((r) => r.owner_responded).length;
    // HasData row order isn't chronological — take the max parsed date.
    const reviewTimes = reviewRows
      .map((r) => (r.date ? Date.parse(r.date) : NaN))
      .filter((t) => Number.isFinite(t));
    const latestReviewAt = reviewTimes.length > 0 ? new Date(Math.max(...reviewTimes)).toISOString() : null;
    const topics = ((reviews?.topics ?? details?.userReviews?.topics ?? d?.topics ?? []) as any[])
      .map((t) => (typeof t === 'string' ? t : t?.keyword ?? t?.name))
      .filter((t): t is string => typeof t === 'string' && !!t);
    const postsArr = posts?.posts ?? posts;
    const photosArr = photos?.photos ?? photos;

    return {
      business_name: d?.title ?? d?.name ?? null,
      address: d?.address ?? d?.fullAddress ?? null,
      phone: d?.phone ?? d?.phoneNumber ?? null,
      website: d?.website ?? d?.websiteUrl ?? null,
      rating: typeof d?.rating === 'number' ? d.rating : null,
      review_count: typeof d?.reviews === 'number' ? d.reviews : (typeof d?.reviewCount === 'number' ? d.reviewCount : null),
      primary_type: d?.type ?? null,
      types: Array.isArray(d?.types) ? d.types : [],
      place_id: meta.placeId,
      data_id: meta.dataId,
      reviews: reviewRows,
      topics,
      posts_count: Array.isArray(postsArr) ? postsArr.length : null,
      photos_count: Array.isArray(photosArr) ? photosArr.length : (typeof photosArr?.photosCount === 'number' ? photosArr.photosCount : null),
      owner_response_rate_observable: reviewRows.length > 0 ? responded / reviewRows.length : null,
      open_state: typeof d?.openState === 'string' ? d.openState : null,
      hours: parseHasDataWorkingHours(d?.workingHours),
      review_corpus_size: reviewRows.length,
      latest_review_at: latestReviewAt,
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
