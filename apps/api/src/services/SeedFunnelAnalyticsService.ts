/**
 * SeedFunnelAnalyticsService — cohort funnel metrics + benchmark gates for the
 * directory-seed go-to-market motion.
 *
 * Implements the measurement layer of
 * docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md (v1.2):
 *   - Per-cohort (per-campaign) funnel counts over directory_presence_seeds
 *   - Combined-cohort aggregates (DISTINCT seeds across a campaign set)
 *   - Benchmark gate grading (G1–G4) with directional vs. decision-grade
 *     small-n rules (spec §6)
 *   - Conversion score with threshold gating (v1.2 — replaces the v1 paid-tier
 *     proxy with a weighted 8-signal composite score; G4 fires when score ≥
 *     threshold within 60 days of claim; G6 = score ≥ threshold at query time)
 *
 * Funnel stage sources:
 *   seeds        — directory_presence_seeds bonded via directory_seed_campaign_links
 *   contactable  — seeds.contact_status = 'contactable' (derived at ingest, migration 258)
 *   invited      — ≥ 1 directory_claim_tokens row for the seed
 *   claimed      — seeds.claimed_at IS NOT NULL (token consumed via acceptClaim)
 *   claimed_30d  — claimed within 30 days of the token being issued (G2 window)
 *   nap_verified — seeds.nap_verified_at IS NOT NULL (stamped at claim)
 *   owner_corrected — seeds.nap_owner_corrected (owner_update diff rows)
 *   converted    — claimed seed's tenant has conversion_score ≥ CONVERSION_THRESHOLD
 *                  and earliest signal timestamp ≤ claimed_at + 60 days
 *   retention_90d — converted seeds whose tenant currently has score ≥ threshold
 *
 * Conversion signals (v1.2):
 *   S1 (weight 2): paid tier upgrade        — tenants + subscription_tiers_list
 *   S2 (weight 2): BSaaS add-on purchase     — tenant_feature_purchases
 *   S3 (weight 2): revenue transaction       — platform_revenue_transactions
 *   S4 (weight 2): customer order             — orders
 *   W1 (weight 1): product stocking           — inventory_items
 *   W2 (weight 1): owner platform access      — users.last_login_at via user_tenants
 *   W3 (weight 1): storefront customization   — inventory_items.custom_branding / landing_page_theme / tenant_storefront_options_settings
 *   W4 (weight 1): GBP sync / business hours  — tenants.google_sync_enabled / google_last_sync / business_hours_list
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
  /** v1.2: converted = claimed seed with conversion_score ≥ threshold within 60d of claim */
  converted: number;
  /** v1.2: retention_90d = converted seeds whose tenant still has score ≥ threshold at query time */
  retention90d: number;
  /** v1.2: retained alias for backward-compat with gate grading (uses converted for G4) */
  paid: number;
  touches: number;
  cacEstimate: number | null;
  /** v1.2 W10: seeds with ≥1 claim_invite QR scan / invited seeds (warm-lead signal) */
  inviteScans: number;
  inviteScanRate: number | null;
}

export interface ConversionScoreBreakdown {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  converted: number;
  threshold: number;
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
  conversionScoreBreakdown?: ConversionScoreBreakdown;
  /** v1.2 W4 — set on the combined report (mirrored at the response top level). */
  medianDaysToClaim?: number | null;
  scalingReadiness?: ScalingReadiness;
}

/** v1.2 W4 — per-category rollup with gate grading (spec §6). */
export interface CategoryRollup {
  category: string;
  metrics: CohortFunnelMetrics;
  gates: GateResult[];
  grade: CohortGrade;
  conversionScoreBreakdown: ConversionScoreBreakdown;
}

/** v1.2 W5 — potential duplicate seed pair (spec §3.1 detection-only). */
export interface PotentialDuplicateSeed {
  seedIds: string[];
  matchKey: 'phone' | 'address_city';
  names: string[];
}

/** v1.2 W4 — scaling readiness surfacing (spec §10). */
export interface ScalingReadiness {
  citiesPassing: string[];
  categoriesPassing: string[];
  ruleMet: boolean;
  note: string;
}

