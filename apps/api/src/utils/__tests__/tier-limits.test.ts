import { describe, it, expect } from 'vitest';
import { getSKULimit, getTierInfo, canAddSKUs, TIER_LIMITS } from '../tier-limits';

// Seed-preview storefront spec §5f — `seed_preview` is a dedicated demo tier
// (20-SKU catalog cap). The resolver previously mapped EVERY non-trial tier
// to 'discovery' (75 SKUs) — these tests pin both the new tier and the
// regression fix for real tiers like omnichannel.

describe('getSKULimit', () => {
  it('resolves seed_preview to its own 20-SKU cap, not the discovery fallthrough', () => {
    expect(getSKULimit('seed_preview')).toBe(20);
  });

  it('resolves real tiers to themselves', () => {
    expect(getSKULimit('omnichannel')).toBe(2000);
    expect(getSKULimit('storefront')).toBe(200);
    expect(getSKULimit('directory_presence')).toBe(5);
  });

  it('proxies trial tiers to their base tier', () => {
    expect(getSKULimit('trial_omnichannel')).toBe(2000);
    expect(getSKULimit('trial_discovery')).toBe(75);
    expect(getSKULimit('expired_trial')).toBe(0); // deprecated → presence
  });

  it('falls back to directory_presence for genuinely unknown or absent tiers', () => {
    // Sprint plan 1.7: the shared DEFAULT_TIER — not a silent 'discovery'
    // 75-SKU answer, and not 'starter' (an inactive legacy key).
    expect(getSKULimit('not_a_tier')).toBe(TIER_LIMITS.directory_presence.maxSkus);
    expect(getSKULimit('')).toBe(TIER_LIMITS.directory_presence.maxSkus);
    expect(getSKULimit(null)).toBe(TIER_LIMITS.directory_presence.maxSkus);
  });

  it('is case-insensitive', () => {
    expect(getSKULimit('SEED_PREVIEW')).toBe(20);
  });
});

describe('getTierInfo', () => {
  it('returns the Seed Preview tier record', () => {
    expect(getTierInfo('seed_preview')).toEqual({ name: 'Seed Preview', maxSkus: 20 });
  });
});

describe('canAddSKUs', () => {
  it('enforces the 20-SKU preview cap', () => {
    expect(canAddSKUs('seed_preview', 19, 1)).toBe(true);
    expect(canAddSKUs('seed_preview', 20, 1)).toBe(false);
  });
});
