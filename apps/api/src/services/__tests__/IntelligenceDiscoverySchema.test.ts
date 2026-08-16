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
  normalizeIntelligenceDiscoveryPayload,
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

  // ─── Tolerant null handling for address/phone (model emits null for unknown) ───

  it('accepts null address and phone on discovered_businesses', () => {
    const data = validDiscovery({
      discovered_businesses: [validCandidate({ address: null, phone: null })],
      qualifying_businesses: [validCandidate({ address: null, phone: null })],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts omitted address and phone (backward compat)', () => {
    const candidate = validCandidate();
    delete (candidate as any).address;
    delete (candidate as any).phone;
    const data = validDiscovery({
      discovered_businesses: [candidate],
      qualifying_businesses: [candidate],
    });
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ─── normalizeIntelligenceDiscoveryPayload: reference-style qualifying_businesses ───

describe('normalizeIntelligenceDiscoveryPayload', () => {
  it('resolves reference-style qualifying entries from discovered_businesses by name', () => {
    const full = validCandidate({ business_name: 'His Grace African Grocery' });
    const payload = validDiscovery({
      discovered_businesses: [full],
      qualifying_businesses: [
        { business_name: 'His Grace African Grocery', note: 'See discovered_businesses — identical record' },
      ],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    const q = normalized.qualifying_businesses[0];
    // Full record fields are now present...
    expect(q.location_status).toBe('inside_city');
    expect(q.category).toBe('Auto Repair');
    expect(q.business_seek_recommended).toBe(true);
    // ...and the reference-only `note` field is preserved.
    expect(q.note).toBe('See discovered_businesses — identical record');
    // The normalized payload now passes schema validation.
    expect(schema.safeParse(normalized).success).toBe(true);
  });

  it('leaves full qualifying records untouched', () => {
    const full = validCandidate();
    const payload = validDiscovery({
      discovered_businesses: [full],
      qualifying_businesses: [full],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses[0]).toEqual(full);
  });

  it('leaves unmatched references in place so validation surfaces a clear error', () => {
    const payload = validDiscovery({
      discovered_businesses: [validCandidate({ business_name: 'Known Biz' })],
      qualifying_businesses: [
        { business_name: 'Unknown Biz', note: 'no match' },
      ],
    });
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    // Unmatched reference is unchanged → validation fails with field-level issues.
    expect(normalized.qualifying_businesses[0].business_name).toBe('Unknown Biz');
    expect(normalized.qualifying_businesses[0].location_status).toBeUndefined();
    expect(schema.safeParse(normalized).success).toBe(false);
  });

  it('is a no-op when qualifying_businesses is missing or not an array', () => {
    const payload = { ...validDiscovery(), qualifying_businesses: undefined };
    const normalized = normalizeIntelligenceDiscoveryPayload(payload);
    expect(normalized.qualifying_businesses).toBeUndefined();
  });

  it('is a no-op for non-object input', () => {
    expect(normalizeIntelligenceDiscoveryPayload(null)).toBeNull();
    expect(normalizeIntelligenceDiscoveryPayload('string')).toBe('string');
  });
});
