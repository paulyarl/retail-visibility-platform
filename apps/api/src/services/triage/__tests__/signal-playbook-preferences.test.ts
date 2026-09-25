/**
 * Signal playbook preferences (migration 308) — suggested-signal pre-wiring.
 *
 * A signal registered from the Bronze overview's suggested-signals flow can
 * declare triage intent without anyone editing a playbook's matching_rules:
 *
 *   primary_playbook   — joins that playbook's `any` evidence pool at
 *                        evaluation time (playbook's own guards still apply).
 *   secondary_playbook — declared fallback when NO playbook's rules match;
 *                        beats the blind PB-03 fallback (none-guard honored,
 *                        all/dual conjunctions can't be satisfied by a lone
 *                        declared signal).
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateTriage,
  buildSignalPlaybookPrefs,
  applySignalPlaybookPreferences,
  preferenceFallbackRecommendation,
  type SignalPlaybookPrefsMap,
} from '../TriageEngineService';
import type { PlaybookCatalogRow, MatchingRules, SignalCode } from '../types';
import type { SignalRegistryRow } from '../signal-taxonomy';

// ─── Fixtures ────────────────────────────────────────────────────────────

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return { any: [], all: [], none: [], dual: null, confidence: 0.85, ...overrides };
}

function playbook(
  code: string,
  rank: number,
  matchingRules: MatchingRules,
  overrides: Partial<PlaybookCatalogRow> = {},
): PlaybookCatalogRow {
  return {
    id: `pbk-${code.toLowerCase()}`,
    code: code as any,
    name: `Playbook ${code}`,
    category: 'review_management',
    archetype: 'A3',
    archetypeLabel: 'A3_LISTING_DRIFT',
    description: null,
    matchingRules,
    priorityRank: rank,
    fitdOfferTitle: `FITD ${code}`,
    fitdDefaultFeeCents: 10000,
    retainerPitchTitle: `Retainer ${code}`,
    retainerFeeCents: 20000,
    openerPromptTemplateId: null,
    previewDeliverableType: 'preview',
    isActive: true,
    ...overrides,
  };
}

function registryRow(
  code: string,
  primaryPlaybook: string | null = null,
  secondaryPlaybook: string | null = null,
): Pick<SignalRegistryRow, 'code' | 'primaryPlaybook' | 'secondaryPlaybook'> {
  return { code, primaryPlaybook, secondaryPlaybook };
}

/** Small cascade: PB-04 (any-guarded), PB-05 (dual-only), PB-03 (fallback). */
function cascade(): PlaybookCatalogRow[] {
  return [
    playbook('PB-04', 1, rules({
      any: ['RA_BBB_GRADE_SUPPRESSION'],
      confidence: 0.95,
    }), { category: 'recovery_management', archetype: 'A2', archetypeLabel: 'A2_NEGATIVE_RECOVERY' }),
    playbook('PB-05', 2, rules({
      none: ['RA_BBB_GRADE_SUPPRESSION'],
      dual: { groupA: ['CP_NAP_NAME_DRIFT'], groupB: ['RA_LOW_REVIEW_VOLUME'] },
      confidence: 0.9,
    }), { category: 'triage_management', archetype: 'A5', archetypeLabel: 'A5_DUAL_TRIAGE' }),
    playbook('PB-03', 3, rules({
      any: ['WC_MISSING_CTA', 'WC_MISSING_WEBSITE'],
      confidence: 0.7,
    })),
  ];
}

// ─── buildSignalPlaybookPrefs ────────────────────────────────────────────

describe('buildSignalPlaybookPrefs', () => {
  it('maps only rows that declare at least one playbook preference', () => {
    const prefs = buildSignalPlaybookPrefs([
      registryRow('INT_SEASONAL_CLOSURE', 'PB-04', 'PB-03'),
      registryRow('INT_COMMUNITY_SIGNAL', null, 'PB-05'),
      registryRow('INT_LOW_VISIBILITY'), // no prefs — excluded
    ]);
    expect(prefs.size).toBe(2);
    expect(prefs.get('INT_SEASONAL_CLOSURE')).toEqual({ primary: 'PB-04', secondary: 'PB-03' });
    expect(prefs.get('INT_COMMUNITY_SIGNAL')).toEqual({ primary: null, secondary: 'PB-05' });
    expect(prefs.has('INT_LOW_VISIBILITY')).toBe(false);
  });
});

