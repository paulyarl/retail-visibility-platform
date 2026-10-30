/**
 * Admin Search Demand Routes (data-driven seeding)
 *
 *   GET  /api/admin/seo-demand/summary         — headline counts + last ingest
 *   GET  /api/admin/seo-demand/signals         — query signals (sort/filter/paginate)
 *   GET  /api/admin/seo-demand/gaps            — category × market demand vs seeds
 *   GET  /api/admin/seo-demand/markets         — market demand vs seeds
 *   POST /api/admin/seo-demand/signals/review  — confirm / reject / reopen a match
 *   POST /api/admin/seo-demand/signals/queue   — click to queue (source_kind = search_batch)
 *   POST /api/admin/seo-demand/classify        — re-run matching on open signals
 *   POST /api/admin/seo-demand/ingest          — pull Search Console now
 *
 * Nothing here queues automatically; every write-back is an operator click.
 * All routes require PLATFORM_ADMIN auth.
 */
import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';
import MarketingProspectQueueService from '../services/MarketingProspectQueueService';
import { classifyQuerySignals } from '../services/SeoDemandMatchService';
import { ingestSearchConsole } from '../services/GscSearchDemandService';

const router = Router();

const requirePlatformAdmin = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const fail = (route: string, res: Response, error: any) => {
  logger.error(`[${route}] Error:`, undefined, {
    error: { name: error?.name || 'Error', message: error?.message || String(error) },
  });
  res.status(500).json({ error: 'internal_error' });
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return typeof v === 'string' && v !== '' && Number.isFinite(n) ? n : undefined;
};

const WINDOWS = { '7': 'impressions_7d', '28': 'impressions_28d', '90': 'impressions_90d' } as const;
const PAGE_SIZES = [25, 50, 100];

function paging(req: Request) {
  const size = Number(req.query.pageSize);
  const pageSize = PAGE_SIZES.includes(size) ? size : 25;
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const dir = String(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const window = (str(req.query.window) as keyof typeof WINDOWS) in WINDOWS ? (str(req.query.window) as keyof typeof WINDOWS) : '28';
  return { pageSize, page, dir, offset: (page - 1) * pageSize, impr: WINDOWS[window] };
}

/** Builds a parameterized WHERE clause; `add` pushes a condition using the next $n. */
function whereBuilder() {
  const params: unknown[] = [];
  const conds: string[] = [];
  return {
    params,
    add(sql: (p: string) => string, value: unknown) {
      params.push(value);
      conds.push(sql(`$${params.length}`));
    },
    raw(sql: string) { conds.push(sql); },
    get sql() { return conds.length ? `WHERE ${conds.join(' AND ')}` : ''; },
  };
}

// Lower number = act first. Used for the default "priority" sort.
const ROUTE_PRIORITY_SQL = `CASE s.route
  WHEN 'pitch_now' THEN 1 WHEN 'audit_triage' THEN 2 WHEN 'seed_signal' THEN 3 WHEN 'seek_batch' THEN 4
  WHEN 'in_queue' THEN 5 WHEN 'category' THEN 6 WHEN 'market' THEN 7 WHEN 'claimed_client' THEN 8
  WHEN 'brand' THEN 9 ELSE 10 END`;

/** GET /summary */
router.get('/summary', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const [routes, last] = await Promise.all([
      pool.query(
        `SELECT coalesce(route, 'other') AS route, count(*)::int AS queries,
                coalesce(sum(impressions_28d), 0)::int AS impressions_28d,
                count(*) FILTER (WHERE review_status = 'open')::int AS open
         FROM seo_query_signals WHERE impressions_90d > 0 GROUP BY 1 ORDER BY 3 DESC`,
      ),
      pool.query(
        `SELECT max(date) AS last_date, max(fetched_at) AS last_fetched,
                coalesce(sum(impressions) FILTER (WHERE date > current_date - 28), 0)::int AS page_impressions_28d,
                coalesce(sum(clicks) FILTER (WHERE date > current_date - 28), 0)::int AS page_clicks_28d
         FROM seo_gsc_page_daily`,
      ),
    ]);
    res.json({ success: true, routes: routes.rows, ingest: last.rows[0] });
  } catch (error) {
    fail('GET /api/admin/seo-demand/summary', res, error);
  }
});

const SIGNAL_SORTS: Record<string, string> = {
  priority: `${ROUTE_PRIORITY_SQL}`,
  query: 's.query_norm',
  impressions: '__impr__',
  impressions_7d: 's.impressions_7d',
  impressions_28d: 's.impressions_28d',
  impressions_90d: 's.impressions_90d',
  clicks: 's.clicks_28d',
  position: 's.position_28d',
  confidence: 's.match_confidence',
  route: 's.route',
  intent: 's.intent',
  match: 's.match_name',
  category: 's.category',
  city: 's.city',
  last_seen: 's.last_seen',
  first_seen: 's.first_seen',
};

