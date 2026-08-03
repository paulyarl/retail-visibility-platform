/**
 * TriageEngineService — deterministic cascade unit tests
 *
 * Covers all 5 rule branches + the terminal fallback + the BBB-absent skip
 * (roadmap Risk 1: PB-04 cannot fire without operator-supplied BBB input).
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §6
 * Sprint 2 — Signal Extractor & Triage Engine.
 */

import { describe, it, expect } from 'vitest';
import { evaluateTriage, CONFIDENCE } from '../TriageEngineService';
import { extractSignals, signalPredicates, SIGNAL_THRESHOLDS } from '../signal-extractor';
import type { NormalizedSignals, SignalExtractorInput } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Baseline signals with nothing firing — falls through to PB-03 fallback. */
const cleanSignals: NormalizedSignals = {
  bbbGrade: undefined,
  googleRating: undefined,
  unansweredBbbComplaints: 0,
  hasDeadUrl: false,
  urlMismatch: false,
  napInconsistent: false,
  daysSinceLastReview: 30,
  unaddressedReviewCount: 0,
  hasCtaFriction: false,
};

function with(overrides: Partial<NormalizedSignals>): NormalizedSignals {
  return { ...cleanSignals, ...overrides };
}

// ─── Confidence scores (roadmap §6.2 hardcoded values) ───────────────────

describe('confidence scores are the spec values', () => {
  it('PB-04 is 0.95 (highest — BBB emergency)', () => {
    expect(CONFIDENCE['PB-04']).toBe(0.95);
  });
  it('PB-05 is 0.90 (dual-signal triage)', () => {
    expect(CONFIDENCE['PB-05']).toBe(0.90);
  });
  it('PB-01 and PB-02 are 0.85', () => {
    expect(CONFIDENCE['PB-01']).toBe(0.85);
    expect(CONFIDENCE['PB-02']).toBe(0.85);
  });
  it('PB-03 is 0.70 (fallback)', () => {
    expect(CONFIDENCE['PB-03']).toBe(0.70);
  });
});

// ─── Rule 1: BBB Emergency Recovery (PB-04) ──────────────────────────────

describe('Rule 1 — BBB Emergency Recovery (PB-04)', () => {
  it('fires when BBB grade is C or below', () => {
    const result = evaluateTriage(with({ bbbGrade: 'C', unansweredBbbComplaints: 0 }));
    expect(result.playbookCode).toBe('PB-04');
    expect(result.category).toBe('recovery_management');
    expect(result.archetype).toBe('A2');
    expect(result.confidence).toBe(0.95);
  });

  it('fires when BBB grade is F', () => {
    const result = evaluateTriage(with({ bbbGrade: 'F' }));
    expect(result.playbookCode).toBe('PB-04');
  });

  it('fires when there are unanswered BBB complaints (even with good grade)', () => {
    const result = evaluateTriage(with({ bbbGrade: 'A+', unansweredBbbComplaints: 3 }));
    expect(result.playbookCode).toBe('PB-04');
    expect(result.reasoning).toContain('3 unanswered BBB complaints');
  });

  it('does NOT fire when BBB grade is A and no unanswered complaints', () => {
    const result = evaluateTriage(with({ bbbGrade: 'A+', unansweredBbbComplaints: 0 }));
    expect(result.playbookCode).not.toBe('PB-04');
  });

  it('does NOT fire when BBB input is entirely absent (bbbGrade undefined, 0 complaints)', () => {
    // Roadmap Risk 1: PB-04 is skipped when no BBB data is supplied.
    const result = evaluateTriage(with({ bbbGrade: undefined, unansweredBbbComplaints: 0 }));
    expect(result.playbookCode).not.toBe('PB-04');
  });

  it('supersedes PB-05 even when both repair and review signals fire', () => {
    // BBB emergency is highest priority — must win over dual-signal triage.
    const result = evaluateTriage(
      with({
        bbbGrade: 'D',
        unansweredBbbComplaints: 2,
        napInconsistent: true,
        daysSinceLastReview: 120,
        unaddressedReviewCount: 10,
      }),
    );
    expect(result.playbookCode).toBe('PB-04');
  });

  it('records bbbGrade and unansweredBbbComplaints as contributed signals', () => {
    const result = evaluateTriage(with({ bbbGrade: 'C', unansweredBbbComplaints: 1 }));
    const contributed = result.detectedSignals.filter((s) => s.contributedToRule);
    const contributedNames = contributed.map((s) => s.signal);
    expect(contributedNames).toContain('bbbGrade');
    expect(contributedNames).toContain('unansweredBbbComplaints');
  });
});

