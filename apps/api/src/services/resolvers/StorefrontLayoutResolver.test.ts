import { describe, it, expect } from 'vitest';
import { resolveStorefrontLayouts } from './StorefrontLayoutResolver';

describe('resolveStorefrontLayouts', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontLayouts({}, null);
    expect(result.enabled).toBe(false);
    expect(result.layout_enabled).toBe(false);
    expect(result.allowed_layouts).toEqual([]);
    expect(result.effective_layout).toBe('classic');
  });

  it('returns disabled when storefront_layouts_disabled is set', () => {
    const result = resolveStorefrontLayouts({ storefront_layouts_enabled: true, storefront_layouts_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables layouts with new storefront_layouts_* keys', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
      storefront_layouts_editorial: true,
      storefront_layouts_immersive: true,
    };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.enabled).toBe(true);
    expect(result.layout_enabled).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
  });

  it('falls back to old storefront_opt_layout_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_layout_on: true,
      storefront_opt_layout_classic: true,
      storefront_opt_layout_editorial: true,
      storefront_opt_layout_immersive: true,
    };
    const result = resolveStorefrontLayouts({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.layout_enabled).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
  });

  it('respects flexible key to unlock all layouts', () => {
    const features = { storefront_layouts_enabled: true, storefront_layouts_flexible: true };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
    expect(result.can_use_layout_classic).toBe(true);
    expect(result.can_use_layout_editorial).toBe(true);
    expect(result.can_use_layout_immersive).toBe(true);
  });

  it('falls back to old storefront_opt_flexible key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_flexible: true,
    };
    const result = resolveStorefrontLayouts({}, null, fallbackFeatures);
    expect(result.is_flexible).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
  });

  it('respects individual layout feature keys', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
      storefront_layouts_editorial: true,
    };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial']);
    expect(result.allowed_layouts).not.toContain('immersive');
    expect(result.can_use_layout_classic).toBe(true);
    expect(result.can_use_layout_editorial).toBe(true);
    expect(result.can_use_layout_immersive).toBe(false);
  });

  it('falls back to individual old layout keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_layout_on: true,
      storefront_opt_layout_classic: true,
    };
    const result = resolveStorefrontLayouts({}, null, fallbackFeatures);
    expect(result.allowed_layouts).toEqual(['classic']);
    expect(result.can_use_layout_classic).toBe(true);
    expect(result.can_use_layout_editorial).toBe(false);
  });

  it('uses merchant preference for effective layout when allowed', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
      storefront_layouts_editorial: true,
      storefront_layouts_immersive: true,
    };
    const merchantPrefs = {
      layouts_enabled: true,
      storefront_layout: 'editorial',
    };
    const result = resolveStorefrontLayouts(features, merchantPrefs);
    expect(result.effective_layout).toBe('editorial');
    expect(result.merchant_preferences.storefront_layout).toBe('editorial');
  });

  it('falls back to first allowed layout when merchant choice is not allowed', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
    };
    const merchantPrefs = {
      layouts_enabled: true,
      storefront_layout: 'immersive',
    };
    const result = resolveStorefrontLayouts(features, merchantPrefs);
    expect(result.effective_layout).toBe('classic');
  });

  it('defaults to classic when no layouts are allowed', () => {
    const features = { storefront_layouts_enabled: true };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.allowed_layouts).toEqual([]);
    expect(result.effective_layout).toBe('classic');
  });

  it('defaults merchant preferences when null', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
    };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.merchant_preferences.layouts_enabled).toBe(true);
    expect(result.merchant_preferences.storefront_layout).toBe('classic');
  });

  it('respects merchant prefs layouts_enabled false', () => {
    const features = {
      storefront_layouts_enabled: true,
      storefront_layouts_on: true,
      storefront_layouts_classic: true,
    };
    const merchantPrefs = {
      layouts_enabled: false,
      storefront_layout: 'classic',
    };
    const result = resolveStorefrontLayouts(features, merchantPrefs);
    expect(result.merchant_preferences.layouts_enabled).toBe(false);
  });

  it('returns empty allowed_layouts when layout group is disabled', () => {
    const features = { storefront_layouts_enabled: true };
    const result = resolveStorefrontLayouts(features, null);
    expect(result.layout_enabled).toBe(false);
    expect(result.allowed_layouts).toEqual([]);
  });
});
