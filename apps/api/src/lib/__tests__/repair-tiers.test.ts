import { describe, it, expect } from 'vitest';
import {
  REPAIR_TIER_CATALOG,
  REPAIR_PLATFORM_STATUSES,
  ACCESS_FIELD_TO_PLATFORM,
  ACCESS_ANSWER_TO_STATUS,
  isRepairTier,
  isRepairMode,
  outOfScopePlatforms,
} from '../repair-tiers';

// Profile Repair Fulfillment Sprint (W2) — tier/mode/platform mapping.
// Spec: docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md §4, §6.1.

describe('REPAIR_TIER_CATALOG', () => {
  it('defines standard/plus/premium with spec pricing + SLAs', () => {
    expect(REPAIR_TIER_CATALOG.standard).toMatchObject({
      slaHours: 48, diyPriceCents: 14900, dfyPriceCents: 29900,
    });
    expect(REPAIR_TIER_CATALOG.plus).toMatchObject({
      slaHours: 48, diyPriceCents: 24900, dfyPriceCents: 39900,
    });
    expect(REPAIR_TIER_CATALOG.premium).toMatchObject({
      slaHours: 24, diyPriceCents: null, dfyPriceCents: 59900,
    });
  });

  it('scopes expanded platforms to premium only', () => {
    expect(REPAIR_TIER_CATALOG.standard.platforms).toEqual(['google', 'facebook', 'yelp', 'bbb']);
    expect(REPAIR_TIER_CATALOG.plus.platforms).toEqual(['google', 'facebook', 'yelp', 'bbb']);
    expect(REPAIR_TIER_CATALOG.premium.platforms).toEqual(
      expect.arrayContaining(['google', 'facebook', 'yelp', 'bbb', 'apple_maps', 'bing_places']),
    );
  });
});

describe('isRepairTier / isRepairMode', () => {
  it('accepts the catalog values and rejects others', () => {
    expect(isRepairTier('standard')).toBe(true);
    expect(isRepairTier('plus')).toBe(true);
    expect(isRepairTier('premium')).toBe(true);
    expect(isRepairTier('enterprise')).toBe(false);
    expect(isRepairTier(undefined)).toBe(false);

    expect(isRepairMode('diy')).toBe(true);
    expect(isRepairMode('dfy')).toBe(true);
    expect(isRepairMode('managed')).toBe(false);
  });
});

describe('outOfScopePlatforms', () => {
  it('passes core platforms on standard', () => {
    expect(outOfScopePlatforms('standard', ['google', 'yelp'])).toEqual([]);
  });

  it('rejects expanded platforms on standard/plus', () => {
    expect(outOfScopePlatforms('standard', ['google', 'apple_maps'])).toEqual(['apple_maps']);
    expect(outOfScopePlatforms('plus', ['bing_places'])).toEqual(['bing_places']);
  });

  it('accepts all six platforms on premium', () => {
    expect(outOfScopePlatforms('premium', ['google', 'facebook', 'yelp', 'bbb', 'apple_maps', 'bing_places'])).toEqual([]);
  });
});

describe('access-intake mappings (W3)', () => {
  it('maps every intake field key to a platform', () => {
    expect(ACCESS_FIELD_TO_PLATFORM['google_gbp']).toBe('google');
    expect(ACCESS_FIELD_TO_PLATFORM['facebook_page']).toBe('facebook');
    expect(ACCESS_FIELD_TO_PLATFORM['yelp']).toBe('yelp');
    expect(ACCESS_FIELD_TO_PLATFORM['bbb']).toBe('bbb');
    expect(ACCESS_FIELD_TO_PLATFORM['apple_maps']).toBe('apple_maps');
    expect(ACCESS_FIELD_TO_PLATFORM['bing_places']).toBe('bing_places');
  });

  it('maps answers to initial platform_status values', () => {
    expect(ACCESS_ANSWER_TO_STATUS['granted']).toBe('access_granted');
    expect(ACCESS_ANSWER_TO_STATUS['pending']).toBe('awaiting_access');
    expect(ACCESS_ANSWER_TO_STATUS['cannot_grant']).toBe('blocked');
    expect(ACCESS_ANSWER_TO_STATUS['not_applicable']).toBe('not_applicable');
  });

  it('keeps the status enum in sync with the adapter target set', () => {
    for (const status of Object.values(ACCESS_ANSWER_TO_STATUS)) {
      expect(REPAIR_PLATFORM_STATUSES).toContain(status);
    }
    // 'escalated' must exist for the Track B handoff (W7c).
    expect(REPAIR_PLATFORM_STATUSES).toContain('escalated');
    expect(REPAIR_PLATFORM_STATUSES).toContain('customer_pending');
    expect(REPAIR_PLATFORM_STATUSES).toContain('customer_reported');
  });
});
