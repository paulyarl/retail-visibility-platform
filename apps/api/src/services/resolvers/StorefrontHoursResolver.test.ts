import { describe, it, expect } from 'vitest';
import { resolveStorefrontHours } from './StorefrontHoursResolver';

describe('resolveStorefrontHours', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontHours({}, null);
    expect(result.enabled).toBe(false);
    expect(result.hours_enabled).toBe(false);
    expect(result.can_show_hours_display).toBe(false);
  });

  it('returns disabled when storefront_hours_disabled is set', () => {
    const result = resolveStorefrontHours({ storefront_hours_enabled: true, storefront_hours_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables hours with new storefront_hours_* keys', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.enabled).toBe(true);
    expect(result.hours_enabled).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
  });

  it('falls back to old storefront_opt_hours_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_hours_on: true,
      storefront_opt_hours_animated: true,
      storefront_opt_hours_status: true,
    };
    const result = resolveStorefrontHours({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.hours_enabled).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
  });

  it('respects flexible key', () => {
    const features = { storefront_hours_enabled: true, storefront_hours_flexible: true };
    const result = resolveStorefrontHours(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
    expect(result.can_use_animated_hours).toBe(true);
    expect(result.can_show_hours_status).toBe(true);
  });

  it('enables hours display via storefront_hours_display key', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_display: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.hours_display_enabled).toBe(true);
    expect(result.can_show_hours_display).toBe(true);
  });

  it('disables hours display when display key is not set', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.hours_display_enabled).toBe(false);
    expect(result.can_show_hours_display).toBe(false);
  });

  it('respects individual hours feature keys', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.allowed_hours_types).toEqual(['hours_animated']);
    expect(result.allowed_hours_types).not.toContain('hours_status');
    expect(result.can_use_animated_hours).toBe(true);
    expect(result.can_show_hours_status).toBe(false);
  });

  it('respects merchant preferences to filter effective hours', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const merchantPrefs = {
      hours_enabled: true,
      hours_display: true,
      hours_animated: false,
      hours_status: true,
    };
    const result = resolveStorefrontHours(features, merchantPrefs);
    expect(result.can_use_animated_hours).toBe(false);
    expect(result.can_show_hours_status).toBe(true);
    expect(result.merchant_preferences.hours_animated).toBe(false);
  });

  it('disables hours when merchant prefs hours_enabled is false', () => {
    const features = { storefront_hours_enabled: true, storefront_hours_on: true };
    const merchantPrefs = { hours_enabled: false };
    const result = resolveStorefrontHours(features, merchantPrefs);
    expect(result.merchant_preferences.hours_enabled).toBe(false);
  });

  it('falls back to old storefront_opt_hours_animated keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_hours_on: true,
      storefront_opt_hours_animated: true,
    };
    const result = resolveStorefrontHours({}, null, fallbackFeatures);
    expect(result.allowed_hours_types).toEqual(['hours_animated']);
    expect(result.can_use_animated_hours).toBe(true);
  });

  it('falls back to old storefront_opt_hours_display key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_hours_on: true,
      storefront_opt_hours_display: true,
    };
    const result = resolveStorefrontHours({}, null, fallbackFeatures);
    expect(result.hours_display_enabled).toBe(true);
    expect(result.can_show_hours_display).toBe(true);
  });

  it('returns empty allowed_hours_types when hours group is disabled', () => {
    const features = { storefront_hours_enabled: true };
    const result = resolveStorefrontHours(features, null);
    expect(result.hours_enabled).toBe(false);
    expect(result.allowed_hours_types).toEqual([]);
  });

  it('defaults merchant preferences to true when null', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.merchant_preferences.hours_enabled).toBe(true);
    expect(result.merchant_preferences.hours_display).toBe(true);
    expect(result.merchant_preferences.hours_animated).toBe(true);
    expect(result.merchant_preferences.hours_status).toBe(true);
    expect(result.can_use_animated_hours).toBe(true);
    expect(result.can_show_hours_status).toBe(true);
  });

  it('disables hours display when merchant prefs hours_display is false', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_display: true,
    };
    const merchantPrefs = { hours_display: false };
    const result = resolveStorefrontHours(features, merchantPrefs);
    expect(result.hours_display_enabled).toBe(false);
    expect(result.can_show_hours_display).toBe(false);
  });
});
