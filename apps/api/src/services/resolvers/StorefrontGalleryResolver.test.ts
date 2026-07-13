import { describe, it, expect } from 'vitest';
import { resolveStorefrontGallery } from './StorefrontGalleryResolver';

describe('resolveStorefrontGallery', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontGallery({}, null);
    expect(result.enabled).toBe(false);
    expect(result.gallery_enabled).toBe(false);
    expect(result.can_use_gallery).toBe(false);
  });

  it('returns disabled when storefront_gallery_disabled is set', () => {
    const result = resolveStorefrontGallery({ storefront_gallery_enabled: true, storefront_gallery_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables gallery with new storefront_gallery_* keys', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_on: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('falls back to old storefront_opt_gallery_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_gallery_on: true,
    };
    const result = resolveStorefrontGallery({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('respects flexible key', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_flexible: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.gallery_carousel_enabled).toBe(true);
    expect(result.gallery_magazine_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('enables carousel mode via storefront_gallery_carousel key', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_on: true,
      storefront_gallery_carousel: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.gallery_carousel_enabled).toBe(true);
  });

  it('enables magazine mode via storefront_gallery_magazine key', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_on: true,
      storefront_gallery_magazine: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.gallery_magazine_enabled).toBe(true);
  });

  it('falls back to old storefront_opt_gallery_magazine key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_gallery_on: true,
      storefront_opt_gallery_magazine: true,
    };
    const result = resolveStorefrontGallery({}, null, fallbackFeatures);
    expect(result.gallery_magazine_enabled).toBe(true);
  });

  it('returns all gallery types when storefront_gallery_enabled is set, regardless of individual limit keys', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_limit_5: true,
      storefront_gallery_limit_10: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('falls back to old storefront_opt_gallery_on to enable all gallery types', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_gallery_on: true,
    };
    const result = resolveStorefrontGallery({}, null, fallbackFeatures);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('respects merchant preferences for gallery enabled flag', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { gallery_enabled: false };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.merchant_preferences.gallery_enabled).toBe(false);
  });

  it('respects merchant preferences for display mode', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true, storefront_gallery_magazine: true };
    const merchantPrefs = { gallery_display_mode: 'magazine' };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.gallery_display_mode).toBe('magazine');
    expect(result.can_use_magazine_gallery).toBe(true);
  });

  it('downgrades magazine display mode to carousel when magazine not tier-gated', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { gallery_display_mode: 'magazine' };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.gallery_display_mode).toBe('carousel');
    expect(result.can_use_magazine_gallery).toBe(false);
  });

  it('respects merchant preferences for image limits', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = {
      image_gallery_5: true,
      image_gallery_10: false,
      image_gallery_15: false,
      default_gallery_limit: 5,
    };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.merchant_preferences.image_gallery_5).toBe(true);
    expect(result.merchant_preferences.image_gallery_10).toBe(false);
    expect(result.default_gallery_limit).toBe(5);
  });

  it('defaults gallery_display_mode to carousel when not set', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.gallery_display_mode).toBe('carousel');
  });

  it('defaults default_gallery_limit to 5 when not set', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.default_gallery_limit).toBe(5);
  });

  it('returns disabled when only enabled flag is set without gallery_on', () => {
    const features = { storefront_gallery_enabled: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('can_use_gallery is true when effective gallery types exist', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { image_gallery_5: true, image_gallery_10: true, image_gallery_15: false };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.can_use_gallery).toBe(true);
  });

  it('can_use_gallery is false when merchant disables all gallery types', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { image_gallery_5: false, image_gallery_10: false, image_gallery_15: false };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.can_use_gallery).toBe(false);
  });
});
