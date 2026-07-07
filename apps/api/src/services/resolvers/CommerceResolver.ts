/**
 * Commerce Resolver
 *
 * Resolves effective commerce state from tier features + merchant settings.
 * Reuses the existing getTenantCommerceCapabilities utility which already
 * handles tier → org → tenant hierarchy and computes checkout mode.
 */

import {
  getTenantCommerceCapabilities,
  getPublicCommerceCapabilities,
  CommerceCapabilities,
} from '../../utils/commerce-capabilities';
import type {
  EffectiveCommerce,
  CommerceMerchantSettings,
  RawCapabilitiesInput,
} from './types';

/**
 * Resolve effective commerce state.
 *
 * @param tenantId       Tenant identifier
 * @param rawCaps        Raw tier capabilities (capability group + features)
 * @param merchantPrefs  Merchant settings from tenant_commerce_settings
 * @returns Flat effective commerce state for frontend consumption
 */
export async function resolveCommerce(
  tenantId: string,
  rawCaps: RawCapabilitiesInput,
  merchantPrefs: CommerceMerchantSettings | null
): Promise<EffectiveCommerce> {
  // The existing utility already queries tier features, org settings, tenant settings
  // and returns a merged CommerceCapabilities object.
  const caps = await getTenantCommerceCapabilities(tenantId);

  // Check for explicit _disabled meta-key (disabled > enabled > flexible > features)
  const commerceDisabled = !!rawCaps.capabilities.commerce_types?.features?.commerce_disabled;
  const commerceEnabled = !commerceDisabled && caps.commerce_enabled;

  // Merchant preferences as booleans (default true when unset)
  const depositEnabled = merchantPrefs?.deposit_enabled !== false;
  const fullPaymentEnabled = merchantPrefs?.full_payment_enabled !== false;

  // Effective payment type: tier allows AND merchant enabled
  let effectivePaymentType: EffectiveCommerce['payment_type'] = 'none';
  if (!commerceEnabled) {
    effectivePaymentType = 'none';
  } else if (caps.deposit_enabled && caps.full_payment_enabled) {
    effectivePaymentType = depositEnabled && fullPaymentEnabled ? 'flexible'
      : fullPaymentEnabled ? 'full'
      : depositEnabled ? 'deposit'
      : 'none';
  } else if (caps.full_payment_enabled) {
    effectivePaymentType = fullPaymentEnabled ? 'full' : 'none';
  } else if (caps.deposit_enabled) {
    effectivePaymentType = depositEnabled ? 'deposit' : 'none';
  }

  const effectiveCartVisible = commerceEnabled && effectivePaymentType !== 'none';

  return {
    enabled: commerceEnabled,
    cart_visible: commerceEnabled && (caps.deposit_enabled || caps.full_payment_enabled),
    payment_type: caps.deposit_enabled && caps.full_payment_enabled ? 'flexible'
      : caps.full_payment_enabled ? 'full'
      : caps.deposit_enabled ? 'deposit'
      : 'none',
    effective_payment_type: effectivePaymentType,
    effective_cart_visible: effectiveCartVisible,
    checkout_available: effectiveCartVisible,
    checkout_mode: getPublicCommerceCapabilities(caps).checkout_mode,
    merchant_preferences: {
      deposit_enabled: depositEnabled,
      full_payment_enabled: fullPaymentEnabled,
    },
    is_flexible: commerceEnabled && caps.deposit_enabled && caps.full_payment_enabled,
  };
}
