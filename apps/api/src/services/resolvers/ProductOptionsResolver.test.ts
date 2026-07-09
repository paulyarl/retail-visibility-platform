import { describe, it, expect } from 'vitest';
import { resolveProductOptions } from './ProductOptionsResolver';

describe('resolveProductOptions', () => {
  const merchantDefaults = {};

  it('uses _on group keys when present', () => {
    const features = {
      product_options_enabled: true,
      product_options_creation_on: true,
      product_options_layout_on: true,
      product_options_sections_on: true,
    };
    const result = resolveProductOptions(features, merchantDefaults);
    expect(result.enabled).toBe(true);
    expect(result.creation_enabled).toBe(true);
    expect(result.layout_enabled).toBe(true);
    expect(result.sections_enabled).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
  });

  it('falls back to _enabled group keys when _on is absent', () => {
    const features = {
      product_options_enabled: true,
      product_options_creation_enabled: true,
      product_options_layout_enabled: true,
      product_options_sections_enabled: true,
    };
    const result = resolveProductOptions(features, merchantDefaults);
    expect(result.enabled).toBe(true);
    expect(result.creation_enabled).toBe(true);
    expect(result.layout_enabled).toBe(true);
    expect(result.sections_enabled).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
  });

  it('respects _off / _disabled group keys', () => {
    const features = {
      product_options_enabled: true,
      product_options_creation_on: true,
      product_options_creation_off: true,
      product_options_layout_enabled: true,
      product_options_layout_disabled: true,
      product_options_sections_enabled: true,
      product_options_sections_disabled: true,
    };
    const result = resolveProductOptions(features, merchantDefaults);
    expect(result.creation_enabled).toBe(false);
    expect(result.layout_enabled).toBe(false);
    expect(result.sections_enabled).toBe(false);
    expect(result.allowed_layouts).toEqual([]);
  });

  it('prefers _on over _enabled when both are present', () => {
    const features = {
      product_options_enabled: true,
      product_options_creation_on: true,
      product_options_creation_enabled: false,
      product_options_creation_off: false,
      product_options_creation_disabled: false,
    };
    const result = resolveProductOptions(features, merchantDefaults);
    expect(result.creation_enabled).toBe(true);
  });

  it('respects merchant preferences for effective flags', () => {
    const features = {
      product_options_enabled: true,
      product_options_creation_on: true,
      product_options_sections_on: true,
    };
    const merchantPrefs = {
      product_variant_enabled: false,
      product_gallery_enabled: true,
      product_opt_recently_viewed: false,
      product_opt_qr_codes: true,
    };
    const result = resolveProductOptions(features, merchantPrefs);
    expect(result.effective_shows_variants).toBe(false);
    expect(result.effective_shows_gallery).toBe(true);
    expect(result.effective_shows_recently_viewed).toBe(false);
    expect(result.effective_shows_qr_codes).toBe(true);
  });
});
