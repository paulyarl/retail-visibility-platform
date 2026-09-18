/**
 * DirectoryPresenceAnalyticsService — Layer 3 engagement analytics for the
 * directory presence traffic surface.
 *
 * Mirrors GalleryAnalyticsService (fire-and-forget track + query methods),
 * but is slug-scoped rather than token-scoped: seed listings are public
 * browse pages, so the slug is the trust boundary.
 *
 * Captures: listing_viewed, claim_clicked, call_clicked, directions_clicked,
 * storefront_clicked, qr_scanned, session_heartbeat, session_end — into
 * `directory_presence_events` (migration 293).
 *
 * Serves BOTH entry surfaces: unclaimed seeds (/place/[slug] — claim_clicked)
 * and claimed tenants (/directory/[slug] — storefront_clicked, call_clicked).
 *
 * NOTE: `qr_scanned` is RESERVED / forward-compatibility only. Real QR scans are
 * authoritative in `qr_scan_events` (server-side redirect tracking via
 * /qr/claim/:token, /r/seed/:seedId/:channel) — do not double-track them here.
 *
 * Uses raw SQL against the events table rather than a Prisma model so the
 * readout does not depend on a `prisma db pull` + client regeneration.
 *
 * See docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §4, §5.
 */

import crypto from 'crypto';
import { BaseService } from './BaseService';
import { generateDirectoryPresenceEventId } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { clampTrafficWindow, type TrafficWindow } from './DirectoryPresenceTrafficService';

export type DirectoryPresenceEventType =
  | 'listing_viewed'
  | 'shelf_viewed'
  | 'listing_clicked'
  | 'filter_applied'
  | 'claim_clicked'
  | 'call_clicked'
  | 'directions_clicked'
  | 'storefront_clicked'
  | 'qr_scanned'
  | 'session_heartbeat'
  | 'session_end';

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

/** Which directory surface emitted an event (migration 295). */
export const DIRECTORY_SURFACES = [
  'place_entry',
  'directory_entry',
  'place_category',
  'place_city',
  'directory_category',
  'directory_location',
  'directory_store_type',
  'directory_home',
] as const;

export type DirectorySurface = (typeof DIRECTORY_SURFACES)[number];

/** Shelf surfaces only — the ones served by the public shelf event route. */
export const DIRECTORY_SHELF_SURFACES = [
  'place_category',
  'place_city',
  'directory_category',
  'directory_location',
  'directory_store_type',
  'directory_home',
] as const;

export const ALLOWED_DIRECTORY_PRESENCE_EVENT_TYPES: DirectoryPresenceEventType[] = [
  'listing_viewed',
  'shelf_viewed',
  'listing_clicked',
  'filter_applied',
  'claim_clicked',
  'call_clicked',
  'directions_clicked',
  'storefront_clicked',
  'qr_scanned',
  'session_heartbeat',
  'session_end',
];

export interface DirectoryPresenceEventInput {
  /** Nullable — shelf events carry no tenant. */
  tenantId?: string | null;
  /** Nullable — shelf events carry no listing. */
  listingId?: string | null;
  slug: string;
  sessionId?: string;
  eventType: DirectoryPresenceEventType;
  dwellMs?: number;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  /** Which surface emitted the event (migration 295). */
  surface?: DirectorySurface | string | null;
  /** The surface's own reference (shelf slug, or entry slug). */
  entityRef?: string | null;
  /** Event-specific detail (e.g. the filter key for `filter_applied`). */
  detail?: string | null;
}

/** Per-surface engagement rollup (entries + shelves in one grid). */
export interface SurfaceEngagementRow {
  surface: string;
  views: number;
  sessions: number;
  clickThroughs: number;
  ctaClicks: number;
  filters: number;
  avgDwellMs: number;
  clickThroughRate: number | null;
}

