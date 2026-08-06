/**
 * Archetype selection + field extractor tests — Sprint 1 (Universal Recalibration)
 *
 * Verifies:
 *   - A6 (Product Visibility Gap) selection logic: fires for product/hybrid
 *     businesses with no website or no product browsing
 *   - A6 does NOT fire for service businesses (additive, non-breaking)
 *   - A6 priority: A2 > A1 > A6 > A3 > A4
 *   - extractA6Fields populates the A6Fields shape correctly
 *   - extractFields dispatcher routes A6 to extractA6Fields
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 */

import { describe, it, expect } from 'vitest';
import {
  selectArchetype,
  type BusinessAnalysisAuditData,
  type ArchetypeCode,
} from '../archetype-selection';
import {
  extractFields,
  extractA6Fields,
  type A6Fields,
  type CommonFields,
} from '../field-extractors';

// ─── Fixtures ────────────────────────────────────────────────────────────

const common: CommonFields = {
  business_name: 'Indy African Market',
  contact_name: 'Amara',
  tone: 'short informal',
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 555-0100',
  website_url: null,
};

function baseAudit(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: {
      google: {
        profile_status: 'claimed',
        rating: 4.2,
        total_reviews: 12,
        reviews_with_observable_response: 8,
        observable_unanswered_reviews: 4,
        observable_unanswered_negative_reviews: 1,
        observable_unanswered_positive_reviews: 3,
        observable_response_rate_percent: 67,
      },
    },
    combined_review_metrics: {
      observable_unanswered_reviews: 2,
      observable_unanswered_rate_percent: 5,
      observable_unanswered_negative_reviews: 0,
    },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
    ...overrides,
  };
}

// ─── A6 selection ────────────────────────────────────────────────────────

describe('Sprint 1 — selectArchetype: A6 Product Visibility Gap', () => {
  it('selects A6 for product business with no website', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: undefined,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A6');
    expect(sel.reason).toContain('product visibility gap');
  });

  it('selects A6 for hybrid business with website but no product browsing', () => {
    const audit = baseAudit({
      business_type: 'hybrid',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: false } as any,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A6');
  });

  it('does NOT select A6 for product business with website + product browsing', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: true } as any,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).not.toBe('A6');
  });

  it('does NOT select A6 for service business with no website (falls through to A3/A4/A1)', () => {
    const audit = baseAudit({
      business_type: 'service',
      website: undefined,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).not.toBe('A6');
  });

  it('does NOT select A6 when business_type is absent', () => {
    const audit = baseAudit({ website: undefined });
    const sel = selectArchetype(audit);
    expect(sel.archetype).not.toBe('A6');
  });
});

// ─── A6 priority in the cascade ──────────────────────────────────────────

describe('Sprint 1 — A6 priority: A2 > A1 > A6 > A3 > A4', () => {
  it('A2 beats A6: recurring-theme negatives win over product gap', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: undefined, // would trigger A6
      negative_review_themes: [
        { theme: 'Spoiled produce', summary: 'multiple reports', supporting_review_count: 5 },
      ],
      combined_review_metrics: {
        observable_unanswered_reviews: 10,
        observable_unanswered_rate_percent: 50,
        observable_unanswered_negative_reviews: 5,
      },
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A2');
  });

  it('A1 beats A6: high unanswered rate wins over product gap', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: undefined, // would trigger A6
      combined_review_metrics: {
        observable_unanswered_reviews: 20,
        observable_unanswered_rate_percent: 80,
        observable_unanswered_negative_reviews: 2,
      },
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A1');
  });

  it('A6 beats A3: product gap wins over listing drift', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: undefined, // triggers A6
      nap_consistency: {
        overall_status: 'minor_variations',
        name_variations: ['Indy African Market', 'Indy African Market LLC'],
      },
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A6');
  });

  it('A6 beats A4: product gap wins over CTA gap', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: false, call_to_action_present: 'no' } as any,
    });
    const sel = selectArchetype(audit);
    expect(sel.archetype).toBe('A6');
  });
});

// ─── extractA6Fields ─────────────────────────────────────────────────────

describe('Sprint 1 — extractA6Fields', () => {
  it('populates A6Fields with product-visibility data', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: {
        url: 'https://example.com',
        status: 'working',
        has_product_browsing: false,
        has_availability_inquiry: false,
        has_pickup_ordering: false,
        has_delivery_option: false,
        product_categories_visible: ['Grains', 'Spices'],
      } as any,
      platforms: {
        google: {
          ...baseAudit().platforms!.google!,
          photo_count: 3,
          photo_types: ['team', 'logo'],
        } as any,
      },
    });
    const fields = extractA6Fields(audit, common);
    expect(fields.business_type).toBe('product');
    expect(fields.has_website).toBe(true);
    expect(fields.has_product_browsing).toBe(false);
    expect(fields.has_availability_inquiry).toBe(false);
    expect(fields.has_pickup_option).toBe(false);
    expect(fields.has_delivery_option).toBe(false);
    expect(fields.photo_count).toBe(3);
    expect(fields.photo_types).toEqual(['team', 'logo']);
    expect(fields.missing_photo_types).toContain('storefront');
    expect(fields.missing_photo_types).toContain('product');
    expect(fields.product_categories_sample).toEqual(['Grains', 'Spices']);
  });

  it('defaults business_type to "product" when audit says "service" (defensive)', () => {
    const audit = baseAudit({ business_type: 'service' });
    const fields = extractA6Fields(audit, common);
    expect(fields.business_type).toBe('product');
  });

  it('defaults business_type to "product" when audit has no business_type', () => {
    const audit = baseAudit();
    const fields = extractA6Fields(audit, common);
    expect(fields.business_type).toBe('product');
  });

  it('preserves "hybrid" business_type', () => {
    const audit = baseAudit({ business_type: 'hybrid' });
    const fields = extractA6Fields(audit, common);
    expect(fields.business_type).toBe('hybrid');
  });
});

// ─── extractFields dispatcher ────────────────────────────────────────────

describe('Sprint 1 — extractFields dispatcher routes A6', () => {
  it('dispatches A6 to extractA6Fields', () => {
    const audit = baseAudit({
      business_type: 'product',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: false } as any,
    });
    const fields = extractFields('A6', audit, common);
    expect((fields as A6Fields).business_type).toBe('product');
    expect((fields as A6Fields).has_product_browsing).toBe(false);
  });

  it('A6 dispatcher result is an A6Fields (not A1Fields/A2Fields/etc.)', () => {
    const audit = baseAudit({ business_type: 'product' });
    const fields = extractFields('A6', audit, common) as A6Fields;
    expect(fields).toHaveProperty('has_product_browsing');
    expect(fields).toHaveProperty('has_availability_inquiry');
    expect(fields).toHaveProperty('missing_photo_types');
    // A1Fields would have unanswered_total, not these
    expect(fields).not.toHaveProperty('unanswered_total');
  });
});

// ─── ArchetypeCode type exhaustiveness ───────────────────────────────────

describe('Sprint 1 — ArchetypeCode includes A6', () => {
  it('A6 is a valid ArchetypeCode', () => {
    const code: ArchetypeCode = 'A6';
    expect(code).toBe('A6');
  });
});