// Benchmark thresholds — seed-funnel spec §5. Freeze changes to these only
// through a spec revision.
export const FUNNEL_GATE_THRESHOLDS = {
  G1_contactable_rate: 0.4,
  G2_claim_rate_30d: 0.2,
  G3_nap_verified_rate: 0.8,
  G4_conversion_rate: 0.1,
} as const;

// v1.2 — conversion score threshold (default 4 of 12). Tune after the first
// two decision-grade cohorts validate the correlation between score ≥ threshold
// and actual retention, then freeze.
export const CONVERSION_THRESHOLD = 4;

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
 *
 * v1.2: G4 uses `converted` (conversion score ≥ threshold within 60d of claim)
 * instead of the v1 paid-tier proxy. G6 (retention_90d) is now graded.
 */
export function gradeGates(m: CohortFunnelMetrics): {
  gates: GateResult[];
  grade: CohortGrade;
} {
  const decisionGrade =
    m.seeds >= DECISION_GRADE_MINIMUMS.seeds &&
    m.claimed >= DECISION_GRADE_MINIMUMS.claimed &&
    m.converted >= DECISION_GRADE_MINIMUMS.paid;

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
      gate: 'G4_conversion_rate',
      description: 'Claims that reached conversion score threshold within 60d / claimed seeds',
      value: rate(m.converted, m.claimed),
      threshold: FUNNEL_GATE_THRESHOLDS.G4_conversion_rate,
    },
    {
      gate: 'G6_retention_90d',
      description: 'Converted seeds still active at query time / converted seeds',
      value: rate(m.retention90d, m.converted),
      threshold: 0.5,
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
    reason: 'CAC estimate uses a placeholder cost-per-touch constant ($15); not graded until real cost data exists.',
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
  converted: bigint | number;
  retention_90d: bigint | number;
  s1_count: bigint | number;
  s2_count: bigint | number;
  s3_count: bigint | number;
  s4_count: bigint | number;
  w1_count: bigint | number;
  w2_count: bigint | number;
  w3_count: bigint | number;
  w4_count: bigint | number;
  touches: bigint | number;
  invite_scans: bigint | number;
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

// Cost-per-touch placeholder for CAC estimation (G5 stays deferred — this is
// informational only until real cost data lands). Sprint plan W1.
export const COST_PER_TOUCH = 15; // USD

// v1.2 — Conversion score LATERAL join. Computes per-tenant signal flags,
// total score, and earliest signal timestamp in a single row per tenant.
// LATERAL ensures this is evaluated only for tenants that have seeds in the
// filtered set (not all tenants).
const CONVERSION_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      -- S1: paid tier upgrade (weight 2)
      CASE WHEN stl.price_monthly > 0 THEN 2 ELSE 0 END AS s1,
      -- S2: BSaaS add-on purchase (weight 2)
      CASE WHEN EXISTS (
        SELECT 1 FROM tenant_feature_purchases tfp
        WHERE tfp.tenant_id = tn.id AND tfp.status = 'active'
      ) THEN 2 ELSE 0 END AS s2,
      -- S3: revenue transaction (weight 2)
      CASE WHEN EXISTS (
        SELECT 1 FROM platform_revenue_transactions prt
        WHERE prt.tenant_id = tn.id
          AND prt.status <> 'failed'
          AND COALESCE(prt.gross_amount_cents, 0) > 0
      ) THEN 2 ELSE 0 END AS s3,
      -- S4: customer order (weight 2)
      CASE WHEN EXISTS (
        SELECT 1 FROM orders o
        WHERE o.tenant_id = tn.id
          AND o.order_status <> 'draft'::order_status
          AND o.payment_status IN ('paid'::payment_status, 'refunded'::payment_status)
      ) THEN 2 ELSE 0 END AS s4,
      -- W1: product stocking (weight 1)
      CASE WHEN EXISTS (
        SELECT 1 FROM inventory_items ii WHERE ii.tenant_id = tn.id
      ) THEN 1 ELSE 0 END AS w1,
      -- W2: owner platform access (weight 1)
      CASE WHEN EXISTS (
        SELECT 1 FROM user_tenants ut
        JOIN users u ON u.id = ut.user_id
        WHERE ut.tenant_id = tn.id AND u.last_login_at IS NOT NULL
      ) THEN 1 ELSE 0 END AS w2,
      -- W3: storefront customization (weight 1)
      CASE WHEN EXISTS (
        SELECT 1 FROM inventory_items ii
        WHERE ii.tenant_id = tn.id
          AND (ii.custom_branding IS NOT NULL
               OR COALESCE(ii.landing_page_theme, 'default') <> 'default')
      ) OR EXISTS (
        SELECT 1 FROM tenant_storefront_options_settings tsos
        WHERE tsos.tenant_id = tn.id AND COALESCE(tsos.storefront_opt_enabled, false) = true
      ) THEN 1 ELSE 0 END AS w3,
      -- W4: GBP sync / business hours (weight 1)
      CASE WHEN COALESCE(tn.google_sync_enabled, false) = true
            OR tn.google_last_sync IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM business_hours_list bhl
              WHERE bhl.tenant_id = tn.id
                AND bhl.periods IS NOT NULL
                AND bhl.periods::text <> '[]'
            )
      THEN 1 ELSE 0 END AS w4,
      -- earliest signal timestamp (for the G4 60-day window). Each signal
      -- contributes a timestamp ONLY when that signal fires. Without the
      -- conditional, tenants.updated_at (the S1/W3 proxy) would enter LEAST
      -- unconditionally — and since the tenant row is created with the seed,
      -- that timestamp always predates claimed_at, making the 60-day window
      -- vacuous (every claimed seed would pass it). Postgres LEAST ignores
      -- NULLs, so per-signal CASE...END composes correctly.
      LEAST(
        CASE WHEN stl.price_monthly > 0 THEN tn.updated_at END,
        (SELECT MIN(tfp.purchased_at) FROM tenant_feature_purchases tfp
         WHERE tfp.tenant_id = tn.id AND tfp.status = 'active'),
        (SELECT MIN(prt.created_at) FROM platform_revenue_transactions prt
         WHERE prt.tenant_id = tn.id AND prt.status <> 'failed' AND COALESCE(prt.gross_amount_cents, 0) > 0),
        (SELECT MIN(o.created_at) FROM orders o
         WHERE o.tenant_id = tn.id AND o.order_status <> 'draft'::order_status
           AND o.payment_status IN ('paid'::payment_status, 'refunded'::payment_status)),
        (SELECT MIN(ii.created_at) FROM inventory_items ii WHERE ii.tenant_id = tn.id),
        (SELECT MAX(u.last_login_at) FROM user_tenants ut
         JOIN users u ON u.id = ut.user_id
         WHERE ut.tenant_id = tn.id AND u.last_login_at IS NOT NULL),
        CASE WHEN EXISTS (
          SELECT 1 FROM inventory_items ii
          WHERE ii.tenant_id = tn.id
            AND (ii.custom_branding IS NOT NULL
                 OR COALESCE(ii.landing_page_theme, 'default') <> 'default')
        ) OR EXISTS (
          SELECT 1 FROM tenant_storefront_options_settings tsos
          WHERE tsos.tenant_id = tn.id AND COALESCE(tsos.storefront_opt_enabled, false) = true
        ) THEN tn.updated_at END,
        CASE WHEN COALESCE(tn.google_sync_enabled, false) = true
              OR tn.google_last_sync IS NOT NULL
              OR EXISTS (
                SELECT 1 FROM business_hours_list bhl
                WHERE bhl.tenant_id = tn.id
                  AND bhl.periods IS NOT NULL
                  AND bhl.periods::text <> '[]'
              )
        THEN COALESCE(tn.google_last_sync, tn.updated_at) END
      ) AS earliest_signal_ts
    FROM tenants tn
    LEFT JOIN subscription_tiers_list stl ON stl.tier_key = tn.subscription_tier
    WHERE tn.id = dps.tenant_id
    LIMIT 1
  ) tc ON true