// ─── applySignalPlaybookPreferences ──────────────────────────────────────

describe('applySignalPlaybookPreferences — primary joins the any pool', () => {
  const prefs: SignalPlaybookPrefsMap = new Map([
    ['INT_SEASONAL_CLOSURE', { primary: 'PB-03', secondary: null }],
  ]);

  it('a detected signal joins its primary playbook\'s any pool → cascade match', () => {
    const playbooks = cascade();
    const { playbooks: augmented, wired } = applySignalPlaybookPreferences(
      playbooks, ['INT_SEASONAL_CLOSURE'], prefs,
    );
    // Signal itself isn't in PB-03's authored any — augmentation adds it.
    const result = evaluateTriage(['INT_SEASONAL_CLOSURE'], augmented);
    expect(result!.playbookCode).toBe('PB-03');
    expect(wired.get('PB-03')!.has('INT_SEASONAL_CLOSURE')).toBe(true);
    const sig = result!.detectedSignals.find((s) => s.code === 'INT_SEASONAL_CLOSURE');
    expect(sig!.contributedToRule).toBe(true);
  });

  it('undetected signals do not augment anything', () => {
    const { playbooks: augmented, wired } = applySignalPlaybookPreferences(
      cascade(), ['WC_MISSING_CTA'], prefs,
    );
    expect(wired.size).toBe(0);
    expect(augmented.find((p) => p.code === 'PB-03')!.matchingRules.any)
      .toEqual(['WC_MISSING_CTA', 'WC_MISSING_WEBSITE']);
  });

  it('never augments a playbook with an empty any clause (dual-only PB-05 stays intact)', () => {
    const dualPrefs: SignalPlaybookPrefsMap = new Map([
      ['INT_DUAL_SIGNAL', { primary: 'PB-05', secondary: null }],
    ]);
    const playbooks = cascade();
    const { playbooks: augmented, wired } = applySignalPlaybookPreferences(
      playbooks, ['INT_DUAL_SIGNAL'], dualPrefs,
    );
    // PB-05 must NOT gain an `any` requirement — its dual-only structure is
    // preserved verbatim so normal repair+review matches are not hijacked.
    expect(wired.size).toBe(0);
    const pb05 = augmented.find((p) => p.code === 'PB-05')!;
    expect(pb05.matchingRules.any).toEqual([]);
    // Normal PB-05 match still works with the declared signal present.
    const result = evaluateTriage(['CP_NAP_NAME_DRIFT', 'RA_LOW_REVIEW_VOLUME', 'INT_DUAL_SIGNAL'], augmented);
    expect(result!.playbookCode).toBe('PB-05');
  });

  it('the playbook\'s none guard still vetoes a wired signal', () => {
    const guarded = cascade().map((p) =>
      p.code === 'PB-03'
        ? { ...p, matchingRules: rules({ any: p.matchingRules.any, none: ['RA_BBB_GRADE_SUPPRESSION'], confidence: 0.7 }) }
        : p,
    );
    const { playbooks: augmented } = applySignalPlaybookPreferences(
      guarded, ['INT_SEASONAL_CLOSURE', 'RA_BBB_GRADE_SUPPRESSION'], prefs,
    );
    // PB-04 wins on its own rules (crisis signal); PB-03 stays vetoed by
    // its none guard even though INT_SEASONAL_CLOSURE was wired in.
    const result = evaluateTriage(['INT_SEASONAL_CLOSURE', 'RA_BBB_GRADE_SUPPRESSION'], augmented);
    expect(result!.playbookCode).toBe('PB-04');
  });

  it('input playbook rows are not mutated', () => {
    const playbooks = cascade();
    const pb03Before = JSON.stringify(playbooks.find((p) => p.code === 'PB-03')!.matchingRules);
    applySignalPlaybookPreferences(playbooks, ['INT_SEASONAL_CLOSURE'], prefs);
    expect(JSON.stringify(playbooks.find((p) => p.code === 'PB-03')!.matchingRules)).toBe(pb03Before);
  });

  it('secondary preference alone does NOT join the any pool', () => {
    const secondaryOnly: SignalPlaybookPrefsMap = new Map([
      ['INT_FALLBACK_ONLY', { primary: null, secondary: 'PB-03' }],
    ]);
    const { playbooks: augmented, wired } = applySignalPlaybookPreferences(
      cascade(), ['INT_FALLBACK_ONLY'], secondaryOnly,
    );
    expect(wired.size).toBe(0);
    // No playbook's rules match the lone signal → evaluateTriage returns null.
    expect(evaluateTriage(['INT_FALLBACK_ONLY'], augmented)).toBeNull();
  });
});

