/**
 * GrowthEngineAnalyticsService — end-to-end growth loop analytics.
 *
 * Aggregates the funnel: seeks → prospects → seeds → published → claimed → upgraded.
 * Provides per-niche, per-city breakdowns, time series, and recommendations.
 *
 * Metrics are computed live from the database (no materialized view needed
 * at this scale — queries are fast enough with proper indexes).
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getDirectPool } from '../utils/db-pool';

export interface FunnelMetrics {
  seeksRun: number;
  prospectsQueued: number;
  seedsCreated: number;
  seedsPublished: number;
  seedsClaimed: number;
  seedsUpgraded: number;
}

export interface FunnelStage {
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromFirst: number;
}

export interface NicheBreakdown {
  category: string;
  prospects: number;
  seeds: number;
  published: number;
  claimed: number;
  upgraded: number;
  claimRate: number;
  upgradeRate: number;
  bestCity: string | null;
  worstCity: string | null;
}

export interface CityBreakdown {
  city: string;
  niches: number;
  prospects: number;
  seeds: number;
  published: number;
  claimed: number;
  upgraded: number;
  claimRate: number;
  upgradeRate: number;
  bestNiche: string | null;
}

export interface TimeSeriesPoint {
  date: string;
  seedsCreated: number;
  seedsPublished: number;
  seedsClaimed: number;
  seedsUpgraded: number;
}

export interface Recommendation {
  type: 'expand_niche' | 'expand_city' | 'deprioritize_niche' | 'high_demand';
  title: string;
  description: string;
  category?: string;
  city?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DemandSignal {
  type: 'zero_result' | 'underserved' | 'lead_gen';
  category: string | null;
  city: string | null;
  searchCount: number;
  listingCount: number;
  description: string;
}

export interface NextSeekTarget {
  category: string;
  city: string;
  score: number;
  zeroResultSearches: number;
  leadGenSubmissions: number;
  underservedSearches: number;
  currentListings: number;
  reason: string;
}

class GrowthEngineAnalyticsService {
  /**
   * Get the overall funnel metrics for a date range.
   */
  async getFunnel(dateRange?: { startDate?: string; endDate?: string }): Promise<{ stages: FunnelStage[]; raw: FunnelMetrics }> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM mkt_intelligence_runs WHERE created_at >= $1 AND created_at <= $2) AS seeks_run,
        (SELECT COUNT(*) FROM mkt_prospect_queue WHERE created_at >= $1 AND created_at <= $2) AS prospects_queued,
        (SELECT COUNT(*) FROM directory_presence_seeds WHERE created_at >= $1 AND created_at <= $2) AS seeds_created,
        (SELECT COUNT(*) FROM directory_presence_seeds WHERE status IN ('published','invited','claimed') AND created_at >= $1 AND created_at <= $2) AS seeds_published,
        (SELECT COUNT(*) FROM directory_presence_seeds WHERE status = 'claimed' AND claimed_at >= $1 AND claimed_at <= $2) AS seeds_claimed,
        (SELECT COUNT(*) FROM tenants WHERE org_standing_mode = 'independent' AND subscription_tier != 'directory_presence' AND updated_at >= $1 AND updated_at <= $2) AS seeds_upgraded`,
      [startDate, endDate],
    );

    const r = result.rows[0];
    const raw: FunnelMetrics = {
      seeksRun: parseInt(r.seeks_run) || 0,
      prospectsQueued: parseInt(r.prospects_queued) || 0,
      seedsCreated: parseInt(r.seeds_created) || 0,
      seedsPublished: parseInt(r.seeds_published) || 0,
      seedsClaimed: parseInt(r.seeds_claimed) || 0,
      seedsUpgraded: parseInt(r.seeds_upgraded) || 0,
    };

    const stages = this.buildStages(raw);
    return { stages, raw };
  }

  /**
   * Get per-niche (category) breakdown.
   */
  async getByNiche(dateRange?: { startDate?: string; endDate?: string }): Promise<NicheBreakdown[]> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    const result = await pool.query(
      `SELECT
        dps.category,
        COUNT(DISTINCT pq.id) AS prospects,
        COUNT(DISTINCT dps.id) AS seeds,
        COUNT(DISTINCT CASE WHEN dps.status IN ('published','invited','claimed') THEN dps.id END) AS published,
        COUNT(DISTINCT CASE WHEN dps.status = 'claimed' THEN dps.id END) AS claimed,
        0 AS upgraded
      FROM directory_presence_seeds dps
      LEFT JOIN mkt_prospect_queue pq ON LOWER(pq.category) = LOWER(dps.category)
        AND pq.created_at >= $1 AND pq.created_at <= $2
      WHERE dps.created_at >= $1 AND dps.created_at <= $2
      GROUP BY dps.category
      ORDER BY seeds DESC`,
      [startDate, endDate],
    );

    return result.rows.map((r: any) => {
      const published = parseInt(r.published) || 0;
      const claimed = parseInt(r.claimed) || 0;
      const upgraded = parseInt(r.upgraded) || 0;
      return {
        category: r.category,
        prospects: parseInt(r.prospects) || 0,
        seeds: parseInt(r.seeds) || 0,
        published,
        claimed,
        upgraded,
        claimRate: published > 0 ? claimed / published : 0,
        upgradeRate: claimed > 0 ? upgraded / claimed : 0,
        bestCity: null,
        worstCity: null,
      };
    });
  }

  /**
   * Get per-city breakdown.
   */
  async getByCity(dateRange?: { startDate?: string; endDate?: string }): Promise<CityBreakdown[]> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    const result = await pool.query(
      `SELECT
        dps.city,
        COUNT(DISTINCT dps.category) AS niches,
        COUNT(DISTINCT dps.id) AS seeds,
        COUNT(DISTINCT CASE WHEN dps.status IN ('published','invited','claimed') THEN dps.id END) AS published,
        COUNT(DISTINCT CASE WHEN dps.status = 'claimed' THEN dps.id END) AS claimed,
        0 AS upgraded
      FROM directory_presence_seeds dps
      WHERE dps.created_at >= $1 AND dps.created_at <= $2
      GROUP BY dps.city
      ORDER BY seeds DESC`,
      [startDate, endDate],
    );

    return result.rows.map((r: any) => {
      const published = parseInt(r.published) || 0;
      const claimed = parseInt(r.claimed) || 0;
      const upgraded = parseInt(r.upgraded) || 0;
      return {
        city: r.city,
        niches: parseInt(r.niches) || 0,
        prospects: 0,
        seeds: parseInt(r.seeds) || 0,
        published,
        claimed,
        upgraded,
        claimRate: published > 0 ? claimed / published : 0,
        upgradeRate: claimed > 0 ? upgraded / claimed : 0,
        bestNiche: null,
      };
    });
  }

  /**
   * Get time series data (weekly or monthly).
   */
  async getTimeSeries(
    dateRange?: { startDate?: string; endDate?: string },
    granularity: 'week' | 'month' = 'week',
  ): Promise<TimeSeriesPoint[]> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    const truncFn = granularity === 'week' ? 'date_trunc(\'week\'' : 'date_trunc(\'month\'';
    const result = await pool.query(
      `SELECT
        ${truncFn}, dps.created_at) AS period,
        COUNT(DISTINCT dps.id) AS seeds_created,
        COUNT(DISTINCT CASE WHEN dps.status IN ('published','invited','claimed') AND dps.published_at IS NOT NULL THEN dps.id END) AS seeds_published,
        COUNT(DISTINCT CASE WHEN dps.status = 'claimed' AND dps.claimed_at IS NOT NULL THEN dps.id END) AS seeds_claimed,
        0 AS seeds_upgraded
      FROM directory_presence_seeds dps
      WHERE dps.created_at >= $1 AND dps.created_at <= $2
      GROUP BY period
      ORDER BY period ASC`,
      [startDate, endDate],
    );

    return result.rows.map((r: any) => ({
      date: new Date(r.period).toISOString().split('T')[0],
      seedsCreated: parseInt(r.seeds_created) || 0,
      seedsPublished: parseInt(r.seeds_published) || 0,
      seedsClaimed: parseInt(r.seeds_claimed) || 0,
      seedsUpgraded: parseInt(r.seeds_upgraded) || 0,
    }));
  }

  /**
   * Get recommendations for next expansion.
   */
  async getRecommendations(): Promise<Recommendation[]> {
    const niches = await this.getByNiche();
    const cities = await this.getByCity();
    const recs: Recommendation[] = [];

    // High claim rate + low city coverage → expand niche
    for (const n of niches) {
      if (n.claimRate > 0.3 && n.published >= 3) {
        const cityCount = cities.filter((c) => c.seeds > 0).length;
        if (cityCount < 5) {
          recs.push({
            type: 'expand_niche',
            title: `Expand "${n.category}" to more cities`,
            description: `${n.category} has a ${(n.claimRate * 100).toFixed(0)}% claim rate but only covers ${cityCount} cities. Consider running a multi-city seek batch.`,
            category: n.category,
            priority: 'high',
          });
        }
      }
    }

    // Low claim rate across cities → deprioritize
    for (const n of niches) {
      if (n.claimRate < 0.1 && n.published >= 5) {
        recs.push({
          type: 'deprioritize_niche',
          title: `Deprioritize "${n.category}"`,
          description: `${n.category} has a low claim rate (${(n.claimRate * 100).toFixed(0)}%) across ${n.published} published seeds. Consider focusing efforts elsewhere.`,
          category: n.category,
          priority: 'low',
        });
      }
    }

    // High claim rate city + low niche count → add niches
    for (const c of cities) {
      if (c.claimRate > 0.3 && c.niches < 3 && c.published >= 2) {
        recs.push({
          type: 'expand_city',
          title: `Add more niches in ${c.city}`,
          description: `${c.city} has a ${(c.claimRate * 100).toFixed(0)}% claim rate but only ${c.niches} niche${c.niches !== 1 ? 's' : ''}. Consider running seeks for new categories here.`,
          city: c.city,
          priority: 'medium',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recs.slice(0, 10);
  }

  /**
   * Log a search demand event from the public directory search.
   * Deduplicates by ip_hash + query + day (one event per user per query per day).
   */
  async logSearchDemand(input: {
    searchQuery: string;
    resolvedCategory?: string | null;
    resolvedCity?: string | null;
    resultCount: number;
    ipHash?: string | null;
    userAgentHash?: string | null;
  }): Promise<{ logged: boolean; deduplicated: boolean }> {
    const pool = getDirectPool();

    // Check for existing event from same ip+query+day
    if (input.ipHash) {
      const existing = await pool.query(
        `SELECT id FROM directory_search_demand_log
         WHERE ip_hash = $1 AND search_query = $2 AND DATE(searched_at) = DATE(now())
         LIMIT 1`,
        [input.ipHash, input.searchQuery],
      );
      if (existing.rows[0]) {
        return { logged: false, deduplicated: true };
      }
    }

    await pool.query(
      `INSERT INTO directory_search_demand_log
        (search_query, resolved_category, resolved_city, result_count, ip_hash, user_agent_hash, searched_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [
        input.searchQuery,
        input.resolvedCategory || null,
        input.resolvedCity || null,
        input.resultCount,
        input.ipHash || null,
        input.userAgentHash || null,
      ],
    );

    return { logged: true, deduplicated: false };
  }

  /**
   * Get demand signals — zero-result searches, underserved areas, lead gen demand.
   */
  async getDemandSignals(dateRange?: { startDate?: string; endDate?: string }): Promise<DemandSignal[]> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    // Zero-result searches (grouped by category+city)
    const zeroResult = await pool.query(
      `SELECT
         resolved_category, resolved_city,
         COUNT(*) AS search_count
       FROM directory_search_demand_log
       WHERE result_count = 0
         AND searched_at >= $1 AND searched_at <= $2
         AND resolved_category IS NOT NULL
       GROUP BY resolved_category, resolved_city
       ORDER BY search_count DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    // Underserved searches (< 5 listings but > 10 searches)
    const underserved = await pool.query(
      `SELECT
         d.resolved_category, d.resolved_city,
         COUNT(*) AS search_count,
         COALESCE(s.listing_count, 0) AS listing_count
       FROM directory_search_demand_log d
       LEFT JOIN (
         SELECT category, city, COUNT(*) AS listing_count
         FROM directory_presence_seeds WHERE status = 'published'
         GROUP BY category, city
       ) s ON LOWER(s.category) = LOWER(d.resolved_category) AND LOWER(s.city) = LOWER(d.resolved_city)
       WHERE d.result_count < 5
         AND d.searched_at >= $1 AND d.searched_at <= $2
         AND d.resolved_category IS NOT NULL
       GROUP BY d.resolved_category, d.resolved_city, s.listing_count
       HAVING COUNT(*) > 5
       ORDER BY search_count DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    // Lead gen demand (directory_lead_gen prospects grouped by category+city)
    const leadGen = await pool.query(
      `SELECT
         category, city, COUNT(*) AS submission_count
       FROM mkt_prospect_queue
       WHERE source_kind = 'directory_lead_gen'
         AND created_at >= $1 AND created_at <= $2
       GROUP BY category, city
       ORDER BY submission_count DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    const signals: DemandSignal[] = [];

    for (const r of zeroResult.rows) {
      signals.push({
        type: 'zero_result',
        category: r.resolved_category,
        city: r.resolved_city,
        searchCount: parseInt(r.search_count) || 0,
        listingCount: 0,
        description: `${r.search_count} zero-result searches for "${r.resolved_category}" in ${r.resolved_city || 'unknown city'}`,
      });
    }

    for (const r of underserved.rows) {
      signals.push({
        type: 'underserved',
        category: r.resolved_category,
        city: r.resolved_city,
        searchCount: parseInt(r.search_count) || 0,
        listingCount: parseInt(r.listing_count) || 0,
        description: `${r.search_count} searches, only ${r.listing_count} listings for "${r.resolved_category}" in ${r.resolved_city || 'unknown city'}`,
      });
    }

    for (const r of leadGen.rows) {
      signals.push({
        type: 'lead_gen',
        category: r.category,
        city: r.city,
        searchCount: parseInt(r.submission_count) || 0,
        listingCount: 0,
        description: `${r.submission_count} "Get listed" submissions for ${r.category || 'unknown'} in ${r.city || 'unknown city'}`,
      });
    }

    return signals;
  }

  /**
   * Get prioritized next seek targets — combines all demand signals into a scored list.
   * Score = (zero_result_searches * 3) + (lead_gen_submissions * 5) + (underserved_searches * 2)
   */
  async getNextSeekTargets(): Promise<NextSeekTarget[]> {
    const pool = getDirectPool();
    const { startDate, endDate } = this.resolveDateRange();

    // Aggregate all demand signals by category+city
    const result = await pool.query(
      `WITH zero_results AS (
         SELECT resolved_category AS category, resolved_city AS city,
                COUNT(*) AS zero_result_searches
         FROM directory_search_demand_log
         WHERE result_count = 0 AND resolved_category IS NOT NULL
           AND searched_at >= $1 AND searched_at <= $2
         GROUP BY resolved_category, resolved_city
       ),
       underserved AS (
         SELECT resolved_category AS category, resolved_city AS city,
                COUNT(*) AS underserved_searches
         FROM directory_search_demand_log
         WHERE result_count < 5 AND resolved_category IS NOT NULL
           AND searched_at >= $1 AND searched_at <= $2
         GROUP BY resolved_category, resolved_city
       ),
       lead_gen AS (
         SELECT category, city, COUNT(*) AS lead_gen_submissions
         FROM mkt_prospect_queue
         WHERE source_kind = 'directory_lead_gen'
           AND created_at >= $1 AND created_at <= $2
         GROUP BY category, city
       ),
       listings AS (
         SELECT category, city, COUNT(*) AS listing_count
         FROM directory_presence_seeds WHERE status = 'published'
         GROUP BY category, city
       )
       SELECT
         COALESCE(z.category, u.category, l.category) AS category,
         COALESCE(z.city, u.city, l.city) AS city,
         COALESCE(z.zero_result_searches, 0) AS zero_result_searches,
         COALESCE(u.underserved_searches, 0) AS underserved_searches,
         COALESCE(l.lead_gen_submissions, 0) AS lead_gen_submissions,
         COALESCE(li.listing_count, 0) AS current_listings,
         (COALESCE(z.zero_result_searches, 0) * 3 +
          COALESCE(l.lead_gen_submissions, 0) * 5 +
          COALESCE(u.underserved_searches, 0) * 2) AS score
       FROM zero_results z
       FULL OUTER JOIN underserved u ON LOWER(z.category) = LOWER(u.category) AND LOWER(z.city) = LOWER(u.city)
       FULL OUTER JOIN lead_gen l ON LOWER(COALESCE(z.category, u.category)) = LOWER(l.category)
         AND LOWER(COALESCE(z.city, u.city)) = LOWER(l.city)
       LEFT JOIN listings li ON LOWER(COALESCE(z.category, u.category, l.category)) = LOWER(li.category)
         AND LOWER(COALESCE(z.city, u.city, l.city)) = LOWER(li.city)
       WHERE COALESCE(z.zero_result_searches, 0) + COALESCE(u.underserved_searches, 0) + COALESCE(l.lead_gen_submissions, 0) > 0
       ORDER BY score DESC
       LIMIT 10`,
      [startDate, endDate],
    );

    return result.rows.map((r: any) => ({
      category: r.category,
      city: r.city,
      score: parseInt(r.score) || 0,
      zeroResultSearches: parseInt(r.zero_result_searches) || 0,
      leadGenSubmissions: parseInt(r.lead_gen_submissions) || 0,
      underservedSearches: parseInt(r.underserved_searches) || 0,
      currentListings: parseInt(r.current_listings) || 0,
      reason: `${parseInt(r.zero_result_searches) || 0} zero-result searches, ${parseInt(r.lead_gen_submissions) || 0} lead gen submissions, ${parseInt(r.current_listings) || 0} existing listings`,
    }));
  }

  /**
   * Run the daily aggregation job — populates growth_engine_daily_metrics.
   * Idempotent: re-running for the same date overwrites.
   */
  async runDailyAggregation(date?: Date): Promise<{ date: string; rowsUpdated: number }> {
    const pool = getDirectPool();
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday by default
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayStart = `${dateStr} 00:00:00`;
    const dayEnd = `${dateStr} 23:59:59`;

    // Aggregate per category+city
    const result = await pool.query(
      `SELECT
        dps.category,
        dps.city,
        COUNT(DISTINCT dps.id) AS seeds_created,
        COUNT(DISTINCT CASE WHEN dps.status IN ('published','invited','claimed') THEN dps.id END) AS published,
        COUNT(DISTINCT CASE WHEN dps.status = 'claimed' THEN dps.id END) AS claimed
      FROM directory_presence_seeds dps
      WHERE dps.created_at >= $1 AND dps.created_at <= $2
      GROUP BY dps.category, dps.city`,
      [dayStart, dayEnd],
    );

    let rowsUpdated = 0;
    for (const row of result.rows) {
      await pool.query(
        `INSERT INTO growth_engine_daily_metrics
          (metric_date, category, city, seeds_created, seeds_published, seeds_claimed, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (metric_date, category, city)
         DO UPDATE SET
           seeds_created = EXCLUDED.seeds_created,
           seeds_published = EXCLUDED.seeds_published,
           seeds_claimed = EXCLUDED.seeds_claimed,
           updated_at = now()`,
        [dateStr, row.category, row.city, parseInt(row.seeds_created) || 0, parseInt(row.published) || 0, parseInt(row.claimed) || 0],
      );
      rowsUpdated++;
    }

    logger.info('GrowthEngineAnalyticsService.runDailyAggregation', undefined, { date: dateStr, rowsUpdated });
    return { date: dateStr, rowsUpdated };
  }

  // --- Helpers ---

  private resolveDateRange(dateRange?: { startDate?: string; endDate?: string }): { startDate: string; endDate: string } {
    const now = new Date();
    const endDate = dateRange?.endDate || now.toISOString();
    const startDate = dateRange?.startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    return { startDate, endDate };
  }

  private buildStages(raw: FunnelMetrics): FunnelStage[] {
    const stages: Array<{ label: string; count: number }> = [
      { label: 'Seeks Run', count: raw.seeksRun },
      { label: 'Prospects Queued', count: raw.prospectsQueued },
      { label: 'Seeds Created', count: raw.seedsCreated },
      { label: 'Seeds Published', count: raw.seedsPublished },
      { label: 'Seeds Claimed', count: raw.seedsClaimed },
      { label: 'Seeds Upgraded', count: raw.seedsUpgraded },
    ];

    const firstCount = stages[0].count || 1;
    return stages.map((s, i) => ({
      label: s.label,
      count: s.count,
      conversionFromPrevious: i > 0 && stages[i - 1].count > 0
        ? s.count / stages[i - 1].count
        : null,
      conversionFromFirst: s.count / firstCount,
    }));
  }
}

export default new GrowthEngineAnalyticsService();
