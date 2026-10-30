/**
 * Google Integration Capability Gate
 *
 * Checks whether a tenant's tier allows Google integration features
 * (GMC sync, GBP sync) before performing sync operations.
 *
 * Gate hierarchy:
 *   - Storefront type gate: `retail` and `service` types qualify for Google sync, as does
 *     `flexible` when the tier allows a physical type (see `isStorefrontTypeGoogleEligible`).
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

interface EffectiveStorefrontInfo {
  enabled: boolean;
  type: string;
  allowedTypes: string[];
}

/**
 * Resolve the effective storefront state for a tenant.
 * Disabled or unconfigured storefront resolves to type 'none' with no allowed types.
 */
function getEffectiveStorefront(caps: any): EffectiveStorefrontInfo {
  const sf = caps?.effective?.storefront;
  if (!sf?.enabled) return { enabled: false, type: 'none', allowedTypes: [] };
  return {
    enabled: true,
    type: (sf as any)?.effective_type || sf?.type || 'none',
    allowedTypes: Array.isArray((sf as any)?.allowed_types) ? (sf as any).allowed_types : [],
  };
}

/**
 * Check if a tenant's storefront type qualifies for Google sync.
 *
 * `retail`/`service` pass directly. `flexible` means the tier grants several
 * storefront types and the merchant never picked one — it passes when any allowed
 * type is physical, otherwise a merchant whose plan includes Google sync is blocked
 * purely for not having answered the storefront-type prompt. `online` and `social`
 * stay excluded.
 */
export function isStorefrontTypeGoogleEligible(
  storefrontType: string,
  allowedTypes: string[] = [],
): boolean {
  if (PHYSICAL_STOREFRONT_TYPES.includes(storefrontType)) return true;
  if (storefrontType === 'flexible') {
    return allowedTypes.some(t => PHYSICAL_STOREFRONT_TYPES.includes(t));
  }
  return false;
}

/**
 * Why a tenant was (or wasn't) allowed to use GMC sync. Routes map these to
 * distinct error codes so a merchant who merely hasn't picked a storefront type
 * isn't told to upgrade a plan that already includes GMC.
 */
export type GMCSyncGateReason =
  | 'ok'
  | 'no_capabilities'
  | 'storefront_disabled'
  | 'storefront_type_required'
  | 'storefront_type_ineligible'
  | 'product_types_disabled'
  | 'product_types_ineligible'
  | 'integration_disabled'
  | 'integration_not_in_plan'
  | 'error';

export interface GMCSyncGateResult {
  allowed: boolean;
  reason: GMCSyncGateReason;
}

/**
 * Evaluate the GMC sync gate, returning the blocking reason.
 * Layered gate:
 *   1. storefront_types must be enabled with a physical-presence type (retail or
 *      service, or `flexible` with a physical type allowed).
 *   2. product_types must include at least one non-digital type (physical, hybrid, or service).
 *   3. GMC integration must be allowed (`google_merchant_center` or `gmc_sync` in effective_google_types).
 */
export async function evaluateGMCSyncGate(tenantId: string): Promise<GMCSyncGateResult> {
  try {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective) return { allowed: false, reason: 'no_capabilities' };

    // Layer 1: storefront type gate
    const sf = getEffectiveStorefront(caps);
    if (!sf.enabled) return { allowed: false, reason: 'storefront_disabled' };
    if (!isStorefrontTypeGoogleEligible(sf.type, sf.allowedTypes)) {
      const couldBePhysical = sf.allowedTypes.some(t => PHYSICAL_STOREFRONT_TYPES.includes(t));
      return {
        allowed: false,
        reason: couldBePhysical ? 'storefront_type_required' : 'storefront_type_ineligible',
      };
    }

    // Layer 2: product types gate — exclude digital-only tenants
    const pt = caps.effective.product_types;
    if (!pt?.enabled) return { allowed: false, reason: 'product_types_disabled' };
    const effectiveProductTypes: string[] = (pt as any)?.effective_types || [];
    if (effectiveProductTypes.length === 0) return { allowed: false, reason: 'product_types_disabled' };
    if (!effectiveProductTypes.some(t => GMC_ELIGIBLE_PRODUCT_TYPES.includes(t))) {
      return { allowed: false, reason: 'product_types_ineligible' };
    }

    // Layer 3: GMC integration gate
    if (!caps.effective.integrations) return { allowed: false, reason: 'integration_disabled' };
    const { effective_google_types, enabled } = caps.effective.integrations;
    if (!enabled) return { allowed: false, reason: 'integration_disabled' };

    const inPlan = effective_google_types.includes('google_merchant_center') ||
                   effective_google_types.includes('gmc_sync');
    return inPlan
      ? { allowed: true, reason: 'ok' }
      : { allowed: false, reason: 'integration_not_in_plan' };
  } catch {
    return { allowed: false, reason: 'error' };
  }
}

