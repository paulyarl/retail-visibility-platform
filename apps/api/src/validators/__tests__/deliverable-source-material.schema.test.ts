/**
 * Unit tests for the deliverable source-material + review-intake schemas and
 * their OUTPUT_SCHEMA_REGISTRY registration.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §4
 */

import { describe, it, expect } from 'vitest';
import {
  deliverableSourceMaterialSchema,
  DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME,
} from '../deliverable-source-material.schema';
import {
  reviewIntakeSchema,
  REVIEW_INTAKE_SCHEMA_NAME,
} from '../review-intake.schema';
import { resolveOutputSchema } from '../market-analysis.schema';

describe('deliverableSourceMaterialSchema', () => {
  it('parses a single populated block with the rest null', () => {
    const valid = {
      signals_consumed: ['CP_NAP_PHONE_DRIFT'],
      deliverable_sources: {
        nap_report: {
          canonical: { name: 'Acme', address: '1 Main St', phone: '555-0100' },
          platform_status: [
            { platform: 'google', phone: '555-0100', status: 'consistent' },
            { platform: 'yelp', phone: '555-0199', status: 'drift' },
          ],
          material_issues: ['Yelp phone differs'],
        },
        review_responses: null,
        testimonial_cards: null,
        service_menu: null,
        gbp_audit: null,
        seo_content: null,
        lead_magnet: null,
        product_visibility_preview: null,
      },
      data_quality: { verified_fields: ['nap_consistency'], unavailable_fields: [], limitations: [] },
    };
    const result = deliverableSourceMaterialSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects a review_responses block whose review lacks text', () => {
    const invalid = {
      signals_consumed: [],
      deliverable_sources: {
        review_responses: { reviews: [{ platform: 'google', rating: 1 }] },
      },
    };
    expect(deliverableSourceMaterialSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts an empty deliverable_sources object', () => {
    const result = deliverableSourceMaterialSchema.safeParse({
      signals_consumed: [],
      deliverable_sources: {},
    });
    expect(result.success).toBe(true);
  });
});

describe('reviewIntakeSchema', () => {
  it('parses reviews with optional fields absent', () => {
    const result = reviewIntakeSchema.safeParse({
      reviews: [{ text: 'Great service, fast turnaround.' }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reviews[0].text).toBe('Great service, fast turnaround.');
  });

  it('defaults reviews to an empty array', () => {
    const result = reviewIntakeSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reviews).toEqual([]);
  });
});

describe('OUTPUT_SCHEMA_REGISTRY registration', () => {
  it('registers deliverable_source_material as a non-audit schema', () => {
    const entry = resolveOutputSchema(DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME);
    expect(entry).not.toBeNull();
    expect(entry?.auditPlatform).toBeNull();
    expect(typeof entry?.promptSuffix).toBe('string');
  });

  it('registers review_intake as a non-audit schema', () => {
    const entry = resolveOutputSchema(REVIEW_INTAKE_SCHEMA_NAME);
    expect(entry).not.toBeNull();
    expect(entry?.auditPlatform).toBeNull();
    expect(typeof entry?.promptSuffix).toBe('string');
  });
});
