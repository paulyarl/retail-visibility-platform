/**
 * Brief assembler — deterministic fragment folding + rank reconciliation.
 *
 * Spec: docs/LocalBiz/ENGAGEMENT_BRIEF_SPINE_SPRINT_PLAN.md (Phase 1, D1–D5)
 *
 * Pinned behavior:
 *   - fragment → spine mapping per field family (gaps/outreach_problems/
 *     themes → pains, observed_assets → assets, opportunities/services/
 *     attributes → fits, data_quality + verify_* attributes → gates)
 *   - the golden ordering: the audit's top-ranked problem (unanswered
 *     reviews) > non_negotiable gaps (missing website) > recommended items
 *     (Yelp split) — stable across re-runs, zero model calls
 *   - provenance: every row carries source_fragment + evidence_index refs
 *   - fingerprint: identical inputs hash identically; any fragment change
 *     flips it (the D4 staleness check)
 */

import { describe, it, expect } from 'vitest';
import {
  assembleEngagementBrief,
  classifyDomain,
  computeEvidenceFingerprint,
  resolveAuditPath,
  BRIEF_INPUT_FIELDS,
} from '../brief-assembler';

// ─── Golden fixture — Viet Hua Madison Ave shape (8031 Madison Ave) ─────
// The proving-ground audit shape: 600 reviews / 0% observable response rate,
// no Google website field, split Yelp identity, underexposed counters.

const VIET_HUA_AUDIT = {
  detected_signals: [
    'RA_UNADDRESSED_NEGATIVE_BACKLOG',
    'WC_MISSING_WEBSITE',
    'DS_BROKEN_PROFILE_LINK',
  ],
  gap_analysis: {
    gaps: [
      {
        platform: 'google',
        field: 'website_present',
        expected: true,
        actual: false,
        gap_description: 'No website field on the Google profile',
        severity: 'non_negotiable',
      },
      {
        platform: 'yelp',
        field: 'listing_consistency',
        expected: 'single listing',
        actual: 'duplicate listings',
        gap_description: 'Two Yelp pages at the same address split review equity',
        severity: 'recommended',
      },
    ],
  },
  negative_review_themes: [
    {
      theme: 'counter service and communication complaints',
      observed_frequency: 'recurring',
      supporting_review_count: 4,
      summary: 'Multiple recent reviews describe counter-service issues.',
    },
    {
      theme: 'possible expired products',
      observed_frequency: 'isolated',
      supporting_review_count: 2,
      summary: 'A small number of reviews allege expired products.',
    },
  ],
  outreach_problems: [
    {
      problem:
        'Hundreds of reviews — including a fresh 1-star accusation at the meat counter — sit unanswered',
      regular: 'Your Google profile has 600 reviews and none of the recent ones have a response.',
      hook: 'Your newest review is a 1-star meat-counter accusation with no reply.',
      solution: 'A review-response routine that answers the newest reviews first.',
      evidence: 'google — 0 of the latest 20 observable reviews have a response',
      outreach_use: 'cold-call opener',
    },
    {
      problem: 'There is no website on the Google profile — the only paths are call or walk in',
      regular: 'Your Google listing has no website button.',
      hook: 'Customers who want to see what you carry hit a dead end.',
      solution: 'A Madison location page on the existing brand domain.',
      evidence: 'google — website field absent',
      outreach_use: 'second point',
    },
    {
      problem: 'Two Yelp listings exist for the same address, splitting the review record',
      regular: 'You have two Yelp pages for the Madison store.',
      hook: 'Your reviews are split across two listings.',
      solution: 'Claim and merge the duplicate Yelp listing.',
      evidence: 'yelp — two listings at 8031 Madison Ave',
      outreach_use: 'objection response',
    },
  ],
  observed_assets: [
    {
      asset: '600-review Google profile at 4.4 stars',
      evidence: 'google rating widget',
      observed_on: 'google',
      confidence: 'verified_on_surface',
      underexposed: false,
    },
    {
      asset: 'live seafood and goat-meat counters',
      evidence: 'review mentions and photos',
      observed_on: 'google',
      confidence: 'verified_on_surface',
      underexposed: true,
    },
    {
      asset: 'community Facebook page',
      evidence: 'page exists; content not rendered',
      observed_on: 'facebook',
      confidence: 'inferred',
      underexposed: false,
    },
  ],
  market_opportunities: [
    {
      title: 'Review response program',
      description: 'Answering the newest reviews first converts the review volume into visible engagement.',
      impact: 'HIGH',
    },
    {
      title: 'Location page on the brand domain',
      description: 'A Madison-specific page gives the listing a real destination.',
      impact: 'HIGH',
    },
    {
      title: 'Directory cleanup',
      description: 'Consolidating the Yelp listings restores a single review surface.',
      impact: 'MEDIUM',
    },
  ],
  recommended_services: ['review response management', 'directory listing cleanup'],
  recommended_attributes: [
    { key: 'snap_ebt', label: 'SNAP/EBT accepted', platform: 'google', current_state: 'verify_with_owner' },
    { key: 'outdoor_seating', label: 'Outdoor seating', platform: 'google', current_state: 'not_observed' },
  ],
  combined_review_metrics: {
    observable_review_sample_size: 20,
    observable_owner_response_rate: 0,
  },
  data_quality: {
    confidence: 'high',
    verified_fields: ['google.rating', 'google.hours'],
    unavailable_fields: ['google.website', 'yelp.live_metrics'],
    conflicts: ['yelp listing identity — two pages at one address'],
    limitations: ['Yelp direct rendering returned 403 — metrics from syndicated captures only'],
  },
  alignment_scoring: { primary_outreach_hook: 'Unanswered reviews at a 600-review surface' },
  digital_opportunity_score: {
    score: 72,
    components: { unanswered_negative_reviews: 30, website_opportunity: 20 },
  },
  high_attention: true,
};

