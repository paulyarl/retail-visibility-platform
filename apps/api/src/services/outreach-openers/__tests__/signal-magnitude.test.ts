/**
 * Signal magnitude — severity computation + triggered signal context tests.
 *
 * Verifies the generalized severity fix that applies to ALL archetypes:
 *   - Per-signal severity computation from audit data (not just presence)
 *   - Triggered signal context ranking (strongest first)
 *   - Per-archetype primary signal severity computation
 *   - Co-occurring signal detection (strongest signal stronger than primary)
 *   - Prompt injection: every archetype gets the signal context note +
 *     co-occurring signal instruction when a stronger signal exists
 *
 * The core regression: when a playbook pins an archetype (e.g., PB-01 → A3)
 * but a stronger co-occurring signal exists (e.g., WC_BROKEN_WEBSITE), the
 * prompt must acknowledge the stronger signal — not ignore it.
 */

import { describe, it, expect } from 'vitest';
import {
  type SignalSeverity,
  type TriggeredSignalEntry,
  computeSignalSeverity,
  computePrimarySignalSeverity,
  buildTriggeredSignalContext,
  signalsStrongerThan,
  getStrongestCoOccurringSignal,
  hasMaterialDrift,
  severityRank,
  isStronger,
  SEVERITY_RANK,
} from '../signal-magnitude';
import { buildArchetypePrompt } from '../archetype-prompts';
import type { BusinessAnalysisAuditData } from '../archetype-selection';
import type { CommonFields } from '../field-extractors';

// ─── Fixtures ────────────────────────────────────────────────────────────

function baseAudit(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: {
      google: { profile_status: 'claimed' },
      yelp: {},
      facebook: {},
    },
    combined_review_metrics: {
      observable_unanswered_reviews: 0,
      observable_unanswered_rate_percent: 0,
      observable_unanswered_negative_reviews: 0,
    },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    ...overrides,
  };
}

const common: CommonFields = {
  business_name: 'Test Biz',
  contact_name: null,
  tone: 'short informal',
  city: 'Test City',
  state: 'TS',
  phone: '555-0100',
  website_url: 'https://example.com',
  triggered_signals: [],
  primary_signal_severity: 'borderline',
  strongest_co_occurring: null,
};

// ─── Severity ranking ────────────────────────────────────────────────────

describe('SEVERITY_RANK + helpers', () => {
  it('ranks crisis > material > cosmetic > borderline', () => {
    expect(SEVERITY_RANK.crisis).toBeGreaterThan(SEVERITY_RANK.material);
    expect(SEVERITY_RANK.material).toBeGreaterThan(SEVERITY_RANK.cosmetic);
    expect(SEVERITY_RANK.cosmetic).toBeGreaterThan(SEVERITY_RANK.borderline);
  });

  it('isStronger returns true when a > b', () => {
    expect(isStronger('crisis', 'material')).toBe(true);
    expect(isStronger('material', 'cosmetic')).toBe(true);
    expect(isStronger('cosmetic', 'crisis')).toBe(false);
    expect(isStronger('material', 'material')).toBe(false);
  });

  it('severityRank returns numeric rank', () => {
    expect(severityRank('crisis')).toBe(4);
    expect(severityRank('borderline')).toBe(1);
  });
});

// ─── hasMaterialDrift ────────────────────────────────────────────────────

describe('hasMaterialDrift', () => {
  it('returns false for cosmetic phone formatting', () => {
    expect(hasMaterialDrift({
      overall_status: 'consistent',
      phone_variations: ['(317) 297-7036', '+1 317-297-7036', '3172977036'],
    })).toBe(false);
  });

  it('returns false for cosmetic address abbreviation', () => {
    expect(hasMaterialDrift({
      overall_status: 'consistent',
      address_variations: ['4271 Lafayette Rd, Indy, IN', '4271 Lafayette Road, Indy, IN'],
    })).toBe(false);
  });

  it('returns false for cosmetic name suffix (LLC)', () => {
    expect(hasMaterialDrift({
      overall_status: 'consistent',
      name_variations: ['Test Biz LLC', 'Test Biz'],
    })).toBe(false);
  });

  it('returns true for genuinely different phone numbers', () => {
    expect(hasMaterialDrift({
      overall_status: 'inconsistent',
      phone_variations: ['317-297-7036', '317-555-1234'],
    })).toBe(true);
  });

  it('returns true for genuinely different addresses', () => {
    expect(hasMaterialDrift({
      overall_status: 'inconsistent',
      address_variations: ['123 Main St, Indy, IN', '456 Oak Ave, Indy, IN'],
    })).toBe(true);
  });
});