// ─── Rule 2: Multi-Signal Footprint Triage (PB-05) ───────────────────────

describe('Rule 2 — Multi-Signal Footprint Triage (PB-05)', () => {
  it('fires when both a repair signal AND a review gap are present', () => {
    const result = evaluateTriage(
      with({ napInconsistent: true, daysSinceLastReview: 120, unaddressedReviewCount: 0 }),
    );
    expect(result.playbookCode).toBe('PB-05');
    expect(result.category).toBe('triage_management');
    expect(result.archetype).toBe('A5');
    expect(result.confidence).toBe(0.90);
  });

  it('fires with dead URL + unaddressed reviews', () => {
    const result = evaluateTriage(
      with({ hasDeadUrl: true, unaddressedReviewCount: 8, daysSinceLastReview: 10 }),
    );
    expect(result.playbookCode).toBe('PB-05');
  });

  it('does NOT fire when only a repair signal is present (no review gap)', () => {
    const result = evaluateTriage(with({ napInconsistent: true, daysSinceLastReview: 10 }));
    expect(result.playbookCode).not.toBe('PB-05');
  });

  it('does NOT fire when only a review gap is present (no repair signal)', () => {
    const result = evaluateTriage(with({ daysSinceLastReview: 200, unaddressedReviewCount: 20 }));
    expect(result.playbookCode).not.toBe('PB-05');
  });

  it('reasoning mentions both repair and review dimensions', () => {
    const result = evaluateTriage(
      with({ napInconsistent: true, daysSinceLastReview: 150, unaddressedReviewCount: 5 }),
    );
    expect(result.reasoning).toContain('NAP inconsistency');
    expect(result.reasoning).toContain('review gap');
  });
});

// ─── Rule 3: Pure Profile Repair (PB-01) ─────────────────────────────────

describe('Rule 3 — Pure Profile Repair (PB-01)', () => {
  it('fires when a repair signal is present with no review gap and no BBB', () => {
    const result = evaluateTriage(with({ napInconsistent: true, daysSinceLastReview: 10 }));
    expect(result.playbookCode).toBe('PB-01');
    expect(result.category).toBe('review_management');
    expect(result.archetype).toBe('A3');
    expect(result.confidence).toBe(0.85);
  });

  it('fires for dead URL with no review gap', () => {
    const result = evaluateTriage(with({ hasDeadUrl: true }));
    expect(result.playbookCode).toBe('PB-01');
  });

  it('fires for URL mismatch with no review gap', () => {
    const result = evaluateTriage(with({ urlMismatch: true }));
    expect(result.playbookCode).toBe('PB-01');
  });
});

// ─── Rule 4: Pure Review Gap (PB-02) ─────────────────────────────────────

describe('Rule 4 — Pure Review Gap (PB-02)', () => {
  it('fires when days since last review exceeds the stale threshold', () => {
    const result = evaluateTriage(
      with({ daysSinceLastReview: SIGNAL_THRESHOLDS.DAYS_SINCE_REVIEW_STALE, unaddressedReviewCount: 0 }),
    );
    expect(result.playbookCode).toBe('PB-02');
    expect(result.category).toBe('review_management');
    expect(result.archetype).toBe('A1');
    expect(result.confidence).toBe(0.85);
  });

  it('fires when unaddressed review count meets the gap threshold', () => {
    const result = evaluateTriage(
      with({ daysSinceLastReview: 10, unaddressedReviewCount: SIGNAL_THRESHOLDS.UNANSWERED_REVIEW_GAP }),
    );
    expect(result.playbookCode).toBe('PB-02');
  });

  it('does NOT fire when review footprint is healthy', () => {
    const result = evaluateTriage(with({ daysSinceLastReview: 10, unaddressedReviewCount: 0 }));
    expect(result.playbookCode).not.toBe('PB-02');
  });
});

