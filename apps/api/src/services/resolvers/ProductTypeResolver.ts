/**
 * Product Type Resolver
 *
 * Resolves effective product type from tier features + merchant preferences.
 * Mirrors StorefrontTypeResolver pattern.
 *
 * Checks new canonical keys (product_types_*) first, then falls back to
 * legacy keys (product_*) for backward compatibility.
 */

import type {
  EffectiveProductType,
  ProductType,
  ProductTypeValue,
  ProductTypeMerchantSettings,
} from './types';

/**
 * Resolve effective product type state from tier features + merchant prefs.
 * This is a pure function — no DB access.
 */
export function resolveProductType(
  features: Record<string, boolean>,
  merchantPrefs: ProductTypeMerchantSettings | null
): EffectiveProductType {
  // ── Master gates (R17: disabled > enabled > flexible > features) ──
  const masterDisabled = !!features.product_types_disabled;
  const masterEnabled = !!features.product_types_enabled;
  const flexible = !!features.product_types_flexible;

  // Backward compat: fall back to legacy keys if new keys not present
  const legacyEnabled = !!features.product_enabled;
  const legacyFlexible = !!features.product_flexible;
  const legacyDisabled = !!features.product_disabled;

  const isEnabled = masterDisabled
    ? false
    : masterEnabled
      ? true
      : flexible
        ? true
        : legacyDisabled
          ? false
          : legacyEnabled
            ? true
            : legacyFlexible
              ? true
              : hasAnyTypeFeature(features);

  const isFlexible = flexible || legacyFlexible;

  // ── Allowed types (new keys first, then legacy fallback) ──
  const allowedTypes: ProductType[] = [];
  const allTypes: ProductType[] = ['physical', 'digital', 'hybrid', 'service'];

  if (isFlexible) {
    allowedTypes.push(...allTypes);
  } else {
    // New canonical keys
    if (features.product_types_physical) allowedTypes.push('physical');
    if (features.product_types_digital) allowedTypes.push('digital');
    if (features.product_types_hybrid) allowedTypes.push('hybrid');
    if (features.product_types_service) allowedTypes.push('service');

    // Legacy fallback (only if no new keys found)
    if (allowedTypes.length === 0) {
      if (features.product_physical) allowedTypes.push('physical');
      if (features.product_digital) allowedTypes.push('digital');
      if (features.product_hybrid) allowedTypes.push('hybrid');
      if (features.product_service) allowedTypes.push('service');
    }
  }
  const uniqueAllowedTypes = [...new Set(allowedTypes)];

  // ── Determine type ──
  let type: ProductTypeValue = 'none';
  if (!isEnabled) {
    type = 'none';
  } else if (isFlexible || uniqueAllowedTypes.length >= allTypes.length) {
    type = 'flexible';
  } else if (uniqueAllowedTypes.length === 1) {
    type = uniqueAllowedTypes[0];
  } else if (uniqueAllowedTypes.length > 1) {
    type = 'flexible';
  }

  // ── Merchant preferences ──
  const productTypesEnabled = merchantPrefs?.product_types_enabled !== false;
  const rawSelected = merchantPrefs?.selected_product_type;

  // Validate selected type against tier allowed types
  let selectedProductType: ProductTypeValue = type;
  let hasMerchantSelection = false;

  if (isEnabled && type === 'flexible' && productTypesEnabled && rawSelected) {
    if (uniqueAllowedTypes.includes(rawSelected as ProductType)) {
      selectedProductType = rawSelected as ProductType;
      hasMerchantSelection = true;
    }
  }

  // Effective type: if merchant has selected a specific type and tier allows it, use it
  let effectiveType: ProductTypeValue = type;
  if (isEnabled && type === 'flexible' && productTypesEnabled) {
    if (selectedProductType !== 'flexible' && uniqueAllowedTypes.includes(selectedProductType as ProductType)) {
      effectiveType = selectedProductType;
    }
  }

  return {
    enabled: isEnabled && productTypesEnabled,
    type,
    effective_type: effectiveType,
    is_flexible: isFlexible,
    allowed_types: uniqueAllowedTypes,
    has_merchant_selection: hasMerchantSelection,
    merchant_preferences: {
      product_types_enabled: productTypesEnabled,
      selected_product_type: selectedProductType,
    },
  };
}

function hasAnyTypeFeature(features: Record<string, boolean>): boolean {
  return !!(
    features.product_types_physical ||
    features.product_types_digital ||
    features.product_types_hybrid ||
    features.product_types_service ||
    features.product_physical ||
    features.product_digital ||
    features.product_hybrid ||
    features.product_service
  );
}
