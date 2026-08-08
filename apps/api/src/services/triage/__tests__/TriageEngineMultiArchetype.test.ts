/**
 * TriageEngineService — multi-archetype evaluateAllMatchingPlaybooks tests
 *
 * Tests the new evaluateAllMatchingPlaybooks function that returns ALL
 * matching playbooks (not just the first), ranked by priority_rank.
 * Used by CampaignTriageService.evaluateAllForCampaign to present
 * sibling-creation suggestions.
 *
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 * Sprint 1 — A1 (multi-archetype triage).
 */

import { describe, it, expect } from 'vitest';
import { evaluateTriage, evaluateAllMatchingPlaybooks } from '../TriageEngineService';
import type { PlaybookCatalogRow, MatchingRules } from '../types';

// ─── Test fixtures ───────────────────────────────────────────────────────

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return {
    any: [],
    all: [],
    none: [],
    dual: null,
    confidence: 0.85,
    ...overrides,
  };
}

function playbook(
  code: string,
  rank: number,
  archetype: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6',
  category: 'review_management' | 'recovery_management' | 'profile_repair' | 'triage_management',
  matchingRules: MatchingRules,
  overrides: Partial<PlaybookCatalogRow> = {},
): PlaybookCatalogRow {
  return {
    id: `pbk-${code.toLowerCase()}`,
    code: code as any,
    name: `Playbook ${code}`,
    category,
    archetype,
    archetypeLabel: `${archetype}_LABEL`,
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

/**
 * Post-migration-178 cascade (profile_repair recategorized):
 *   PB-04(1) A2 recovery_management
 *   PB-05(2) A5 triage_management
 *   PB-01(3) A3 profile_repair
 *   PB-02(4) A1 review_management
 *   PB-07(5) A6 profile_repair
 *   PB-06(6) A3 profile_repair
 *   PB-03(7) A4 profile_repair
 */
function postMigrationCascade(): PlaybookCatalogRow[] {
  return [
    playbook('PB-04', 1, 'A2', 'recovery_management', rules({
      any: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      confidence: 0.95,
    })),
    playbook('PB-05', 2, 'A5', 'triage_management', rules({
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
      dual: {
        groupA: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_URL_MISMATCH', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
        groupB: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      },
      confidence: 0.90,
    })),
    playbook('PB-01', 3, 'A3', 'profile_repair', rules({
      any: ['WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      confidence: 0.85,
    })),
    playbook('PB-02', 4, 'A1', 'review_management', rules({
      any: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
      confidence: 0.85,
    })),
    playbook('PB-07', 5, 'A6', 'profile_repair', rules({
      any: ['VP_MISSING_PROJECT_PHOTOS', 'VP_STALE_SOCIAL_ACTIVITY', 'DS_PHOTO_DEFICIT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
      confidence: 0.80,
    })),
    playbook('PB-06', 6, 'A3', 'profile_repair', rules({
      any: ['VP_MISSING_PROJECT_PHOTOS', 'VP_STALE_SOCIAL_ACTIVITY', 'DS_PHOTO_DEFICIT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
      confidence: 0.80,
    })),
    // PB-03 — fallback (empty any → matches everything)
    playbook('PB-03', 7, 'A4', 'profile_repair', rules({
      any: [],
      confidence: 0.70,
    })),
  ];
}

// ─── evaluateAllMatchingPlaybooks ────────────────────────────────────────

describe('evaluateAllMatchingPlaybooks — multi-archetype sibling suggestions', () => {
  it('returns all matching playbooks ranked by priority_rank', () => {
    const cascade = postMigrationCascade();
    // WC_MISSING_CTA matches only PB-03 (fallback with empty any)
    const matches = evaluateAllMatchingPlaybooks(['WC_MISSING_CTA'], cascade);
    expect(matches.length).toBe(1);
    expect(matches[0].playbookCode).toBe('PB-03');
  });

  it('returns multiple matches when signals satisfy multiple playbooks', () => {
    const cascade = postMigrationCascade();
    // NAP drift + review drought → PB-05 (dual) + PB-03 (fallback)
    // PB-01 and PB-02 are excluded by their none clauses
    const matches = evaluateAllMatchingPlaybooks(
      ['CP_NAP_NAME_DRIFT', 'RA_REVIEW_DROUGHT'],
      cascade,
    );
    const codes = matches.map((m) => m.playbookCode);
    expect(codes).toContain('PB-05');
    expect(codes).toContain('PB-03');
    expect(codes[0]).toBe('PB-05'); // winner is highest priority
  });

  it('first element equals evaluateTriage result (the winner)', () => {
    const cascade = postMigrationCascade();
    const signals = ['CP_NAP_NAME_DRIFT', 'RA_REVIEW_DROUGHT'];
    const winner = evaluateTriage(signals, cascade);
    const allMatches = evaluateAllMatchingPlaybooks(signals, cascade);
    expect(allMatches[0].playbookCode).toBe(winner!.playbookCode);
    expect(allMatches[0].confidence).toBe(winner!.confidence);
  });

  it('each match includes detectedSignals', () => {
    const cascade = postMigrationCascade();
    const matches = evaluateAllMatchingPlaybooks(['WC_MISSING_CTA'], cascade);
    expect(matches[0].detectedSignals).toBeDefined();
    expect(Array.isArray(matches[0].detectedSignals)).toBe(true);
  });

  it('returns empty array when no playbook matches', () => {
    const cascade = postMigrationCascade().filter((p) => p.code !== 'PB-03'); // remove fallback
    // Signals that don't match any remaining playbook
    const matches = evaluateAllMatchingPlaybooks(['UNKNOWN_SIGNAL'], cascade);
    expect(matches).toEqual([]);
  });

  it('skips inactive playbooks', () => {
    const cascade = postMigrationCascade();
    cascade[0].isActive = false; // deactivate PB-04
    const matches = evaluateAllMatchingPlaybooks(['RA_BBB_GRADE_SUPPRESSION'], cascade);
    expect(matches.find((m) => m.playbookCode === 'PB-04')).toBeUndefined();
  });

  it('preserves priority_rank ordering in results', () => {
    const cascade = postMigrationCascade();
    // Empty signals → only PB-03 (fallback) matches
    const matches = evaluateAllMatchingPlaybooks([], cascade);
    expect(matches.length).toBe(1);
    expect(matches[0].playbookCode).toBe('PB-03');
  });

  it('dual-trigger signals match PB-05 + PB-03 (fallback), not PB-01/PB-02', () => {
    const cascade = postMigrationCascade();
    const matches = evaluateAllMatchingPlaybooks(
      ['CP_NAP_NAME_DRIFT', 'RA_REVIEW_DROUGHT', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      cascade,
    );
    const codes = matches.map((m) => m.playbookCode);
    // PB-05 matches (dual with NAP + review signals, no BBB crisis)
    expect(codes).toContain('PB-05');
    // PB-01 excluded (none clause blocks on review signals)
    expect(codes).not.toContain('PB-01');
    // PB-02 excluded (none clause blocks on NAP signals)
    expect(codes).not.toContain('PB-02');
    // PB-03 fallback always matches
    expect(codes).toContain('PB-03');
  });

  it('profile_repair signals match PB-01 + PB-03 (fallback)', () => {
    const cascade = postMigrationCascade();
    const matches = evaluateAllMatchingPlaybooks(['CP_NAP_NAME_DRIFT'], cascade);
    const codes = matches.map((m) => m.playbookCode);
    expect(codes).toContain('PB-01');
    expect(codes).toContain('PB-03');
    expect(matches[0].playbookCode).toBe('PB-01'); // winner
    expect(matches[0].category).toBe('profile_repair');
  });
});
