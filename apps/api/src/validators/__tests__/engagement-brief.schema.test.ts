/**
 * engagement_brief schema — the Pass-2 spine.
 *
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md
 * ("Brief shape"). Pins the field shapes, the two confidence vocabularies
 * (evidence tri-state on pains/assets vs high|medium|low on
 * capability_fits), the visibility enum, and the passthrough contract the
 * shared-schema convention requires.
 */

import { describe, it, expect } from 'vitest';
import {
  engagementBriefSchema,
  ENGAGEMENT_BRIEF_SCHEMA_NAME,
  ENGAGEMENT_BRIEF_PROMPT_SUFFIX,
} from '../engagement-brief.schema';
import { resolveOutputSchema } from '../market-analysis.schema';

const VALID_BRIEF = {
  brief_version: 1,
  source_audit_id: 'aud_abc123',
  business: { name: 'Dreamcast African Market', category: 'African Grocery Store', store_format: 'grocery' },
  side: {
    value: 'emerging',
    density_score: 9,
    inputs_used: ['channels_scanned[instagram].rendered'],
    classifier_version: 1,
  },
  evidence_index: {
    w1: 'website.issues[1]',
    a1: 'observed_assets[0]',
  },
  pains: [
    {
      ref_id: 'p1',
      severity: 'high',
      business_consequence: 'Customers cannot see what the store stocks before visiting.',
      evidence_ref: 'w1',
      confidence: 'verified_on_surface',
      visibility: 'internal',
    },
  ],
  assets: [
    {
      ref_id: 'a1',
      asset: 'Free delivery over $200',
      underexposure: true,
      how_to_use: 'leverage — the store already fulfils; the offer is just invisible',
      evidence_ref: 'a1',
      confidence: 'verified_on_surface',
      visibility: 'internal',
    },
  ],
  capability_fits: [
    {
      capability: 'hosted_storefront',
      addresses_ref: 'p1',
      why_it_fits: 'A hosted catalog surface makes the inventory browsable.',
      confidence: 'high',
      visibility: 'client_safe',
    },
  ],
  verification_gates: [
    {
      gate: 'Whether EBT can fund a deposit-first BOPIS flow',
      blocks: 'a1',
      who_can_answer: 'owner',
      visibility: 'internal',
    },
  ],
  engagement_shape: {
    primary_hook_ref: 'p1',
    lead_with: 'asset',
    do_not_claim: ['the old domain was hijacked', "we'll recover dreamcastmarket.com"],
  },
};

describe('engagementBriefSchema', () => {
  it('accepts the spec-shaped brief', () => {
    const r = engagementBriefSchema.safeParse(VALID_BRIEF);
    expect(r.success).toBe(true);
  });

  it('accepts the empty-brief shape (no source audit)', () => {
    const r = engagementBriefSchema.safeParse({
      business: { name: 'X' },
      evidence_index: {},
      pains: [],
      assets: [],
      capability_fits: [],
      verification_gates: [
        { gate: 'No Pass-1 audit exists', blocks: '', who_can_answer: 'operator' },
      ],
      engagement_shape: { primary_hook_ref: '', lead_with: 'pain', do_not_claim: [] },
    });
    expect(r.success).toBe(true);
  });

  it('accepts a bare object — everything optional at validator level', () => {
    expect(engagementBriefSchema.safeParse({}).success).toBe(true);
  });

  it('enforces the evidence confidence vocabulary on pains/assets', () => {
    const badPain = {
      ...VALID_BRIEF,
      pains: [{ ...VALID_BRIEF.pains[0], confidence: 'high' }],
    };
    expect(engagementBriefSchema.safeParse(badPain).success).toBe(false);

    const badAsset = {
      ...VALID_BRIEF,
      assets: [{ ...VALID_BRIEF.assets[0], confidence: 'medium' }],
    };
    expect(engagementBriefSchema.safeParse(badAsset).success).toBe(false);
  });

  it('enforces the judgment confidence vocabulary on capability_fits', () => {
    const bad = {
      ...VALID_BRIEF,
      capability_fits: [{ ...VALID_BRIEF.capability_fits[0], confidence: 'verified_on_surface' }],
    };
    expect(engagementBriefSchema.safeParse(bad).success).toBe(false);
  });

  it('enforces the visibility enum', () => {
    const bad = {
      ...VALID_BRIEF,
      pains: [{ ...VALID_BRIEF.pains[0], visibility: 'everyone' }],
    };
    expect(engagementBriefSchema.safeParse(bad).success).toBe(false);
  });

  it('enforces who_can_answer and severity enums', () => {
    const badGate = {
      ...VALID_BRIEF,
      verification_gates: [{ ...VALID_BRIEF.verification_gates[0], who_can_answer: 'anyone' }],
    };
    expect(engagementBriefSchema.safeParse(badGate).success).toBe(false);

    const badPain = {
      ...VALID_BRIEF,
      pains: [{ ...VALID_BRIEF.pains[0], severity: 'critical' }],
    };
    expect(engagementBriefSchema.safeParse(badPain).success).toBe(false);
  });

  it('rejects a side value outside the density vocabulary', () => {
    const bad = { ...VALID_BRIEF, side: { ...VALID_BRIEF.side, value: 'dense' } };
    expect(engagementBriefSchema.safeParse(bad).success).toBe(false);
  });

  it('passthrough preserves undeclared keys (shared-schema convention)', () => {
    const r = engagementBriefSchema.safeParse({ ...VALID_BRIEF, future_field: { x: 1 } });
    expect(r.success).toBe(true);
    expect((r as any).data.future_field).toEqual({ x: 1 });
  });

  it('coerces string booleans on underexposure', () => {
    const r = engagementBriefSchema.safeParse({
      ...VALID_BRIEF,
      assets: [{ ...VALID_BRIEF.assets[0], underexposure: 'true' }],
    });
    expect(r.success).toBe(true);
    expect((r as any).data.assets[0].underexposure).toBe(true);
  });
});

describe('engagement_brief registry entry', () => {
  it('resolves to the engagement_brief audit platform with a prompt suffix', () => {
    const resolved = resolveOutputSchema(ENGAGEMENT_BRIEF_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved!.auditPlatform).toBe('engagement_brief');
    expect(resolved!.promptSuffix).toBe(ENGAGEMENT_BRIEF_PROMPT_SUFFIX);
    expect(resolved!.validator.safeParse(VALID_BRIEF).success).toBe(true);
  });
});
