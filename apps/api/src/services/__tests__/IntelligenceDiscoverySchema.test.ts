/**
 * Unit tests for the intelligence_discovery output schema (Sprint 2).
 *
 * Tests:
 *   - Valid discovery output passes validation
 *   - outside_market candidates excluded from qualifying_businesses
 *   - national_chain / national_franchise / regional_chain excluded from qualifying
 *   - identity_confidence 'low' → business_seek_priority must be 'hold'
 *   - category_fit 'insufficient' → priority 'hold' or recommended false
 *   - No Business-Audit signal fields required (structural §31)
 *   - .passthrough() allows forward-compatible fields
 */

import { describe, it, expect } from 'vitest';
import {
  intelligenceDiscoverySchemaWithRefinements as schema,
  INTELLIGENCE_DISCOVERY_SCHEMA_NAME,
} from '../../validators/intelligence-discovery.schema';

const validCandidate = (overrides: Record<string, any> = {}) => ({
  business_name: 'Test Auto',
  category: 'Auto Repair',
  city: 'Austin',
  state: 'TX',
  location_status: 'inside_city',
  ownership_type: 'independent',
  category_fit: 'verified',
  identity_confidence: 'high',
  discovery_signals: ['INT_LOW_VISIBILITY'],
  discovery_provenance: [{ source: 'Google', role: 'directory' }],
  business_seek_recommended: true,
  business_seek_priority: 'high',
  ...overrides,
});

const validDiscovery = (overrides: Record<string, any> = {}) => ({
  intelligence_mode: 'profile',
  category: 'Auto Repair',
  city: 'Austin',
  state: 'TX',
  focus: 'emerging',
  discovered_businesses: [validCandidate()],
  qualifying_businesses: [validCandidate()],
  candidate_count: 1,
  qualifying_count: 1,
  hold_count: 0,
  ...overrides,
});

describe('intelligence_discovery schema', () => {
  it('schema name is intelligence_discovery', () => {
    expect(INTELLIGENCE_DISCOVERY_SCHEMA_NAME).toBe('intelligence_discovery');
  });

  it('valid discovery output passes', () => {
    const result = schema.safeParse(validDiscovery());
    expect(result.success).toBe(true);
  });

  it('outside_market candidate in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ location_status: 'outside_market' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('national_chain in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ ownership_type: 'national_chain' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('regional_chain in qualifying_businesses → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ ownership_type: 'regional_chain' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('identity_confidence low + priority not hold → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ identity_confidence: 'low', business_seek_priority: 'high' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('identity_confidence low + priority hold → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({ identity_confidence: 'low', business_seek_priority: 'hold' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('category_fit insufficient + priority high + recommended true → fail', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_priority: 'high',
        business_seek_recommended: true,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('category_fit insufficient + priority hold → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_priority: 'hold',
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('category_fit insufficient + recommended false → pass', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        category_fit: 'insufficient',
        business_seek_recommended: false,
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('passthrough allows forward-compatible fields', () => {
    const data = validDiscovery({
      future_field: 'some future value',
      discovered_businesses: [validCandidate({ future_candidate_field: 'ok' })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('discovery_signals accept INT_* codes', () => {
    const data = validDiscovery({
      qualifying_businesses: [validCandidate({
        discovery_signals: ['INT_LOW_VISIBILITY', 'INT_HIDDEN_TRUST', 'INT_MULTISOURCE_IDENTITY'],
      })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