// ─── Rule 5: Fallback CTA Gap (PB-03) ────────────────────────────────────

describe('Rule 5 — Fallback CTA Gap (PB-03)', () => {
  it('fires when CTA friction is present and no higher-priority signal fired', () => {
    const result = evaluateTriage(with({ hasCtaFriction: true }));
    expect(result.playbookCode).toBe('PB-03');
    expect(result.category).toBe('review_management');
    expect(result.archetype).toBe('A4');
    expect(result.confidence).toBe(0.70);
  });

  it('fires as the terminal fallback when no signal fired at all', () => {
    const result = evaluateTriage(cleanSignals);
    expect(result.playbookCode).toBe('PB-03');
    expect(result.reasoning).toContain('Fallback');
  });

  it('does NOT fire when a repair signal is present (repair wins)', () => {
    const result = evaluateTriage(with({ hasCtaFriction: true, napInconsistent: true }));
    expect(result.playbookCode).toBe('PB-01');
  });
});

// ─── Priority ordering (cascade supersedes) ──────────────────────────────

describe('priority ordering — higher rules supersede lower', () => {
  it('PB-04 > PB-05 > PB-01 > PB-02 > PB-03', () => {
    // Everything firing at once → PB-04 wins (BBB is highest).
    const allFiring = evaluateTriage(
      with({
        bbbGrade: 'F',
        unansweredBbbComplaints: 5,
        napInconsistent: true,
        hasDeadUrl: true,
        daysSinceLastReview: 200,
        unaddressedReviewCount: 30,
        hasCtaFriction: true,
      }),
    );
    expect(allFiring.playbookCode).toBe('PB-04');

    // Remove BBB → PB-05 wins (dual signal).
    const noBbb = evaluateTriage(
      with({
        napInconsistent: true,
        hasDeadUrl: true,
        daysSinceLastReview: 200,
        unaddressedReviewCount: 30,
        hasCtaFriction: true,
      }),
    );
    expect(noBbb.playbookCode).toBe('PB-05');

    // Remove review gap → PB-01 wins (pure repair).
    const repairOnly = evaluateTriage(
      with({ napInconsistent: true, hasDeadUrl: true, hasCtaFriction: true }),
    );
    expect(repairOnly.playbookCode).toBe('PB-01');

    // Remove repair → PB-02 wins (pure review gap).
    const reviewOnly = evaluateTriage(
      with({ daysSinceLastReview: 200, unaddressedReviewCount: 30, hasCtaFriction: true }),
    );
    expect(reviewOnly.playbookCode).toBe('PB-02');

    // Remove review gap → PB-03 wins (fallback CTA).
    const ctaOnly = evaluateTriage(with({ hasCtaFriction: true }));
    expect(ctaOnly.playbookCode).toBe('PB-03');
  });
});

// ─── detected_signals recording ──────────────────────────────────────────