// ─── preferenceFallbackRecommendation ────────────────────────────────────

describe('preferenceFallbackRecommendation — declared no-match route', () => {
  it('routes to the secondary playbook when no rules match', () => {
    const prefs = new Map([
      ['INT_FALLBACK_ONLY', { primary: null, secondary: 'PB-04' }],
    ]);
    const result = preferenceFallbackRecommendation(['INT_FALLBACK_ONLY'], cascade(), prefs);
    expect(result).not.toBeNull();
    expect(result!.playbookCode).toBe('PB-04');
    expect(result!.reasoning).toContain('preference route');
    expect(result!.reasoning).toContain('INT_FALLBACK_ONLY');
    const sig = result!.detectedSignals.find((s) => s.code === 'INT_FALLBACK_ONLY');
    expect(sig!.contributedToRule).toBe(true);
  });

  it('primary preference outranks secondary preference from another signal', () => {
    const prefs = new Map([
      ['INT_STRONG', { primary: 'PB-04', secondary: null }],
      ['INT_WEAK', { primary: null, secondary: 'PB-03' }],
    ]);
    // PB-05 is dual-only → ineligible; PB-04 any-augmented would have matched
    // in the cascade, so in a live flow we wouldn't reach the fallback — but
    // the weight ordering is still pinned for non-augmentable targets.
    const result = preferenceFallbackRecommendation(['INT_STRONG', 'INT_WEAK'], cascade(), prefs);
    expect(result!.playbookCode).toBe('PB-04');
  });

  it('honors the target playbook\'s none guard (veto beats preference)', () => {
    const prefs = new Map([
      ['INT_BLOCKED', { primary: null, secondary: 'PB-05' }],
      ['INT_OPEN', { primary: null, secondary: 'PB-03' }],
    ]);
    // INT_BLOCKED prefers dual-guarded PB-05 → ineligible (all/dual can't be
    // satisfied by a lone signal). INT_OPEN's secondary → PB-03 wins.
    const result = preferenceFallbackRecommendation(['INT_BLOCKED', 'INT_OPEN'], cascade(), prefs);
    expect(result!.playbookCode).toBe('PB-03');
  });

  it('skips playbooks with all/dual conjunctions a lone signal cannot satisfy', () => {
    const prefs = new Map([
      ['INT_DUAL_LEAN', { primary: null, secondary: 'PB-05' }],
    ]);
    expect(preferenceFallbackRecommendation(['INT_DUAL_LEAN'], cascade(), prefs)).toBeNull();
  });

  it('skips inactive preferred playbooks', () => {
    const prefs = new Map([
      ['INT_FALLBACK_ONLY', { primary: null, secondary: 'PB-04' }],
    ]);
    const inactive = cascade().map((p) => p.code === 'PB-04' ? { ...p, isActive: false } : p);
    expect(preferenceFallbackRecommendation(['INT_FALLBACK_ONLY'], inactive, prefs)).toBeNull();
  });

  it('none-guard violation makes the target ineligible', () => {
    const prefs = new Map([
      ['INT_FALLBACK_ONLY', { primary: null, secondary: 'PB-05' }],
    ]);
    // PB-05 has none: [RA_BBB_GRADE_SUPPRESSION] — the crisis signal vetoes
    // the preference route even though PB-05 is dual-guarded too.
    const result = preferenceFallbackRecommendation(
      ['INT_FALLBACK_ONLY', 'RA_BBB_GRADE_SUPPRESSION'], cascade(), prefs,
    );
    expect(result).toBeNull();
  });

  it('OX_* outreach-state signals never carry preference weight', () => {
    const prefs = new Map([
      ['OX_OPENER_SENT', { primary: null, secondary: 'PB-04' }],
    ]);
    expect(preferenceFallbackRecommendation(['OX_OPENER_SENT'], cascade(), prefs)).toBeNull();
  });

  it('returns null when no detected signal declares a preference', () => {
    expect(preferenceFallbackRecommendation(['WC_MISSING_CTA'], cascade(), new Map())).toBeNull();
  });
});
