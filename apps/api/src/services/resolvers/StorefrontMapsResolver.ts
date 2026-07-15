/**
 * Storefront Maps Resolver
 *
 * Resolves the effective storefront maps capability from tier features
 * and merchant preferences.
 *
 * New namespace: storefront_maps_* (storefront_maps capability type)
 * Fallback namespace: storefront_opt_interactive_maps / storefront_opt_map_display / storefront_opt_location_display (storefront_options)
 */

import {
  StorefrontMapsMerchantSettings,
  EffectiveStorefrontMaps,
} from './types';

export function resolveStorefrontMaps(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontMapsMerchantSettings | null,
  fallbackFeatures: Record<string, boolean> = {},
): EffectiveStorefrontMaps {
  const disabled = !!features.storefront_maps_disabled || !!fallbackFeatures.storefront_opt_disabled;
  const enabled = !disabled && (!!features.storefront_maps_enabled || !!fallbackFeatures.storefront_opt_enabled);
  const flexible = !!features.storefront_maps_flexible || !!fallbackFeatures.storefront_opt_flexible;
  const mainOn = enabled;

  // Maps group — new keys with fallback to old storefront_opt_* keys
  const mapsGroupEnabled = flexible
    || !!features.storefront_maps_on || !!features.storefront_maps
    || !!features.storefront_maps_interactive
    || !!features.storefront_maps_display
    || !!features.storefront_maps_location
    || !!fallbackFeatures.storefront_opt_interactive_maps
    || !!fallbackFeatures.storefront_opt_map_display
    || !!fallbackFeatures.storefront_opt_location_display;

  // Individual maps features
  const interactiveMapsTierAllowed = flexible
    || !!features.storefront_maps_interactive
    || !!fallbackFeatures.storefront_opt_interactive_maps;

  const mapDisplayTierAllowed = flexible
    || !!features.storefront_maps_display
    || !!fallbackFeatures.storefront_opt_map_display;

  const locationDisplayTierAllowed = flexible
    || !!features.storefront_maps_location
    || !!fallbackFeatures.storefront_opt_location_display;

  // Merchant preferences (defaults to true unless explicitly false)
  const prefs = {
    maps_enabled: merchantPrefs?.maps_enabled !== false,
    interactive_maps: merchantPrefs?.interactive_maps !== false,
    map_display: merchantPrefs?.map_display !== false,
    location_display: merchantPrefs?.location_display !== false,
  };

  return {
    enabled: mainOn,
    is_flexible: flexible,
    maps_enabled: mainOn && mapsGroupEnabled,
    can_show_map_display: mainOn && mapDisplayTierAllowed && prefs.map_display,
    can_show_location_display: mainOn && locationDisplayTierAllowed && prefs.location_display,
    can_use_interactive_maps: mainOn && interactiveMapsTierAllowed && prefs.interactive_maps,
    merchant_preferences: prefs,
  };
}