export interface DirectoryEngagementSummary {
  tenantId: string;
  daysBack: TrafficWindow;
  views: number;
  claimClicks: number;
  callClicks: number;
  directionsClicks: number;
  storefrontClicks: number;
  qrScans: number;
  uniqueSessions: number;
  avgDwellMs: number;
  eventCounts: Array<{ eventType: string; events: number; sessions: number }>;
  deviceSplit: Array<{ deviceType: string; events: number }>;
}

export interface DirectoryEngagementDashboard {
  daysBack: TrafficWindow;
  totals: {
    views: number;
    claimClicks: number;
    callClicks: number;
    directionsClicks: number;
    storefrontClicks: number;
    qrScans: number;
    uniqueSessions: number;
    avgDwellMs: number;
  };
  eventCounts: Array<{ eventType: string; events: number; sessions: number }>;
  topSeeds: Array<{
    seedId: string;
    businessName: string | null;
    slug: string | null;
    category: string;
    city: string;
    state: string;
    views: number;
    claimClicks: number;
    sessions: number;
  }>;
  funnel: DirectoryClaimFunnel;
}

export interface DirectoryClaimFunnel {
  views: number;
  viewSessions: number;
  claimClicks: number;
  claimsAccepted: number;
  viewToClickRate: number | null;
  clickToAcceptRate: number | null;
  viewToAcceptRate: number | null;
}

export interface DirectoryPresenceRecentEvent {
  id: string;
  eventType: string;
  sessionId: string | null;
  deviceType: string | null;
  dwellMs: number | null;
  referrer: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function parseDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

export function hashDirectoryIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = unifiedConfig.galleryIpHashSalt;
  if (!salt) return null; // graceful degradation — no salt, no hash
  return crypto.createHash('sha256').update(`${ip}${salt}`).digest('hex');
}

// ─── In-memory rate limiter (60 events/min per IP) ──────────────────────
// Separate map from the gallery limiter — different surface, different abuse
// vector (spec §5).

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_EVENTS = 60;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export function checkDirectoryPresenceRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_EVENTS;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