// ─── Assembly ────────────────────────────────────────────────────────────

describe('assembleEngagementBrief — fragment folding', () => {
  const brief = assembleEngagementBrief(VIET_HUA_AUDIT);

  it('emits the golden ordering — reviews > website > Yelp split', () => {
    expect(brief.pains.length).toBeGreaterThanOrEqual(3);
    // p1 — the audit's top outreach problem (unanswered reviews).
    expect(brief.pains[0].domain).toBe('review');
    expect(brief.pains[0].business_consequence).toMatch(/reviews/i);
    // p2 — non_negotiable gap (no website), merged with outreach_problems[1].
    expect(brief.pains[1].domain).toBe('website');
    // p3 — Yelp split (recommended-severity tier, outreach-ordered).
    expect(brief.pains[2].domain).toBe('directory');
  });

  it('resolves primary_hook_ref mechanically to pains[0]', () => {
    expect(brief.engagement_shape.primary_hook_ref).toBe(brief.pains[0].ref_id);
    expect(brief.engagement_shape.lead_with).toBe('pain');
  });

  it('carries spoken lines verbatim onto pain rows', () => {
    expect(brief.pains[0].regular).toContain('600 reviews');
    expect(brief.pains[0].hook).toContain('1-star');
    expect(brief.pains[0].fix).toContain('review-response');
  });

  it('folds negative themes into the review pain as supporting evidence', () => {
    const reviewPain = brief.pains[0];
    expect(reviewPain.supporting_refs).toBeDefined();
    const supportPaths = reviewPain.supporting_refs!.map((r) => brief.evidence_index[r]);
    expect(supportPaths).toContain('negative_review_themes[0]');
    expect(supportPaths).toContain('negative_review_themes[1]');
  });

  it('merges the website outreach problem into its non_negotiable gap', () => {
    const websitePain = brief.pains[1];
    expect(websitePain.source_fragment).toBe('gap_analysis.gaps[0]');
    expect(websitePain.severity).toBe('high');
    const supportPaths = websitePain.supporting_refs!.map((r) => brief.evidence_index[r]);
    expect(supportPaths).toContain('outreach_problems[1]');
    expect(brief.assembly_notes.merged_outreach_problems).toBeGreaterThanOrEqual(1);
  });

  it('emits every evidence_index path that rows cite — no dangling refs', () => {
    for (const item of [...brief.pains, ...brief.assets]) {
      expect(brief.evidence_index[item.evidence_ref]).toBeDefined();
      for (const sref of item.supporting_refs ?? []) {
        expect(brief.evidence_index[sref]).toBeDefined();
      }
    }
    // And every cited path actually resolves against the source audit.
    for (const path of Object.values(brief.evidence_index)) {
      expect(resolveAuditPath(VIET_HUA_AUDIT, path)).not.toBeUndefined();
    }
  });

  it('maps observed_assets to ranked asset rows with use guidance', () => {
    expect(brief.assets).toHaveLength(3);
    // Underexposed verified assets sort first — the opportunity signal —
    // then verified lead assets, then unverified ones last.
    expect(brief.assets[0].how_to_use).toBe('leverage it');
    expect(brief.assets[0].underexposure).toBe(true);
    expect(brief.assets[1].how_to_use).toBe('lead with it');
    expect(brief.assets[2].confidence).toBe('inferred');
    expect(brief.assets[2].how_to_use).toMatch(/leave alone/);
  });

  it('maps opportunities/services/enableable attributes to capability_fits', () => {
    const caps = brief.capability_fits.map((c) => c.capability);
    expect(caps).toContain('Review response program');
    expect(caps).toContain('review response management');
    expect(caps.some((c) => c.includes('Outdoor seating'))).toBe(true);
    // HIGH-impact fits sort first.
    expect(brief.capability_fits[0].confidence).toBe('high');
    // Review-domain fit addresses the top (review) pain.
    const reviewFit = brief.capability_fits.find((c) => c.capability === 'Review response program');
    expect(reviewFit?.addresses_ref).toBe(brief.pains[0].ref_id);
  });

  it('routes verify_with_owner/unverifiable attributes to gates, not fits', () => {
    const ebtGate = brief.verification_gates.find((g) => g.gate.includes('SNAP/EBT'));
    expect(ebtGate).toBeDefined();
    expect(ebtGate!.who_can_answer).toBe('owner');
    expect(ebtGate!.status).toBe('pending');
    // not_observed is enableable now — a fit, not a gate.
    expect(brief.capability_fits.some((c) => c.capability.includes('Outdoor seating'))).toBe(true);
  });

  it('orders gates operator-clearable first — owner questions last', () => {
    const whoOrder = brief.verification_gates.map((g) => g.who_can_answer);
    const firstOwnerIdx = whoOrder.indexOf('owner');
    expect(whoOrder.slice(0, firstOwnerIdx)).not.toContain('owner');
    // unavailable_fields → operator gates; conflict → owner gate.
    expect(brief.verification_gates.some((g) => g.gate.includes('google.website'))).toBe(true);
    expect(
      brief.verification_gates.some((g) => g.gate.includes('yelp listing identity')),
    ).toBe(true);
  });

  it('emits mechanical do_not_claim guardrails from data_quality', () => {
    const dnc = brief.engagement_shape.do_not_claim;
    expect(dnc.some((d) => d.includes('google.website') && d.includes('not measured'))).toBe(true);
    expect(dnc.some((d) => d.includes('conflicting evidence'))).toBe(true);
    expect(dnc.some((d) => d.includes('review allegations'))).toBe(true);
    expect(dnc.some((d) => d.includes('observable-sample'))).toBe(true);
    expect(dnc.some((d) => d.includes('syndicated or gated-platform'))).toBe(true);
  });

  it('is deterministic — same audit in, identical spine out', () => {
    expect(assembleEngagementBrief(VIET_HUA_AUDIT)).toEqual(brief);
  });

  it('emits an empty-but-valid spine for a thin audit', () => {
    const thin = assembleEngagementBrief({ detected_signals: [] });
    expect(thin.pains).toEqual([]);
    expect(thin.engagement_shape.primary_hook_ref).toBeNull();
    expect(thin.engagement_shape.lead_with).toBe('asset');
    expect(thin.assembly_notes.uncovered_slots).toContain('pains');
  });
});

