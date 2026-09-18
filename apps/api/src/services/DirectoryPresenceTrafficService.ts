/**
 * DirectoryPresenceTrafficService — Layer 1 + Layer 2 readout for the
 * directory presence traffic surface.
 *
 * Aggregates page-view events already captured by `StoreViewTracker` on
 * `/place/[slug]` (unclaimed seeds) and `/directory/[slug]` (claimed
 * tenants). Those land in `user_behavior_simple` with
 * `entity_type='store'`, `page_type='directory_detail'`,
 * `entity_id=<tenantId>`.
 *
 * Scoping is by join: `directory_presence_seeds.tenant_id = entity_id`.
 * This includes claimed seeds (their seed row persists after claim), so the
 * readout answers "which directory entry is getting traffic" for the full
 * seed lifecycle.
 *
 * Layer 2: events are tagged with `context->>'surface'` (`place` from /place,
 * `directory` from /directory — the same vocabulary as CategoryBrowseTracker)
 * so the ecosystem surface can be split without a join, plus
 * `context->>'listing_origin'` (`directory_seed` | `claimed`, mirroring
 * `directory_listings_list.listing_origin`). The optional `surface` filter
 * applies that predicate; `surfaceBreakdown` always reports the full split
 * (untagged historical rows appear as `untagged` until migration 294
 * rewrites them).
 *
 * Read-only — no new table. See
 * docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §3, §6.
 */

import { BaseService } from './BaseService';

/** Allowed lookback windows (days). Keeps the interpolated INTERVAL literal
 *  bounded and avoids unbounded scans on the behavior table. */
export const ALLOWED_TRAFFIC_WINDOWS = [7, 30, 90] as const;
export const DEFAULT_TRAFFIC_WINDOW = 30;

export type TrafficWindow = (typeof ALLOWED_TRAFFIC_WINDOWS)[number];

export function clampTrafficWindow(daysBack?: number): TrafficWindow {
  return (ALLOWED_TRAFFIC_WINDOWS as readonly number[]).includes(daysBack ?? -1)
    ? (daysBack as TrafficWindow)
    : DEFAULT_TRAFFIC_WINDOW;
}

export interface DirectoryTrafficFilters {
  seedBatch?: string;
  status?: string;
  category?: string;
  city?: string;
  state?: string;
  /** Layer 2 — restrict to events tagged with this `context->>'surface'`. */
  surface?: string;
}

export interface SurfaceBreakdownRow {
  surface: string;
  views: number;
  uniqueSessions: number;
}

export interface SeedTrafficSummary {
  seedId: string;
  tenantId: string;
  listingId: string;
  businessName: string | null;
  slug: string | null;
  category: string;
  city: string;
  state: string;
  status: string;
  seedBatch: string;
  views: number;
  uniqueSessions: number;
  views7d: number;
  views30d: number;
}

export interface TrafficTimeseriesPoint {
  day: string;
  views: number;
  uniqueSessions: number;
}

/** A category / location / home shelf browse surface (non-entry). */
export interface ShelfTrafficRow {
  pageType: string;
  entityId: string;
  label: string;
  surface: string | null;
  views: number;
  uniqueSessions: number;
}

/** Entry views attributed back to the shelf that referred them. */
export interface ShelfReferralRow {
  shelf: string;
  views: number;
  uniqueSessions: number;
}

/** Entry views grouped by source/channel (`context->>'entry_source'`).
 *  Includes `qr` (QR-encoded entry links), `shelf`, and any `utm_source`. */
export interface EntrySourceRow {
  source: string;
  views: number;
  uniqueSessions: number;
}

export interface SeedTrafficDetail {
  seedId: string;
  tenantId: string;
  listingId: string;
  businessName: string | null;
  slug: string | null;
  category: string;
  city: string;
  state: string;
  status: string;
  seedBatch: string;
  daysBack: TrafficWindow;
  surface: string | null;
  views: number;
  uniqueSessions: number;
  views7d: number;
  views30d: number;
  views90d: number;
  avgDurationSeconds: number;
  daily: TrafficTimeseriesPoint[];
  topReferrers: Array<{ referrer: string; views: number }>;
  deviceSplit: Array<{ deviceType: string; views: number }>;
  surfaceBreakdown: SurfaceBreakdownRow[];
}