const toNumber = (value: number | bigint | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

const rate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : null;

// ─── Service ────────────────────────────────────────────────────────────

class DirectoryPresenceAnalyticsService extends BaseService {
  private static instance: DirectoryPresenceAnalyticsService;

  private constructor() {
    super();
  }

  public static getInstance(): DirectoryPresenceAnalyticsService {
    if (!DirectoryPresenceAnalyticsService.instance) {
      DirectoryPresenceAnalyticsService.instance = new DirectoryPresenceAnalyticsService();
    }
    return DirectoryPresenceAnalyticsService.instance;
  }

  private buildRow(input: DirectoryPresenceEventInput): unknown[] {
    return [
      generateDirectoryPresenceEventId(),
      input.tenantId ?? null,
      input.listingId ?? null,
      input.slug,
      input.sessionId || null,
      input.eventType,
      input.referrer || null,
      input.userAgent || null,
      hashDirectoryIp(input.ip),
      parseDeviceType(input.userAgent),
      input.dwellMs ?? null,
      input.surface ?? null,
      input.entityRef ?? null,
      input.detail ?? null,
    ];
  }

  /** Column list for the events insert (kept in sync with `buildRow`). */
  private static readonly EVENT_COLUMNS =
    'id, tenant_id, listing_id, slug, session_id, event_type, referrer, user_agent, ip_hash, device_type, dwell_ms, surface, entity_ref, detail';

  // ====================
  // EVENT TRACKING (fire-and-forget)
  // ====================

  /** Track a single engagement event. Never throws — analytics must not block UX. */
  async trackEvent(input: DirectoryPresenceEventInput): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO directory_presence_events
           (${DirectoryPresenceAnalyticsService.EVENT_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        ...this.buildRow(input),
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Directory presence event tracking failed (fire-and-forget)', undefined, {
        error: msg,
        eventType: input.eventType,
        slug: input.slug,
      });
    }
  }

  /** Track a batch of events (max 50 enforced at the route). Never throws. */
  async trackEvents(inputs: DirectoryPresenceEventInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    try {
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (const input of inputs) {
        const row = this.buildRow(input);
        const start = params.length;
        placeholders.push(`(${row.map((_, i) => `$${start + i + 1}`).join(', ')})`);
        params.push(...row);
      }
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO directory_presence_events
           (${DirectoryPresenceAnalyticsService.EVENT_COLUMNS})
         VALUES ${placeholders.join(', ')}`,
        ...params,
      );
      return inputs.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Directory presence batch tracking failed (fire-and-forget)', undefined, {
        error: msg,
        count: inputs.length,
      });
      return 0;
    }
  }

  // ====================
  // QUERY METHODS
  // ====================

  /** Per-seed engagement summary (Layer 3). */
  async getListingEngagement(tenantId: string, daysBack?: number): Promise<DirectoryEngagementSummary> {
    const window = clampTrafficWindow(daysBack);

    const counts = await this.executeQuery<{
      event_type: string;
      events: number | bigint;
      sessions: number | bigint;
    }>(
      `SELECT event_type,
              COUNT(*)::int AS events,
              COUNT(DISTINCT session_id)::int AS sessions
       FROM directory_presence_events
       WHERE tenant_id = $1
         AND created_at >= NOW() - INTERVAL '${window} days'
       GROUP BY event_type`,
      [tenantId],
    );

    const dwell = await this.executeQuery<{ avg_dwell_ms: number | null }>(
      `SELECT COALESCE(AVG(max_dwell), 0)::float AS avg_dwell_ms
       FROM (
         SELECT session_id, MAX(dwell_ms) AS max_dwell
         FROM directory_presence_events
         WHERE tenant_id = $1
           AND created_at >= NOW() - INTERVAL '${window} days'
           AND session_id IS NOT NULL
           AND dwell_ms IS NOT NULL
         GROUP BY session_id
       ) per_session`,
      [tenantId],
    );

    const deviceSplit = await this.executeQuery<{ device_type: string | null; events: number | bigint }>(
      `SELECT device_type, COUNT(*)::int AS events
       FROM directory_presence_events
       WHERE tenant_id = $1
         AND created_at >= NOW() - INTERVAL '${window} days'
       GROUP BY device_type
       ORDER BY events DESC`,
      [tenantId],
    );

    const eventCounts = counts.map((row) => ({
      eventType: row.event_type,
      events: toNumber(row.events),
      sessions: toNumber(row.sessions),
    }));
    const countFor = (type: string) => eventCounts.find((e) => e.eventType === type)?.events ?? 0;

    return {
      tenantId,
      daysBack: window,
      views: countFor('listing_viewed'),
      claimClicks: countFor('claim_clicked'),
      callClicks: countFor('call_clicked'),
      directionsClicks: countFor('directions_clicked'),
      storefrontClicks: countFor('storefront_clicked'),
      qrScans: countFor('qr_scanned'),
      uniqueSessions: countFor('listing_viewed') > 0
        ? eventCounts.find((e) => e.eventType === 'listing_viewed')?.sessions ?? 0
        : 0,
      avgDwellMs: dwell[0]?.avg_dwell_ms ?? 0,
      eventCounts,
      deviceSplit: deviceSplit.map((row) => ({
        deviceType: row.device_type ?? 'unknown',
        events: toNumber(row.events),
      })),
    };
  }

  /** Recent events for a seed — live activity feed. */
  async getRecentEvents(tenantId: string, limit = 20): Promise<DirectoryPresenceRecentEvent[]> {
    const rows = await this.executeQuery<{
      id: string;
      event_type: string;
      session_id: string | null;
      device_type: string | null;
      dwell_ms: number | null;
      referrer: string | null;
      created_at: Date;
    }>(
      `SELECT id, event_type, session_id, device_type, dwell_ms, referrer, created_at
       FROM directory_presence_events
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      sessionId: row.session_id,
      deviceType: row.device_type,
      dwellMs: row.dwell_ms,
      referrer: row.referrer,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  }

  /**
   * Claim funnel for a seed: listing_viewed → claim_clicked → claim accepted
   * (directory_claim_tokens.consumed_at).
   *
   * This is the ON-PAGE CONVERSION funnel — did the listing itself convert a
   * shopper into a claim click, and did that convert into an accepted claim.
   * It is deliberately NOT the same as `SeedFunnelAnalyticsService`'s cohort
   * funnel (seeds → contactable → invited → claimed + per-channel invite-scan
   * rates), which is the GTM measurement layer driven by outreach touches and
   * QR-invite scans. The two share only the 'claims accepted' terminus:
   *   - invite/QR-driven conversion → SeedFunnelAnalyticsService
   *   - on-page CTA conversion      → here
   */
  async getClaimFunnel(tenantId: string, daysBack?: number): Promise<DirectoryClaimFunnel> {
    const window = clampTrafficWindow(daysBack);

    const views = await this.executeQuery<{
      views: number | bigint;
      view_sessions: number | bigint;
      claim_clicks: number | bigint;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'listing_viewed')::int AS views,
         COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'listing_viewed')::int AS view_sessions,
         COUNT(*) FILTER (WHERE event_type = 'claim_clicked')::int AS claim_clicks
       FROM directory_presence_events
       WHERE tenant_id = $1
         AND created_at >= NOW() - INTERVAL '${window} days'`,
      [tenantId],
    );

    const accepted = await this.executeQuery<{ accepted: number | bigint }>(
      `SELECT COUNT(*)::int AS accepted
       FROM directory_claim_tokens dct
       JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
       WHERE dps.tenant_id = $1
         AND dct.consumed_at IS NOT NULL
         AND dct.consumed_at >= NOW() - INTERVAL '${window} days'`,
      [tenantId],
    );

    const row = views[0];
    const viewCount = toNumber(row?.views);
    const claimClicks = toNumber(row?.claim_clicks);
    const claimsAccepted = toNumber(accepted[0]?.accepted);

    return {
      views: viewCount,
      viewSessions: toNumber(row?.view_sessions),
      claimClicks,
      claimsAccepted,
      viewToClickRate: rate(claimClicks, viewCount),
      clickToAcceptRate: rate(claimsAccepted, claimClicks),
      viewToAcceptRate: rate(claimsAccepted, viewCount),
    };
  }

  /** Cross-seed engagement rollup for the Directory Traffic page (Layer 3). */
  async getDashboardEngagement(daysBack?: number): Promise<DirectoryEngagementDashboard> {    const window = clampTrafficWindow(daysBack);

    const eventRows = await this.executeQuery<{
      event_type: string;
      events: number | bigint;
      sessions: number | bigint;
    }>(
      `SELECT event_type,
              COUNT(*)::int AS events,
              COUNT(DISTINCT session_id)::int AS sessions
       FROM directory_presence_events
       WHERE created_at >= NOW() - INTERVAL '${window} days'
       GROUP BY event_type`,
      [],
    );

    const dwell = await this.executeQuery<{ avg_dwell_ms: number | null }>(
      `SELECT COALESCE(AVG(max_dwell), 0)::float AS avg_dwell_ms
       FROM (
         SELECT session_id, MAX(dwell_ms) AS max_dwell
         FROM directory_presence_events
         WHERE created_at >= NOW() - INTERVAL '${window} days'
           AND session_id IS NOT NULL
           AND dwell_ms IS NOT NULL
         GROUP BY session_id
       ) per_session`,
      [],
    );

    const topSeedRows = await this.executeQuery<{
      seed_id: string;
      business_name: string | null;
      slug: string | null;
      category: string;
      city: string;
      state: string;
      views: number | bigint;
      claim_clicks: number | bigint;
      sessions: number | bigint;
    }>(
      `SELECT
         s.id AS seed_id,
         l.business_name,
         l.slug,
         s.category,
         s.city,
         s.state,
         COUNT(*) FILTER (WHERE e.event_type = 'listing_viewed')::int AS views,
         COUNT(*) FILTER (WHERE e.event_type = 'claim_clicked')::int AS claim_clicks,
         COUNT(DISTINCT e.session_id)::int AS sessions
       FROM directory_presence_events e
       JOIN directory_presence_seeds s ON s.tenant_id = e.tenant_id
       LEFT JOIN directory_listings_list l ON l.id = s.listing_id
       WHERE e.created_at >= NOW() - INTERVAL '${window} days'
       GROUP BY s.id, l.business_name, l.slug, s.category, s.city, s.state
       ORDER BY claim_clicks DESC, views DESC
       LIMIT 50`,
      [],
    );

    const funnel = await this.executeQuery<{
      views: number | bigint;
      view_sessions: number | bigint;
      claim_clicks: number | bigint;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'listing_viewed')::int AS views,
         COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'listing_viewed')::int AS view_sessions,
         COUNT(*) FILTER (WHERE event_type = 'claim_clicked')::int AS claim_clicks
       FROM directory_presence_events
       WHERE created_at >= NOW() - INTERVAL '${window} days'`,
      [],
    );

    const accepted = await this.executeQuery<{ accepted: number | bigint }>(
      `SELECT COUNT(*)::int AS accepted
       FROM directory_claim_tokens
       WHERE consumed_at IS NOT NULL
         AND consumed_at >= NOW() - INTERVAL '${window} days'`,
      [],
    );

    const eventCounts = eventRows.map((row) => ({
      eventType: row.event_type,
      events: toNumber(row.events),
      sessions: toNumber(row.sessions),
    }));
    const countFor = (type: string) => eventCounts.find((e) => e.eventType === type)?.events ?? 0;

    const funnelRow = funnel[0];
    const viewCount = toNumber(funnelRow?.views);
    const claimClicks = toNumber(funnelRow?.claim_clicks);
    const claimsAccepted = toNumber(accepted[0]?.accepted);

    return {
      daysBack: window,
      totals: {
        views: viewCount,
        claimClicks,
        callClicks: countFor('call_clicked'),
        directionsClicks: countFor('directions_clicked'),
        storefrontClicks: countFor('storefront_clicked'),
        qrScans: countFor('qr_scanned'),
        uniqueSessions: eventCounts.find((e) => e.eventType === 'listing_viewed')?.sessions ?? 0,
        avgDwellMs: dwell[0]?.avg_dwell_ms ?? 0,
      },
      eventCounts,
      topSeeds: topSeedRows.map((row) => ({
        seedId: row.seed_id,
        businessName: row.business_name,
        slug: row.slug,
        category: row.category,
        city: row.city,
        state: row.state,
        views: toNumber(row.views),
        claimClicks: toNumber(row.claim_clicks),
        sessions: toNumber(row.sessions),
      })),
      funnel: {
        views: viewCount,
        viewSessions: toNumber(funnelRow?.view_sessions),
        claimClicks,
        claimsAccepted,
        viewToClickRate: rate(claimClicks, viewCount),
        clickToAcceptRate: rate(claimsAccepted, claimClicks),
        viewToAcceptRate: rate(claimsAccepted, viewCount),
      },
    };
  }

  // ====================
  // PER-SURFACE ENGAGEMENT (entries + shelves)
  // ====================

  /**
   * Per-surface engagement rollup — entries AND shelves in one grid.
   * views = listing_viewed + shelf_viewed; clickThroughs = listing_clicked;
   * ctaClicks = claim/storefront/call/directions; filters = filter_applied.
   * avgDwellMs = MAX(dwell_ms) per session, then averaged.
   */
  async getSurfaceEngagement(daysBack?: number): Promise<SurfaceEngagementRow[]> {
    const window = clampTrafficWindow(daysBack);

    const counts = await this.executeQuery<{
      surface: string;
      views: number | bigint;
      sessions: number | bigint;
      click_throughs: number | bigint;
      cta_clicks: number | bigint;
      filters: number | bigint;
    }>(
      `SELECT
         COALESCE(surface, 'unknown') AS surface,
         COUNT(*) FILTER (WHERE event_type IN ('listing_viewed', 'shelf_viewed'))::int AS views,
         COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('listing_viewed', 'shelf_viewed'))::int AS sessions,
         COUNT(*) FILTER (WHERE event_type = 'listing_clicked')::int AS click_throughs,
         COUNT(*) FILTER (WHERE event_type IN ('claim_clicked', 'storefront_clicked', 'call_clicked', 'directions_clicked'))::int AS cta_clicks,
         COUNT(*) FILTER (WHERE event_type = 'filter_applied')::int AS filters
       FROM directory_presence_events
       WHERE created_at >= NOW() - INTERVAL '${window} days'
       GROUP BY 1
       ORDER BY views DESC`,
      [],
    );

    const dwell = await this.executeQuery<{ surface: string; avg_dwell_ms: number | null }>(
      `SELECT COALESCE(surface, 'unknown') AS surface,
              COALESCE(AVG(max_dwell), 0)::float AS avg_dwell_ms
       FROM (
         SELECT surface, session_id, MAX(dwell_ms) AS max_dwell
         FROM directory_presence_events
         WHERE created_at >= NOW() - INTERVAL '${window} days'
           AND session_id IS NOT NULL
           AND dwell_ms IS NOT NULL
         GROUP BY surface, session_id
       ) per_session
       GROUP BY 1`,
      [],
    );

    const dwellBySurface = new Map(dwell.map((row) => [row.surface, row.avg_dwell_ms ?? 0]));

    return counts.map((row) => {
      const views = toNumber(row.views);
      const clickThroughs = toNumber(row.click_throughs);
      return {
        surface: row.surface,
        views,
        sessions: toNumber(row.sessions),
        clickThroughs,
        ctaClicks: toNumber(row.cta_clicks),
        filters: toNumber(row.filters),
        avgDwellMs: dwellBySurface.get(row.surface) ?? 0,
        clickThroughRate: rate(clickThroughs, views),
      };
    });
  }

  // ====================
  // SEED-SCOPED CONVENIENCE (resolve seed → tenant, then delegate)
  // ====================

  private async resolveSeedTenant(seedId: string): Promise<string | null> {
    const seed = await this.prisma.directory_presence_seeds.findUnique({
      where: { id: seedId },
      select: { tenant_id: true },
    });
    return seed?.tenant_id ?? null;
  }

  /** Per-seed engagement + recent events feed. Null when the seed is unknown. */
  async getSeedEngagement(
    seedId: string,
    daysBack?: number,
    recentLimit = 20,
  ): Promise<(DirectoryEngagementSummary & { recentEvents: DirectoryPresenceRecentEvent[] }) | null> {
    const tenantId = await this.resolveSeedTenant(seedId);
    if (!tenantId) return null;
    const [engagement, recentEvents] = await Promise.all([
      this.getListingEngagement(tenantId, daysBack),
      this.getRecentEvents(tenantId, recentLimit),
    ]);
    return { ...engagement, recentEvents };
  }

  /** Claim funnel for a seed. Null when the seed is unknown. */
  async getSeedClaimFunnel(seedId: string, daysBack?: number): Promise<DirectoryClaimFunnel | null> {
    const tenantId = await this.resolveSeedTenant(seedId);
    if (!tenantId) return null;
    return this.getClaimFunnel(tenantId, daysBack);
  }
}

export default DirectoryPresenceAnalyticsService.getInstance();
export { DirectoryPresenceAnalyticsService };
