import { describe, it, expect } from 'vitest';
import { resolveStorefrontMaps } from './StorefrontMapsResolver';

describe('resolveStorefrontMaps', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontMaps({}, null);
    expect(result.enabled).toBe(false);
    expect(result.maps_enabled).toBe(false);
    expect(result.can_show_map_display).toBe(false);
    expect(result.can_show_location_display).toBe(false);
    expect(result.can_use_interactive_maps).toBe(false);
  });

  it('returns disabled when storefront_maps_disabled is set', () => {
    const result = resolveStorefrontMaps({ storefront_maps_enabled: true, storefront_maps_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables maps with new storefront_maps_* keys', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_interactive: true,
      storefront_maps_display: true,
      storefront_maps_location: true,
    };
    const result = resolveStorefrontMaps(features, null);
    expect(result.enabled).toBe(true);
    expect(result.maps_enabled).toBe(true);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(true);
    expect(result.can_show_location_display).toBe(true);
  });

  it('falls back to old storefront_opt_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_interactive_maps: true,
      storefront_opt_map_display: true,
      storefront_opt_location_display: true,
    };
    const result = resolveStorefrontMaps({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.maps_enabled).toBe(true);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(true);
    expect(result.can_show_location_display).toBe(true);
  });

  it('respects flexible key', () => {
    const features = { storefront_maps_enabled: true, storefront_maps_flexible: true };
    const result = resolveStorefrontMaps(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.maps_enabled).toBe(true);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(true);
    expect(result.can_show_location_display).toBe(true);
  });

  it('respects individual maps feature keys', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_interactive: true,
    };
    const result = resolveStorefrontMaps(features, null);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(false);
    expect(result.can_show_location_display).toBe(false);
  });

  it('respects merchant preferences to filter effective maps', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_interactive: true,
      storefront_maps_display: true,
      storefront_maps_location: true,
    };
    const merchantPrefs = {
      maps_enabled: true,
      interactive_maps: false,
      map_display: true,
      location_display: true,
    };
    const result = resolveStorefrontMaps(features, merchantPrefs);
    expect(result.can_use_interactive_maps).toBe(false);
    expect(result.can_show_map_display).toBe(true);
    expect(result.can_show_location_display).toBe(true);
    expect(result.merchant_preferences.interactive_maps).toBe(false);
  });

  it('disables maps when merchant prefs maps_enabled is false', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_interactive: true,
    };
    const merchantPrefs = { maps_enabled: false };
    const result = resolveStorefrontMaps(features, merchantPrefs);
    expect(result.merchant_preferences.maps_enabled).toBe(false);
  });

  it('falls back to old storefront_opt_interactive_maps key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_interactive_maps: true,
    };
    const result = resolveStorefrontMaps({}, null, fallbackFeatures);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(false);
  });

  it('falls back to old storefront_opt_map_display key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_map_display: true,
    };
    const result = resolveStorefrontMaps({}, null, fallbackFeatures);
    expect(result.can_show_map_display).toBe(true);
  });

  it('falls back to old storefront_opt_location_display key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_location_display: true,
    };
    const result = resolveStorefrontMaps({}, null, fallbackFeatures);
    expect(result.can_show_location_display).toBe(true);
  });

  it('returns maps_enabled false when maps group is disabled', () => {
    const features = { storefront_maps_enabled: true };
    const result = resolveStorefrontMaps(features, null);
    expect(result.maps_enabled).toBe(false);
  });

  it('defaults merchant preferences to true when null', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_interactive: true,
      storefront_maps_display: true,
      storefront_maps_location: true,
    };
    const result = resolveStorefrontMaps(features, null);
    expect(result.merchant_preferences.maps_enabled).toBe(true);
    expect(result.merchant_preferences.interactive_maps).toBe(true);
    expect(result.merchant_preferences.map_display).toBe(true);
    expect(result.merchant_preferences.location_display).toBe(true);
    expect(result.can_use_interactive_maps).toBe(true);
    expect(result.can_show_map_display).toBe(true);
    expect(result.can_show_location_display).toBe(true);
  });

  it('disables map display when merchant prefs map_display is false', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_display: true,
    };
    const merchantPrefs = { map_display: false };
    const result = resolveStorefrontMaps(features, merchantPrefs);
    expect(result.can_show_map_display).toBe(false);
  });

  it('disables location display when merchant prefs location_display is false', () => {
    const features = {
      storefront_maps_enabled: true,
      storefront_maps_location: true,
    };
    const merchantPrefs = { location_display: false };
    const result = resolveStorefrontMaps(features, merchantPrefs);
    expect(result.can_show_location_display).toBe(false);
  });
});