// ─── computeSignalSeverity ───────────────────────────────────────────────

describe('computeSignalSeverity', () => {
  it('returns "crisis" for WC_BROKEN_WEBSITE', () => {
    const audit = baseAudit({ website: { url: 'https://example.com', status: 'dead' } });
    expect(computeSignalSeverity('WC_BROKEN_WEBSITE', audit)).toBe('crisis');
  });

  it('returns "crisis" for RA_BBB_GRADE_SUPPRESSION', () => {
    expect(computeSignalSeverity('RA_BBB_GRADE_SUPPRESSION', baseAudit())).toBe('crisis');
  });

  it('returns "material" for CP_NAP_PHONE_DRIFT when material drift exists', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'inconsistent',
        phone_variations: ['317-297-7036', '317-555-1234'],
      },
    });
    expect(computeSignalSeverity('CP_NAP_PHONE_DRIFT', audit)).toBe('material');
  });

  it('returns "cosmetic" for CP_NAP_PHONE_DRIFT when only formatting differs', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        phone_variations: ['(317) 297-7036', '317-297-7036'],
      },
    });
    expect(computeSignalSeverity('CP_NAP_PHONE_DRIFT', audit)).toBe('cosmetic');
  });

  it('returns "crisis" for RA_UNADDRESSED_NEGATIVE_BACKLOG at 10+', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 15,
        observable_unanswered_rate_percent: 50,
        observable_unanswered_negative_reviews: 12,
      },
    });
    expect(computeSignalSeverity('RA_UNADDRESSED_NEGATIVE_BACKLOG', audit)).toBe('crisis');
  });

  it('returns "material" for RA_UNADDRESSED_NEGATIVE_BACKLOG at 3-9', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 5,
        observable_unanswered_rate_percent: 20,
        observable_unanswered_negative_reviews: 5,
      },
    });
    expect(computeSignalSeverity('RA_UNADDRESSED_NEGATIVE_BACKLOG', audit)).toBe('material');
  });

  it('returns "material" for WC_MISSING_CTA', () => {
    expect(computeSignalSeverity('WC_MISSING_CTA', baseAudit())).toBe('material');
  });

  it('returns "borderline" for RA_LOW_REVIEW_VOLUME', () => {
    expect(computeSignalSeverity('RA_LOW_REVIEW_VOLUME', baseAudit())).toBe('borderline');
  });

  it('returns "borderline" for unknown codes (fallback)', () => {
    expect(computeSignalSeverity('UNKNOWN_SIGNAL', baseAudit())).toBe('borderline');
  });
});

// ─── buildTriggeredSignalContext ─────────────────────────────────────────

describe('buildTriggeredSignalContext', () => {
  it('ranks signals by severity (strongest first)', () => {
    const audit = baseAudit({
      website: { url: 'https://example.com', status: 'dead' },
      nap_consistency: {
        overall_status: 'consistent',
        phone_variations: ['(317) 555-0100', '317-555-0100'],
      },
    });
    const ctx = buildTriggeredSignalContext(
      ['WC_BROKEN_WEBSITE', 'CP_NAP_PHONE_DRIFT', 'WC_MISSING_CTA'],
      audit,
    );
    expect(ctx.signals[0].code).toBe('WC_BROKEN_WEBSITE');
    expect(ctx.signals[0].severity).toBe('crisis');
    expect(ctx.strongest?.code).toBe('WC_BROKEN_WEBSITE');
  });

  it('labels each signal', () => {
    const ctx = buildTriggeredSignalContext(['WC_BROKEN_WEBSITE'], baseAudit());
    expect(ctx.signals[0].label).toContain('Broken Website');
  });

  it('returns empty context for empty signal list', () => {
    const ctx = buildTriggeredSignalContext([], baseAudit());
    expect(ctx.signals).toEqual([]);
    expect(ctx.strongest).toBeNull();
  });
});

