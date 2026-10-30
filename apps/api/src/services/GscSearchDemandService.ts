/**
 * Search Console demand ingest (data-driven seeding).
 *
 * Pulls Google Search Console search analytics for GSC_SITE_URL with the
 * gsc-reader service account (GSC_SERVICE_ACCOUNT_JSON_B64) into
 * seo_gsc_query_daily / seo_gsc_page_daily, then rolls rolling demand up into
 * seo_query_signals. Search Console lags and revises recent days, so every run
 * replaces the last GSC_LOOKBACK_DAYS days; the first run backfills
 * GSC_BACKFILL_DAYS.
 *
 * See: migrations/317_seo_search_demand.sql
 */
import { google, searchconsole_v1 } from 'googleapis';
import type { PoolClient } from 'pg';
import { getDirectPool } from '../utils/db-pool';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const ROW_LIMIT = 25000;
const INSERT_CHUNK = 1000;
const QUERY_NORM_SQL = `lower(btrim(regexp_replace(query, '\\s+', ' ', 'g')))`;

type GscRow = searchconsole_v1.Schema$ApiDataRow;

export interface GscIngestResult {
  skipped?: 'not_configured';
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  backfill?: boolean;
  queryRows?: number;
  pageRows?: number;
  signals?: number;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function isGscConfigured(): boolean {
  return Boolean(unifiedConfig.gscServiceAccountJsonB64);
}

function createClient(): searchconsole_v1.Searchconsole {
  const raw = Buffer.from(unifiedConfig.gscServiceAccountJsonB64 || '', 'base64').toString('utf8');
  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: [GSC_SCOPE] });
  return google.searchconsole({ version: 'v1', auth });
}

async function fetchAllRows(
  client: searchconsole_v1.Searchconsole,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const res = await client.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions, rowLimit: ROW_LIMIT, startRow, dataState: 'all' },
    });
    const batch = res.data.rows ?? [];
    rows.push(...batch);
    if (batch.length < ROW_LIMIT) break;
  }
  return rows;
}

async function insertQueryRows(db: PoolClient, rows: GscRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const keys = chunk.map((r) => r.keys ?? []);
    await db.query(
      `INSERT INTO seo_gsc_query_daily (date, query, page, country, device, clicks, impressions, ctr, position)
       SELECT * FROM unnest($1::date[], $2::text[], $3::text[], $4::varchar[], $5::varchar[], $6::int[], $7::int[], $8::float8[], $9::float8[])
       ON CONFLICT (date, query, page, country, device) DO UPDATE SET
         clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
         ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = now()`,
      [
        keys.map((k) => k[0]),
        keys.map((k) => k[1]),
        keys.map((k) => k[2]),
        keys.map((k) => k[3]),
        keys.map((k) => k[4]),
        chunk.map((r) => r.clicks ?? 0),
        chunk.map((r) => r.impressions ?? 0),
        chunk.map((r) => r.ctr ?? 0),
        chunk.map((r) => r.position ?? 0),
      ],
    );
  }
}

async function insertPageRows(db: PoolClient, rows: GscRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const keys = chunk.map((r) => r.keys ?? []);
    await db.query(
      `INSERT INTO seo_gsc_page_daily (date, page, clicks, impressions, ctr, position)
       SELECT * FROM unnest($1::date[], $2::text[], $3::int[], $4::int[], $5::float8[], $6::float8[])
       ON CONFLICT (date, page) DO UPDATE SET
         clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
         ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = now()`,
      [
        keys.map((k) => k[0]),
        keys.map((k) => k[1]),
        chunk.map((r) => r.clicks ?? 0),
        chunk.map((r) => r.impressions ?? 0),
        chunk.map((r) => r.ctr ?? 0),
        chunk.map((r) => r.position ?? 0),
      ],
    );
  }
}

