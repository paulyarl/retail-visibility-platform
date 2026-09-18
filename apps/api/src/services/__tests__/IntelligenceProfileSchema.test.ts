/**
 * Unit tests for the intelligence_profile output schema (GAP-P8).
 *
 * Tests that the §10 profile structure is validated correctly:
 *   - Valid profile passes
 *   - Missing specialized_sources → fail
 *   - specialized_sources without capabilities → fail
 *   - specialized_sources without limitations → fail
 *   - Missing prohibited_inferences → fail
 *   - Missing category_signals → fail
 *   - .passthrough() allows forward-compatible fields
 */

import { describe, it, expect } from 'vitest';
import {
  intelligenceProfileSchema,
  INTELLIGENCE_PROFILE_SCHEMA_NAME,
} from '../../validators/intelligence-profile.schema';

const validProfile = (overrides: Record<string, any> = {}) => ({
  category_key: 'auto_repair',
  category_name: 'Auto Repair',
  terminology: { 'oil change': 'Routine engine oil replacement' },
  synonyms: ['auto mechanic', 'car repair shop'],
  specialized_sources: [
    {
      name: 'CARFAX',
      type: 'service_history',
      priority: 1,
      capabilities: ['Vehicle service history records'],
      limitations: ['CARFAX is NOT a review system — it does not measure customer satisfaction'],
    },
  ],
  prohibited_inferences: [
    'Absence from CARFAX does NOT mean the business is inactive',
  ],
  category_signals: ['INT_LOW_VISIBILITY', 'INT_HIDDEN_TRUST'],
  ...overrides,
});

describe('intelligence_profile schema (GAP-P8)', () => {
  it('schema name is intelligence_profile', () => {
    expect(INTELLIGENCE_PROFILE_SCHEMA_NAME).toBe('intelligence_profile');
  });

  it('valid profile passes', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile());
    expect(result.success).toBe(true);
  });

  it('missing specialized_sources → fail', () => {
    const { specialized_sources, ...withoutSources } = validProfile();
    const result = intelligenceProfileSchema.safeParse(withoutSources);
    expect(result.success).toBe(false);
  });

  it('empty specialized_sources array → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({ specialized_sources: [] }));
    expect(result.success).toBe(false);
  });

  it('specialized_source without capabilities → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        limitations: ['Not a review system'],
      }],
    }));
    expect(result.success).toBe(false);
  });

  it('specialized_source without limitations → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        capabilities: ['Service history records'],
      }],
    }));
    expect(result.success).toBe(false);
  });

  it('empty capabilities array → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        capabilities: [],
        limitations: ['Not a review system'],
      }],
    }));
    expect(result.success).toBe(false);
  });

  it('empty limitations array → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        capabilities: ['Service history'],
        limitations: [],
      }],
    }));
    expect(result.success).toBe(false);
  });

  it('missing prohibited_inferences → fail', () => {
    const { prohibited_inferences, ...without } = validProfile();
    const result = intelligenceProfileSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('empty prohibited_inferences → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({ prohibited_inferences: [] }));
    expect(result.success).toBe(false);
  });

  it('missing category_signals → fail', () => {
    const { category_signals, ...without } = validProfile();
    const result = intelligenceProfileSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('passthrough allows forward-compatible fields', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      future_field: 'ok',
      discovery_patterns: { vertical: 'Search industry-specific directories' },
    }));
    expect(result.success).toBe(true);
  });

  it('missing category_key → fail', () => {
    const { category_key, ...without } = validProfile();
    const result = intelligenceProfileSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('specialized_source with valid url → pass', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        url: 'https://www.carfax.com',
        priority: 1,
        capabilities: ['Vehicle service history records'],
        limitations: ['CARFAX is NOT a review system'],
      }],
    }));
    expect(result.success).toBe(true);
  });

  it('specialized_source with invalid url → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'CARFAX',
        type: 'service_history',
        url: 'not-a-url',
        capabilities: ['Service history records'],
        limitations: ['Not a review system'],
      }],
    }));
    expect(result.success).toBe(false);
  });

  it('specialized_source without url → pass (optional)', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [{
        name: 'Storefront Photo Evidence',
        type: 'other',
        capabilities: ['Corroborate physical identity'],
        limitations: ['Photo does not establish current inventory'],
      }],
    }));
    expect(result.success).toBe(true);
  });

  it('specialized_source with null url → pass (coerced to undefined)', () => {
    // Models frequently emit `"url": null` for sources with no canonical web
    // address (e.g. "supplier sourcing-road network", "storefront corridor
    // observation"). The schema must coerce null → undefined rather than fail.
    const result = intelligenceProfileSchema.safeParse(validProfile({
      specialized_sources: [
        {
          name: 'CARFAX',
          type: 'service_history',
          url: 'https://www.carfax.com',
          priority: 1,
          capabilities: ['Vehicle service history records'],
          limitations: ['CARFAX is NOT a review system'],
        },
        {
          name: 'Storefront Corridor Observation',
          type: 'other',
          url: null,
          priority: 3,
          capabilities: ['Photograph signage, hours windows, EBT decals'],
          limitations: ['Field method — labor-intensive and point-in-time'],
        },
      ],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specialized_sources[1].url).toBeUndefined();
    }
  });

  // ─── Discovery substrate (category-independent enumeration) ─────────────

  it('discovery substrate fields → pass (optional but validated when present)', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      geography_grid: {
        city: 'Kansas City',
        state: 'MO',
        zips: ['64118', '64124', '64111'],
        corridors: ['Independence Ave / US-24', 'North Oak Trafficway'],
      },
      generic_label_set: [
        { platform: 'google', labels: ['Grocery store', 'Convenience store', 'Supermarket'] },
      ],
      label_independent_sweeps: [
        {
          dataset: 'Missouri Secretary of State business entity registry',
          url: 'https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx',
          sweep_key: 'geography',
          filter: 'none',
          post_filter: 'assortment',
        },
      ],
    }));
    expect(result.success).toBe(true);
  });

  it('generic_label_set entry without labels → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      generic_label_set: [{ platform: 'google', labels: [] }],
    }));
    expect(result.success).toBe(false);
  });

  it('label_independent_sweep with invalid url → fail', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      label_independent_sweeps: [{ dataset: 'SNAP retailer locator', url: 'not-a-url' }],
    }));
    expect(result.success).toBe(false);
  });

  it('label_independent_sweep with null url → pass (coerced to undefined)', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      label_independent_sweeps: [{ dataset: 'SNAP retailer locator', url: null, sweep_key: 'geography' }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label_independent_sweeps?.[0].url).toBeUndefined();
    }
  });

  it('geography_grid accepts a bare zip list without city/state', () => {
    const result = intelligenceProfileSchema.safeParse(validProfile({
      geography_grid: { zips: ['64118'] },
    }));
    expect(result.success).toBe(true);
  });
});
