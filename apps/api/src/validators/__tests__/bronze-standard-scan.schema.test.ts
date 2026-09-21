/**
 * Unit tests for Bronze Standard Scan Schema (Bronze Standard System)
 *
 * Tests:
 *   - Schema validates a well-formed stage-1 (national) output
 *   - Schema validates a stage-2 (city) output with reason_coverage
 *   - Schema rejects missing category_key / catalog_revision
 *   - reason_coverage[].status enforces the three-state vocabulary
 *   - discovered_by enforces the provenance enum (mandatory per slot)
 *   - platform_presence / digital_quality / observed_platform are controlled
 *   - Registry entry exists with auditPlatform = null (profiles, not audits)
 *   - Passthrough fields allowed
 */

import { describe, it, expect } from 'vitest';
import {
  bronzeStandardScanSchema,
  BRONZE_STANDARD_SCAN_SCHEMA_NAME,
  BRONZE_STANDARD_SCAN_PROMPT_SUFFIX,
} from '../bronze-standard-scan.schema';
import { resolveOutputSchema, OUTPUT_SCHEMA_REGISTRY } from '../market-analysis.schema';

const BASE = {
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  catalog_revision: 1,
};

describe('bronzeStandardScanSchema', () => {
  it('validates a well-formed stage-1 national output', () => {
    const valid = {
      ...BASE,
      reference_city: null,
      reference_state: null,
      reference_platform: null,
      catalog_snapshot: [
        {
          reason_key: 'absent_from_platform',
          label: 'Absent from a major platform',
          definition: 'The business has no verifiable listing on a major platform.',
          signals: ['no GBP listing', 'no Yelp page'],
          expected_vectors: ['community directories', 'state business registry'],
          priority: 1,
          scope_category_key: null,
          scope_city: null,
          scope_state: null,
          scope_platform: null,
          provenance: 'derived',
        },
      ],
      reason_coverage: [
        {
          reason_key: 'absent_from_platform',
          status: 'filled',
          slots: [
            {
              business_name: 'Mama Nkechi Provisions',
              address: '4122 Troost Ave, Kansas City, MO',
              observed_platform: 'google',
              category_fit_evidence: 'Sells fufu flour, palm oil, and dried fish per storefront photos',
              operational_evidence: 'Three reviews in the last 60 days mention in-store pickup',
              operational_status: 'active',
              discovered_by: 'bronze_establishment_scan',
              discovered_via: 'KC African community business directory',
              evidence_urls: ['https://example.org/dir/mama-nkechi'],
              digital_quality: 'very_low',
              platform_presence: { google: 'absent', facebook: 'present_generic_category' },
            },
          ],
        },
        {
          reason_key: 'community_only_presence',
          status: 'empty_unproven',
          empty_slot_note: 'Church bulletin vector executed, returned 0 qualifying leads',
        },
      ],
      not_applicable_reasons: ['port_specific_importer'],
      scope_mix: { universal: 9, category: 4, location: 2, category_location: 1, platform_bound: 1 },
      vector_execution_log: [
        { vector: 'community directories', executed: true, returned: 1 },
        { vector: 'church bulletin boards', executed: true, returned: 0 },
        { vector: 'US Customs import records', executed: false, returned: null },
      ],
      prohibited_inferences: ['low revenue', 'sales readiness'],
    };
    const result = bronzeStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('validates a stage-2 city output with reference_city/state', () => {
    const valid = {
      ...BASE,
      reference_city: 'Kansas City',
      reference_state: 'MO',
      reason_coverage: [
        {
          reason_key: 'absent_from_platform',
          status: 'empty_proven_elsewhere',
          empty_slot_note: 'Platform queries executed, returned 0 in-market exemplars; proven nationally',
        },
      ],
    };
    const result = bronzeStandardScanSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing category_key', () => {
    const { category_key, ...invalid } = BASE;
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects missing catalog_revision', () => {
    const { catalog_revision, ...invalid } = BASE;
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an invalid reason_coverage status', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [{ reason_key: 'absent_from_platform', status: 'partially_filled' }],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts all three coverage statuses', () => {
    const valid = {
      ...BASE,
      reason_coverage: [
        { reason_key: 'a', status: 'filled', slots: [{ business_name: 'B', discovered_by: 'emerging_scan' }] },
        { reason_key: 'b', status: 'empty_unproven', empty_slot_note: 'executed, returned 0' },
        { reason_key: 'c', status: 'empty_proven_elsewhere' },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a slot missing discovered_by (provenance is mandatory)', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [
        { reason_key: 'a', status: 'filled', slots: [{ business_name: 'B' }] },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts every discovered_by provenance value', () => {
    const valid = {
      ...BASE,
      reason_coverage: [
        {
          reason_key: 'a',
          status: 'filled',
          slots: [
            { business_name: 'B1', discovered_by: 'operator_self_discovery' },
            { business_name: 'B2', discovered_by: 'business_audit' },
            { business_name: 'B3', discovered_by: 'emerging_scan' },
            { business_name: 'B4', discovered_by: 'competitive_scan' },
            { business_name: 'B5', discovered_by: 'bronze_establishment_scan' },
          ],
        },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid discovered_by value', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [
        { reason_key: 'a', status: 'filled', slots: [{ business_name: 'B', discovered_by: 'web_search' }] },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an invalid platform_presence vocabulary value', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [
        {
          reason_key: 'a',
          status: 'filled',
          slots: [
            { business_name: 'B', discovered_by: 'emerging_scan', platform_presence: { google: 'present' } },
          ],
        },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an invalid digital_quality value', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [
        {
          reason_key: 'a',
          status: 'filled',
          slots: [{ business_name: 'B', discovered_by: 'emerging_scan', digital_quality: 'medium' }],
        },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an invalid observed_platform', () => {
    const invalid = {
      ...BASE,
      reason_coverage: [
        {
          reason_key: 'a',
          status: 'filled',
          slots: [{ business_name: 'B', discovered_by: 'emerging_scan', observed_platform: 'tiktok' }],
        },
      ],
    };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects reference_platform = all (platform-scoped or null, not the gold all token)', () => {
    const invalid = { ...BASE, reference_platform: 'all' };
    expect(bronzeStandardScanSchema.safeParse(invalid).success).toBe(false);
  });

  it('allows passthrough fields (forward-compatible)', () => {
    const valid = {
      ...BASE,
      future_field: 'extension',
      reason_coverage: [{ reason_key: 'a', status: 'filled', future_entry_field: true }],
    };
    expect(bronzeStandardScanSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts analyst-suggested uncataloged blind spots with category family signal and exemplar lead', () => {
    const valid = {
      ...BASE,
      suggested_reasons: [
        {
          reason_key: 'ethnic_community_classifieds_only',
          proposed_label: 'Exclusively visible on community-specific classifieds',
          proposed_definition: 'Business bypasses mainstream directories; operations exist only in diaspora bulletin boards.',
          observed_signals: ['no platform presence', 'listed in local diaspora directory archive'],
          expected_vectors: ['diaspora business registry'],
          scope_level: 'category_family',
          category_family_applicable: true,
          suggested_category_scope: 'grocery',
          suggested_scope_platform: null,
          exemplar_lead: {
            business_name: 'Afro-Indy Market',
            observed_platform: null,
            discovery_vector: 'diaspora business registry',
            notes: 'Verified operational through community classifieds scan',
          },
        },
      ],
    };
    const parsed = bronzeStandardScanSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.suggested_reasons).toHaveLength(1);
      expect(parsed.data.suggested_reasons?.[0].category_family_applicable).toBe(true);
      expect(parsed.data.suggested_reasons?.[0].suggested_category_scope).toBe('grocery');
      expect(parsed.data.suggested_reasons?.[0].exemplar_lead?.business_name).toBe('Afro-Indy Market');
    }
  });
});

describe('OUTPUT_SCHEMA_REGISTRY — bronze_standard_scan registration', () => {
  it('is registered in the registry', () => {
    expect(OUTPUT_SCHEMA_REGISTRY[BRONZE_STANDARD_SCAN_SCHEMA_NAME]).toBeDefined();
  });

  it('has auditPlatform = null — bronze scans produce profiles, never audits', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[BRONZE_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.auditPlatform).toBeNull();
  });

  it('has a non-empty prompt suffix', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[BRONZE_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.promptSuffix).toBeTruthy();
    expect(entry!.promptSuffix.length).toBeGreaterThan(100);
  });

  it('has the bronzeStandardScanSchema validator', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[BRONZE_STANDARD_SCAN_SCHEMA_NAME];
    expect(entry?.validator).toBe(bronzeStandardScanSchema);
  });

  it('is resolvable via resolveOutputSchema', () => {
    const resolved = resolveOutputSchema(BRONZE_STANDARD_SCAN_SCHEMA_NAME);
    expect(resolved).toBeDefined();
    expect(resolved?.validator).toBe(bronzeStandardScanSchema);
  });
});

describe('BRONZE_STANDARD_SCAN_PROMPT_SUFFIX', () => {
  it('documents the three-state coverage vocabulary', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('empty_unproven');
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('empty_proven_elsewhere');
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('filled');
  });

  it('mandates discovered_by provenance', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('discovered_by');
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('operator_self_discovery');
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('business_audit');
  });

  it('documents catalog_revision stamping', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('catalog_revision');
  });

  it('documents the vector execution log', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('vector_execution_log');
  });

  it('documents the prohibited inferences', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('PROHIBITED INFERENCES');
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('low revenue');
  });

  it('caps slots at 2 per reason', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('2 per reason');
  });

  it('forbids competitive-benchmark framing', () => {
    expect(BRONZE_STANDARD_SCAN_PROMPT_SUFFIX).toContain('competitive benchmark');
  });
});
