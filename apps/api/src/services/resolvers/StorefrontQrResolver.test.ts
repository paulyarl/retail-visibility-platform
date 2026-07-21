import { describe, it, expect } from 'vitest';
import { resolveStorefrontQr } from './StorefrontQrResolver';

describe('resolveStorefrontQr', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontQr({}, null);
    expect(result.enabled).toBe(false);
    expect(result.qr_enabled).toBe(false);
    expect(result.can_use_qr_codes).toBe(false);
  });

  it('returns disabled when storefront_qr_disabled is set', () => {
    const result = resolveStorefrontQr({ storefront_qr_enabled: true, storefront_qr_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables QR with new storefront_qr_* keys', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.enabled).toBe(true);
    expect(result.qr_enabled).toBe(true);
    expect(result.allowed_qr_resolutions).toEqual(['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048']);
    expect(result.allowed_qr_content_types).toEqual(['qr_product', 'qr_store', 'qr_logo', 'qr_directory']);
  });

  it('falls back to old storefront_opt_qr_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_qr_on: true,
    };
    const result = resolveStorefrontQr({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.qr_enabled).toBe(true);
    expect(result.allowed_qr_resolutions).toEqual(['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048']);
  });

  it('respects flexible key', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_flexible: true };
    const result = resolveStorefrontQr(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.qr_styled_enabled).toBe(true);
    expect(result.allowed_qr_dot_styles).toEqual(['rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded', 'square']);
    expect(result.allowed_qr_corner_styles).toEqual(['dot', 'extra-rounded', 'rounded', 'square']);
    expect(result.allowed_qr_corner_dot_styles).toEqual(['dot', 'square']);
    expect(result.qr_custom_colors).toBe(true);
    expect(result.qr_gradients).toBe(true);
  });

  it('enables styled QR via storefront_qr_styled key', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
      storefront_qr_styled: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_styled_enabled).toBe(true);
  });

  it('disables styled QR when styled_off is set', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
      storefront_qr_styled: true,
      storefront_qr_styled_off: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_styled_enabled).toBe(false);
    expect(result.allowed_qr_dot_styles).toEqual([]);
    expect(result.allowed_qr_corner_dot_styles).toEqual([]);
  });

  it('respects individual QR resolution keys', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_resolution_512: true,
      storefront_qr_resolution_1024: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.allowed_qr_resolutions).toEqual(['qr_codes_512', 'qr_codes_1024']);
    expect(result.allowed_qr_resolutions).not.toContain('qr_codes_2048');
  });

  it('respects individual QR content type keys', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_product: true,
      storefront_qr_store: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.allowed_qr_content_types).toEqual(['qr_product', 'qr_store']);
    expect(result.allowed_qr_content_types).not.toContain('qr_logo');
    expect(result.allowed_qr_content_types).not.toContain('qr_directory');
  });

  it('respects merchant preferences to filter effective QR', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
    };
    const merchantPrefs = {
      qr_enabled: true,
      qr_codes_512: false,
      qr_codes_1024: true,
      qr_codes_2048: false,
      qr_product: true,
      qr_store: false,
      qr_logo: false,
      qr_directory: false,
    };
    const result = resolveStorefrontQr(features, merchantPrefs);
    expect(result.can_use_qr_codes).toBe(true);
    expect(result.merchant_preferences.qr_codes_512).toBe(false);
    expect(result.merchant_preferences.qr_codes_1024).toBe(true);
  });

  it('disables QR when merchant prefs qr_enabled is false', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_on: true };
    const merchantPrefs = { qr_enabled: false };
    const result = resolveStorefrontQr(features, merchantPrefs);
    expect(result.merchant_preferences.qr_enabled).toBe(false);
  });

  it('enables classic QR via storefront_qr_classic key', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
      storefront_qr_classic: true,
    };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_classic_enabled).toBe(true);
  });

  it('falls back to old storefront_opt_qr_styled keys for styled QR', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_qr_on: true,
      storefront_opt_qr_styled: true,
    };
    const result = resolveStorefrontQr({}, null, fallbackFeatures);
    expect(result.qr_styled_enabled).toBe(true);
  });

  it('falls back to old storefront_opt_qr_codes_* keys for individual resolutions', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_qr_codes_512: true,
      storefront_opt_qr_codes_2048: true,
    };
    const result = resolveStorefrontQr({}, null, fallbackFeatures);
    expect(result.allowed_qr_resolutions).toEqual(['qr_codes_512', 'qr_codes_2048']);
  });

  it('tier allows styled QR even when merchant pref qr_styled_enabled is false', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
      storefront_qr_styled: true,
    };
    const merchantPrefs = { qr_styled_enabled: false };
    const result = resolveStorefrontQr(features, merchantPrefs);
    expect(result.qr_styled_enabled).toBe(true);
    expect(result.qr_classic_enabled).toBe(true);
    expect(result.merchant_preferences.qr_styled_enabled).toBe(false);
  });

  it('tier allows classic QR even when merchant pref qr_classic_enabled is false', () => {
    const features = {
      storefront_qr_enabled: true,
      storefront_qr_on: true,
      storefront_qr_styled: true,
    };
    const merchantPrefs = { qr_classic_enabled: false };
    const result = resolveStorefrontQr(features, merchantPrefs);
    expect(result.qr_classic_enabled).toBe(true);
    expect(result.qr_styled_enabled).toBe(true);
    expect(result.merchant_preferences.qr_classic_enabled).toBe(false);
  });

  it('returns empty arrays when QR group is disabled', () => {
    const features = { storefront_qr_enabled: true };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_enabled).toBe(false);
    expect(result.allowed_qr_resolutions).toEqual([]);
    expect(result.allowed_qr_content_types).toEqual([]);
  });

  it('enables QR analytics when flexible', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_flexible: true };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_analytics_enabled).toBe(true);
    expect(result.can_use_qr_analytics).toBe(true);
  });

  it('enables QR analytics via storefront_qr_analytics feature key', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_analytics: true };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_analytics_enabled).toBe(true);
    expect(result.can_use_qr_analytics).toBe(true);
  });

  it('can_use_qr_analytics is true even when merchant pref qr_analytics_enabled is false (R33)', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_flexible: true };
    const merchantPrefs = { qr_analytics_enabled: false };
    const result = resolveStorefrontQr(features, merchantPrefs);
    expect(result.can_use_qr_analytics).toBe(true);
    expect(result.merchant_preferences.qr_analytics_enabled).toBe(false);
  });

  it('disables QR analytics when tier does not allow it', () => {
    const features = { storefront_qr_enabled: true, storefront_qr_on: true };
    const result = resolveStorefrontQr(features, null);
    expect(result.qr_analytics_enabled).toBe(false);
    expect(result.can_use_qr_analytics).toBe(false);
  });
});
