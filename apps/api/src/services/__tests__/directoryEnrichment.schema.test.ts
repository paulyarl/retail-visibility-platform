/**
 * Directory Enrichment output-schema tests — Migration 279 / sprint plan.
 * docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md
 *
 * Covers:
 * - category_enrichment + location_enrichment validator acceptance/rejection
 * - comma-separated string → string[] coercion (LLMs emit "a, b, c")
 * - empty-string → undefined coercion on optional fields
 * - registry wiring (validator + auditPlatform + promptSuffix)
 */
import { describe, it, expect } from 'vitest';
import {
  categoryEnrichmentSchema,
  locationEnrichmentSchema,
  CATEGORY_ENRICHMENT_SCHEMA_NAME,
  LOCATION_ENRICHMENT_SCHEMA_NAME,
} from '../../validators/directory-enrichment.schema';
import { OUTPUT_SCHEMA_REGISTRY, resolveOutputSchema } from '../../validators/market-analysis.schema';

const validCategoryPacket = {
  meta_title: 'Halal Grocery in Columbus, OH — VisibleShelf Places',
  description: 'Browse halal grocery stores in Columbus listed from public information.',
  keywords: ['halal grocery', 'halal market', 'halal grocery near me'],
  secondary_categories: ['International Grocery', 'Middle Eastern Grocery'],
  schema_type_hint: 'CollectionPage',
  body_copy: 'Halal grocery stores carry zabiha meats and imported staples.',
};

const validLocationPacket = {
  meta_title: 'Local Businesses in Columbus, OH — VisibleShelf Directory',
  description: 'Browse local businesses in Columbus, Ohio listed from public information.',
  keywords: ['columbus businesses', 'local shops columbus'],
  secondary_categories: ['restaurants', 'grocery stores'],
  top_categories: ['restaurants', 'grocery stores', 'auto repair'],
  schema_type_hint: 'WebPage',
  body_copy: 'Columbus has a diverse local business scene across many categories.',
};

describe('categoryEnrichmentSchema', () => {
  it('accepts a complete packet', () => {
    const result = categoryEnrichmentSchema.safeParse(validCategoryPacket);
    expect(result.success).toBe(true);
  });

  it('accepts a packet with optional fields omitted', () => {
    const { secondary_categories, schema_type_hint, body_copy, ...minimal } = validCategoryPacket;
    const result = categoryEnrichmentSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts optional echo fields (category_key/category_name)', () => {
    const result = categoryEnrichmentSchema.safeParse({
      ...validCategoryPacket,
      category_key: 'halal grocery',
      category_name: 'Halal Grocery',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing meta_title', () => {
    const { meta_title, ...noTitle } = validCategoryPacket;
    expect(categoryEnrichmentSchema.safeParse(noTitle).success).toBe(false);
  });

  it('rejects a missing description', () => {
    const { description, ...noDesc } = validCategoryPacket;
    expect(categoryEnrichmentSchema.safeParse(noDesc).success).toBe(false);
  });

  it('rejects a missing keywords array', () => {
    const { keywords, ...noKw } = validCategoryPacket;
    expect(categoryEnrichmentSchema.safeParse(noKw).success).toBe(false);
  });

  it('coerces comma-separated keyword strings into an array', () => {
    const result = categoryEnrichmentSchema.safeParse({
      ...validCategoryPacket,
      keywords: 'halal grocery, halal market, halal grocery near me',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual(['halal grocery', 'halal market', 'halal grocery near me']);
    }
  });

  it('coerces empty-string optional fields to undefined', () => {
    const result = categoryEnrichmentSchema.safeParse({
      ...validCategoryPacket,
      schema_type_hint: '',
      body_copy: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schema_type_hint).toBeUndefined();
      expect(result.data.body_copy).toBeUndefined();
    }
  });

  it('rejects over-length meta_title', () => {
    expect(
      categoryEnrichmentSchema.safeParse({ ...validCategoryPacket, meta_title: 'x'.repeat(201) }).success,
    ).toBe(false);
  });

  it('passes through unknown forward-compatible fields', () => {
    const result = categoryEnrichmentSchema.safeParse({ ...validCategoryPacket, future_field: 42 });
    expect(result.success).toBe(true);
  });
});

describe('locationEnrichmentSchema', () => {
  it('accepts a complete packet', () => {
    expect(locationEnrichmentSchema.safeParse(validLocationPacket).success).toBe(true);
  });

  it('accepts optional echo fields (city/state/location_name)', () => {
    const result = locationEnrichmentSchema.safeParse({
      ...validLocationPacket,
      city: 'Columbus',
      state: 'OH',
      location_name: 'Columbus, OH',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing meta_title', () => {
    const { meta_title, ...noTitle } = validLocationPacket;
    expect(locationEnrichmentSchema.safeParse(noTitle).success).toBe(false);
  });

  it('accepts a packet without top_categories (AI-only field)', () => {
    const { top_categories, ...noTop } = validLocationPacket;
    expect(locationEnrichmentSchema.safeParse(noTop).success).toBe(true);
  });
});

describe('OUTPUT_SCHEMA_REGISTRY wiring', () => {
  it('registers category_enrichment with validator + auditPlatform + suffix', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[CATEGORY_ENRICHMENT_SCHEMA_NAME];
    expect(entry).toBeDefined();
    expect(entry.validator).toBe(categoryEnrichmentSchema);
    expect(entry.auditPlatform).toBe('category_enrichment');
    expect(entry.promptSuffix).toContain('meta_title');
  });

  it('registers location_enrichment with validator + auditPlatform + suffix', () => {
    const entry = OUTPUT_SCHEMA_REGISTRY[LOCATION_ENRICHMENT_SCHEMA_NAME];
    expect(entry).toBeDefined();
    expect(entry.validator).toBe(locationEnrichmentSchema);
    expect(entry.auditPlatform).toBe('location_enrichment');
    expect(entry.promptSuffix).toContain('top_categories');
  });

  it('resolveOutputSchema resolves both names and returns null for unknown', () => {
    expect(resolveOutputSchema(CATEGORY_ENRICHMENT_SCHEMA_NAME)).not.toBeNull();
    expect(resolveOutputSchema(LOCATION_ENRICHMENT_SCHEMA_NAME)).not.toBeNull();
    expect(resolveOutputSchema('not_a_schema')).toBeNull();
    expect(resolveOutputSchema(null)).toBeNull();
  });
});
