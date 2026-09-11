/**
 * SeedFunnelAnalyticsService.getCohortFunnel — SQL-path tests (sprint plan W8)
 *
 * Verifies the row → report mapping with mocked $queryRawUnsafe:
 * - bigint → Number conversion across all metric fields
 * - Per-campaign cohorts carry campaign fields; combined omits them
 * - Gates graded through (G4 uses `converted`, G6 uses retention90d/converted)
 * - conversionScoreBreakdown surfaced with the frozen threshold
 * - cacEstimate = touches × COST_PER_TOUCH / converted
 * - v1.2 W4: categoryRollups, medianDaysToClaim, scalingReadiness
 * - Filters propagate as bound params to ALL FOUR queries
 *
 * Query order (asserted): per-campaign → combined → category rollups → median.
 *
 * See: docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md §4, §6, §10, §11.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe, mockQueryRaw, mockLogger } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  // Migration 262 — the dedup-verdict exclusion lookup runs through $queryRaw.
  mockQueryRaw: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: { $queryRawUnsafe: mockQueryRawUnsafe, $queryRaw: mockQueryRaw },
}));

vi.mock('../../logger', () => ({ logger: mockLogger }));

import SeedFunnelAnalyticsService, {
  CONVERSION_THRESHOLD,
  COST_PER_TOUCH,
} from '../SeedFunnelAnalyticsService';

const perCampaignRow = {
  campaign_id: 'camp-1',
  display_id: 'MC-0001',
  category: 'Middle Eastern Grocery Store',
  city: 'Madison',
  state: 'WI',
  focus: 'emerging',
  seeds: 25n,
  contactable: 20n,
  invited: 18n,
  claimed: 10n,
  claimed_30d: 6n,
  nap_verified: 9n,
  owner_corrected: 3n,
  converted: 2n,
  retention_90d: 2n,
  s1_count: 1n,
  s2_count: 2n,
  s3_count: 0n,
  s4_count: 1n,
  w1_count: 2n,
  w2_count: 2n,
  w3_count: 1n,
  w4_count: 2n,
  touches: 12n,
  invite_scans: 5n,
  invite_scans_mail: 3n,
  invite_scans_walkin: 1n,
  invite_scans_social: 1n,
};

const combinedRow = {
  campaign_id: null,
  display_id: null,
  category: null,
  city: null,
  state: null,
  focus: null,
  seeds: 40n,
  contactable: 30n,
  invited: 30n,
  claimed: 15n,
  claimed_30d: 8n,
  nap_verified: 13n,
  owner_corrected: 4n,
  converted: 3n,
  retention_90d: 2n,
  s1_count: 2n,
  s2_count: 2n,
  s3_count: 1n,
  s4_count: 1n,
  w1_count: 3n,
  w2_count: 3n,
  w3_count: 2n,
  w4_count: 3n,
  touches: 20n,
  invite_scans: 8n,
  invite_scans_mail: 5n,
  invite_scans_walkin: 2n,
  invite_scans_social: 1n,
};

const categoryRow = {
  campaign_id: null,
  display_id: null,
  category: 'Middle Eastern Grocery Store',
  city: null,
  state: null,
  focus: null,
  seeds: 40n,
  contactable: 30n,
  invited: 30n,
  claimed: 15n,
  claimed_30d: 8n,
  nap_verified: 13n,
  owner_corrected: 4n,
  converted: 3n,
  retention_90d: 2n,
  s1_count: 2n,
  s2_count: 2n,
  s3_count: 1n,
  s4_count: 1n,
  w1_count: 3n,
  w2_count: 3n,
  w3_count: 2n,
  w4_count: 3n,
  touches: 20n,
  invite_scans: 8n,
  invite_scans_mail: 5n,
  invite_scans_walkin: 2n,
  invite_scans_social: 1n,
};

const medianRow = { median_days: 5.25 };

const duplicateRows = [
  {
    seed_ids: ['seed-a', 'seed-b'],
    match_key: 'phone',
    names: ['Istanbul Super Market', 'Istanbul Market'],
  },
];

/** Queue the five query results in execution order:
 *  1. per-campaign, 2. combined, 3. category rollups, 4. median, 5. duplicates.
 *  The dedup-verdict lookup ($queryRaw) is set separately via `verdicts`. */
