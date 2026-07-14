/**
 * Storefront Hours Resolver
 *
 * Resolves the effective storefront hours capability from tier features
 * and merchant preferences.
 *
 * New namespace: storefront_hours_* (storefront_hours capability type)
 * Fallback namespace: storefront_opt_hours_* / storefront_opt_* (storefront_options)
 */

import {
  StorefrontOptHoursType,
  StorefrontHoursMerchantSettings,
  EffectiveStorefrontHours,
} from './types';

export function resolveStorefrontHours(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontHoursMerchantSettings | null,
  fallbackFeatures: Record<string, boolean> = {},
): EffectiveStorefrontHours {
  const disabled = !!features.storefront_hours_disabled || !!fallbackFeatures.storefront_opt_disabled;
  const enabled = !disabled && (!!features.storefront_hours_enabled || !!fallbackFeatures.storefront_opt_enabled);
  const flexible = !!features.storefront_hours_flexible || !!fallbackFeatures.storefront_opt_flexible;
  const mainOn = enabled;

  // Hours group — new keys with fallback to old storefront_opt_hours_* keys
  const hoursGroupEnabled = flexible
    || !!features.storefront_hours_on || !!features.storefront_hours
    || !!fallbackFeatures.storefront_opt_hours_on
    || !!fallbackFeatures.storefront_opt_hours_enabled;

  // Hours display toggle (separate from group — controls whether hours section shows)
  const hoursDisplayTierAllowed = flexible
    || !!features.storefront_hours_display
    || !!fallbackFeatures.storefront_opt_hours_display;

  // Individual hours features
  const allowedHoursTypes: StorefrontOptHoursType[] = [];
  if (hoursGroupEnabled) {
    if (flexible) {
      allowedHoursTypes.push('hours_animated', 'hours_status');
    } else {
      if (features.storefront_hours_animated || fallbackFeatures.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
      if (features.storefront_hours_status || fallbackFeatures.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
    }
  }

  // Merchant preferences (defaults to true unless explicitly false)
  const prefs: Record<string, boolean> = {
    hours_enabled: merchantPrefs?.hours_enabled !== false,
    hours_display: merchantPrefs?.hours_display !== false,
    hours_animated: merchantPrefs?.hours_animated !== false,
    hours_status: merchantPrefs?.hours_status !== false,
  };

  // Effective filters — remove types the merchant has turned off
  const effectiveHoursTypes = mainOn ? allowedHoursTypes.filter((t) => prefs[t] !== false) : [];

  return {
    enabled: mainOn,
    is_flexible: flexible,
    hours_enabled: mainOn && (hoursGroupEnabled || allowedHoursTypes.length > 0),
    allowed_hours_types: allowedHoursTypes,
    hours_display_enabled: mainOn && hoursDisplayTierAllowed && prefs.hours_display,
    can_show_hours_display: mainOn && hoursDisplayTierAllowed && prefs.hours_display,
    can_use_animated_hours: mainOn && effectiveHoursTypes.includes('hours_animated'),
    can_show_hours_status: mainOn && effectiveHoursTypes.includes('hours_status'),
    merchant_preferences: prefs,
  };
}
