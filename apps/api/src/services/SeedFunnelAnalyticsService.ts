/**
 * SeedFunnelAnalyticsService — cohort funnel metrics + benchmark gates for the
 * directory-seed go-to-market motion.
 *
 * Implements the measurement layer of
 * docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md:
 *   - Per-cohort (per-campaign) funnel counts over directory_presence_seeds
 *   - Combined-cohort aggregates (DISTINCT seeds across a campaign set)
 *   - Benchmark gate grading (G1–G4) with directional vs. decision-grade
 *     small-n rules (spec §6)
 *
 * Funnel stage sources:
 *   seeds        — directory_presence_seeds bonded via directory_seed_campaign_links
 *   contactable  — seeds.contact_status = 'contactable' (derived at ingest, migration 258)
 *   invited      — ≥ 1 directory_claim_tokens row for the seed
 *   claimed      — seeds.claimed_at IS NOT NULL (token consumed via acceptClaim)
 *   claimed_30d  — claimed within 30 days of the token being issued (G2 window)
 *   nap_verified — seeds.nap_verified_at IS NOT NULL (stamped at claim)
 *   owner_corrected — seeds.nap_owner_corrected (owner_update diff rows)
 *   paid         — claimed seed's tenant sits on a paid tier
 *                  (subscription_tiers_list.price_monthly > 0)
 *
 * Known v1 approximations (documented in the spec revision log):
 *   - G4 uses "on a paid tier now" as the proxy for "paid within 60 days of
 *     claim" — tenants carry no tier-change history table, and seed cohorts
 *     are young. Revisit when subscription history exists.
 *   - G5 (CAC payback) and G6 (90-day retention) are deferred: they need
 *     outreach-cost allocation and renewal history respectively.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface CohortFunnelMetrics {
  seeds: number;
  contactable: number;
  invited: number;
  claimed: number;
  claimed30d: number;
  napVerified: number;
  ownerCorrected: number;
  paid: number;
}

export interface GateResult {
  gate: string;
  description: string;
  value: number | null;
  threshold: number;
  /** null = not evaluable (zero denominator) — never read as a failure. */
  pass: boolean | null;
}

export type CohortGrade = 'directional' | 'decision_grade';

export interface CohortFunnelReport {
  cohortKey: string;
  /** Omitted on the combined aggregate (campaign fields are per-cohort only). */
  campaignId?: string | null;
  displayId?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  focus?: string | null;
  metrics: CohortFunnelMetrics;
  gates: GateResult[];
  grade: CohortGrade;
  deferredGates: Array<{ gate: string; reason: string }>;
}

// Benchmark thresholds — seed-funnel spec §5. Freeze changes to these only
// through a spec revision.
export const FUNNEL_GATE_THRESHOLDS = {
  G1_contactable_rate: 0.4,
  G2_claim_rate_30d: 0.2,
  G3_nap_verified_rate: 0.8,
  G4_paid_rate: 0.1,
} as const;

// Small-n rules (spec §6): a cohort is decision-grade only when it holds
// enough seeds, claims, and paid conversions for the rates to mean anything.
export const DECISION_GRADE_MINIMUMS = {
  seeds: 20,
  claimed: 5,
  paid: 2,
} as const;

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * Grade a cohort's funnel metrics against the benchmark gates.
 * Pure function — exported for direct unit testing.
 */
