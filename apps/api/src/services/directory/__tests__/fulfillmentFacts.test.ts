import { describe, it, expect } from 'vitest';
import {
  extractFulfillmentFromAuditData,
  extractSeedObservedAssets,
} from '../fulfillmentFacts';

/**
 * OQ1/OQ5 (migration 337) — the extractors are the single contract between
 * the business_analysis audit blob and the listing/seed columns:
 *   - tri-state is preserved verbatim (null = unobserved, false = explicit
 *     negative — never conflated)
 *   - an audit that addressed NEITHER field returns null so callers skip
 *     the write entirely (a "didn't look" audit can't erase prior evidence)
 *   - observed_on companions become the provenance source_name
 *   - only verified_on_surface observed_assets are seed-eligible
 */

describe('extractFulfillmentFromAuditData', () => {
  const AT = '2026-10-13T12:00:00.000Z';

  it('returns null when the audit addressed neither field', () => {
    expect(extractFulfillmentFromAuditData({ website: {} }, AT)).toBeNull();
    expect(
      extractFulfillmentFromAuditData(
        { website: { has_delivery_option: null, has_pickup_ordering: null } },
        AT,
      ),
    ).toBeNull();
    // No website block at all (stub/discovery audit).
    expect(extractFulfillmentFromAuditData({}, AT)).toBeNull();
    expect(extractFulfillmentFromAuditData(null, AT)).toBeNull();
  });

  it('maps observed values verbatim with the surface as source_name', () => {
    const f = extractFulfillmentFromAuditData(
      {
        website: {
          has_delivery_option: true,
          has_delivery_option_observed_on: 'doordash',
          has_pickup_ordering: true,
          has_pickup_ordering_observed_on: 'owned_site',
        },
      },
      AT,
    );
    expect(f).toEqual({
      deliveryOffered: true,
      pickupOffered: true,
      fulfillmentAsOf: new Date(AT),
      fulfillmentSource: 'audit_channel_scan',
      fulfillmentSourceName: 'doordash, owned_site',
    });
  });

  it('preserves an explicit negative (false) distinct from unobserved (null)', () => {
    const f = extractFulfillmentFromAuditData(
      {
        website: {
          has_delivery_option: false,
          has_delivery_option_observed_on: 'owned_site',
          has_pickup_ordering: null,
        },
      },
      AT,
    );
    expect(f?.deliveryOffered).toBe(false);
    expect(f?.pickupOffered).toBeNull();
    expect(f?.fulfillmentSourceName).toBe('owned_site');
  });

  it('dedupes repeated observed_on surfaces and falls back when absent', () => {
    const f = extractFulfillmentFromAuditData(
      {
        website: {
          has_delivery_option: true,
          has_delivery_option_observed_on: 'google',
          has_pickup_ordering: true,
          has_pickup_ordering_observed_on: 'google',
        },
      },
      AT,
    );
    expect(f?.fulfillmentSourceName).toBe('google');

    const noSurface = extractFulfillmentFromAuditData(
      { website: { has_pickup_ordering: true } },
      AT,
    );
    expect(noSurface?.fulfillmentSourceName).toBe('business_analysis_audit');
  });

  it('treats non-boolean coercion survivors conservatively (null)', () => {
    // The validator coerces yes/no/likely at import, but a hand-assembled
    // blob could still carry a string — a non-strict value must not flip a
    // public filter column.
    const f = extractFulfillmentFromAuditData(
      { website: { has_delivery_option: 'yes', has_pickup_ordering: true } },
      AT,
    );
    expect(f?.deliveryOffered).toBeNull();
    expect(f?.pickupOffered).toBe(true);
  });
});

describe('extractSeedObservedAssets', () => {
  const entry = (confidence: string, extra: Record<string, any> = {}) => ({
    asset: 'catering_menu',
    evidence: 'Catering menu page rendered',
    source_url: 'https://example.com/catering',
    observed_on: 'owned_site',
    also_seen_on: ['google'],
    confidence,
    underexposed: true,
    underexposure_note: 'not linked from GBP',
    ...extra,
  });

  it('keeps only verified_on_surface entries', () => {
    const assets = extractSeedObservedAssets({
      observed_assets: [
        entry('verified_on_surface'),
        entry('inferred'),
        entry('verify_with_owner'),
      ],
    });
    expect(assets).toHaveLength(1);
    expect(assets[0].confidence).toBe('verified_on_surface');
  });

  it('preserves full internal fidelity (underexposed fields stay on the seed)', () => {
    const [a] = extractSeedObservedAssets({ observed_assets: [entry('verified_on_surface')] });
    expect(a.underexposed).toBe(true);
    expect(a.underexposure_note).toBe('not linked from GBP');
    expect(a.observed_on).toBe('owned_site');
    expect(a.source_url).toBe('https://example.com/catering');
  });

  it('returns [] for missing/non-array observed_assets', () => {
    expect(extractSeedObservedAssets({})).toEqual([]);
    expect(extractSeedObservedAssets({ observed_assets: null })).toEqual([]);
    expect(extractSeedObservedAssets(null)).toEqual([]);
  });

  it('caps the stored set', () => {
    const raw = Array.from({ length: 30 }, () => entry('verified_on_surface'));
    expect(extractSeedObservedAssets({ observed_assets: raw }, 20)).toHaveLength(20);
  });
});
