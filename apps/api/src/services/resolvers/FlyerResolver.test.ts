import { describe, it, expect } from 'vitest';
import { resolveFlyer } from './FlyerResolver';

describe('resolveFlyer', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveFlyer({}, {}, null);
    expect(result.enabled).toBe(false);
    expect(result.storefront_on).toBe(false);
    expect(result.items_limit).toBe(0);
    expect(result.can_use_storefront).toBe(false);
  });

  it('flyer_disabled vetoes the module absolutely', () => {
    const result = resolveFlyer(
      { flyer_enabled: true, flyer_flexible: true, flyer_disabled: true, flyer_items_20: true },
      {},
      null,
    );
    expect(result.enabled).toBe(false);
    expect(result.storefront_on).toBe(false);
    expect(result.items_limit).toBe(0);
    expect(result.frozen).toBe(false);
  });

  it('enables via flyer_enabled', () => {
    const result = resolveFlyer({ flyer_enabled: true, flyer_storefront_on: true }, {}, null);
    expect(result.enabled).toBe(true);
    expect(result.storefront_on).toBe(true);
  });

  it('enables via flyer_on', () => {
    const result = resolveFlyer({ flyer_on: true, flyer_storefront_on: true }, {}, null);
    expect(result.enabled).toBe(true);
    expect(result.can_use_storefront).toBe(true);
  });

  it('leaf key alone implicitly activates the module', () => {
    // Capability contract: any active flyer_* key activates the module.
    const result = resolveFlyer({ flyer_storefront_on: true, flyer_items_5: true }, {}, null);
    expect(result.enabled).toBe(true);
    expect(result.storefront_on).toBe(true);
    expect(result.items_limit).toBe(5);
  });

  it('flyer_flexible grants surfaces, limits, image, frozen, recurring', () => {
    const result = resolveFlyer({ flyer_flexible: true }, {}, null);
    expect(result.enabled).toBe(true);
    expect(result.is_flexible).toBe(true);
    expect(result.storefront_on).toBe(true);
    expect(result.directory_on).toBe(true);
    expect(result.place_on).toBe(true);
    expect(result.image).toBe(true);
    expect(result.items_limit).toBe(20);
    expect(result.frozen).toBe(true);
    expect(result.recurring).toBe(true);
  });

  it('flyer_flexible does NOT grant gbp_publish (separate flyer_gbp type)', () => {
    const result = resolveFlyer({ flyer_flexible: true }, {}, null);
    expect(result.gbp_publish).toBe(false);
    expect(result.can_use_gbp_publish).toBe(false);
  });

  it('gbp_publish resolves from the flyer_gbp group only', () => {
    const result = resolveFlyer(
      { flyer_enabled: true },
      { flyer_gbp_publish: true },
      null,
    );
    expect(result.gbp_publish).toBe(true);
    expect(result.can_use_gbp_publish).toBe(true);
  });

  it('can_use_gbp_publish requires the flyer module on', () => {
    // GBP grant alone (no flyer keys) → raw grant visible but unusable.
    const result = resolveFlyer({}, { flyer_gbp_publish: true }, null);
    expect(result.gbp_publish).toBe(true);
    expect(result.can_use_gbp_publish).toBe(false);
  });

  it('items_limit picks the highest granted limit', () => {
    const result = resolveFlyer(
      { flyer_enabled: true, flyer_items_5: true, flyer_items_10: true, flyer_items_20: true },
      {},
      null,
    );
    expect(result.items_limit).toBe(20);
    const mid = resolveFlyer({ flyer_enabled: true, flyer_items_5: true, flyer_items_10: true }, {}, null);
    expect(mid.items_limit).toBe(10);
  });

  it('max_live defaults to 2 and expansion keys raise it', () => {
    expect(resolveFlyer({ flyer_enabled: true }, {}, null).max_live).toBe(2);
    expect(resolveFlyer({ flyer_enabled: true, flyer_live_3: true }, {}, null).max_live).toBe(3);
    expect(resolveFlyer({ flyer_enabled: true, flyer_live_3: true, flyer_live_5: true }, {}, null).max_live).toBe(5);
    expect(resolveFlyer({ flyer_flexible: true }, {}, null).max_live).toBe(5);
  });

  it('a lone flyer_live_* grant does not activate the module', () => {
    const result = resolveFlyer({ flyer_live_5: true }, {}, null);
    expect(result.enabled).toBe(false);
    expect(result.max_live).toBe(0);
  });

  it('merchant master display toggle gates can_use_* but not tier fields', () => {
    const features = { flyer_enabled: true, flyer_storefront_on: true, flyer_frozen: true };
    const result = resolveFlyer(features, {}, { flyer_display: false });
    expect(result.storefront_on).toBe(true);   // tier-level unchanged
    expect(result.frozen).toBe(true);          // tier-level unchanged
    expect(result.can_use_storefront).toBe(false);
    expect(result.can_use_frozen_panel).toBe(false);
  });

  it('per-surface merchant toggles gate only their surface', () => {
    const features = {
      flyer_enabled: true,
      flyer_storefront_on: true,
      flyer_directory_on: true,
      flyer_place_on: true,
    };
    const result = resolveFlyer(features, {}, { flyer_directory_display: false });
    expect(result.can_use_storefront).toBe(true);
    expect(result.can_use_directory).toBe(false);
    expect(result.can_use_place).toBe(true);
  });

  it('merchant_preferences echo the resolved defaults', () => {
    const result = resolveFlyer({ flyer_enabled: true }, {}, null);
    expect(result.merchant_preferences.flyer_display).toBe(true);
    expect(result.merchant_preferences.flyer_frozen_display).toBe(true);
    expect(result.merchant_preferences.default_title).toBe('Featured Specials');
  });

  it('merchant_preferences honor persisted values', () => {
    const result = resolveFlyer(
      { flyer_enabled: true },
      {},
      { flyer_place_display: false, default_title: 'Ramadan Specials' },
    );
    expect(result.merchant_preferences.flyer_place_display).toBe(false);
    expect(result.merchant_preferences.default_title).toBe('Ramadan Specials');
  });
});
