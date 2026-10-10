/**
 * Material-variance regression tests — project-phase sprint §1.5.
 *
 * Verifies the shared material-variance rules at BOTH emission sites:
 *   - selectArchetype A1/A3 thresholds (outreach-openers)
 *   - deriveSignals CP_NAP_*_DRIFT (triage extractor — the partial lane's
 *     signal source, so this fix is load-bearing for plan correctness)
 *
 * Rules: formatting-only differences (legal suffixes, punctuation, phone
 * formatting, address abbreviations) are not material; unable_to_verify
 * never counts as inconsistency; material_issues is analyst-authoritative.
 */

import { describe, it, expect } from 'vitest';
import {
  selectArchetype,
  type BusinessAnalysisAuditData,
} from '../../outreach-openers/archetype-selection';
import {
  hasMaterialDrift,
  hasMaterialNameDrift,
  hasMaterialNapVariance,
  isFormattingOnlyNameDifference,
} from '../../outreach-openers/signal-magnitude';
import { extractSignals } from '../signal-extractor';

// ─── Fixtures ────────────────────────────────────────────────────────────

function baseAudit(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: { google: { profile_status: 'claimed' } },
    combined_review_metrics: {
      observable_unanswered_reviews: 1,
      observable_unanswered_rate_percent: 5,
      observable_unanswered_negative_reviews: 0,
    },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    ...overrides,
  };
}

const campaign = { unaddressed_reviews: 0, has_website: 'yes', website_url: 'https://example.com' };

function signalsFor(audit: BusinessAnalysisAuditData): string[] {
  return extractSignals({ campaign, auditData: audit });
}

// ─── A1 materiality: rate AND count both required ────────────────────────

describe('selectArchetype — A1 threshold (rate ≥25% AND count ≥5)', () => {
  // Fixtures use a website gap (A7) as the competing archetype — A1 outranks
  // A7, so A7 winning proves the A1 threshold did NOT fire. (The bottom
  // fallback also returns A1, so 'not A1' alone is unprovable without a
  // competitor; we additionally assert the reason isn't the gap branch.)

  it('does not fire on a mostly-answered business', () => {
    const audit = baseAudit({ website: undefined });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A7');
    expect(sel.reason).not.toContain('review response gap');
  });

  it('does not fire on high rate with tiny count (2 of 4 unanswered)', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 2,
        observable_unanswered_rate_percent: 50,
        observable_unanswered_negative_reviews: 0,
      },
      website: undefined,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A7');
    expect(sel.reason).not.toContain('review response gap');
  });

  it('does not fire on high count with low rate (20 of 400 unanswered)', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 20,
        observable_unanswered_rate_percent: 5,
        observable_unanswered_negative_reviews: 0,
      },
      website: undefined,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A7');
    expect(sel.reason).not.toContain('review response gap');
  });

  it('fires when both rate (30%) and count (8) clear the floor', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 8,
        observable_unanswered_rate_percent: 30,
        observable_unanswered_negative_reviews: 0,
      },
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A1');
    expect(sel.reason).toContain('review response gap');
  });
});

// ─── A3 material variance: formatting-only does not fire ─────────────────

describe('selectArchetype — A3 material variance', () => {
  it('does not fire on formatting-only name variation (legal suffix)', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        name_variations: ['Acme Grocery', 'Acme Grocery LLC'],
      },
      website: undefined, // no A7 fallback confusion — isolates the A3 branch
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).not.toBe('A3');
  });

  it('does not fire on cosmetic phone formatting variations', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        phone_variations: ['(317) 555-0100', '317-555-0100', '+1 317-555-0100'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).not.toBe('A3');
  });

  it('does not fire on cosmetic address abbreviation variations', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        address_variations: ['12 Main Rd, Indy, IN', '12 Main Road, Indy, IN'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).not.toBe('A3');
  });

  it('fires on genuinely different names', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        name_variations: ['Acme Grocery', 'Acme Market & Deli'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).toBe('A3');
  });

  it('fires on genuinely different phone numbers', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        phone_variations: ['317-555-0100', '317-555-9999'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).toBe('A3');
  });

  it('does not fire when overall_status is unable_to_verify', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'unable_to_verify',
        name_variations: ['Acme Grocery', 'Acme Market & Deli'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).not.toBe('A3');
  });

  it('fires when material_issues is populated (analyst-verified)', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        material_issues: ['Yelp address conflicts with Google'],
      },
      website: undefined,
    });
    expect(selectArchetype(audit).archetype).toBe('A3');
  });
});

