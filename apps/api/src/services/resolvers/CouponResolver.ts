/**
 * Coupon Resolver
 *
 * Resolves effective coupon capability from merged tier + purchased features.
 * Follows the canonical feature-key convention for options capabilities:
 *   <capability_key>_enabled / _disabled
 *   <capability_key>_flexible
 *   <capability_key>_<group>_on / _off
 *   <capability_key>_<group>_<feature>
 *
 * For coupon_options the group is "discount_types" and the features are the discount types.
 */

import type {
  EffectiveCouponOptions,
  CouponDiscountType,
  CouponOptionsMerchantSettings,
} from './types';

const DISCOUNT_TYPE_MAP: { key: string; type: CouponDiscountType }[] = [
  { key: 'coupon_percent_off', type: 'percent_off' },
  { key: 'coupon_fixed_amount', type: 'fixed_amount' },
  { key: 'coupon_free_shipping', type: 'free_shipping' },
  { key: 'coupon_bogo', type: 'bogo' },
];

export function resolveCouponOptions(
  features: Record<string, boolean>,
  merchantPrefs: CouponOptionsMerchantSettings | null
): EffectiveCouponOptions {
  const disabled = !!features.coupon_disabled;
  const masterEnabled = !!features.coupon_enabled;
  const flexible = !!features.coupon_flexible;
  const groupOn = flexible || !!features.coupon_discount_types_on;
  const groupOff = !!features.coupon_discount_types_off;

  const canTargetProducts = !!features.coupon_targeted;
  const canSetLimits = !!features.coupon_limited_redemption;
  const canViewAnalytics = !!features.coupon_analytics;
  const canUseQrSharing = !!features.coupon_qr_sharing;
  const canUseSpotlight = !!features.coupon_spotlight;

  // Determine allowed discount types from group gate + individual feature keys
  const allowed_discount_types: CouponDiscountType[] = [];
  for (const { key, type } of DISCOUNT_TYPE_MAP) {
    if (groupOn && !groupOff) {
      allowed_discount_types.push(type);
    } else if (!groupOff && !!features[key]) {
      allowed_discount_types.push(type);
    }
  }

  const tierEnabled = masterEnabled && !disabled && allowed_discount_types.length > 0;

  // Merchant preference soft toggle (default: enabled if tier allows)
  const prefEnabled = merchantPrefs?.coupon_enabled !== false;
  const effectiveEnabled = tierEnabled && prefEnabled;

  return {
    enabled: effectiveEnabled,
    can_create_coupons: effectiveEnabled,
    can_use_percent_off: effectiveEnabled && allowed_discount_types.includes('percent_off'),
    can_use_fixed_amount: effectiveEnabled && allowed_discount_types.includes('fixed_amount'),
    can_use_free_shipping: effectiveEnabled && allowed_discount_types.includes('free_shipping'),
    can_use_bogo: effectiveEnabled && allowed_discount_types.includes('bogo'),
    can_target_products: effectiveEnabled && canTargetProducts,
    can_set_limits: effectiveEnabled && canSetLimits,
    can_view_analytics: effectiveEnabled && canViewAnalytics,
    can_use_qr_sharing: effectiveEnabled && canUseQrSharing,
    can_use_spotlight: effectiveEnabled && canUseSpotlight,
    allowed_discount_types: effectiveEnabled ? allowed_discount_types : [],
    is_flexible: flexible,
  };
}