`;

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
  -- v1.2: converted = claimed + score ≥ threshold + earliest signal ≤ claim + 60d
  COUNT(DISTINCT dps.id) FILTER (
    WHERE dps.claimed_at IS NOT NULL
      AND (COALESCE(tc.s1, 0) + COALESCE(tc.s2, 0) + COALESCE(tc.s3, 0) + COALESCE(tc.s4, 0)
           + COALESCE(tc.w1, 0) + COALESCE(tc.w2, 0) + COALESCE(tc.w3, 0) + COALESCE(tc.w4, 0)) >= ${CONVERSION_THRESHOLD}
      AND (tc.earliest_signal_ts IS NULL
           OR tc.earliest_signal_ts <= dps.claimed_at + INTERVAL '60 days')
  ) AS converted,
  -- v1.2: retention_90d = converted seeds whose tenant currently has score ≥ threshold
  COUNT(DISTINCT dps.id) FILTER (
    WHERE dps.claimed_at IS NOT NULL
      AND (COALESCE(tc.s1, 0) + COALESCE(tc.s2, 0) + COALESCE(tc.s3, 0) + COALESCE(tc.s4, 0)
           + COALESCE(tc.w1, 0) + COALESCE(tc.w2, 0) + COALESCE(tc.w3, 0) + COALESCE(tc.w4, 0)) >= ${CONVERSION_THRESHOLD}
  ) AS retention_90d,
  -- per-signal counts (for conversionScoreBreakdown)
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.s1, 0) > 0) AS s1_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.s2, 0) > 0) AS s2_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.s3, 0) > 0) AS s3_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.s4, 0) > 0) AS s4_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.w1, 0) > 0) AS w1_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.w2, 0) > 0) AS w2_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.w3, 0) > 0) AS w3_count,
  COUNT(DISTINCT dps.id) FILTER (WHERE COALESCE(tc.w4, 0) > 0) AS w4_count,
  COUNT(dsot.id) AS touches,
  -- v1.2 W10: invite scans = distinct seeds with ≥1 claim_invite QR scan event
  -- (qr_scan_events is keyed by tenant_id; seeds carry the same tenant_id post-claim,
  --  and pre-claim scans are attributed to the seed's tenant_id via the QR redirect)
  COUNT(DISTINCT dps.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM qr_scan_events qse
      WHERE qse.tenant_id = dps.tenant_id
        AND qse.surface = 'claim_invite'
    )
  ) AS invite_scans
`;

