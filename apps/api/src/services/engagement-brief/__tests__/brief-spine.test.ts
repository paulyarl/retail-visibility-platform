/**
 * Brief spine — consumer-layer behavior pins.
 *
 * Covers the two behaviors that make persisted v1 (model-emitted) briefs
 * consumable under the v2 projection contract:
 *   - hydrateLegacySpine borrows spoken lines (hook/regular/fix) + domain
 *     from the source audit's outreach_problems — fill-only, domain-gated
 *   - applyArchetypeOverlay reorders by domain when `domain` is absent
 *     (classified on the fly) and re-points primary_hook_ref
 */

import { describe, it, expect } from 'vitest';
import { hydrateLegacySpine, applyArchetypeOverlay, spineToAmmunition } from '../brief-spine';

const V1_PAIN = {
  ref_id: 'p1',
  severity: 'high',
  confidence: 'verified_on_surface',
  visibility: 'client_safe',
  evidence_ref: 'e_p1',
  business_consequence:
    'Six hundred customers reviewed the store and every reader sees complaints with no reply — the newest review is a 1-star accusation sitting unanswered.',
};

const AUDIT_PROBLEMS = [
  {
    problem: 'Google reviews accumulate with zero responses — 600 reviews, 0% response rate',
    hook: 'Your newest Google review is a 1-star accusation with no reply.',
    regular: 'Your profile has 600 reviews and no management responses.',
    solution: 'A review-response routine.',
    outreach_use: 'lead with the unanswered-review count',
  },
  {
    problem: 'No website — the Google profile has no website field',
    hook: 'Shoppers cannot see your departments before driving over.',
    regular: 'There is no website on the profile.',
    solution: 'A single-page storefront site.',
  },
];

describe('hydrateLegacySpine (v1 → v2 projection backfill)', () => {
  const v1Spine = {
    brief_version: 1,
    pains: [V1_PAIN],
    engagement_shape: { lead_with: 'pain', do_not_claim: ['never claim X'] },
  };

  it('borrows hook/regular/fix from the domain-matching outreach problem', () => {
    const hydrated = hydrateLegacySpine(v1Spine, { outreach_problems: AUDIT_PROBLEMS });
    const p = hydrated.pains[0];
    expect(p.hook).toContain('1-star');
    expect(p.regular).toContain('600 reviews');
    expect(p.fix).toContain('review-response');
    expect(p.domain).toBe('review');
    // v1 fields untouched
    expect(p.business_consequence).toBe(V1_PAIN.business_consequence);
  });

  it('does not cross domains — a website pain borrows nothing from review problems', () => {
    const webPain = {
      ...V1_PAIN,
      ref_id: 'p2',
      business_consequence: 'The profile has no website field — shoppers cannot browse departments before driving over.',
    };
    const hydrated = hydrateLegacySpine(
      { ...v1Spine, pains: [webPain] },
      { outreach_problems: [AUDIT_PROBLEMS[0]] }, // review-only problems
    );
    expect(hydrated.pains[0].hook).toBeUndefined();
    expect(hydrated.pains[0].domain).toBe('website');
  });

  it('leaves v2 rows and already-hydrated fields alone', () => {
    const v2 = { evidence_fingerprint: 'abc', pains: [V1_PAIN] };
    expect(hydrateLegacySpine(v2, { outreach_problems: AUDIT_PROBLEMS })).toBe(v2);
    const withHook = { pains: [{ ...V1_PAIN, hook: 'existing' }] };
    expect(hydrateLegacySpine(withHook, { outreach_problems: AUDIT_PROBLEMS }).pains[0].hook).toBe('existing');
  });

  it('hydrated v1 pains project full ammunition rows', () => {
    const hydrated = hydrateLegacySpine(v1Spine, { outreach_problems: AUDIT_PROBLEMS });
    const ammo = spineToAmmunition(hydrated);
    expect(ammo).toHaveLength(1);
    expect(ammo[0].problem).toContain('Six hundred');
    expect(ammo[0].hook).toContain('1-star');
  });
});

describe('applyArchetypeOverlay on legacy rows', () => {
  it('classifies domain on the fly and reorders for the archetype', () => {
    const spine = {
      pains: [
        { ref_id: 'p1', business_consequence: 'No website — shoppers cannot browse departments.', severity: 'high' },
        { ref_id: 'p2', business_consequence: '600 reviews with zero responses on Google.', severity: 'medium' },
      ],
      capability_fits: [
        { capability: 'review_response', addresses_ref: 'p2' },
        { capability: 'websites', addresses_ref: 'p1' },
      ],
      engagement_shape: { primary_hook_ref: 'p1', lead_with: 'pain' },
    };
    const overlaid = applyArchetypeOverlay(spine as any, 'A2'); // review lane
    expect(overlaid.pains[0].ref_id).toBe('p2'); // review pain leads
    expect(overlaid.engagement_shape.primary_hook_ref).toBe('p2');
    // fits follow their addressed pain's rank
    expect(overlaid.capability_fits[0].capability).toBe('review_response');
    // canonical spine untouched
    expect(spine.pains[0].ref_id).toBe('p1');
  });
});