export function gradeGates(m: CohortFunnelMetrics): {
  gates: GateResult[];
  grade: CohortGrade;
} {
  const decisionGrade =
    m.seeds >= DECISION_GRADE_MINIMUMS.seeds &&
    m.claimed >= DECISION_GRADE_MINIMUMS.claimed &&
    m.paid >= DECISION_GRADE_MINIMUMS.paid;

  const gateDefs: Array<Omit<GateResult, 'pass'>> = [
    {
      gate: 'G1_contactable_rate',
      description: 'Seeds with a usable outreach route / all seeds',
      value: rate(m.contactable, m.seeds),
      threshold: FUNNEL_GATE_THRESHOLDS.G1_contactable_rate,
    },
    {
      gate: 'G2_claim_rate_30d',
      description: 'Seeds claimed within 30 days of invite / invited seeds',
      value: rate(m.claimed30d, m.invited),
      threshold: FUNNEL_GATE_THRESHOLDS.G2_claim_rate_30d,
    },
    {
      gate: 'G3_nap_verified_rate',
      description: 'Claims with owner-confirmed NAP / claimed seeds',
      value: rate(m.napVerified, m.claimed),
      threshold: FUNNEL_GATE_THRESHOLDS.G3_nap_verified_rate,
    },
    {
      gate: 'G4_paid_rate',
      description: 'Claims that reached a paid tier / claimed seeds',
      value: rate(m.paid, m.claimed),
      threshold: FUNNEL_GATE_THRESHOLDS.G4_paid_rate,
    },
  ];

  const gates: GateResult[] = gateDefs.map((g) => ({
    ...g,
    pass: g.value == null ? null : (g.value as number) >= g.threshold,
  }));

  return { gates, grade: decisionGrade ? 'decision_grade' : 'directional' };
}

const DEFERRED_GATES = [
  {
    gate: 'G5_cac_payback',
    reason: 'Requires outreach-cost allocation; not yet instrumented.',
  },
  {
    gate: 'G6_retention_90d',
    reason: 'Requires subscription renewal history; not yet instrumented.',
  },
];

export interface CohortFilters {
  campaignIds?: string[];
  category?: string;
  city?: string;
  state?: string;
  focus?: string;
}

interface CohortRow {
  campaign_id: string | null;
  display_id: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  focus: string | null;
  seeds: bigint | number;
  contactable: bigint | number;
  invited: bigint | number;
  claimed: bigint | number;
  claimed_30d: bigint | number;
  nap_verified: bigint | number;
  owner_corrected: bigint | number;
  paid: bigint | number;
}

