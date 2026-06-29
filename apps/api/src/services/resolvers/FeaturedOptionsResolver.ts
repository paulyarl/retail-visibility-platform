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
  const flexible = !!features.featured_flexible;

  // Fail-open: when no tier config exists at all, allow all types.
  // This matches the SQL gate behavior in tier-capability-sql.ts where
  // tfa.tier_key IS_NULL skips all capability gating.
  const hasAnyFeaturedConfig = Object.keys(features).some(k => k.startsWith('featured_'));

  const tenantControlled: FeaturedType[] = ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured'];
  const platformControlled: FeaturedType[] = ['bestseller', 'trending', 'recommended', 'random_featured'];

  const allowedTenantTypes: FeaturedType[] = [];
  const allowedPlatformTypes: FeaturedType[] = [];

  if (!hasAnyFeaturedConfig || flexible || enabled) {
    for (const t of tenantControlled) {
      if (!hasAnyFeaturedConfig || flexible || features[`featured_${t}`]) allowedTenantTypes.push(t);
    }
    for (const t of platformControlled) {
      if (!hasAnyFeaturedConfig || flexible || features[`featured_${t}`]) allowedPlatformTypes.push(t);
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

  // Fail-open: unconfigured tiers are treated as enabled to match SQL gate behavior
  const isEnabled = !hasAnyFeaturedConfig || enabled;

  return {
    enabled: isEnabled,
    tenant_enabled: isEnabled && allowedTenantTypes.length > 0,
    platform_enabled: isEnabled && allowedPlatformTypes.length > 0,
    allowed_tenant_types: allowedTenantTypes,
    allowed_platform_types: allowedPlatformTypes,
    allowed_types: [...allowedTenantTypes, ...allowedPlatformTypes],
    effective_tenant_types: effectiveTenantTypes,
    effective_platform_types: effectivePlatformTypes,
    effective_types: [...effectiveTenantTypes, ...effectivePlatformTypes],
    featured_available: isEnabled && (allowedTenantTypes.length + allowedPlatformTypes.length) > 0,
    effective_featured_available: isEnabled && (effectiveTenantTypes.length + effectivePlatformTypes.length) > 0,
    expiry_monitor_enabled: flexible || !!features.featured_expiry_monitor,
    merchant_preferences: prefs,
    is_flexible: flexible,
  };
}