/**
 * Check if a tenant is allowed to use Google Merchant Center sync.
 * Thin boolean wrapper over `evaluateGMCSyncGate` for callers that don't need the
 * blocking reason (background jobs, readiness flags).
 */
export async function isGMCSyncAllowed(tenantId: string): Promise<boolean> {
  return (await evaluateGMCSyncGate(tenantId)).allowed;
}

/**
 * Map a blocked GMC sync gate reason to the HTTP error the route should return.
 *
 * `storefront_type_required` / `product_types_disabled` are fixable setup gaps, not
 * plan limits — they must not tell the merchant to upgrade a plan that already
 * includes GMC. Only `integration_not_in_plan` / `storefront_type_ineligible` are
 * genuine tier restrictions.
 */
export function gmcSyncGateError(
  reason: GMCSyncGateReason,
  tenantId: string,
): { status: number; error: string; message: string; actionUrl?: string } {
  switch (reason) {
    case 'storefront_type_required':
      return {
        status: 409,
        error: 'storefront_type_required',
        message: 'Choose a retail or service storefront type to enable Google Merchant Center sync.',
        actionUrl: `/t/${tenantId}/settings/storefront-type-options`,
      };
    case 'storefront_disabled':
      return {
        status: 409,
        error: 'storefront_type_required',
        message: 'Enable your storefront and choose a retail or service type to enable Google Merchant Center sync.',
        actionUrl: `/t/${tenantId}/settings/storefront-type-options`,
      };
    case 'product_types_disabled':
    case 'product_types_ineligible':
      return {
        status: 409,
        error: 'product_types_ineligible',
        message: 'Google Merchant Center sync requires physical, hybrid, or service products. Enable a physical product type to use this feature.',
        actionUrl: `/t/${tenantId}/settings/product-types`,
      };
    case 'no_capabilities':
    case 'error':
      return {
        status: 503,
        error: 'capability_unavailable',
        message: 'Unable to verify your Google Merchant Center entitlements right now. Please try again.',
      };
    default:
      return {
        status: 403,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan. Please upgrade to use this feature.',
      };
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
    const sf = getEffectiveStorefront(caps);
    if (!isStorefrontTypeGoogleEligible(sf.type, sf.allowedTypes)) return false;

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
    const sf = getEffectiveStorefront(caps);
    if (!isStorefrontTypeGoogleEligible(sf.type, sf.allowedTypes)) return false;

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

/** GBP Management module features gated through `gbp_management` (migration 243/342). */
export type GbpManagementFeature = 'ai_response' | 'posts_scheduler' | 'media_upload' | 'attributes' | 'managed_service';

/**
 * Check whether the tenant is entitled to a `gbp_management` feature.
 *
 * Reads the resolved capability state (tier + BSaaS purchase + admin grant, and
 * the flexible key) — never the merchant soft gate, per R33. A merchant who has
 * the capability but has toggled public display off still passes this gate.
 */
export async function isGbpManagementFeatureAllowed(
  tenantId: string,
  feature: GbpManagementFeature,
): Promise<boolean> {
  try {
    const caps = await resolveEffectiveCapabilities(tenantId);
    const gbp = (caps?.effective as any)?.gbp_management;
    if (!gbp) return false;
    switch (feature) {
      case 'ai_response':
        return !!gbp.can_use_ai_response;
      case 'posts_scheduler':
        return !!gbp.can_use_posts_scheduler;
      case 'media_upload':
        return !!gbp.can_use_media_upload;
      case 'attributes':
        return !!gbp.can_use_attributes;
      case 'managed_service':
        return !!gbp.can_use_managed_service;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