function buildFilterClauses(filters: CohortFilters, params: any[]): string {
  const clauses: string[] = [];
  if (filters.campaignIds && filters.campaignIds.length > 0) {
    params.push(filters.campaignIds);
    clauses.push(`mc.id = ANY($${params.length}::text[])`);
  }
  if (filters.category) {
    params.push(`%${filters.category}%`);
    clauses.push(`mc.category ILIKE $${params.length}`);
  }
  if (filters.city) {
    params.push(`%${filters.city}%`);
    clauses.push(`mc.address_city ILIKE $${params.length}`);
  }
  if (filters.state) {
    params.push(`%${filters.state}%`);
    clauses.push(`mc.address_state ILIKE $${params.length}`);
  }
  if (filters.focus) {
    params.push(filters.focus);
    clauses.push(`mc.intelligence_focus = $${params.length}`);
  }
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

// Shared aggregate expressions. COUNT(DISTINCT dps.id) keeps a seed bonded to
// several campaigns from double-counting inside a single cohort.
const METRIC_SELECT = `
  COUNT(DISTINCT dps.id) AS seeds,
  COUNT(DISTINCT dps.id) FILTER (WHERE dps.contact_status = 'contactable') AS contactable,
  COUNT(DISTINCT dps.id) FILTER (
    WHERE EXISTS (SELECT 1 FROM directory_claim_tokens t WHERE t.seed_id = dps.id)
  ) AS invited,
  COUNT(DISTINCT dps.id) FILTER (WHERE dps.claimed_at IS NOT NULL) AS claimed,
  COUNT(DISTINCT dps.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM directory_claim_tokens t2
      WHERE t2.seed_id = dps.id
        AND t2.consumed_at IS NOT NULL
        AND t2.consumed_at <= t2.created_at + INTERVAL '30 days'
    )
  ) AS claimed_30d,
  COUNT(DISTINCT dps.id) FILTER (WHERE dps.nap_verified_at IS NOT NULL) AS nap_verified,
  COUNT(DISTINCT dps.id) FILTER (WHERE dps.nap_owner_corrected) AS owner_corrected,
  COUNT(DISTINCT dps.id) FILTER (
    WHERE dps.claimed_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM tenants tn
        JOIN subscription_tiers_list stl ON stl.tier_key = tn.subscription_tier
        WHERE tn.id = dps.tenant_id AND stl.price_monthly > 0
      )
  ) AS paid
`;

const FUNNEL_FROM = `
  FROM directory_seed_campaign_links dscl
  JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
  JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
`;

function rowToMetrics(row: CohortRow): CohortFunnelMetrics {
  return {
    seeds: Number(row.seeds ?? 0),
    contactable: Number(row.contactable ?? 0),
    invited: Number(row.invited ?? 0),
    claimed: Number(row.claimed ?? 0),
    claimed30d: Number(row.claimed_30d ?? 0),
    napVerified: Number(row.nap_verified ?? 0),
    ownerCorrected: Number(row.owner_corrected ?? 0),
    paid: Number(row.paid ?? 0),
  };
}

function buildReport(
  cohortKey: string,
  row: CohortRow | null,
  includeCampaignFields: boolean,
): CohortFunnelReport {
  const metrics = row
    ? rowToMetrics(row)
    : {
        seeds: 0,
        contactable: 0,
        invited: 0,
        claimed: 0,
        claimed30d: 0,
        napVerified: 0,
        ownerCorrected: 0,
        paid: 0,
      };
  const { gates, grade } = gradeGates(metrics);
  const report: CohortFunnelReport = {
    cohortKey,
    metrics,
    gates,
    grade,
    deferredGates: DEFERRED_GATES,
  };
  if (includeCampaignFields && row) {
    report.campaignId = row.campaign_id;
    report.displayId = row.display_id;
    report.category = row.category;
    report.city = row.city;
    report.state = row.state;
    report.focus = row.focus;
  }
  return report;
}

export class SeedFunnelAnalyticsService {
  /**
   * Cohort funnel report: per-campaign breakdown plus a combined aggregate
   * over the filtered campaign set. The combined query counts DISTINCT seeds
   * across the whole set, so a seed bonded to multiple campaigns in the set
   * is counted once.
   */
  async getCohortFunnel(filters: CohortFilters = {}): Promise<{
    generatedAt: string;
    filters: CohortFilters;
    cohorts: CohortFunnelReport[];
    combined: CohortFunnelReport;
  }> {
    const params: any[] = [];
    const whereClause = buildFilterClauses(filters, params);

    const perCampaignRows = await prisma.$queryRawUnsafe<CohortRow[]>(
      `SELECT
        mc.id AS campaign_id,
        mc.display_id AS display_id,
        mc.category AS category,
        mc.address_city AS city,
        mc.address_state AS state,
        mc.intelligence_focus AS focus,
        ${METRIC_SELECT}
      ${FUNNEL_FROM}
      ${whereClause}
      GROUP BY mc.id, mc.display_id, mc.category, mc.address_city, mc.address_state, mc.intelligence_focus
      ORDER BY MAX(mc.created_at) DESC`,
      ...params,
    );

    const combinedRows = await prisma.$queryRawUnsafe<CohortRow[]>(
      `SELECT
        NULL::text AS campaign_id,
        NULL::text AS display_id,
        NULL::text AS category,
        NULL::text AS city,
        NULL::text AS state,
        NULL::text AS focus,
        ${METRIC_SELECT}
      ${FUNNEL_FROM}
      ${whereClause}`,
      ...params,
    );

    const cohorts = perCampaignRows.map((row) =>
      buildReport(row.campaign_id ?? 'unknown', row, true),
    );
    const combined = buildReport('combined', combinedRows[0] ?? null, false);

    if (combined.metrics.seeds === 0) {
      logger.info('SeedFunnelAnalyticsService.getCohortFunnel — empty cohort set', undefined, {
        filters,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      filters,
      cohorts,
      combined,
    };
  }
}

export default new SeedFunnelAnalyticsService();
