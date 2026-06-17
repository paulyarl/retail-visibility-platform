/**
 * Featured Options Resolver
 *
 * Resolves effective featured options state from tier features + merchant preferences.
 */

import type {
  EffectiveFeatured,
  FeaturedOptionsMerchantSettings,
} from './types';

export type FeaturedType =
  | 'store_selection' | 'new_arrival' | 'seasonal' | 'sale'
  | 'staff_pick' | 'clearance' | 'featured'
  | 'bestseller' | 'trending' | 'recommended' | 'random_featured';

export function resolveFeaturedOptions(
  features: Record<string, boolean>,
  merchantPrefs: FeaturedOptionsMerchantSettings | null
): EffectiveFeatured {
  const enabled = !!features.featured_enabled;
  const disabled = !!features.featured_disabled;
  const flexible = !!features.featured_flexible;

  const tenantControlled: FeaturedType[] = ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured'];
  const platformControlled: FeaturedType[] = ['bestseller', 'trending', 'recommended', 'random_featured'];

  const allowedTenantTypes: FeaturedType[] = [];
  const allowedPlatformTypes: FeaturedType[] = [];

  if (flexible || enabled) {
    for (const t of tenantControlled) {
      if (flexible || features[`featured_${t}`]) allowedTenantTypes.push(t);
    }
    for (const t of platformControlled) {
      if (flexible || features[`featured_${t}`]) allowedPlatformTypes.push(t);
    }
  }

  const prefs = {
    featured_enabled: merchantPrefs?.featured_enabled !== false,
    featured_store_selection: merchantPrefs?.featured_store_selection !== false,
    featured_new_arrival: merchantPrefs?.featured_new_arrival !== false,
    featured_seasonal: merchantPrefs?.featured_seasonal !== false,
    featured_sale: merchantPrefs?.featured_sale !== false,
    featured_staff_pick: merchantPrefs?.featured_staff_pick !== false,
    featured_clearance: merchantPrefs?.featured_clearance !== false,
    featured_featured: merchantPrefs?.featured_featured !== false,
    featured_bestseller: merchantPrefs?.featured_bestseller !== false,
    featured_trending: merchantPrefs?.featured_trending !== false,
    featured_recommended: merchantPrefs?.featured_recommended !== false,
    featured_random_featured: merchantPrefs?.featured_random_featured !== false,
    featured_expiry_monitor: merchantPrefs?.featured_expiry_monitor !== false,
  };

  const effectiveTenantTypes = allowedTenantTypes.filter((t) => prefs[`featured_${t}` as keyof typeof prefs] !== false);
  const effectivePlatformTypes = allowedPlatformTypes.filter((t) => prefs[`featured_${t}` as keyof typeof prefs] !== false);

  return {
    enabled: enabled && !disabled,
    tenant_enabled: enabled && !disabled && allowedTenantTypes.length > 0,
    platform_enabled: enabled && !disabled && allowedPlatformTypes.length > 0,
    allowed_tenant_types: allowedTenantTypes,
    allowed_platform_types: allowedPlatformTypes,
    allowed_types: [...allowedTenantTypes, ...allowedPlatformTypes],
    effective_tenant_types: effectiveTenantTypes,
    effective_platform_types: effectivePlatformTypes,
    effective_types: [...effectiveTenantTypes, ...effectivePlatformTypes],
    featured_available: enabled && !disabled && (allowedTenantTypes.length + allowedPlatformTypes.length) > 0,
    effective_featured_available: enabled && !disabled && (effectiveTenantTypes.length + effectivePlatformTypes.length) > 0,
    expiry_monitor_enabled: !!features.featured_expiry_monitor,
    merchant_preferences: prefs,
    is_flexible: flexible,
  };
}