/** Rolls the last 90 days of raw query rows into one seo_query_signals row per normalized query. */
export async function refreshQuerySignals(): Promise<number> {
  const pool = getDirectPool();
  const res = await pool.query(
    `WITH raw AS (
       SELECT ${QUERY_NORM_SQL} AS query_norm, query, page, date, clicks, impressions, position
       FROM seo_gsc_query_daily
       WHERE date > current_date - 90
     ), agg AS (
       SELECT query_norm,
              min(query) AS sample_query,
              coalesce(sum(impressions) FILTER (WHERE date > current_date - 7), 0) AS i7,
              coalesce(sum(impressions) FILTER (WHERE date > current_date - 28), 0) AS i28,
              coalesce(sum(impressions), 0) AS i90,
              coalesce(sum(clicks) FILTER (WHERE date > current_date - 28), 0) AS c28,
              sum(position * impressions) FILTER (WHERE date > current_date - 28)
                / nullif(sum(impressions) FILTER (WHERE date > current_date - 28), 0) AS p28,
              min(date) AS first_seen,
              max(date) AS last_seen
       FROM raw GROUP BY query_norm
     ), top AS (
       SELECT DISTINCT ON (query_norm) query_norm, page
       FROM (SELECT query_norm, page, sum(impressions) AS im FROM raw GROUP BY query_norm, page) x
       ORDER BY query_norm, im DESC
     )
     INSERT INTO seo_query_signals AS s
       (query_norm, sample_query, impressions_7d, impressions_28d, impressions_90d, clicks_28d,
        position_28d, top_page, first_seen, last_seen, updated_at)
     SELECT a.query_norm, a.sample_query, a.i7, a.i28, a.i90, a.c28, a.p28, t.page, a.first_seen, a.last_seen, now()
     FROM agg a LEFT JOIN top t USING (query_norm)
     ON CONFLICT (query_norm) DO UPDATE SET
       sample_query = EXCLUDED.sample_query,
       impressions_7d = EXCLUDED.impressions_7d,
       impressions_28d = EXCLUDED.impressions_28d,
       impressions_90d = EXCLUDED.impressions_90d,
       clicks_28d = EXCLUDED.clicks_28d,
       position_28d = EXCLUDED.position_28d,
       top_page = EXCLUDED.top_page,
       first_seen = LEAST(s.first_seen, EXCLUDED.first_seen),
       last_seen = EXCLUDED.last_seen,
       updated_at = now()`,
  );
  await pool.query(
    `UPDATE seo_query_signals
     SET impressions_7d = 0, impressions_28d = 0, impressions_90d = 0, clicks_28d = 0, position_28d = NULL, updated_at = now()
     WHERE last_seen <= current_date - 90 AND impressions_90d > 0`,
  );
  return res.rowCount ?? 0;
}

export async function ingestSearchConsole(opts: { days?: number } = {}): Promise<GscIngestResult> {
  if (!isGscConfigured()) return { skipped: 'not_configured' };

  const pool = getDirectPool();
  const siteUrl = unifiedConfig.gscSiteUrl;

  let days = opts.days;
  let backfill = false;
  if (!days) {
    const { rows } = await pool.query(`SELECT EXISTS (SELECT 1 FROM seo_gsc_page_daily) AS has_data`);
    backfill = !rows[0]?.has_data;
    days = backfill ? unifiedConfig.gscBackfillDays : unifiedConfig.gscLookbackDays;
  }

  const endDate = isoDate(daysAgo(1));
  const startDate = isoDate(daysAgo(days));
  const client = createClient();

  const [queryRows, pageRows] = await Promise.all([
    fetchAllRows(client, siteUrl, startDate, endDate, ['date', 'query', 'page', 'country', 'device']),
    fetchAllRows(client, siteUrl, startDate, endDate, ['date', 'page']),
  ]);

  // Replace the window so rows Google revised away don't linger.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`DELETE FROM seo_gsc_query_daily WHERE date BETWEEN $1 AND $2`, [startDate, endDate]);
    await db.query(`DELETE FROM seo_gsc_page_daily WHERE date BETWEEN $1 AND $2`, [startDate, endDate]);
    await insertQueryRows(db, queryRows);
    await insertPageRows(db, pageRows);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    db.release();
  }

  const signals = await refreshQuerySignals();

  const result: GscIngestResult = {
    siteUrl, startDate, endDate, backfill,
    queryRows: queryRows.length, pageRows: pageRows.length, signals,
  };
  logger.info('[GscSearchDemand] Ingest complete', undefined, result);
  return result;
}

export default { ingestSearchConsole, refreshQuerySignals, isGscConfigured };
