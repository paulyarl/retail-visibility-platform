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
});