/** GET /signals */
router.get('/signals', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { pageSize, offset, page, dir, impr } = paging(req);
    const w = whereBuilder();
    w.raw(`s.${impr} > 0`);
    const q = str(req.query.q);
    if (q) w.add((p) => `(s.query_norm ILIKE ${p} OR s.match_name ILIKE ${p})`, `%${q}%`);
    for (const key of ['intent', 'route', 'review_status', 'match_kind'] as const) {
      const v = str(req.query[key === 'review_status' ? 'reviewStatus' : key === 'match_kind' ? 'matchKind' : key]);
      if (v) w.add((p) => `s.${key} = ANY(string_to_array(${p}, ','))`, v);
    }
    const category = str(req.query.category);
    if (category) w.add((p) => `s.category ILIKE ${p}`, category);
    const city = str(req.query.city);
    if (city) w.add((p) => `s.city ILIKE ${p}`, city);
    const state = str(req.query.state);
    if (state) w.add((p) => `s.state ILIKE ${p}`, state);
    const minImpr = num(req.query.minImpressions);
    if (minImpr != null) w.add((p) => `s.${impr} >= ${p}`, minImpr);
    const minConf = num(req.query.minConfidence);
    if (minConf != null) w.add((p) => `coalesce(s.match_confidence, 0) >= ${p}`, minConf);
    const seedStatus = str(req.query.seedStatus);
    if (seedStatus === 'none') w.raw('s.seed_id IS NULL');
    else if (seedStatus === 'any') w.raw('s.seed_id IS NOT NULL');
    else if (seedStatus) w.add((p) => `sd.status = ${p}`, seedStatus);
    const stage = str(req.query.campaignStage);
    if (stage === 'none') w.raw('s.campaign_id IS NULL');
    else if (stage) w.add((p) => `c.stage = ${p}`, stage);

    const sortKey = str(req.query.sort) || 'priority';
    let sortCol = SIGNAL_SORTS[sortKey] || SIGNAL_SORTS.priority;
    if (sortCol === '__impr__') sortCol = `s.${impr}`;
    const sortDir = sortKey === 'priority' && !str(req.query.dir) ? 'ASC' : dir;

    const from = `FROM seo_query_signals s
      LEFT JOIN directory_presence_seeds sd ON sd.id = s.seed_id
      LEFT JOIN mkt_campaigns_list c ON c.id = s.campaign_id
      ${w.sql}`;
    const pool = getDirectPool();
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT s.query_norm, s.sample_query, s.intent, s.route, s.match_kind, s.match_id, s.match_name,
                s.match_confidence::float AS match_confidence, s.seed_id, s.campaign_id, s.category, s.city, s.state,
                s.top_page, s.impressions_7d, s.impressions_28d, s.impressions_90d, s.clicks_28d, s.position_28d,
                s.first_seen, s.last_seen, s.review_status, s.reviewed_at, s.queued_prospect_id,
                sd.status AS seed_status, c.stage AS campaign_stage
         ${from}
         ORDER BY ${sortCol} ${sortDir} NULLS LAST, s.${impr} DESC, s.query_norm ASC
         LIMIT ${pageSize} OFFSET ${offset}`,
        w.params,
      ),
      pool.query(`SELECT count(*)::int AS total ${from}`, w.params),
    ]);
    res.json({ success: true, rows: rows.rows, total: count.rows[0].total, page, pageSize });
  } catch (error) {
    fail('GET /api/admin/seo-demand/signals', res, error);
  }
});

const GAP_SORTS: Record<string, string> = {
  gap_score: 'gap_score', impressions: 'impressions', queries: 'queries', seeds: 'seeds',
  published: 'published', category: 'category', city: 'city', position: 'position', store_signals: 'store_signals',
};

/** GET /gaps — category × market demand against seeding coverage. */
router.get('/gaps', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { pageSize, offset, page, dir, impr } = paging(req);
    const inner = whereBuilder();
    inner.raw(`s.${impr} > 0`);
    inner.raw('s.category IS NOT NULL');
    inner.raw(`s.review_status <> 'rejected'`);
    const city = str(req.query.city);
    if (city) inner.add((p) => `s.city ILIKE ${p}`, city);
    const state = str(req.query.state);
    if (state) inner.add((p) => `s.state ILIKE ${p}`, state);
    const category = str(req.query.category);
    if (category) inner.add((p) => `s.category ILIKE ${p}`, category);
    const q = str(req.query.q);
    if (q) inner.add((p) => `(s.category ILIKE ${p} OR s.city ILIKE ${p})`, `%${q}%`);
    if (str(req.query.marketOnly) === 'true') inner.raw('s.city IS NOT NULL');

    const minImpr = num(req.query.minImpressions);
    const params = inner.params;
    let outerSql = '';
    if (minImpr != null) {
      params.push(minImpr);
      outerSql = `WHERE impressions >= $${params.length}`;
    }
    if (str(req.query.gapOnly) === 'true') outerSql += `${outerSql ? ' AND' : 'WHERE'} published <= 2`;

    const sortCol = GAP_SORTS[str(req.query.sort) || 'gap_score'] || 'gap_score';
    const sql = `WITH g AS (
        SELECT s.category, s.city, s.state,
               sum(s.${impr})::int AS impressions,
               count(*)::int AS queries,
               count(*) FILTER (WHERE s.intent = 'store')::int AS store_signals,
               sum(coalesce(s.position_28d, 0) * s.impressions_28d) / nullif(sum(s.impressions_28d), 0) AS position,
               (array_agg(s.sample_query ORDER BY s.${impr} DESC))[1:5] AS top_queries
        FROM seo_query_signals s ${inner.sql}
        GROUP BY s.category, s.city, s.state
      ), j AS (
        SELECT g.*,
               coalesce(cov.seeds, 0)::int AS seeds,
               coalesce(cov.published, 0)::int AS published,
               round(g.impressions::numeric / (1 + coalesce(cov.published, 0)), 2)::float AS gap_score
        FROM g
        LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE d.status <> 'suppressed') AS seeds,
                 count(*) FILTER (WHERE d.status IN ('published', 'invited')) AS published
          FROM directory_presence_seeds d
          WHERE d.category ILIKE g.category
            AND (g.city IS NULL OR (d.city ILIKE g.city AND d.state ILIKE g.state))
        ) cov ON true
      )`;
    const pool = getDirectPool();
    const [rows, count] = await Promise.all([
      pool.query(
        `${sql} SELECT * FROM j ${outerSql}
         ORDER BY ${sortCol} ${dir} NULLS LAST, impressions DESC, category, city
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      ),
      pool.query(`${sql} SELECT count(*)::int AS total FROM j ${outerSql}`, params),
    ]);
    res.json({ success: true, rows: rows.rows, total: count.rows[0].total, page, pageSize });
  } catch (error) {
    fail('GET /api/admin/seo-demand/gaps', res, error);
  }
});

