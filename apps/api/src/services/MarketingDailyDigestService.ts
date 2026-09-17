/**
 * MarketingDailyDigestService — derived "module activity" for a single day.
 *
 * The legacy daily scorecard (mkt_scorecards_list) is an operator-entered
 * productivity diary. The module now runs several automated motions
 * (proving grounds, seek batches, directory seeds, outreach, report delivery,
 * prospect queue) whose activity is already recorded elsewhere. This service
 * composes those sources into one read-only daily digest so the scorecard can
 * show what the module actually did instead of asking an operator to retype it.
 *
 * Sources (no new tables, no writes):
 *   - GrowthEngineAnalyticsService.getFunnel → seeks / queue / seeds / funnel
 *   - mkt_seek_batches                       → batch throughput
 *   - directory_seed_outreach_touches        → seed outreach + report outcomes
 *   - mkt_outreach_log                       → campaign outreach
 *   - mkt_campaigns_list                     → proving-ground workspaces
 *   - directory_seed_campaign_links          → per-PG cockpit breakdown
 *   - marketing_revenue / mkt_scorecards_list → canonical vs logged revenue
 */
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import GrowthEngineAnalyticsService, { type FunnelStage } from './GrowthEngineAnalyticsService';

/** One proving-ground workspace's seed activity for the day (mini cockpit row). */
export interface PgDigestRow {
  provingGroundId: string;
  displayId: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  seeds: number;
  published: number;
  claimed: number;
}

export interface DailyDigest {
  date: string;
  seeks: { runs: number };
  queue: { created: number; byStatus: Record<string, number> };
  seeds: {
    created: number;
    contactable: number;
    published: number;
    invited: number;
    claimed: number;
    upgraded: number;
    pgLinked: number;
  };
  provingGrounds: { workspaces: number; linkedSeeds: number; byWorkspace: PgDigestRow[] };
  batches: { launched: number; completed: number; running: number };
  outreach: {
    seedTouches: number;
    byChannel: Record<string, number>;
    campaignTouches: number;
    byOutcome: Record<string, number>;
  };
  reports: { delivered: number; viewed: number; claimed: number; declined: number };
  funnel: FunnelStage[];
  revenue: {
    /** Canonical payments recorded in marketing_revenue for the day. */
    canonicalCents: number;
    /** Operator-logged scorecard revenue for the day (all users). */
    loggedCents: number;
    /** canonicalCents − loggedCents. Positive = under-logged. */
    varianceCents: number;
    count: number;
  };
}

