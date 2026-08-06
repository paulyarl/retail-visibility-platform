/**
 * TriageEngineService co-occurrence test — Sprint 1 (Universal Recalibration)
 *
 * CRITICAL test: verifies the PB-07/PB-02 cascade fix. A product business
 * (grocery store) with BOTH low review volume (RA_LOW_REVIEW_VOLUME) AND a
 * missing product catalog (DS_MISSING_PRODUCT_CATALOG) must route to PB-07
 * (A6 Product Visibility), NOT PB-02 (A1 Review Gap).
 *
 * Without the PB-02 `none` extension (migration 171), PB-02 at rank 4 would
 * win over PB-07 at rank 5 because PB-02's `any` includes RA_LOW_REVIEW_VOLUME.
 * The `none` set extension with DS_MISSING_PRODUCT_CATALOG + WC_MISSING_PRODUCT_BROWSING
 * excludes PB-02 from matching when a product-visibility gap is present.
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 *       docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §6
 */

import { describe, it, expect } from 'vitest';
import { evaluateTriage, ruleMatches } from '../TriageEngineService';
import type { PlaybookCatalogRow, MatchingRules } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return { any: [], all: [], none: [], dual: null, confidence: 0.85, ...overrides };
}

function playbook(
  code: string,
  rank: number,
  archetype: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6',
  matchingRules: MatchingRules,
  overrides: Partial<PlaybookCatalogRow> = {},
): PlaybookCatalogRow {
  return {
    id: `pbk-${code.toLowerCase()}`,
    code: code as any,
    name: `Playbook ${code}`,
    category: 'triage_management',
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
 * The post-Sprint-1 7-playbook cascade (migration 171), in priority_rank order:
 *   PB-04=1, PB-05=2, PB-01=3, PB-02=4, PB-07=5, PB-06=6, PB-03=7
 *
 * PB-02's `none` set now includes DS_MISSING_PRODUCT_CATALOG and
 * WC_MISSING_PRODUCT_BROWSING (the cascade fix).
 */
function sprint1Cascade(): PlaybookCatalogRow[] {
  return [
    // PB-04 — BBB emergency (rank 1)
    playbook('PB-04', 1, 'A2', rules({
      any: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      confidence: 0.95,
    })),
    // PB-05 — dual triage (rank 2)
    playbook('PB-05', 2, 'A5', rules({
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
      dual: {
        groupA: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_URL_MISMATCH', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
        groupB: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      },
      confidence: 0.90,
    })),
    // PB-01 — pure profile repair (rank 3)
    playbook('PB-01', 3, 'A3', rules({
      any: ['WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      confidence: 0.85,
    })),
    // PB-02 — pure review gap (rank 4) — WITH Sprint 1 none extension
    playbook('PB-02', 4, 'A1', rules({
      any: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      none: [
        'RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG',
        'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT',
        'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK',
        // Sprint 1 extension — prevents product businesses from misrouting to PB-02
        'DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING',
      ],
      confidence: 0.85,
    })),
    // PB-07 — product visibility (rank 5) — NEW in Sprint 1
    playbook('PB-07', 5, 'A6', rules({
      any: ['DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING', 'WC_MISSING_AVAILABILITY_INQUIRY', 'WC_MISSING_PICKUP_DELIVERY'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      confidence: 0.82,
    }), {
      previewDeliverableType: 'product_visibility_preview',
    }),
    // PB-06 — visual & asset refresh (rank 6, was 5)
    playbook('PB-06', 6, 'A3', rules({
      any: ['VP_MISSING_PROJECT_PHOTOS', 'VP_STALE_SOCIAL_ACTIVITY', 'DS_PHOTO_DEFICIT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'],
      confidence: 0.80,
    })),
    // PB-03 — fallback conversion gap (rank 7, was 6)
    playbook('PB-03', 7, 'A4', rules({
      any: ['WC_MISSING_CTA', 'WC_MISSING_SERVICE_PAGES', 'DS_MISSING_SERVICE_MENU', 'WC_MOBILE_FRICTION', 'WC_MISSING_WEBSITE'],
      confidence: 0.70,
    })),
  ];
}

// ─── CRITICAL co-occurrence test ─────────────────────────────────────────

describe('Sprint 1 — PB-07/PB-02 co-occurrence cascade fix', () => {
  const cascade = sprint1Cascade();

  it('CRITICAL: grocery store with low review volume + missing product catalog → PB-07 (not PB-02)', () => {
    // This is the Indianapolis African grocery store scenario:
    // - product business with no website → DS_MISSING_PRODUCT_CATALOG fires
    // - low review volume (<15) → RA_LOW_REVIEW_VOLUME fires
    // Without the PB-02 none extension, PB-02 (rank 4) would win.
    // With the extension, PB-02 is excluded and PB-07 (rank 5) wins.
    const signals = new Set(['RA_LOW_REVIEW_VOLUME', 'DS_MISSING_PRODUCT_CATALOG']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
    expect(rec.archetype).toBe('A6');
  });

  it('grocery store with review drought + missing product catalog → PB-07 (not PB-02)', () => {
    const signals = new Set(['RA_REVIEW_DROUGHT', 'DS_MISSING_PRODUCT_CATALOG']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
  });

  it('grocery store with product browsing gap + low review volume → PB-07', () => {
    const signals = new Set(['RA_LOW_REVIEW_VOLUME', 'WC_MISSING_PRODUCT_BROWSING']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
  });

  it('service business with only low review volume (no product gap) → PB-02 (unchanged)', () => {
    // Additive guarantee: service businesses without product-visibility codes
    // still route to PB-02 exactly as before Sprint 1.
    const signals = new Set(['RA_LOW_REVIEW_VOLUME']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-02');
    expect(rec.archetype).toBe('A1');
  });

  it('service business with review drought only → PB-02 (unchanged)', () => {
    const signals = new Set(['RA_REVIEW_DROUGHT']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-02');
  });

  it('product business with ONLY product-visibility codes (no review gap) → PB-07', () => {
    const signals = new Set(['DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
  });

  it('product business with availability inquiry gap only → PB-07', () => {
    const signals = new Set(['WC_MISSING_AVAILABILITY_INQUIRY']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
  });

  it('product business with pickup/delivery gap only → PB-07', () => {
    const signals = new Set(['WC_MISSING_PICKUP_DELIVERY']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-07');
  });
});

// ─── PB-07 none guard (BBB crisis wins) ──────────────────────────────────

describe('Sprint 1 — PB-07 none guard: BBB crisis still wins', () => {
  const cascade = sprint1Cascade();

  it('BBB grade suppression + product gap → PB-04 (not PB-07)', () => {
    const signals = new Set(['RA_BBB_GRADE_SUPPRESSION', 'DS_MISSING_PRODUCT_CATALOG']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-04');
  });

  it('unanswered complaints + product gap → PB-04 (not PB-07)', () => {
    const signals = new Set(['RA_UNANSWERED_COMPLAINTS', 'WC_MISSING_PRODUCT_BROWSING']);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-04');
  });
});

// ─── PB-07 vs PB-05 (dual triage) ────────────────────────────────────────

describe('Sprint 1 — PB-05 dual triage still wins over PB-07 when both fire', () => {
  const cascade = sprint1Cascade();

  it('NAP drift + review drought + product gap → PB-05 (dual, rank 2)', () => {
    const signals = new Set([
      'CP_NAP_NAME_DRIFT', 'RA_REVIEW_DROUGHT', 'DS_MISSING_PRODUCT_CATALOG',
    ]);
    const rec = evaluateTriage(signals, cascade);
    expect(rec.playbookCode).toBe('PB-05');
    expect(rec.archetype).toBe('A5');
  });
});

// ─── ruleMatches unit test for PB-02 none extension ──────────────────────

describe('Sprint 1 — ruleMatches: PB-02 none extension', () => {
  const pb02Rules = rules({
    any: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME'],
    none: [
      'RA_BBB_GRADE_SUPPRESSION', 'DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING',
    ],
  });

  it('PB-02 matches when only RA_LOW_REVIEW_VOLUME is present', () => {
    expect(ruleMatches(pb02Rules, new Set(['RA_LOW_REVIEW_VOLUME']))).toBe(true);
  });

  it('PB-02 does NOT match when DS_MISSING_PRODUCT_CATALOG is also present', () => {
    expect(ruleMatches(pb02Rules, new Set(['RA_LOW_REVIEW_VOLUME', 'DS_MISSING_PRODUCT_CATALOG']))).toBe(false);
  });

  it('PB-02 does NOT match when WC_MISSING_PRODUCT_BROWSING is also present', () => {
    expect(ruleMatches(pb02Rules, new Set(['RA_REVIEW_DROUGHT', 'WC_MISSING_PRODUCT_BROWSING']))).toBe(false);
  });
});
