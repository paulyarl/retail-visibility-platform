/**
 * Google Integration Capability Gate
 *
 * Checks whether a tenant's tier allows Google integration features
 * (GMC sync, GBP sync) before performing sync operations.
 *
 * Gate hierarchy:
 *   - Storefront type gate: only `retail` and `service` types qualify for Google sync.
 *     `online` (no physical location) and `social` (social commerce via Meta/TikTok) are excluded.
 *   - Product type gate (GMC only): tenants with only `digital` product types are excluded
 *     since Google Merchant Center is for physical/hybrid/service products.
 *   - Integration gate: `google_merchant_center`/`gmc_sync` for GMC, `gbp` for GBP.
 *   - Hours display gate (GBP hours only): `storefront_hours.hours_enabled` must be true.
 */

import { resolveEffectiveCapabilities } from '../../services/EffectiveCapabilityResolver';

/** Storefront types that imply a physical presence and qualify for Google sync. */
const PHYSICAL_STOREFRONT_TYPES = ['retail', 'service'];

/** Product types that are eligible for Google Merchant Center sync (i.e. not digital-only). */
const GMC_ELIGIBLE_PRODUCT_TYPES = ['physical', 'hybrid', 'service'];

/**
 * Resolve the effective storefront type for a tenant.
 * Returns 'none' if storefront is disabled or not configured.
 */
function getEffectiveStorefrontType(caps: any): string {
  const sf = caps?.effective?.storefront;
  if (!sf?.enabled) return 'none';
  return (sf as any)?.effective_type || sf?.type || 'none';
}

/**
 * Check if a tenant's storefront type qualifies for Google sync.
 * Only `retail` and `service` types pass — `online` and `social` are excluded.
 */
export function isStorefrontTypeGoogleEligible(storefrontType: string): boolean {
  return PHYSICAL_STOREFRONT_TYPES.includes(storefrontType);
}

/**
 * Check if a tenant is allowed to use Google Merchant Center sync.
 * Layered gate:
 *   1. storefront_types must be enabled with a physical-presence type (retail or service).
 *   2. product_types must include at least one non-digital type (physical, hybrid, or service).
 *   3. GMC integration must be allowed (`google_merchant_center` or `gmc_sync` in effective_google_types).
 */
export async function isGMCSyncAllowed(tenantId: string): Promise<boolean> {
  try {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective) return false;

    // Layer 1: storefront type gate
    const sfType = getEffectiveStorefrontType(caps);
    if (!isStorefrontTypeGoogleEligible(sfType)) return false;

    // Layer 2: product types gate — exclude digital-only tenants
    const pt = caps.effective.product_types;
    if (!pt?.enabled) return false;
    const effectiveProductTypes: string[] = (pt as any)?.effective_types || [];
    if (effectiveProductTypes.length === 0) return false;
    const hasEligibleProductType = effectiveProductTypes.some(t => GMC_ELIGIBLE_PRODUCT_TYPES.includes(t));
    if (!hasEligibleProductType) return false;

    // Layer 3: GMC integration gate
    if (!caps.effective.integrations) return false;
    const { effective_google_types, enabled } = caps.effective.integrations;
    if (!enabled) return false;

    return effective_google_types.includes('google_merchant_center') ||
           effective_google_types.includes('gmc_sync');
  } catch {
    return false;
  }
}

/**
 * Check if a tenant is allowed to use Google Business Profile sync.
 * Layered gate:
 *   1. storefront_types must be enabled with a physical-presence type (retail or service).
 *   2. GBP integration must be allowed (`gbp` in effective_google_types).
 */
export async function isGBPSyncAllowed(tenantId: string): Promise<boolean> {
  try {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective) return false;

    // Layer 1: storefront type gate
    const sfType = getEffectiveStorefrontType(caps);
    if (!isStorefrontTypeGoogleEligible(sfType)) return false;

    // Layer 2: GBP integration gate
    if (!caps.effective.integrations) return false;
    const { effective_google_types, enabled } = caps.effective.integrations;
    if (!enabled) return false;

    return effective_google_types.includes('gbp');
  } catch {
    return false;
  }
}

/**
 * Check if a tenant is allowed to sync business hours to Google Business Profile.
 * Layered gate:
 *   1. storefront_types must be enabled with a physical-presence type (retail or service).
 *   2. storefront_hours.hours_enabled must be true (merchant hours display gate).
 *   3. GBP integration must be allowed (`gbp` in effective_google_types).
 */
export async function isGBPHoursSyncAllowed(tenantId: string): Promise<boolean> {
  try {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective) return false;

    // Layer 1: storefront type gate
    const sfType = getEffectiveStorefrontType(caps);
    if (!isStorefrontTypeGoogleEligible(sfType)) return false;

    // Layer 2: storefront_hours hours display gate
    if (!(caps.effective.storefront_hours as any)?.hours_enabled) return false;

    // Layer 3: GBP integration gate
    if (!caps.effective.integrations) return false;
    const { effective_google_types, enabled } = caps.effective.integrations;
    if (!enabled) return false;
    if (!effective_google_types.includes('gbp')) return false;

    return true;
  } catch {
    return false;
  }
}