const MARKET_SORTS: Record<string, string> = {
  impressions: 'impressions', queries: 'queries', store_signals: 'store_signals', seed_signals: 'seed_signals',
  categories: 'categories', seeds: 'seeds', published: 'published', city: 'city', clicks: 'clicks', position: 'position',
};

/** GET /markets — demand per city against seeding coverage. */
router.get('/markets', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { pageSize, offset, page, dir, impr } = paging(req);
    const w = whereBuilder();
    w.raw(`s.${impr} > 0`);
    w.raw('s.city IS NOT NULL');
    const q = str(req.query.q);
    if (q) w.add((p) => `s.city ILIKE ${p}`, `%${q}%`);
    const state = str(req.query.state);
    if (state) w.add((p) => `s.state ILIKE ${p}`, state);
    const params = w.params;
    let outerSql = '';
    const minImpr = num(req.query.minImpressions);
    if (minImpr != null) {
      params.push(minImpr);
      outerSql = `WHERE impressions >= $${params.length}`;
    }
    const sortCol = MARKET_SORTS[str(req.query.sort) || 'impressions'] || 'impressions';
    const sql = `WITH m AS (
        SELECT s.city, s.state,
               sum(s.${impr})::int AS impressions,
               sum(s.clicks_28d)::int AS clicks,
               count(*)::int AS queries,
               count(*) FILTER (WHERE s.intent = 'store')::int AS store_signals,
               count(*) FILTER (WHERE s.route = 'seed_signal')::int AS seed_signals,
               count(DISTINCT s.category)::int AS categories,
               sum(coalesce(s.position_28d, 0) * s.impressions_28d) / nullif(sum(s.impressions_28d), 0) AS position
        FROM seo_query_signals s ${w.sql}
        GROUP BY s.city, s.state
      ), j AS (
        SELECT m.*, coalesce(cov.seeds, 0)::int AS seeds, coalesce(cov.published, 0)::int AS published
        FROM m LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE d.status <> 'suppressed') AS seeds,
                 count(*) FILTER (WHERE d.status IN ('published', 'invited')) AS published
          FROM directory_presence_seeds d WHERE d.city ILIKE m.city AND d.state ILIKE m.state
        ) cov ON true
      )`;
    const pool = getDirectPool();
    const [rows, count] = await Promise.all([
      pool.query(
        `${sql} SELECT * FROM j ${outerSql} ORDER BY ${sortCol} ${dir} NULLS LAST, impressions DESC, city
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      ),
      pool.query(`${sql} SELECT count(*)::int AS total FROM j ${outerSql}`, params),
    ]);
    res.json({ success: true, rows: rows.rows, total: count.rows[0].total, page, pageSize });
  } catch (error) {
    fail('GET /api/admin/seo-demand/markets', res, error);
  }
});

/** POST /signals/review { queryNorm, status: confirmed | rejected | open } */
router.post('/signals/review', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const queryNorm = str(req.body?.queryNorm);
    const status = str(req.body?.status);
    if (!queryNorm || !status || !['confirmed', 'rejected', 'open'].includes(status)) {
      return res.status(400).json({ error: 'queryNorm and status (confirmed|rejected|open) required' });
    }
    const { rows } = await getDirectPool().query(
      `UPDATE seo_query_signals
       SET review_status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE query_norm = $1 RETURNING query_norm, review_status`,
      [queryNorm, status, (req as any).user?.id ?? null],
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    if (status === 'open') await classifyQuerySignals();
    res.json({ success: true, signal: rows[0] });
  } catch (error) {
    fail('POST /api/admin/seo-demand/signals/review', res, error);
  }
});

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** POST /signals/queue { queryNorm, businessName?, city?, state?, category? } — click to queue. */
router.post('/signals/queue', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const queryNorm = str(req.body?.queryNorm);
    if (!queryNorm) return res.status(400).json({ error: 'queryNorm required' });
    const pool = getDirectPool();
    const { rows } = await pool.query(`SELECT * FROM seo_query_signals WHERE query_norm = $1`, [queryNorm]);
    const s = rows[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.intent !== 'store') {
      return res.status(400).json({ error: 'only store-name signals can be queued; use Start seek batch for category demand' });
    }
    if (s.route === 'claimed_client') {
      return res.status(400).json({ error: 'claimed client — no outreach' });
    }

    const matched = s.match_kind && s.match_kind !== 'unmatched';
    const businessName = str(req.body?.businessName) || (matched ? s.match_name : titleCase(s.sample_query));
    const evidence = {
      source: 'search_batch',
      query: s.sample_query,
      impressions_7d: s.impressions_7d,
      impressions_28d: s.impressions_28d,
      impressions_90d: s.impressions_90d,
      clicks_28d: s.clicks_28d,
      position_28d: s.position_28d,
      top_page: s.top_page,
      route: s.route,
      match_kind: s.match_kind,
      match_id: s.match_id,
      match_confidence: s.match_confidence != null ? Number(s.match_confidence) : null,
      captured_at: new Date().toISOString(),
    };
    const result = await MarketingProspectQueueService.addToQueue({
      business_name: businessName,
      title: `${businessName} — Search Demand`,
      category: str(req.body?.category) || s.category || undefined,
      city: str(req.body?.city) || s.city || undefined,
      state: str(req.body?.state) || s.state || undefined,
      source_kind: 'search_batch',
      scope: 'business',
      seed_id: s.seed_id || undefined,
      business_snapshot: { search_demand: evidence },
      discovery_provenance: [evidence],
      discovery_signals: ['search_demand', s.route].filter(Boolean),
      note: `Search demand: "${s.sample_query}" — ${s.impressions_28d} impressions (28d)${s.position_28d != null ? `, avg position ${Number(s.position_28d).toFixed(1)}` : ''}`,
      queuedBy: (req as any).user?.id,
    });

    if (result.kind === 'campaign_exists') {
      await pool.query(
        `UPDATE seo_query_signals SET campaign_id = $2, review_status = 'confirmed', reviewed_by = $3,
                reviewed_at = now(), updated_at = now() WHERE query_norm = $1`,
        [queryNorm, result.campaignId, (req as any).user?.id ?? null],
      );
      return res.json({ success: true, data: { kind: 'campaign_exists', campaignId: result.campaignId } });
    }
    await pool.query(
      `UPDATE seo_query_signals SET review_status = 'queued', queued_prospect_id = $2, reviewed_by = $3,
              reviewed_at = now(), updated_at = now() WHERE query_norm = $1`,
      [queryNorm, result.entry.id, (req as any).user?.id ?? null],
    );
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: { kind: result.created ? 'created' : 'already_queued', prospectId: result.entry.id },
    });
  } catch (error: any) {
    if (error?.name === 'ConflictError' || error?.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    fail('POST /api/admin/seo-demand/signals/queue', res, error);
  }
});

/** POST /classify — re-run matching on open signals. */
router.post('/classify', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const classified = await classifyQuerySignals();
    res.json({ success: true, classified });
  } catch (error) {
    fail('POST /api/admin/seo-demand/classify', res, error);
  }
});

/** POST /ingest — pull Search Console now (same as the daily job). */
router.post('/ingest', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await ingestSearchConsole();
    res.json({ success: true, result });
  } catch (error) {
    fail('POST /api/admin/seo-demand/ingest', res, error);
  }
});

export default router;
