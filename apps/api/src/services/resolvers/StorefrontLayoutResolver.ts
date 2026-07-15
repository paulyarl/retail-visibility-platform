/**
 * Storefront Layouts Resolver
 *
 * Resolves the effective storefront layouts capability from tier features
 * and merchant preferences.
 *
 * New namespace: storefront_layouts_* (storefront_layouts capability type)
 * Fallback namespace: storefront_opt_layout_* / storefront_opt_* (storefront_options)
 */

import {
  StorefrontLayoutType,
  StorefrontLayoutMerchantSettings,
  EffectiveStorefrontLayouts,
} from './types';

export function resolveStorefrontLayouts(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontLayoutMerchantSettings | null,
  fallbackFeatures: Record<string, boolean> = {},
): EffectiveStorefrontLayouts {
  const disabled = !!features.storefront_layouts_disabled || !!fallbackFeatures.storefront_opt_disabled;
  const enabled = !disabled && (!!features.storefront_layouts_enabled || !!fallbackFeatures.storefront_opt_enabled);
  const flexible = !!features.storefront_layouts_flexible || !!fallbackFeatures.storefront_opt_flexible;
  const mainOn = enabled;

  // Layout group — new keys with fallback to old storefront_opt_layout_* keys
  const layoutGroupEnabled = flexible
    || !!features.storefront_layouts_on || !!features.storefront_layouts
    || !!fallbackFeatures.storefront_opt_layout_on
    || !!fallbackFeatures.storefront_opt_layout_enabled;

  // Individual layout features
  const allowedLayouts: StorefrontLayoutType[] = [];
  if (layoutGroupEnabled) {
    if (flexible) {
      allowedLayouts.push('classic', 'editorial', 'immersive');
    } else {
      if (features.storefront_layouts_classic || fallbackFeatures.storefront_opt_layout_classic) allowedLayouts.push('classic');
      if (features.storefront_layouts_editorial || fallbackFeatures.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
      if (features.storefront_layouts_immersive || fallbackFeatures.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
    }
  }

  // Merchant preferences
  const prefs = {
    layouts_enabled: merchantPrefs?.layouts_enabled !== false,
    storefront_layout: merchantPrefs?.storefront_layout || 'classic',
  };

  // Effective layout — merchant's choice if allowed, otherwise first available
  const effectiveLayouts = mainOn ? allowedLayouts : [];
  const merchantLayoutChoice = merchantPrefs?.storefront_layout || 'classic';
  const effectiveLayout: StorefrontLayoutType = effectiveLayouts.includes(merchantLayoutChoice as StorefrontLayoutType)
    ? (merchantLayoutChoice as StorefrontLayoutType)
    : (effectiveLayouts[0] || 'classic');

  return {
    enabled: mainOn,
    is_flexible: flexible,
    layout_enabled: mainOn && allowedLayouts.length > 0,
    allowed_layouts: allowedLayouts,
    effective_layout: effectiveLayout,
    can_use_layout_classic: mainOn && allowedLayouts.includes('classic'),
    can_use_layout_editorial: mainOn && allowedLayouts.includes('editorial'),
    can_use_layout_immersive: mainOn && allowedLayouts.includes('immersive'),
    merchant_preferences: prefs,
  };
}
