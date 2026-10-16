/**
 * Triage reasoning must name the signal that ACTUALLY matched.
 *
 * The regression: the rationale buckets detected signals into families —
 * repair / review / crisis / visual — and files everything else under
 * "other signals". The website family (`WC_*`) is in none of those buckets, so
 * PB-08 (whose entire `any` clause is `WC_*`) rendered a rationale that filed
 * its own winning signal under "other" while listing the duplicate and
 * NAP-drift signals that did NOT contribute. The card read as if listing drift
 * had driven a website recommendation.
 */
import { describe, it, expect } from 'vitest';
import { evaluateTriage } from '../TriageEngineService';

const playbook = (
  code: string,
  name: string,
  matchingRules: Record<string, unknown>,
  priorityRank: number,
) => ({
  id: `pbk-${code.toLowerCase()}`,
  code,
  name,
  category: 'profile_repair',
  archetype: 'A7',
  description: '',
  matchingRules,
  priorityRank,
  fitdOfferTitle: '',
  fitdDefaultFeeCents: 0,
  retainerPitchTitle: '',
  retainerFeeCents: 0,
  openerPromptTemplateId: null,
  previewDeliverableType: null,
  isActive: true,
} as any);

const PB08 = playbook(
  'PB-08',
  'Website Acquisition & Build',
  {
    any: ['WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_BROKEN_WEBSITE'],
    all: [],
    dual: null,
    none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
    confidence: 0.88,
  },
  8,
);

describe('buildReasoning — matched-on attribution', () => {
  it('names a website signal for a website playbook instead of filing it as "other"', () => {
    const rec = evaluateTriage(
      [
        'DS_DUPLICATE_LISTING',
        'CP_NAP_PHONE_DRIFT',
        'RA_UNADDRESSED_POSITIVE_BACKLOG',
        'WC_BUILDER_SUBDOMAIN',
      ] as any,
      [PB08],
    );

    expect(rec).not.toBeNull();
    expect(rec!.reasoning).toContain('matched on: WC_BUILDER_SUBDOMAIN');

    // The winning signal must not ALSO appear as an unmatched "other".
    const other = rec!.reasoning.split('other signals:')[1] ?? '';
    expect(other).not.toContain('WC_BUILDER_SUBDOMAIN');
  });

  it('names both dual groups for a dual-rule playbook', () => {
    const pb05 = playbook(
      'PB-05',
      'Multi-Signal Footprint Triage',
      {
        any: [],
        all: [],
        dual: {
          groupA: ['DS_DUPLICATE_LISTING', 'CP_NAP_NAME_DRIFT'],
          groupB: ['RA_UNADDRESSED_POSITIVE_BACKLOG', 'RA_REVIEW_DROUGHT'],
        },
        none: ['RA_BBB_GRADE_SUPPRESSION'],
        confidence: 0.9,
      },
      2,
    );

    const rec = evaluateTriage(
      ['DS_DUPLICATE_LISTING', 'RA_UNADDRESSED_POSITIVE_BACKLOG'] as any,
      [pb05],
    );

    expect(rec!.reasoning).toContain('matched on: DS_DUPLICATE_LISTING, RA_UNADDRESSED_POSITIVE_BACKLOG');
  });

  it('omits the clause when nothing matched the winning rule', () => {
    // PB-03-style fallback: empty any/all/none matches everything, so there is
    // no clause to attribute.
    const fallback = playbook(
      'PB-03',
      'Fallback',
      { any: [], all: [], dual: null, none: [], confidence: 0.5 },
      9,
    );
    const rec = evaluateTriage(['DS_MISSING_PROFILE'] as any, [fallback]);
    expect(rec!.reasoning).not.toContain('matched on:');
  });
});
