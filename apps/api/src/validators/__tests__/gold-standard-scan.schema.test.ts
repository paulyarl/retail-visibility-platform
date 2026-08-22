/**
 * Unit tests for Gold Standard Scan Schema (Gold Standard System — Sprint 0)
 *
 * Tests:
 *   - Schema validates a well-formed gold-standard scan output
 *   - Schema rejects missing category_key
 *   - Schema rejects invalid platform_focus
 *   - Schema accepts partial output (no expected_fields, no candidates)
 *   - Schema accepts candidates with platform_evaluations and branding artifacts
 *   - Schema is registered in OUTPUT_SCHEMA_REGISTRY
 *   - Registry entry has auditPlatform = 'gold_standard_scan'
 *   - Registry entry has a prompt suffix
 *   - profile_url is captured on platform evaluations
 *   - quality_gates use non_negotiable | recommended severity
 */

import { describe, it, expect } from 'vitest';
import {
  goldStandardScanSchema,
  GOLD_STANDARD_SCAN_SCHEMA_NAME,
  GOLD_STANDARD_SCAN_PROMPT_SUFFIX,
} from '../gold-standard-scan.schema';
import { resolveOutputSchema, OUTPUT_SCHEMA_REGISTRY } from '../market-analysis.schema';

describe('goldStandardScanSchema', () => {
  it('validates a well-formed establishment scan output', () => {
    const valid = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'google',
      expected_fields: {
        universal: {
          canonical_name: 'African Grocery Store',
          canonical_address: null,
          canonical_phone: null,
          hours_present: true,
          website_present: true,
          quality_gates: [
            { field: 'business_name', description: 'Canonical name', severity: 'non_negotiable' },
          ],
          fields: [
            { field: 'hours', description: 'Operating hours', severity: 'recommended' },
          ],
        },
        platforms: {
          google: {
            primary_category: 'African goods store',
            additional_categories: ['Grocery store', 'Butcher shop'],
            required_attributes: ['address', 'phone', 'hours'],
            expected_photo_count: 10,
            branding_expectations: {
              has_logo: true,
              has_cover_photo: true,
              photo_count: 10,
              photo_types: ['storefront', 'interior', 'product'],
            },
            quality_gates: [
              { field: 'primary_category', description: 'Correct GBP category', severity: 'non_negotiable' },
            ],
          },
        },
      },
      candidates: [
        {
          business_name: 'Afro Ethiopian Market',
          city: 'Kansas City',
          state: 'MO',
          nap: { name: 'Afro Ethiopian Market', address: '2408 NW Vivion Rd', phone: null },
          platform_evaluations: [
            {
              platform: 'google',
              profile_url: 'https://www.google.com/maps/place/Afro+Ethiopian+Market',
              quality_score: 8,
              quality_rationale: 'Strong profile with correct category and photos',
              is_gold_standard: true,
              branding_artifacts: {
                has_logo: true,
                has_cover_photo: true,
                photo_count: 12,
                photo_types: ['storefront', 'interior', 'product'],
              },
              quality_gates_passed: ['primary_category', 'address', 'hours'],
              quality_gates_failed: ['website'],
            },
          ],
          category_notes: 'Full butcher counter and spice selection',
        },
      ],
      scan_metadata: {
        scan_date: '2026-08-21',
        sources_consulted: ['Google Maps', 'Yelp', 'BBB'],
        selection_criteria: 'Top-rated businesses with complete profiles',
        platforms_evaluated: ['google'],
        expected_field_derivation: 'Derived from top 3 candidates',
        platform_focus: 'google',
      },
    };
    const result = goldStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing category_key', () => {
    const invalid = {
      category_name: 'African Grocery Store',
      platform_focus: 'google',
    };
    const result = goldStandardScanSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid platform_focus', () => {
    const invalid = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'tiktok',
    };
    const result = goldStandardScanSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts minimal output (no expected_fields, no candidates)', () => {
    const minimal = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'all',
    };
    const result = goldStandardScanSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts candidates without platform_evaluations', () => {
    const valid = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'all',
      candidates: [
        { business_name: 'Test Business', city: 'Kansas City' },
      ],
    };
    const result = goldStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts quality_gates with recommended severity', () => {
    const valid = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'google',
      expected_fields: {
        universal: {
          quality_gates: [
            { field: 'logo', description: 'Business logo', severity: 'recommended' },
          ],
        },
      },
    };
    const result = goldStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('allows passthrough fields (forward-compatible)', () => {
    const valid = {
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      platform_focus: 'google',
      future_field: 'some future extension',
      candidates: [
        { business_name: 'Test', future_candidate_field: true },
      ],
    };
    const result = goldStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('OUTPUT_SCHEMA_REGISTRY — gold_standard_scan registration', () => {
  it('is registered in the registry', () => {
    expect(OUTPUT_SCHEMA_REGISTRY[GOLD_STANDARD_SCAN_SCHEMA_NAME]).toBeDefined();
  });

  it('has auditPlatform = gold_standard_scan', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[GOLD_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.auditPlatform).toBe('gold_standard_scan');
  });

  it('has a non-empty prompt suffix', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[GOLD_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.promptSuffix).toBeTruthy();
    expect(entry!.promptSuffix.length).toBeGreaterThan(100);
  });

  it('has the goldStandardScanSchema validator', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[GOLD_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.validator).toBe(goldStandardScanSchema);
  });

  it('is resolvable via resolveOutputSchema', () => {
    const resolved = resolveOutputSchema(GOLD_STANDARD_SCAN_SCHEMA_NAME);
    expect(resolved).toBeDefined();
    expect(resolved?.validator).toBe(goldStandardScanSchema);
  });
});

describe('GOLD_STANDARD_SCAN_PROMPT_SUFFIX', () => {
  it('mentions profile_url as a required field', () => {
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('profile_url');
  });

  it('mentions quality_gates with severity', () => {
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('non_negotiable');
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('recommended');
  });

  it('mentions branding_artifacts', () => {
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('branding_artifacts');
  });

  it('mentions is_gold_standard flag', () => {
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('is_gold_standard');
  });

  it('mentions up to 4 candidates per platform', () => {
    expect(GOLD_STANDARD_SCAN_PROMPT_SUFFIX).toContain('4');
  });
});