// ─── signalsStrongerThan + getStrongestCoOccurringSignal ─────────────────

describe('signalsStrongerThan + getStrongestCoOccurringSignal', () => {
  it('filters signals stronger than threshold', () => {
    const ctx: { signals: TriggeredSignalEntry[]; strongest: TriggeredSignalEntry | null } = {
      signals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken Website', severity: 'crisis' },
        { code: 'WC_MISSING_CTA', label: 'Missing CTA', severity: 'material' },
        { code: 'CP_NAP_PHONE_DRIFT', label: 'NAP Phone Drift', severity: 'cosmetic' },
      ],
      strongest: null,
    };
    const stronger = signalsStrongerThan(ctx, 'material');
    expect(stronger.length).toBe(1);
    expect(stronger[0].code).toBe('WC_BROKEN_WEBSITE');
  });

  it('getStrongestCoOccurringSignal returns the strongest above primary', () => {
    const ctx: { signals: TriggeredSignalEntry[]; strongest: TriggeredSignalEntry | null } = {
      signals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken Website', severity: 'crisis' },
        { code: 'CP_NAP_PHONE_DRIFT', label: 'NAP Phone Drift', severity: 'cosmetic' },
      ],
      strongest: null,
    };
    const strongest = getStrongestCoOccurringSignal(ctx, 'cosmetic');
    expect(strongest?.code).toBe('WC_BROKEN_WEBSITE');
  });

  it('getStrongestCoOccurringSignal returns null when primary is already strongest', () => {
    const ctx: { signals: TriggeredSignalEntry[]; strongest: TriggeredSignalEntry | null } = {
      signals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken Website', severity: 'crisis' },
      ],
      strongest: null,
    };
    const strongest = getStrongestCoOccurringSignal(ctx, 'crisis');
    expect(strongest).toBeNull();
  });
});

// ─── computePrimarySignalSeverity per archetype ──────────────────────────

describe('computePrimarySignalSeverity — per archetype', () => {
  it('A1: crisis at 50%+ unanswered rate', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 40,
        observable_unanswered_rate_percent: 60,
        observable_unanswered_negative_reviews: 10,
      },
    });
    expect(computePrimarySignalSeverity('A1', audit)).toBe('crisis');
  });

  it('A1: material at 25%+ unanswered rate', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 15,
        observable_unanswered_rate_percent: 30,
        observable_unanswered_negative_reviews: 3,
      },
    });
    expect(computePrimarySignalSeverity('A1', audit)).toBe('material');
  });

  it('A1: borderline below 25%', () => {
    const audit = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 5,
        observable_unanswered_rate_percent: 15,
        observable_unanswered_negative_reviews: 1,
      },
    });
    expect(computePrimarySignalSeverity('A1', audit)).toBe('borderline');
  });

  it('A2: crisis at 5+ theme reviews', () => {
    const audit = baseAudit({
      negative_review_themes: [
        { theme: 'Pricing', summary: 'test', supporting_review_count: 7 },
      ],
    });
    expect(computePrimarySignalSeverity('A2', audit)).toBe('crisis');
  });

  it('A2: material at 3-4 theme reviews', () => {
    const audit = baseAudit({
      negative_review_themes: [
        { theme: 'Pricing', summary: 'test', supporting_review_count: 3 },
      ],
    });
    expect(computePrimarySignalSeverity('A2', audit)).toBe('material');
  });

  it('A3: material when NAP drift is genuine', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'inconsistent',
        phone_variations: ['317-297-7036', '317-555-1234'],
      },
    });
    expect(computePrimarySignalSeverity('A3', audit)).toBe('material');
  });

  it('A3: cosmetic when NAP drift is formatting-only', () => {
    const audit = baseAudit({
      nap_consistency: {
        overall_status: 'consistent',
        phone_variations: ['(317) 297-7036', '317-297-7036'],
      },
    });
    expect(computePrimarySignalSeverity('A3', audit)).toBe('cosmetic');
  });

  it('A4: material (missing CTA is always a real gap)', () => {
    expect(computePrimarySignalSeverity('A4', baseAudit())).toBe('material');
  });

  it('A6: crisis when no website', () => {
    const audit = baseAudit({ website: undefined });
    expect(computePrimarySignalSeverity('A6', audit)).toBe('crisis');
  });

  it('A6: material when website exists but no product browsing', () => {
    const audit = baseAudit({
      website: { url: 'https://example.com', status: 'working', has_product_browsing: false } as any,
    });
    expect(computePrimarySignalSeverity('A6', audit)).toBe('material');
  });
});

