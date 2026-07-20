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
 *
 * Merchant gates: each feature has a merchant toggle (default true). The effective
 * can_use_* flag is tier-allowed AND merchant-enabled. This mirrors FunnelResolver.
 */

import type {
  EffectiveCouponOptions,
  CouponDiscountType,
  CouponOptionsMerchantSettings,
} from './types';

const DISCOUNT_TYPE_MAP: { key: string; type: CouponDiscountType; toggleKey: keyof CouponOptionsMerchantSettings }[] = [
  { key: 'coupon_percent_off', type: 'percent_off', toggleKey: 'percent_off_enabled' },
  { key: 'coupon_fixed_amount', type: 'fixed_amount', toggleKey: 'fixed_amount_enabled' },
  { key: 'coupon_free_shipping', type: 'free_shipping', toggleKey: 'free_shipping_enabled' },
  { key: 'coupon_bogo', type: 'bogo', toggleKey: 'bogo_enabled' },
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

  const tierCanTargetProducts = flexible || !!features.coupon_targeted;
  const tierCanSetLimits = flexible || !!features.coupon_limited_redemption;
  const tierCanViewAnalytics = flexible || !!features.coupon_analytics;
  const tierCanUseQrSharing = flexible || !!features.coupon_qr_sharing;
  const tierCanUseSpotlight = flexible || !!features.coupon_spotlight;

  // Determine tier-allowed discount types from group gate + individual feature keys
  const tierAllowedDiscountTypes: CouponDiscountType[] = [];
  for (const { key, type } of DISCOUNT_TYPE_MAP) {
    if (groupOn && !groupOff) {
      tierAllowedDiscountTypes.push(type);
    } else if (!groupOff && !!features[key]) {
      tierAllowedDiscountTypes.push(type);
    }
  }

  const tierEnabled = masterEnabled && !disabled && tierAllowedDiscountTypes.length > 0;

  // Merchant gate helper (default true if no prefs)
  const merchantGate = (toggleKey: keyof CouponOptionsMerchantSettings): boolean => {
    if (!merchantPrefs) return true;
    const val = merchantPrefs[toggleKey];
    return val === null || val === undefined ? true : !!val;
  };

  // Merchant preference soft toggle (default: enabled if tier allows)
  const prefEnabled = merchantGate('coupon_enabled');
  const effectiveEnabled = tierEnabled && prefEnabled;

  // Apply merchant gates to each feature
  const mPercentOff = merchantGate('percent_off_enabled');
  const mFixedAmount = merchantGate('fixed_amount_enabled');
  const mFreeShipping = merchantGate('free_shipping_enabled');
  const mBogo = merchantGate('bogo_enabled');
  const mTargetProducts = merchantGate('target_products_enabled');
  const mQrSharing = merchantGate('qr_sharing_enabled');
  const mSpotlight = merchantGate('spotlight_enabled');

  // Filter discount types by merchant gate
  const allowed_discount_types = effectiveEnabled
    ? tierAllowedDiscountTypes.filter(dt => {
        if (dt === 'percent_off') return mPercentOff;
        if (dt === 'fixed_amount') return mFixedAmount;
        if (dt === 'free_shipping') return mFreeShipping;
        if (dt === 'bogo') return mBogo;
        return true;
      })
    : [];

  return {
    enabled: effectiveEnabled,
    can_create_coupons: effectiveEnabled,
    can_use_percent_off: effectiveEnabled && allowed_discount_types.includes('percent_off'),
    can_use_fixed_amount: effectiveEnabled && allowed_discount_types.includes('fixed_amount'),
    can_use_free_shipping: effectiveEnabled && allowed_discount_types.includes('free_shipping'),
    can_use_bogo: effectiveEnabled && allowed_discount_types.includes('bogo'),
    can_target_products: effectiveEnabled && tierCanTargetProducts && mTargetProducts,
    can_set_limits: effectiveEnabled && tierCanSetLimits,
    can_view_analytics: effectiveEnabled && tierCanViewAnalytics,
    can_use_qr_sharing: effectiveEnabled && tierCanUseQrSharing && mQrSharing,
    can_use_spotlight: effectiveEnabled && tierCanUseSpotlight && mSpotlight,
    allowed_discount_types,
    is_flexible: flexible,
    merchant_preferences: merchantPrefs ?? null,
  };
}