export interface TrafficDashboard {
  daysBack: TrafficWindow;
  surface: string | null;
  totals: {
    views: number;
    uniqueSessions: number;
    seedsWithTraffic: number;
    totalSeeds: number;
  };
  topSeeds: SeedTrafficSummary[];
  categoryBreakdown: Array<{
    category: string;
    views: number;
    uniqueSessions: number;
    seeds: number;
  }>;
  daily: TrafficTimeseriesPoint[];
  surfaceBreakdown: SurfaceBreakdownRow[];
  /** Shelf surfaces (category / location / home) — see §6 review note.
   *  Computed with `daysBack` + `surface` only; seed filters do not apply. */
  shelves: ShelfTrafficRow[];
  /** Entry views grouped by the referring shelf (`context->>'referrer_shelf'`,
   *  stamped from the `?shelf=` link param). Respects seed + surface filters. */
  shelfReferrals: ShelfReferralRow[];
  /** Entry views grouped by source/channel (`context->>'entry_source'`), from
   *  `?utm_source=` / `?source=` (e.g. `qr`) or `shelf`. Respects seed +
   *  surface filters. Unattributed (organic/direct) views are not listed. */
  entrySources: EntrySourceRow[];
}

interface TrafficCountRow {
  views: number | bigint | null;
  unique_sessions: number | bigint | null;
  views_7d: number | bigint | null;
  views_30d: number | bigint | null;
  views_90d: number | bigint | null;
  avg_duration_seconds: number | null;
}

interface DashboardTotalsRow {
  views: number | bigint | null;
  unique_sessions: number | bigint | null;
  seeds_with_traffic: number | bigint | null;
  total_seeds: number | bigint | null;
}