const FUNNEL_FROM = `
  FROM directory_seed_campaign_links dscl
  JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
  JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
  LEFT JOIN directory_seed_outreach_touches dsot ON dsot.seed_id = dps.id
  ${CONVERSION_LATERAL}
`;

function rowToMetrics(row: CohortRow): CohortFunnelMetrics {
  const converted = Number(row.converted ?? 0);
  const touches = Number(row.touches ?? 0);
  const inviteScans = Number(row.invite_scans ?? 0);
  const invited = Number(row.invited ?? 0);
  return {
    seeds: Number(row.seeds ?? 0),
    contactable: Number(row.contactable ?? 0),
    invited,
    claimed: Number(row.claimed ?? 0),
    claimed30d: Number(row.claimed_30d ?? 0),
    napVerified: Number(row.nap_verified ?? 0),
    ownerCorrected: Number(row.owner_corrected ?? 0),
    converted,
    retention90d: Number(row.retention_90d ?? 0),
    // backward-compat: `paid` alias used by CAC estimate and decision-grade minimums
    paid: converted,
    touches,
    cacEstimate: converted > 0 ? Math.round((touches * COST_PER_TOUCH / converted) * 100) / 100 : null,
    inviteScans,
    inviteScanRate: invited > 0 ? Math.round((inviteScans / invited) * 10000) / 10000 : null,
  };
}

