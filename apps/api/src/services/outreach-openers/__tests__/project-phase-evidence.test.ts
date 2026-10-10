/**
 * extractPhaseEvidence + resolvePhaseCopy — Phase 5.1/5.2 coverage:
 * signal→field mapping, verbatim quote rows (isQuote + attribution),
 * quote attachment scoped to trust, and template copy never leaking
 * internal vocabulary.
 */
import { describe, expect, it } from 'vitest';
import { extractPhaseEvidence } from '../project-phase-evidence';
import { resolvePhaseCopy, PHASE_TEMPLATES } from '../project-phase-prompts';
import { PROJECT_PHASE_CATALOG_ORDER } from '../../../lib/project-phase-predicates';
import type { SignalCode } from '../../triage/signal-taxonomy';

const AUDIT = {
  nap_consistency: {
    name_variations: ['Harbor Deli', 'Harbour Deli'],
    overall_status: 'major_inconsistencies',
  },
  combined_review_metrics: {
    observable_unanswered_negative_reviews: 7,
    observable_total_reviews: 9,
    newest_observable_unanswered_review: '2025-01-01',
  },
  platforms: { google: { profile_status: 'unclaimed', photo_count: 2 } },
  website: { url: 'harbordeli.weebly.com', status: 'live' },
  unanswered_negative_review_examples: [
    { text: 'Waited 40 minutes and nobody helped.', author: 'Sam K.', platform: 'Google' },
  ],
} as any;

function ev(codes: SignalCode[], phaseKey = 'foundation') {
  return extractPhaseEvidence({
    phaseKey,
    triggerSignals: codes,
    audit: AUDIT,
    campaignId: 'c-1',
  });
}

describe('extractPhaseEvidence', () => {
  it('maps NAP drift to the variation lists', () => {
    const rows = ev(['CP_NAP_NAME_DRIFT']);
    expect(rows[0]).toMatchObject({ field: 'name_variations', campaignId: 'c-1' });
    expect(rows[0].value).toContain('Harbor Deli');
    expect(rows[0].signalCode).toBe('CP_NAP_NAME_DRIFT');
  });

  it('maps backlog/drought/volume to review metrics', () => {
    const rows = ev(['RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_LOW_REVIEW_VOLUME'], 'trust');
    expect(rows.find((r) => r.field === 'unanswered_negative_reviews')?.value).toContain('7');
    expect(rows.find((r) => r.field === 'review_count')?.value).toContain('9');
  });

  it('verbatim quotes attach to trust only, with isQuote + attribution', () => {
    const trustRows = ev(['RA_UNADDRESSED_NEGATIVE_BACKLOG'], 'trust');
    const quote = trustRows.find((r) => r.isQuote);
    expect(quote).toBeTruthy();
    expect(quote!.value).toBe('Waited 40 minutes and nobody helped.');
    expect(quote!.attribution).toBe('Sam K. · Google');

    const findRows = ev(['WC_MISSING_WEBSITE'], 'findability');
    expect(findRows.some((r) => r.isQuote)).toBe(false);
  });

  it('no audit → no fabricated evidence', () => {
    const rows = extractPhaseEvidence({
      phaseKey: 'foundation',
      triggerSignals: ['CP_NAP_NAME_DRIFT'],
      audit: null,
      campaignId: 'c-1',
    });
    expect(rows).toHaveLength(0);
  });
});

describe('resolvePhaseCopy', () => {
  it('every phase has a template producing the full anatomy', () => {
    for (const key of PROJECT_PHASE_CATALOG_ORDER) {
      const copy = resolvePhaseCopy(key, { evidence: [] });
      expect(copy.name).toBeTruthy();
      expect(copy.goal).toBeTruthy();
      expect(copy.actions.length).toBeGreaterThan(0);
      expect(copy.exitCopy).toBeTruthy();
    }
  });

  it('foundation copy interpolates the name-variation evidence', () => {
    const evidence = ev(['CP_NAP_NAME_DRIFT']);
    const copy = resolvePhaseCopy('foundation', { evidence });
    expect(copy.goal).toContain('name');
  });

  it('owner copy never carries internal vocabulary', () => {
    const evidence = ev(['RA_UNADDRESSED_NEGATIVE_BACKLOG'], 'trust');
    const forbidden = /\b(RA|DS|WC|CP|VP|OX|INT)_[A-Z_]+\b|\bA[1-7]\b|tier_?\d|\$\d/i;
    for (const key of PROJECT_PHASE_CATALOG_ORDER) {
      const copy = resolvePhaseCopy(key, { evidence, businessName: 'Harbor Deli' });
      const text = [copy.name, copy.goal, copy.exitCopy, ...copy.actions.map((a) => a.text)].join(' ');
      expect(text).not.toMatch(forbidden);
    }
  });
});