// ─── Reconciliation edge cases ───────────────────────────────────────────

describe('assembleEngagementBrief — reconciliation', () => {
  it('a theme-only audit emits a theme-backed review pain at the theme tier', () => {
    const audit = {
      negative_review_themes: [
        { theme: 'cold food', summary: 'Reviews complain about cold food.' },
      ],
    };
    const brief = assembleEngagementBrief(audit);
    expect(brief.pains[0].domain).toBe('review');
    expect(brief.pains[0].severity).toBe('high'); // theme-backed tier
    expect(brief.assembly_notes.standalone_theme_pains).toBe(1);
  });

  it('recommended gaps rank below the audit top problem even without themes', () => {
    const audit = {
      gap_analysis: {
        gaps: [
          { field: 'photo_count', expected: 20, actual: 3, gap_description: 'Thin photos', severity: 'recommended' },
        ],
      },
      outreach_problems: [
        { problem: 'No website on the listing', regular: 'r', hook: 'h', solution: 's', evidence: 'e', outreach_use: 'u' },
      ],
    };
    const brief = assembleEngagementBrief(audit);
    expect(brief.pains[0].domain).toBe('website');
    expect(brief.pains[1].domain).toBe('photos');
  });

  it('a claim-state signal emits the GBP claim gate', () => {
    const brief = assembleEngagementBrief({ detected_signals: ['DS_CLAIMED_STATUS'] });
    expect(brief.verification_gates.some((g) => g.gate.includes('claim/management state'))).toBe(true);
  });
});