const toNumber = (value: number | bigint | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

class DirectoryPresenceTrafficService extends BaseService {
  private static instance: DirectoryPresenceTrafficService;

  private constructor() {
    super();
  }

  public static getInstance(): DirectoryPresenceTrafficService {
    if (!DirectoryPresenceTrafficService.instance) {
      DirectoryPresenceTrafficService.instance = new DirectoryPresenceTrafficService();
    }
    return DirectoryPresenceTrafficService.instance;
  }

  /**
   * Build the seed-scoped WHERE fragment + bound params shared by every
   * dashboard query. Params are positional ($1..$n) and always bound.
   */
  private buildSeedFilters(filters: DirectoryTrafficFilters): {
    clause: string;
    params: string[];
  } {
    const conditions: string[] = [];
    const params: string[] = [];
    const push = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      conditions.push(`${column} = $${params.length}`);
    };
    push('s.seed_batch', filters.seedBatch);
    push('s.status', filters.status);
    push('s.category', filters.category);
    push('s.city', filters.city);
    push('s.state', filters.state);
    return {
      clause: conditions.length ? `AND ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Per-seed traffic: views, unique sessions, fixed-window counts, daily
   * timeseries, top referrers, device split, and the surface split.
   */
  async getSeedTraffic(
    seedId: string,
    daysBack?: number,
    surface?: string,
  ): Promise<SeedTrafficDetail | null> {
    const seed = await this.prisma.directory_presence_seeds.findUnique({
      where: { id: seedId },
      include: { directory_listings_list: true },
    });
    if (!seed) return null;

    const window = clampTrafficWindow(daysBack);
    const tenantId = seed.tenant_id;

    // Layer 2 — optional surface predicate on the behavior table.
    const params: string[] = [tenantId];
    let surfaceClause = '';
    if (surface) {
      params.push(surface);
      surfaceClause = `AND context->>'surface' = $${params.length}`;
    }

    const counts = await this.executeQuery<TrafficCountRow>(
      `SELECT
         COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '${window} days')::int AS views,
         COUNT(DISTINCT session_id) FILTER (WHERE timestamp >= NOW() - INTERVAL '${window} days')::int AS unique_sessions,
         COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days')::int AS views_7d,
         COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '30 days')::int AS views_30d,
         COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '90 days')::int AS views_90d,
         AVG(duration_seconds) FILTER (WHERE timestamp >= NOW() - INTERVAL '${window} days')::float AS avg_duration_seconds
       FROM user_behavior_simple
       WHERE entity_type = 'store'
         AND page_type = 'directory_detail'
         AND entity_id = $1
         ${surfaceClause}
         AND timestamp >= NOW() - INTERVAL '90 days'`,
      params,
    );

    const daily = await this.executeQuery<{
      day: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         to_char(date_trunc('day', timestamp), 'YYYY-MM-DD') AS day,
         COUNT(*)::int AS views,
         COUNT(DISTINCT session_id)::int AS unique_sessions
       FROM user_behavior_simple
       WHERE entity_type = 'store'
         AND page_type = 'directory_detail'
         AND entity_id = $1
         ${surfaceClause}
         AND timestamp >= NOW() - INTERVAL '${window} days'
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );

    const topReferrers = await this.executeQuery<{
      referrer: string;
      views: number | bigint;
    }>(
      `SELECT
         COALESCE(NULLIF(referrer, ''), 'direct') AS referrer,
         COUNT(*)::int AS views
       FROM user_behavior_simple
       WHERE entity_type = 'store'
         AND page_type = 'directory_detail'
         AND entity_id = $1
         ${surfaceClause}
         AND timestamp >= NOW() - INTERVAL '${window} days'
       GROUP BY 1
       ORDER BY views DESC
       LIMIT 5`,
      params,
    );

    const deviceSplit = await this.executeQuery<{
      device_type: string;
      views: number | bigint;
    }>(
      `SELECT
         CASE
           WHEN user_agent ILIKE '%ipad%' OR user_agent ILIKE '%tablet%' THEN 'tablet'
           WHEN user_agent ILIKE '%mobi%' OR user_agent ILIKE '%android%' OR user_agent ILIKE '%iphone%' THEN 'mobile'
           WHEN user_agent IS NULL OR user_agent = '' THEN 'unknown'
           ELSE 'desktop'
         END AS device_type,
         COUNT(*)::int AS views
       FROM user_behavior_simple
       WHERE entity_type = 'store'
         AND page_type = 'directory_detail'
         AND entity_id = $1
         ${surfaceClause}
         AND timestamp >= NOW() - INTERVAL '${window} days'
       GROUP BY 1
       ORDER BY views DESC`,
      params,
    );

    // Surface split is always over the full (unfiltered) event set so the
    // seed-vs-claimed breakdown stays visible even when a surface filter is on.
    const surfaceRows = await this.executeQuery<{
      surface: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         COALESCE(context->>'surface', 'untagged') AS surface,
         COUNT(*)::int AS views,
         COUNT(DISTINCT session_id)::int AS unique_sessions
       FROM user_behavior_simple
       WHERE entity_type = 'store'
         AND page_type = 'directory_detail'
         AND entity_id = $1
         AND timestamp >= NOW() - INTERVAL '${window} days'
       GROUP BY 1
       ORDER BY views DESC`,
      [tenantId],
    );

    const countRow = counts[0];
    const listing = seed.directory_listings_list;

    return {
      seedId: seed.id,
      tenantId,
      listingId: seed.listing_id,
      businessName: listing?.business_name ?? null,
      slug: listing?.slug ?? null,
      category: seed.category,
      city: seed.city,
      state: seed.state,
      status: seed.status,
      seedBatch: seed.seed_batch,
      daysBack: window,
      surface: surface ?? null,
      views: toNumber(countRow?.views),
      uniqueSessions: toNumber(countRow?.unique_sessions),
      views7d: toNumber(countRow?.views_7d),
      views30d: toNumber(countRow?.views_30d),
      views90d: toNumber(countRow?.views_90d),
      avgDurationSeconds: countRow?.avg_duration_seconds ?? 0,
      daily: daily.map((row) => ({
        day: row.day,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
      topReferrers: topReferrers.map((row) => ({
        referrer: row.referrer,
        views: toNumber(row.views),
      })),
      deviceSplit: deviceSplit.map((row) => ({
        deviceType: row.device_type,
        views: toNumber(row.views),
      })),
      surfaceBreakdown: surfaceRows.map((row) => ({
        surface: row.surface,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
    };
  }

  /**
   * Cross-seed rollup: totals, top seeds by views, category breakdown, an
   * all-seeds daily trend, and the seed-vs-claimed surface split. Seeds with
   * zero traffic are included in the seed count but not in `seedsWithTraffic`.
   */
  async getTrafficDashboard(
    daysBack?: number,
    filters: DirectoryTrafficFilters = {},
  ): Promise<TrafficDashboard> {
    const window = clampTrafficWindow(daysBack);
    const { clause, params } = this.buildSeedFilters(filters);

    // Layer 2 — surface predicate lives in the behavior JOIN so seeds with no
    // matching traffic still appear (with zero views).
    let surfaceJoin = '';
    if (filters.surface) {
      params.push(filters.surface);
      surfaceJoin = `AND b.context->>'surface' = $${params.length}`;
    }

    const totalsRows = await this.executeQuery<DashboardTotalsRow>(
      `SELECT
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions,
         COUNT(DISTINCT s.id) FILTER (WHERE b.id IS NOT NULL)::int AS seeds_with_traffic,
         COUNT(DISTINCT s.id)::int AS total_seeds
       FROM directory_presence_seeds s
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}`,
      params,
    );

    const topSeedRows = await this.executeQuery<{
      seed_id: string;
      tenant_id: string;
      listing_id: string;
      category: string;
      city: string;
      state: string;
      status: string;
      seed_batch: string;
      business_name: string | null;
      slug: string | null;
      views: number | bigint;
      unique_sessions: number | bigint;
      views_7d: number | bigint;
      views_30d: number | bigint;
    }>(
      `SELECT
         s.id AS seed_id,
         s.tenant_id,
         s.listing_id,
         s.category,
         s.city,
         s.state,
         s.status,
         s.seed_batch,
         l.business_name,
         l.slug,
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions,
         COUNT(b.id) FILTER (WHERE b.timestamp >= NOW() - INTERVAL '7 days')::int AS views_7d,
         COUNT(b.id) FILTER (WHERE b.timestamp >= NOW() - INTERVAL '30 days')::int AS views_30d
       FROM directory_presence_seeds s
       LEFT JOIN directory_listings_list l ON l.id = s.listing_id
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}
       GROUP BY s.id, l.business_name, l.slug
       ORDER BY views DESC, s.created_at DESC
       LIMIT 100`,
      params,
    );

    const categoryRows = await this.executeQuery<{
      category: string;
      views: number | bigint;
      unique_sessions: number | bigint;
      seeds: number | bigint;
    }>(
      `SELECT
         s.category,
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions,
         COUNT(DISTINCT s.id)::int AS seeds
       FROM directory_presence_seeds s
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}
       GROUP BY s.category
       ORDER BY views DESC`,
      params,
    );

    const dailyRows = await this.executeQuery<{
      day: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         to_char(date_trunc('day', b.timestamp), 'YYYY-MM-DD') AS day,
         COUNT(*)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions
       FROM directory_presence_seeds s
       JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );

    // Full split — deliberately excludes the surface predicate.
    const surfaceRows = await this.executeQuery<{
      surface: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         COALESCE(b.context->>'surface', 'untagged') AS surface,
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions
       FROM directory_presence_seeds s
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
       WHERE TRUE ${clause}
       GROUP BY 1
       ORDER BY views DESC`,
      this.buildSeedFilters(filters).params,
    );

    // Shelf surfaces — category / location / home browse pages. These are NOT
    // seed rows (different entity semantics: path-shaped entity_id, no tenant
    // join), so the seed filters do not apply. Only daysBack + surface do.
    const shelfParams: string[] = [];
    let shelfSurfaceClause = '';
    if (filters.surface) {
      shelfParams.push(filters.surface);
      shelfSurfaceClause = `AND context->>'surface' = $${shelfParams.length}`;
    }
    const shelfRows = await this.executeQuery<{
      page_type: string;
      entity_id: string;
      entity_name: string | null;
      surface: string | null;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         page_type,
         entity_id,
         entity_name,
         context->>'surface' AS surface,
         COUNT(*)::int AS views,
         COUNT(DISTINCT session_id)::int AS unique_sessions
       FROM user_behavior_simple
       WHERE page_type IN ('directory_category', 'directory_location', 'directory_store_type', 'directory_home')
         AND entity_id IS NOT NULL
         AND timestamp >= NOW() - INTERVAL '${window} days'
         ${shelfSurfaceClause}
       GROUP BY page_type, entity_id, entity_name, context->>'surface'
       ORDER BY views DESC
       LIMIT 50`,
      shelfParams,
    );

    // Shelf→entry attribution — entry views grouped by the shelf that referred
    // them (StoreViewTracker stamps `referrer_shelf` from the `?shelf=` param).
    // Respects the seed filters + surface filter (it is entry-scoped).
    const shelfReferralRows = await this.executeQuery<{
      shelf: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         b.context->>'referrer_shelf' AS shelf,
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions
       FROM directory_presence_seeds s
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}
         AND b.context->>'referrer_shelf' IS NOT NULL
       GROUP BY 1
       ORDER BY views DESC
       LIMIT 50`,
      params,
    );

    // Entry sources — which channel drove the entry view. QR-encoded listing
    // links carry `?source=qr`; shelf links carry `?shelf=` (→ 'shelf'); any
    // `?utm_source=` is used verbatim. Organic/direct views are unattributed.
    const entrySourceRows = await this.executeQuery<{
      source: string;
      views: number | bigint;
      unique_sessions: number | bigint;
    }>(
      `SELECT
         b.context->>'entry_source' AS source,
         COUNT(b.id)::int AS views,
         COUNT(DISTINCT b.session_id)::int AS unique_sessions
       FROM directory_presence_seeds s
       LEFT JOIN user_behavior_simple b
         ON b.entity_id = s.tenant_id
        AND b.entity_type = 'store'
        AND b.page_type = 'directory_detail'
        AND b.timestamp >= NOW() - INTERVAL '${window} days'
        ${surfaceJoin}
       WHERE TRUE ${clause}
         AND b.context->>'entry_source' IS NOT NULL
       GROUP BY 1
       ORDER BY views DESC
       LIMIT 50`,
      params,
    );

    const totalsRow = totalsRows[0];    return {
      daysBack: window,
      surface: filters.surface ?? null,
      totals: {
        views: toNumber(totalsRow?.views),
        uniqueSessions: toNumber(totalsRow?.unique_sessions),
        seedsWithTraffic: toNumber(totalsRow?.seeds_with_traffic),
        totalSeeds: toNumber(totalsRow?.total_seeds),
      },
      topSeeds: topSeedRows.map((row) => ({
        seedId: row.seed_id,
        tenantId: row.tenant_id,
        listingId: row.listing_id,
        businessName: row.business_name,
        slug: row.slug,
        category: row.category,
        city: row.city,
        state: row.state,
        status: row.status,
        seedBatch: row.seed_batch,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
        views7d: toNumber(row.views_7d),
        views30d: toNumber(row.views_30d),
      })),
      categoryBreakdown: categoryRows.map((row) => ({
        category: row.category,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
        seeds: toNumber(row.seeds),
      })),
      daily: dailyRows.map((row) => ({
        day: row.day,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
      surfaceBreakdown: surfaceRows.map((row) => ({
        surface: row.surface,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
      shelves: shelfRows.map((row) => ({
        pageType: row.page_type,
        entityId: row.entity_id,
        label: row.entity_name || row.entity_id,
        surface: row.surface,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
      shelfReferrals: shelfReferralRows.map((row) => ({
        shelf: row.shelf,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
      entrySources: entrySourceRows.map((row) => ({
        source: row.source,
        views: toNumber(row.views),
        uniqueSessions: toNumber(row.unique_sessions),
      })),
    };
  }
}

export default DirectoryPresenceTrafficService.getInstance();
export { DirectoryPresenceTrafficService };
