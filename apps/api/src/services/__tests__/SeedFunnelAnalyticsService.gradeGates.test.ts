/**
 * SeedFunnelAnalyticsService.gradeGates tests
 *
 * Verifies the benchmark-gate grading logic (pure function):
 * - Decision-grade cohort passes all four gates at healthy metrics
 * - Small cohorts grade 'directional' even when rates pass
 * - Zero denominators produce pass = null (not evaluable, never a failure)
 * - Threshold boundaries are inclusive (value == threshold passes)
 * - G2 uses the 30-day claim window count, not the all-time claim count
 *
 * See: docs/LocalBiz/seed_funnel_benchmark_gates_and_analytics_spec.md §5–§6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { gradeGates, FUNNEL_GATE_THRESHOLDS, DECISION_GRADE_MINIMUMS } from '../SeedFunnelAnalyticsService';

const baseMetrics = {
  seeds: 0,
  contactable: 0,
  invited: 0,
  claimed: 0,
  claimed30d: 0,
  napVerified: 0,
  ownerCorrected: 0,
  paid: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gradeGates', () => {
  it('passes all four gates on a healthy decision-grade cohort', () => {
    const { gates, grade } = gradeGates({
      ...baseMetrics,
      seeds: 25,
      contactable: 20, // 0.80 ≥ 0.40
      invited: 18,
      claimed: 10,
      claimed30d: 6, // 0.33 ≥ 0.20
      napVerified: 9, // 0.90 ≥ 0.80
      ownerCorrected: 3,
      paid: 2, // 0.20 ≥ 0.10
    });

    expect(grade).toBe('decision_grade');
    expect(gates.map((g) => g.pass)).toEqual([true, true, true, true]);
  });

  it('grades directional when the cohort is below decision-grade minimums', () => {
    // All rates pass, but paid (1) < decision minimum (2)
    const { gates, grade } = gradeGates({
      ...baseMetrics,
      seeds: 8,
      contactable: 5,
      invited: 4,
      claimed: 3,
      claimed30d: 2,
      napVerified: 3,
      ownerCorrected: 1,
      paid: 1,
    });

    expect(grade).toBe('directional');
    expect(gates.every((g) => g.pass === true)).toBe(true);
  });

  it('returns pass = null (not evaluable) for zero denominators', () => {
    const { gates } = gradeGates({ ...baseMetrics });

    expect(gates.find((g) => g.gate === 'G1_contactable_rate')?.value).toBeNull();
    expect(gates.find((g) => g.gate === 'G1_contactable_rate')?.pass).toBeNull();
    expect(gates.find((g) => g.gate === 'G2_claim_rate_30d')?.pass).toBeNull();
    expect(gates.find((g) => g.gate === 'G3_nap_verified_rate')?.pass).toBeNull();
    expect(gates.find((g) => g.gate === 'G4_paid_rate')?.pass).toBeNull();
  });

  it('treats threshold boundaries as passing', () => {
    const { gates } = gradeGates({
      ...baseMetrics,
      seeds: 10,
      contactable: 4, // exactly 0.40
      invited: 10,
      claimed: 10,
      claimed30d: 2, // exactly 0.20
      napVerified: 8, // exactly 0.80
      ownerCorrected: 0,
      paid: 1, // exactly 0.10
    });

    const byGate = Object.fromEntries(gates.map((g) => [g.gate, g.pass]));
    expect(byGate['G1_contactable_rate']).toBe(true);
    expect(byGate['G2_claim_rate_30d']).toBe(true);
    expect(byGate['G3_nap_verified_rate']).toBe(true);
    expect(byGate['G4_paid_rate']).toBe(true);
  });

  it('fails G1 when the contactable rate is below threshold', () => {
    const { gates } = gradeGates({
      ...baseMetrics,
      seeds: 10,
      contactable: 2, // 0.20 < 0.40
      invited: 1,
      claimed: 1,
      claimed30d: 1,
      napVerified: 1,
      ownerCorrected: 0,
      paid: 1,
    });

    const g1 = gates.find((g) => g.gate === 'G1_contactable_rate');
    expect(g1?.pass).toBe(false);
    expect(g1?.value).toBeCloseTo(0.2);
  });

  it('computes G2 from the 30-day claim window, not all-time claims', () => {
    const { gates } = gradeGates({
      ...baseMetrics,
      seeds: 30,
      contactable: 25,
      invited: 10,
      claimed: 10, // all-time claims would pass (1.0)
      claimed30d: 1, // 30-day window fails (0.10 < 0.20)
      napVerified: 10,
      ownerCorrected: 2,
      paid: 2,
    });

    const g2 = gates.find((g) => g.gate === 'G2_claim_rate_30d');
    expect(g2?.value).toBeCloseTo(0.1);
    expect(g2?.pass).toBe(false);
  });

  it('exposes the frozen thresholds for reporting', () => {
    expect(FUNNEL_GATE_THRESHOLDS).toEqual({
      G1_contactable_rate: 0.4,
      G2_claim_rate_30d: 0.2,
      G3_nap_verified_rate: 0.8,
      G4_paid_rate: 0.1,
    });
    expect(DECISION_GRADE_MINIMUMS).toEqual({ seeds: 20, claimed: 5, paid: 2 });
  });
});
