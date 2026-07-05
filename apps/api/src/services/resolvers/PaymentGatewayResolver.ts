/**
 * Payment Gateway Resolver
 *
 * Tier capability = hard gate (allowed/disallowed by plan)
 * Merchant preference = soft toggle (merchant can disable even if tier allows)
 * Effective = tier allows AND merchant preference enabled
 */

import type {
  EffectivePaymentGateway,
  PaymentGatewayMerchantSettings,
} from './types';

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';

/**
 * Resolve effective payment gateway state from raw capability features + merchant preferences.
 */
export function resolvePaymentGateway(
  features: Record<string, boolean>,
  merchantPrefs: PaymentGatewayMerchantSettings | null
): EffectivePaymentGateway {
  const disabled = !!features.payment_gateway_disabled;
  const enabled = !disabled && !!features.payment_gateway_enabled;
  const flexible = !!features.payment_gateway_flexible;

  // Tier-allowed gateways (hard gate)
  const allowedGateways: GatewayType[] = [];
  if (flexible) {
    allowedGateways.push('stripe', 'paypal', 'square', 'clover');
  } else {
    if (features.payment_gateway_stripe) allowedGateways.push('stripe');
    if (features.payment_gateway_paypal) allowedGateways.push('paypal');
    if (features.payment_gateway_square) allowedGateways.push('square');
    if (features.payment_gateway_clover) allowedGateways.push('clover');
  }

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    gateway_enabled: merchantPrefs?.gateway_enabled !== false,
    stripe_enabled: merchantPrefs?.stripe_enabled !== false,
    paypal_enabled: merchantPrefs?.paypal_enabled !== false,
    square_enabled: merchantPrefs?.square_enabled !== false,
    clover_enabled: merchantPrefs?.clover_enabled !== false,
  };

  // Effective gateways = tier allows AND merchant enabled AND master gateway switch on
  const effectiveGateways = allowedGateways.filter((gw) => {
    if (!prefs.gateway_enabled) return false;
    return prefs[`${gw}_enabled` as keyof typeof prefs];
  });

  return {
    enabled: enabled && prefs.gateway_enabled,
    allowed_gateways: allowedGateways,
    effective_gateways: effectiveGateways,
    checkout_available: enabled && prefs.gateway_enabled && effectiveGateways.length > 0,
    merchant_preferences: prefs,
    is_flexible: flexible,
  };
}