// ─── Fingerprint + path resolution ───────────────────────────────────────

describe('computeEvidenceFingerprint', () => {
  it('is stable for identical inputs', () => {
    expect(computeEvidenceFingerprint(VIET_HUA_AUDIT)).toBe(
      computeEvidenceFingerprint(JSON.parse(JSON.stringify(VIET_HUA_AUDIT))),
    );
  });

  it('changes when any read field changes', () => {
    const changed = JSON.parse(JSON.stringify(VIET_HUA_AUDIT));
    changed.outreach_problems[0].problem = 'different';
    expect(computeEvidenceFingerprint(changed)).not.toBe(
      computeEvidenceFingerprint(VIET_HUA_AUDIT),
    );
  });

  it('ignores fields outside BRIEF_INPUT_FIELDS', () => {
    const changed = JSON.parse(JSON.stringify(VIET_HUA_AUDIT));
    changed.some_unrelated_field = { noise: true };
    expect(computeEvidenceFingerprint(changed)).toBe(
      computeEvidenceFingerprint(VIET_HUA_AUDIT),
    );
  });

  it('covers exactly the assembler read manifest', () => {
    expect(BRIEF_INPUT_FIELDS).toContain('gap_analysis');
    expect(BRIEF_INPUT_FIELDS).toContain('outreach_problems');
    expect(BRIEF_INPUT_FIELDS).toContain('detected_signals');
  });
});

describe('resolveAuditPath', () => {
  it('resolves nested and indexed paths', () => {
    expect(resolveAuditPath(VIET_HUA_AUDIT, 'gap_analysis.gaps[0].severity')).toBe('non_negotiable');
    expect(resolveAuditPath(VIET_HUA_AUDIT, 'outreach_problems[2]')).toEqual(
      VIET_HUA_AUDIT.outreach_problems[2],
    );
  });

  it('returns undefined for paths that do not resolve', () => {
    expect(resolveAuditPath(VIET_HUA_AUDIT, 'gap_analysis.gaps[99]')).toBeUndefined();
    expect(resolveAuditPath(VIET_HUA_AUDIT, 'no.such.path')).toBeUndefined();
    expect(resolveAuditPath(null, 'anything')).toBeUndefined();
  });
});

describe('classifyDomain', () => {
  it('scores whole text — yelp+listing wins over a stray "review"', () => {
    expect(
      classifyDomain('Two Yelp listings at the same address split the review record'),
    ).toBe('directory');
  });
  it('review vocabulary wins for review-dense text', () => {
    expect(classifyDomain('600 reviews sit unanswered — no responses')).toBe('review');
  });
  it('empty text is other', () => {
    expect(classifyDomain('')).toBe('other');
    expect(classifyDomain(null)).toBe('other');
  });
});