class MarketingDailyDigestService {
  /**
   * Compose the module-wide activity digest for a calendar day (UTC).
   * `dateStr` is `YYYY-MM-DD`; defaults to today.
   */
  async getDailyDigest(dateStr?: string, ctx?: RequestCtx): Promise<DailyDigest> {
    const pool = getDirectPool();
    const { day, start, endExclusive, endInclusive } = this.resolveDay(dateStr);

    try {
      const [
        funnel,
        queueRows,
        batchRows,
        seedTouchRows,
        campaignRows,
        pgRows,
        pgByWorkspaceRows,
        revenueRows,
        loggedRevenueRows,
      ] = await Promise.all([
        GrowthEngineAnalyticsService.getFunnel({ startDate: start, endDate: endInclusive }),
        pool.query(
          `SELECT status, COUNT(*) AS count
           FROM mkt_prospect_queue
           WHERE created_at >= $1 AND created_at < $2
           GROUP BY status`,
          [start, endExclusive],
        ),
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS launched,
             COUNT(*) FILTER (WHERE completed_at >= $1 AND completed_at < $2) AS completed,
             COUNT(*) FILTER (WHERE status = 'running') AS running
           FROM mkt_seek_batches`,
          [start, endExclusive],
        ),
        pool.query(
          `SELECT channel, outcome, COUNT(*) AS count
           FROM directory_seed_outreach_touches
           WHERE occurred_at >= $1 AND occurred_at < $2
           GROUP BY channel, outcome`,
          [start, endExclusive],
        ),
        pool.query(
          `SELECT outcome, COUNT(*) AS count
           FROM mkt_outreach_log
           WHERE contact_date = $1::date
           GROUP BY outcome`,
          [day],
        ),
        pool.query(
          `SELECT COUNT(*) AS workspaces
           FROM mkt_campaigns_list
           WHERE campaign_category = 'proving_ground'
             AND stage NOT IN ('lost', 'dead', 'closed', 'resolved_and_closed')`,
          [],
        ),
        pool.query(
          `SELECT
             mc.id AS proving_ground_id,
             mc.display_id,
             mc.category,
             mc.address_city AS city,
             mc.address_state AS state,
             COUNT(DISTINCT dps.id) AS seeds,
             COUNT(DISTINCT CASE WHEN dps.published_at IS NOT NULL THEN dps.id END) AS published,
             COUNT(DISTINCT CASE WHEN dps.claimed_at IS NOT NULL THEN dps.id END) AS claimed
           FROM directory_seed_campaign_links dscl
           JOIN mkt_campaigns_list mc
             ON mc.id = dscl.campaign_id AND mc.campaign_category = 'proving_ground'
           JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
           WHERE dps.created_at >= $1 AND dps.created_at < $2
           GROUP BY mc.id, mc.display_id, mc.category, mc.address_city, mc.address_state
           ORDER BY seeds DESC
           LIMIT 10`,
          [start, endExclusive],
        ),
        pool.query(
          `SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS count
           FROM marketing_revenue
           WHERE created_at >= $1 AND created_at < $2`,
          [start, endExclusive],
        ),
        pool.query(
          `SELECT COALESCE(SUM(revenue_collected_cents), 0) AS cents
           FROM mkt_scorecards_list
           WHERE date = $1::date`,
          [day],
        ),
      ]);

      const byStatus: Record<string, number> = {};
      let queueCreated = 0;
      for (const r of queueRows.rows) {
        const count = parseInt(r.count) || 0;
        byStatus[r.status ?? 'unknown'] = count;
        queueCreated += count;
      }

      const byChannel: Record<string, number> = {};
      let seedTouches = 0;
      const reports = { delivered: 0, viewed: 0, claimed: 0, declined: 0 };
      for (const r of seedTouchRows.rows) {
        const count = parseInt(r.count) || 0;
        byChannel[r.channel ?? 'unknown'] = (byChannel[r.channel ?? 'unknown'] ?? 0) + count;
        seedTouches += count;
        if (r.outcome === 'report_delivered') reports.delivered += count;
        else if (r.outcome === 'report_viewed') reports.viewed += count;
        else if (r.outcome === 'report_claimed') reports.claimed += count;
        else if (r.outcome === 'report_declined') reports.declined += count;
      }

      const byOutcome: Record<string, number> = {};
      let campaignTouches = 0;
      for (const r of campaignRows.rows) {
        const count = parseInt(r.count) || 0;
        byOutcome[r.outcome ?? 'unknown'] = count;
        campaignTouches += count;
      }

      const raw = funnel.raw;
      const canonicalCents = parseInt(revenueRows.rows[0]?.cents) || 0;
      const loggedCents = parseInt(loggedRevenueRows.rows[0]?.cents) || 0;
      return {
        date: day,
        seeks: { runs: raw.seeksRun },
        queue: { created: queueCreated, byStatus },
        seeds: {
          created: raw.seedsCreated,
          contactable: raw.seedsContactable,
          published: raw.seedsPublished,
          invited: raw.seedsInvited,
          claimed: raw.seedsClaimed,
          upgraded: raw.seedsUpgraded,
          pgLinked: raw.seedsPgLinked,
        },
        provingGrounds: {
          workspaces: parseInt(pgRows.rows[0]?.workspaces) || 0,
          linkedSeeds: raw.seedsPgLinked,
          byWorkspace: pgByWorkspaceRows.rows.map((r: any) => ({
            provingGroundId: r.proving_ground_id,
            displayId: r.display_id ?? null,
            category: r.category ?? null,
            city: r.city ?? null,
            state: r.state ?? null,
            seeds: parseInt(r.seeds) || 0,
            published: parseInt(r.published) || 0,
            claimed: parseInt(r.claimed) || 0,
          })),
        },
        batches: {
          launched: parseInt(batchRows.rows[0]?.launched) || 0,
          completed: parseInt(batchRows.rows[0]?.completed) || 0,
          running: parseInt(batchRows.rows[0]?.running) || 0,
        },
        outreach: { seedTouches, byChannel, campaignTouches, byOutcome },
        reports,
        funnel: funnel.stages,
        revenue: {
          canonicalCents,
          loggedCents,
          varianceCents: canonicalCents - loggedCents,
          count: parseInt(revenueRows.rows[0]?.count) || 0,
        },
      };
    } catch (error) {
      logger.error('Failed to build daily digest', ctx, { error: (error as Error).message, date: day });
      throw error;
    }
  }

  private resolveDay(dateStr?: string): { day: string; start: string; endExclusive: string; endInclusive: string } {
    const day = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : new Date().toISOString().slice(0, 10);
    const next = new Date(`${day}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      day,
      start: `${day}T00:00:00.000Z`,
      endExclusive: next.toISOString(),
      endInclusive: `${day}T23:59:59.999Z`,
    };
  }
}

export { MarketingDailyDigestService };
export default new MarketingDailyDigestService();
