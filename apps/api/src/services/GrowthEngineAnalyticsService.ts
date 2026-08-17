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