// ─── Extractor CP_NAP_*_DRIFT: same material rules ───────────────────────

describe('extractSignals — CP_NAP_*_DRIFT material variance', () => {
  it('does not emit CP_NAP_NAME_DRIFT for formatting-only name variation', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        name_variations: ['Acme Grocery', 'Acme Grocery, Inc.'],
      },
    });
    expect(signalsFor(audit)).not.toContain('CP_NAP_NAME_DRIFT');
  });

  it('emits CP_NAP_NAME_DRIFT for genuinely different names', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        name_variations: ['Acme Grocery', 'Acme Market & Deli'],
      },
    });
    expect(signalsFor(audit)).toContain('CP_NAP_NAME_DRIFT');
  });

  it('does not emit CP_NAP_PHONE_DRIFT for formatting-only phone variation', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        phone_variations: ['(317) 555-0100', '3175550100'],
      },
    });
    expect(signalsFor(audit)).not.toContain('CP_NAP_PHONE_DRIFT');
  });

  it('emits CP_NAP_PHONE_DRIFT for genuinely different numbers', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        phone_variations: ['317-555-0100', '317-555-9999'],
      },
    });
    expect(signalsFor(audit)).toContain('CP_NAP_PHONE_DRIFT');
  });

  it('emits no drift signals when overall_status is unable_to_verify', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'unable_to_verify',
        name_variations: ['Acme Grocery', 'Acme Market & Deli'],
        phone_variations: ['317-555-0100', '317-555-9999'],
      },
    });
    const signals = signalsFor(audit);
    expect(signals).not.toContain('CP_NAP_NAME_DRIFT');
    expect(signals).not.toContain('CP_NAP_PHONE_DRIFT');
    expect(signals).not.toContain('CP_NAP_ADDRESS_DRIFT');
  });

  it('emits CP_NAP_ADDRESS_DRIFT when material_issues names the address', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'minor_variations',
        material_issues: ['Yelp address conflicts with Google'],
      },
    });
    const signals = signalsFor(audit);
    expect(signals).toContain('CP_NAP_ADDRESS_DRIFT');
    expect(signals).not.toContain('CP_NAP_NAME_DRIFT');
  });
});

// ─── Helper unit edges ───────────────────────────────────────────────────

describe('material-variance helpers', () => {
  it('isFormattingOnlyNameDifference collapses legal suffixes + punctuation', () => {
    expect(isFormattingOnlyNameDifference('Acme Grocery, LLC', 'acme grocery')).toBe(true);
    expect(isFormattingOnlyNameDifference('Acme Grocery', 'Acme Market & Deli')).toBe(false);
  });

  it('hasMaterialDrift treats cosmetic-only variations as cosmetic', () => {
    expect(
      hasMaterialDrift({
        overall_status: 'minor_variations',
        name_variations: ['Acme Grocery', 'Acme Grocery LLC'],
        phone_variations: ['(317) 555-0100', '3175550100'],
      }),
    ).toBe(false);
  });

  it('hasMaterialNameDrift compares canonical against variations', () => {
    expect(
      hasMaterialNameDrift({
        overall_status: 'minor_variations',
        canonical_name: 'Acme Grocery',
        name_variations: ['Acme Market & Deli'],
      }),
    ).toBe(true);
  });

  it('hasMaterialNapVariance respects consistent + unable_to_verify', () => {
    expect(hasMaterialNapVariance({ overall_status: 'consistent' })).toBe(false);
    expect(
      hasMaterialNapVariance({
        overall_status: 'unable_to_verify',
        name_variations: ['A', 'B'],
      }),
    ).toBe(false);
    expect(hasMaterialNapVariance({ overall_status: 'major_inconsistencies' })).toBe(true);
    expect(hasMaterialNapVariance(null)).toBe(false);
  });
});