function queueQueries({
  perCampaign = [perCampaignRow],
  combined = [combinedRow],
  categories = [categoryRow],
  median = [medianRow],
  duplicates = duplicateRows,
  verdicts = [] as any[],
} = {}) {
  // mockReset (not clearAllMocks): clears queued mockResolvedValueOnce
  // implementations too, so a test-level re-queue replaces the beforeEach
  // defaults instead of stacking behind them (FIFO once-queue).
  mockQueryRawUnsafe.mockReset();
  mockQueryRawUnsafe
    .mockResolvedValueOnce(perCampaign)
    .mockResolvedValueOnce(combined)
    .mockResolvedValueOnce(categories)
    .mockResolvedValueOnce(median)
    .mockResolvedValueOnce(duplicates);
  mockQueryRaw.mockReset();
  mockQueryRaw.mockResolvedValue(verdicts);
}

beforeEach(() => {
  vi.clearAllMocks();
  queueQueries();
});

describe('getCohortFunnel — SQL path', () => {
  it('maps per-campaign rows to reports with Number-converted metrics', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.cohorts).toHaveLength(1);
    const cohort = report.cohorts[0];
    expect(cohort.cohortKey).toBe('camp-1');
    expect(cohort.campaignId).toBe('camp-1');
    expect(cohort.displayId).toBe('MC-0001');
    expect(cohort.category).toBe('Middle Eastern Grocery Store');
    expect(cohort.metrics.seeds).toBe(25);
    expect(cohort.metrics.claimed30d).toBe(6);
    expect(cohort.metrics.converted).toBe(2);
    expect(cohort.metrics.retention90d).toBe(2);
    expect(cohort.metrics.touches).toBe(12);
  });

  it('grades gates through the mapped metrics (G4 on converted, G6 on retention)', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();
    const cohort = report.cohorts[0];

    expect(cohort.gates.map((g) => g.gate)).toEqual([
      'G1_contactable_rate',
      'G2_claim_rate_30d',
      'G3_nap_verified_rate',
      'G4_conversion_rate',
      'G6_retention_90d',
    ]);
    // 20/25 = 0.8, 6/18 ≈ 0.33, 9/10 = 0.9, 2/10 = 0.2, 2/2 = 1.0 — all pass
    expect(cohort.gates.every((g) => g.pass === true)).toBe(true);
    // decision grade: seeds 25 ≥ 20, claimed 10 ≥ 5, converted 2 ≥ 2
    expect(cohort.grade).toBe('decision_grade');
  });

  it('surfaces the conversion score breakdown with the frozen threshold', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();
    const cohort = report.cohorts[0];

    expect(cohort.conversionScoreBreakdown).toEqual({
      s1: 1,
      s2: 2,
      s3: 0,
      s4: 1,
      w1: 2,
      w2: 2,
      w3: 1,
      w4: 2,
      converted: 2,
      threshold: CONVERSION_THRESHOLD,
    });
    expect(CONVERSION_THRESHOLD).toBe(4);
  });

  it('computes cacEstimate from touches, cost-per-touch, and converted', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();
    const cohort = report.cohorts[0];

    // 12 touches × $15 / 2 converted = $90
    expect(cohort.metrics.cacEstimate).toBe(90);
    expect(COST_PER_TOUCH).toBe(15);

    // Zero conversions → null estimate, never a divide-by-zero
    queueQueries({
      perCampaign: [{ ...perCampaignRow, converted: 0n, touches: 5n }],
      combined: [{ ...combinedRow, converted: 0n }],
      categories: [],
      median: [],
      duplicates: [],
    });
    const empty = await SeedFunnelAnalyticsService.getCohortFunnel();
    expect(empty.cohorts[0].metrics.cacEstimate).toBeNull();
  });

  it('surfaces invite scan count and rate from claim_invite QR events (W10)', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();
    const cohort = report.cohorts[0];

    // 5 invite scans / 18 invited = 0.2778 (4dp rounding)
    expect(cohort.metrics.inviteScans).toBe(5);
    expect(cohort.metrics.inviteScanRate).toBeCloseTo(0.2778, 4);

    // Per-channel split: 3 mail + 1 walkin + 1 social = 5 total
    expect(cohort.metrics.inviteScansMail).toBe(3);
    expect(cohort.metrics.inviteScansWalkin).toBe(1);
    expect(cohort.metrics.inviteScansSocial).toBe(1);
    expect(cohort.metrics.inviteScanRateMail).toBeCloseTo(0.1667, 4);
    expect(cohort.metrics.inviteScanRateWalkin).toBeCloseTo(0.0556, 4);
    expect(cohort.metrics.inviteScanRateSocial).toBeCloseTo(0.0556, 4);

    // Combined: 8 scans / 30 invited
    expect(report.combined.metrics.inviteScans).toBe(8);
    expect(report.combined.metrics.inviteScanRate).toBeCloseTo(0.2667, 4);
    expect(report.combined.metrics.inviteScansMail).toBe(5);
    expect(report.combined.metrics.inviteScansWalkin).toBe(2);
    expect(report.combined.metrics.inviteScansSocial).toBe(1);

    // Zero invited → null rate (no divide-by-zero)
    queueQueries({
      perCampaign: [{ ...perCampaignRow, invited: 0n, invite_scans: 0n }],
      combined: [{ ...combinedRow, invited: 0n, invite_scans: 0n }],
      categories: [],
      median: [],
      duplicates: [],
    });
    const noInvited = await SeedFunnelAnalyticsService.getCohortFunnel();
    expect(noInvited.cohorts[0].metrics.inviteScanRate).toBeNull();
  });

  it('builds the combined report from the second query without campaign fields', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.combined.cohortKey).toBe('combined');
    expect(report.combined.campaignId).toBeUndefined();
    expect(report.combined.displayId).toBeUndefined();
    expect(report.combined.metrics.seeds).toBe(40);
    expect(report.combined.metrics.converted).toBe(3);
    // combined grade: seeds 40 ≥ 20, claimed 15 ≥ 5, converted 3 ≥ 2
    expect(report.combined.grade).toBe('decision_grade');
  });

  it('returns category rollups, median days-to-claim, and scaling readiness (W4)', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    // Category rollup graded with the same gates
    expect(report.categoryRollups).toHaveLength(1);
    expect(report.categoryRollups[0].category).toBe('Middle Eastern Grocery Store');
    expect(report.categoryRollups[0].metrics.seeds).toBe(40);
    expect(report.combined.medianDaysToClaim).toBe(5.3); // 5.25 rounded to 1dp

    // Scaling readiness: 1 passing cohort → 1 city, 1 category — rule not met
    expect(report.scalingReadiness.citiesPassing).toEqual(['Madison']);
    expect(report.combined.scalingReadiness.categoriesPassing).toEqual([
      'Middle Eastern Grocery Store',
    ]);
    expect(report.combined.scalingReadiness.ruleMet).toBe(false);
    expect(report.combined.scalingReadiness.note).toContain('Not yet');
  });

  it('surfaces potential duplicate seeds with match key and names (W5)', async () => {
    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.potentialDuplicateSeeds).toHaveLength(1);
    expect(report.potentialDuplicateSeeds[0].seedIds).toEqual(['seed-a', 'seed-b']);
    expect(report.potentialDuplicateSeeds[0].matchKey).toBe('phone');
    expect(report.potentialDuplicateSeeds[0].names).toEqual([
      'Istanbul Super Market',
      'Istanbul Market',
    ]);
    expect(report.duplicateSeedCount).toBe(1);
  });

  it('propagates filters as bound params to all five queries', async () => {
    const filters = {
      campaignIds: ['camp-1', 'camp-2'],
      category: 'grocery',
      city: 'Madison',
      state: 'WI',
      focus: 'emerging',
    };
    await SeedFunnelAnalyticsService.getCohortFunnel(filters);

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
    for (const call of mockQueryRawUnsafe.mock.calls) {
      const [sql, ...params] = call as [string, ...any[]];
      expect(sql).toContain('mc.id = ANY($1::text[])');
      expect(sql).toContain('mc.category ILIKE $2');
      expect(sql).toContain('mc.address_city ILIKE $3');
      expect(sql).toContain('mc.address_state ILIKE $4');
      expect(sql).toContain('mc.intelligence_focus = $5');
      expect(params).toEqual([
        ['camp-1', 'camp-2'],
        '%grocery%',
        '%Madison%',
        '%WI%',
        'emerging',
      ]);
    }
    // The median query folds the consumed-at predicate into its WHERE
    const medianSql = mockQueryRawUnsafe.mock.calls[3][0] as string;
    expect(medianSql).toContain('PERCENTILE_CONT');
    expect(medianSql).toContain('AND t2.consumed_at IS NOT NULL');
  });

  it('keeps the median query valid SQL when no filters are passed', async () => {
    await SeedFunnelAnalyticsService.getCohortFunnel();

    // Fourth call = median query: must carry a proper WHERE, not an orphaned AND
    const medianSql = mockQueryRawUnsafe.mock.calls[3][0] as string;
    expect(medianSql).toContain('WHERE t2.consumed_at IS NOT NULL');
    expect(medianSql).not.toContain('WHERE WHERE');
    expect(medianSql.match(/\bJOIN directory_presence_seeds dps\b/g)?.length).toBe(1);
  });

  it('returns a zeroed directional combined report for an empty cohort set', async () => {
    queueQueries({ perCampaign: [], combined: [], categories: [], median: [], duplicates: [] });

    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.cohorts).toHaveLength(0);
    expect(report.categoryRollups).toHaveLength(0);
    expect(report.combined.metrics.seeds).toBe(0);
    expect(report.combined.grade).toBe('directional');
    expect(report.combined.gates.every((g) => g.pass === null)).toBe(true);
    expect(report.combined.conversionScoreBreakdown?.threshold).toBe(CONVERSION_THRESHOLD);
    expect(report.medianDaysToClaim).toBeNull();
    expect(report.scalingReadiness.ruleMet).toBe(false);
  });
});


describe('getCohortFunnel � dedup verdict exclusion (Migration 262)', () => {
  it('excludes a surfaced group whose verdict was recorded (identity ledger)', async () => {
    queueQueries({
      verdicts: [{ seed_ids: ['seed-a', 'seed-b'], match_key: 'phone' }],
    });

    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.potentialDuplicateSeeds).toEqual([]);
    expect(report.duplicateSeedCount).toBe(0);
  });

  it('still surfaces groups with no verdict (unannotated)', async () => {
    queueQueries({ verdicts: [] });

    const report = await SeedFunnelAnalyticsService.getCohortFunnel();

    expect(report.potentialDuplicateSeeds).toHaveLength(1);
    expect(report.duplicateSeedCount).toBe(1);
  });

  it('does not exclude a group on a different match_key', async () => {
    queueQueries({
      verdicts: [{ seed_ids: ['seed-a', 'seed-b'], match_key: 'address_city' }],
    });

    const report = await SeedFunnelAnalyticsService.getCohortFunnel();
    expect(report.potentialDuplicateSeeds).toHaveLength(1);
  });
});