function rowToBreakdown(row: CohortRow): ConversionScoreBreakdown {
  return {
    s1: Number(row.s1_count ?? 0),
    s2: Number(row.s2_count ?? 0),
    s3: Number(row.s3_count ?? 0),
    s4: Number(row.s4_count ?? 0),
    w1: Number(row.w1_count ?? 0),
    w2: Number(row.w2_count ?? 0),
    w3: Number(row.w3_count ?? 0),
    w4: Number(row.w4_count ?? 0),
    converted: Number(row.converted ?? 0),
    threshold: CONVERSION_THRESHOLD,
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
        converted: 0,
        retention90d: 0,
        paid: 0,
        touches: 0,
        cacEstimate: null,
        inviteScans: 0,
        inviteScanRate: null,
      };
  const { gates, grade } = gradeGates(metrics);
  const report: CohortFunnelReport = {
    cohortKey,
    metrics,
    gates,
    grade,
    deferredGates: DEFERRED_GATES,
    conversionScoreBreakdown: row
      ? rowToBreakdown(row)
      : { s1: 0, s2: 0, s3: 0, s4: 0, w1: 0, w2: 0, w3: 0, w4: 0, converted: 0, threshold: CONVERSION_THRESHOLD },
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
   *
   * v1.2 W4: also returns per-category rollups, median days-to-claim, and a
   * scaling-readiness block on the combined report.
   * v1.2 W5: also returns potentialDuplicateSeeds (detection-only, spec §3.1).
   */
  async getCohortFunnel(filters: CohortFilters = {}): Promise<{
    generatedAt: string;
    filters: CohortFilters;
    cohorts: CohortFunnelReport[];
    combined: CohortFunnelReport;
    categoryRollups: CategoryRollup[];
    medianDaysToClaim: number | null;
    scalingReadiness: ScalingReadiness;
    potentialDuplicateSeeds: PotentialDuplicateSeed[];
    duplicateSeedCount: number;
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

    // v1.2 W4 — per-category rollup (spec §6)
    const categoryRows = await prisma.$queryRawUnsafe<CohortRow[]>(
      `SELECT
        NULL::text AS campaign_id,
        NULL::text AS display_id,
        mc.category AS category,
        NULL::text AS city,
        NULL::text AS state,
        NULL::text AS focus,
        ${METRIC_SELECT}
      ${FUNNEL_FROM}
      ${whereClause}
      GROUP BY mc.category
      ORDER BY mc.category`,
      ...params,
    );

    // v1.2 W4 — median days-to-claim (percentile_cont(0.5) over claim duration).
    // Explicit FROM rather than a FUNNEL_FROM string-replace: the replace hack
    // left a duplicate `directory_presence_seeds dps` join (Postgres error),
    // and appending `AND t2.consumed_at IS NOT NULL` after an empty whereClause
    // produced ORPHANED-AND syntax. The consumed-at predicate is folded into a
    // proper WHERE for both the filtered and unfiltered cases.
    const medianWhere = whereClause
      ? `${whereClause} AND t2.consumed_at IS NOT NULL`
      : 'WHERE t2.consumed_at IS NOT NULL';
    const medianRows = await prisma.$queryRawUnsafe<Array<{ median_days: number | null }>>(
      `SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (t2.consumed_at - t2.created_at)) / 86400.0
        ) AS median_days
      FROM directory_claim_tokens t2
      JOIN directory_presence_seeds dps ON dps.id = t2.seed_id
      JOIN directory_seed_campaign_links dscl ON dscl.seed_id = dps.id
      JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
      ${medianWhere}`,
      ...params,
    );

    const cohorts = perCampaignRows.map((row) =>
      buildReport(row.campaign_id ?? 'unknown', row, true),
    );
    const combined = buildReport('combined', combinedRows[0] ?? null, false);

    // Build category rollups with gate grading
    const categoryRollups: CategoryRollup[] = categoryRows
      .filter((row) => row.category && Number(row.seeds) > 0)
      .map((row) => {
        const metrics = rowToMetrics(row);
        const { gates, grade } = gradeGates(metrics);
        return {
          category: row.category!,
          metrics,
          gates,
          grade,
          conversionScoreBreakdown: rowToBreakdown(row),
        };
      });

    // v1.2 W4 — scaling readiness (spec §10): ≥2 cities AND ≥2 categories passing
    // at decision grade with G1–G4 + G6 all passing.
    const passingCohorts = cohorts.filter(
      (c) => c.grade === 'decision_grade' && c.gates.every((g) => g.pass === true),
    );
    const citiesPassing = [...new Set(passingCohorts.map((c) => c.city).filter(Boolean))] as string[];
    const categoriesPassing = [...new Set(passingCohorts.map((c) => c.category).filter(Boolean))] as string[];
    const ruleMet = citiesPassing.length >= 2 && categoriesPassing.length >= 2;
    const scalingReadiness: ScalingReadiness = {
      citiesPassing,
      categoriesPassing,
      ruleMet,
      note: ruleMet
        ? 'Scaling rule met: ≥2 cities and ≥2 categories passing at decision grade.'
        : `Not yet: ${citiesPassing.length} city/cities and ${categoriesPassing.length} category/categories passing. Need ≥2 of each.`,
    };

    const medianDaysToClaim = medianRows[0]?.median_days != null
      ? Math.round(Number(medianRows[0].median_days) * 10) / 10
      : null;

    // v1.2 W5 — duplicate-seed detection (spec §3.1, detection-only).
    // Pairs seeds in the filtered set that share a normalized phone (digits,
    // last 10) OR normalized address+city (lowercase, punctuation-stripped).
    // Auto-merge is deferred to operator work; detection prevents silent
    // double-counting in funnel denominators.
    const dupParams = [...params];
    const dupWhere = whereClause
      || '';
    const duplicateRows = await prisma.$queryRawUnsafe<Array<{
      seed_ids: string[];
      match_key: 'phone' | 'address_city';
      names: string[];
    }>>(
      `WITH filtered_seeds AS (
        SELECT dps.id, dps.tenant_id, dl.phone, dl.address, dl.city, dl.business_name,
               dps.name_variants
        ${FUNNEL_FROM.replace('LEFT JOIN directory_seed_outreach_touches dsot ON dsot.seed_id = dps.id\n', '').replace('LEFT JOIN LATERAL', 'LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id\n      LEFT JOIN LATERAL')}
        ${dupWhere}
      ),
      phone_dups AS (
        SELECT
          ARRAY_AGG(fs.id ORDER BY fs.id) AS seed_ids,
          'phone'::text AS match_key,
          ARRAY_AGG(
            COALESCE(fs.business_name, array_to_string(fs.name_variants, ' / '))
            ORDER BY fs.id
          ) AS names
        FROM filtered_seeds fs
        WHERE fs.phone IS NOT NULL
        GROUP BY REGEXP_REPLACE(fs.phone, '[^0-9]', '', 'g')
        HAVING COUNT(DISTINCT fs.id) > 1
      ),
      address_dups AS (
        SELECT
          ARRAY_AGG(fs.id ORDER BY fs.id) AS seed_ids,
          'address_city'::text AS match_key,
          ARRAY_AGG(
            COALESCE(fs.business_name, array_to_string(fs.name_variants, ' / '))
            ORDER BY fs.id
          ) AS names
        FROM filtered_seeds fs
        WHERE fs.address IS NOT NULL AND fs.city IS NOT NULL
        GROUP BY LOWER(REGEXP_REPLACE(fs.address || ' ' || fs.city, '[^a-zA-Z0-9 ]', '', 'g'))
        HAVING COUNT(DISTINCT fs.id) > 1
      )
      SELECT * FROM phone_dups
      UNION ALL
      SELECT * FROM address_dups`,
      ...dupParams,
    );

    // Migration 262 (spec §4.9) — exclude groups the operator has already
    // resolved (mkt_prospect_dedup_verdicts, group-keyed on the sorted
    // seed_ids set + match_key). duplicateSeedCount reports unannotated
    // groups only; verdicts are the identity ledger.
    const annotated = await prisma.$queryRaw<any[]>`
      SELECT seed_ids, match_key FROM mkt_prospect_dedup_verdicts
    `;
    const annotatedKeys = new Set(annotated.map((v) => `${v.match_key}:${(v.seed_ids as string[]).join(',')}`));
    const openDuplicateRows = duplicateRows.filter(
      (g) => !annotatedKeys.has(`${g.match_key}:${[...g.seed_ids].sort().join(',')}`),
    );

    const potentialDuplicateSeeds: PotentialDuplicateSeed[] = openDuplicateRows.map((row) => ({
      seedIds: row.seed_ids,
      matchKey: row.match_key,
      names: row.names,
    }));

    if (combined.metrics.seeds === 0) {
      logger.info('SeedFunnelAnalyticsService.getCohortFunnel — empty cohort set', undefined, {
        filters,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      filters,
      cohorts,
      // v1.2 W4: medianDaysToClaim and scalingReadiness are cohort-set-level
      // statistics — mirrored on the combined report AND at the response top
      // level so consumers can read them from either surface.
      combined: {
        ...combined,
        medianDaysToClaim,
        scalingReadiness,
      },
      categoryRollups,
      medianDaysToClaim,
      scalingReadiness,
      potentialDuplicateSeeds,
      duplicateSeedCount: potentialDuplicateSeeds.length,
    };
  }
}

export default new SeedFunnelAnalyticsService();