describe('detected_signals recording', () => {
  it('records every signal field with its raw value', () => {
    const result = evaluateTriage(with({ napInconsistent: true }));
    const signalNames = result.detectedSignals.map((s) => s.signal);
    expect(signalNames).toEqual(
      expect.arrayContaining([
        'bbbGrade',
        'googleRating',
        'unansweredBbbComplaints',
        'hasDeadUrl',
        'urlMismatch',
        'napInconsistent',
        'daysSinceLastReview',
        'unaddressedReviewCount',
        'hasCtaFriction',
      ]),
    );
  });

  it('marks only the winning rule\'s signals as contributedToRule', () => {
    const result = evaluateTriage(
      with({ napInconsistent: true, hasDeadUrl: true, hasCtaFriction: true }),
    );
    // PB-01 wins; contributed = repair signals, NOT hasCtaFriction.
    const contributed = result.detectedSignals.filter((s) => s.contributedToRule);
    const contributedNames = contributed.map((s) => s.signal);
    expect(contributedNames).toContain('napInconsistent');
    expect(contributedNames).toContain('hasDeadUrl');
    expect(contributedNames).not.toContain('hasCtaFriction');
  });
});

// ─── SignalExtractor integration ─────────────────────────────────────────

describe('extractSignals — normalizes campaign + audit into NormalizedSignals', () => {
  const baseCampaign: SignalExtractorInput['campaign'] = {
    last_review_date: new Date('2026-05-01'),
    unaddressed_reviews: 12,
    nap_consistent: false,
    has_website: 'yes',
    website_url: 'https://example.com',
  };

  it('computes daysSinceLastReview from last_review_date', () => {
    const now = new Date('2026-08-02');
    const signals = extractSignals({ campaign: baseCampaign }, now);
    // 2026-05-01 → 2026-08-02 = ~93 days
    expect(signals.daysSinceLastReview).toBeGreaterThanOrEqual(92);
    expect(signals.daysSinceLastReview).toBeLessThanOrEqual(93);
  });

  it('returns -1 for daysSinceLastReview when last_review_date is null', () => {
    const signals = extractSignals({ campaign: { ...baseCampaign, last_review_date: null } });
    expect(signals.daysSinceLastReview).toBe(-1);
  });

  it('maps nap_consistent=false to napInconsistent=true', () => {
    const signals = extractSignals({ campaign: baseCampaign });
    expect(signals.napInconsistent).toBe(true);
  });

  it('carries through unaddressed_reviews', () => {
    const signals = extractSignals({ campaign: baseCampaign });
    expect(signals.unaddressedReviewCount).toBe(12);
  });

  it('passes through operator-supplied BBB fields', () => {
    const signals = extractSignals({
      campaign: baseCampaign,
      bbb: { bbbGrade: 'B', unansweredBbbComplaints: 2 },
    });
    expect(signals.bbbGrade).toBe('B');
    expect(signals.unansweredBbbComplaints).toBe(2);
  });

  it('defaults BBB fields to absent when not supplied', () => {
    const signals = extractSignals({ campaign: baseCampaign });
    expect(signals.bbbGrade).toBeUndefined();
    expect(signals.unansweredBbbComplaints).toBe(0);
  });
});

// ─── signalPredicates ────────────────────────────────────────────────────

describe('signalPredicates — individual signal thresholds', () => {
  it('bbbEmergency is true for low grade', () => {
    expect(signalPredicates.bbbEmergency(with({ bbbGrade: 'D' }))).toBe(true);
  });

  it('bbbEmergency is true for unanswered complaints', () => {
    expect(signalPredicates.bbbEmergency(with({ unansweredBbbComplaints: 1 }))).toBe(true);
  });

  it('bbbEmergency is false for good grade with no complaints', () => {
    expect(signalPredicates.bbbEmergency(with({ bbbGrade: 'A', unansweredBbbComplaints: 0 }))).toBe(false);
  });

  it('hasReviewGap uses the stale-days threshold', () => {
    expect(signalPredicates.hasReviewGap(with({ daysSinceLastReview: 89 }))).toBe(false);
    expect(signalPredicates.hasReviewGap(with({ daysSinceLastReview: 90 }))).toBe(true);
  });

  it('hasReviewGap uses the unaddressed-count threshold', () => {
    expect(signalPredicates.hasReviewGap(with({ unaddressedReviewCount: 4 }))).toBe(false);
    expect(signalPredicates.hasReviewGap(with({ unaddressedReviewCount: 5 }))).toBe(true);
  });
});