// ─── Prompt injection — co-occurring signal instruction ──────────────────

describe('buildArchetypePrompt — co-occurring signal injection', () => {
  function makeFields(archetype: string, overrides: any = {}): string {
    const fields = {
      ...common,
      business_name: 'Test Biz',
      primary_signal_severity: 'cosmetic',
      strongest_co_occurring: {
        code: 'WC_BROKEN_WEBSITE',
        label: 'Broken Website (dead URL)',
        severity: 'crisis',
      },
      triggered_signals: [
        { code: 'WC_BROKEN_WEBSITE', label: 'Broken Website (dead URL)', severity: 'crisis' },
        { code: 'CP_NAP_PHONE_DRIFT', label: 'NAP Phone Drift', severity: 'cosmetic' },
      ],
      ...overrides,
    };
    return JSON.stringify(fields, null, 2);
  }

  it('A1: injects co-occurring signal instruction when stronger signal exists', () => {
    const prompt = buildArchetypePrompt('A1', makeFields('A1'), 'soft');
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
    expect(prompt).toContain('Broken Website (dead URL)');
  });

  it('A2: injects co-occurring signal instruction when stronger signal exists', () => {
    const prompt = buildArchetypePrompt('A2', makeFields('A2'), 'soft');
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
  });

  it('A4: injects co-occurring signal instruction when stronger signal exists', () => {
    const prompt = buildArchetypePrompt('A4', makeFields('A4'), 'soft');
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
  });

  it('A5: injects co-occurring signal instruction when stronger signal exists', () => {
    const prompt = buildArchetypePrompt('A5', makeFields('A5'), 'soft');
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
  });

  it('A6: injects co-occurring signal instruction when stronger signal exists', () => {
    const prompt = buildArchetypePrompt('A6', makeFields('A6'), 'soft');
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
  });

  it('does NOT inject co-occurring signal instruction when no stronger signal', () => {
    const fields = JSON.stringify({
      ...common,
      primary_signal_severity: 'crisis',
      strongest_co_occurring: null,
      triggered_signals: [],
    }, null, 2);
    const prompt = buildArchetypePrompt('A1', fields, 'soft');
    expect(prompt).not.toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
  });
});

// ─── Prompt injection — signal context note in all archetypes ────────────

describe('buildArchetypePrompt — signal context note present in all archetypes', () => {
  const fields = JSON.stringify({ ...common, primary_signal_severity: 'material' }, null, 2);

  it('A1 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A1', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });

  it('A2 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A2', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });

  it('A3 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A3', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });

  it('A4 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A4', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });

  it('A5 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A5', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });

  it('A6 prompt includes signal context note', () => {
    expect(buildArchetypePrompt('A6', fields, 'soft')).toContain('triggered_signals lists ALL signals');
  });
});

// ─── Prompt injection — severity guard in Forbidden section ──────────────

describe('buildArchetypePrompt — severity guard in Forbidden section', () => {
  const fields = JSON.stringify({ ...common, primary_signal_severity: 'material' }, null, 2);

  it('A1 forbids overstating severity', () => {
    expect(buildArchetypePrompt('A1', fields, 'soft')).toContain('overstating the severity');
  });

  it('A2 forbids overstating severity', () => {
    // The phrase may be split across lines in the Forbidden section;
    // check for "overstating" which is on the first line of the phrase.
    expect(buildArchetypePrompt('A2', fields, 'soft')).toContain('overstating');
  });

  it('A4 forbids overstating severity', () => {
    // The phrase may be split across lines in the Forbidden section;
    // check for "overstating" which is on the first line of the phrase.
    expect(buildArchetypePrompt('A4', fields, 'soft')).toContain('overstating');
  });

  it('A5 forbids overstating severity', () => {
    expect(buildArchetypePrompt('A5', fields, 'soft')).toContain('overstating the severity');
  });

  it('A6 forbids overstating severity', () => {
    expect(buildArchetypePrompt('A6', fields, 'soft')).toContain('overstating the severity');
  });
});
