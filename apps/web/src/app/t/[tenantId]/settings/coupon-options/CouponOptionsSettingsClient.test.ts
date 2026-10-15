import { describe, it, expect } from 'vitest';
import { couponTierAllowed, FEATURE_TOGGLES } from './CouponOptionsSettingsClient';
import type { CouponOptionsState } from '@/services/CapabilityResolutionService';

// Regression: every switch on the coupon-options page was gated on the *effective*
// can_use_* flags, which already fold in the merchant's own toggles. Turning a switch
// off — or simply having no settings row — made the page report "not included in your
// plan" and the switch became unflippable. Spotlight in particular could never be
// enabled, so the storefront panel could never appear. Allowance now comes from the
// tier block, which is computed before merchant gates are applied.
const cap = (over: Partial<CouponOptionsState> = {}): CouponOptionsState => ({
  enabled: true,
  canCreateCoupons: true,
  canUsePercentOff: true,
  canUseFixedAmount: true,
  canUseFreeShipping: true,
  canUseBogo: true,
  canTargetProducts: false,
  canSetLimits: true,
  canViewAnalytics: true,
  canUseQrSharing: true,
  canUseSpotlight: false,
  allowedDiscountTypes: ['percent_off', 'fixed_amount', 'free_shipping', 'bogo'],
  isFlexible: false,
  merchantPreferences: { coupon_enabled: true, spotlight_enabled: false },
  tier: {
    enabled: true,
    allowedDiscountTypes: ['percent_off', 'fixed_amount', 'free_shipping', 'bogo'],
    canTargetProducts: false,
    canUseQrSharing: true,
    canUseSpotlight: true,
  },
  ...over,
});

const tierFlag = (key: string) => FEATURE_TOGGLES.find(t => t.key === key)!.tierFlag;

describe('coupon options tier allowance', () => {
  it('offers Spotlight even though the merchant gate reports it effective-off', () => {
    const c = cap();
    expect(c.canUseSpotlight).toBe(false);
    expect(tierFlag('spotlightEnabled')(c)).toBe(true);
  });

  it('keeps the master switch usable when no settings row exists', () => {
    expect(couponTierAllowed(cap({ enabled: false, merchantPreferences: null }))).toBe(true);
  });

  it('hides features the plan does not include', () => {
    expect(tierFlag('targetProductsEnabled')(cap())).toBe(false);
    const noCoupons: CouponOptionsState = {
      ...cap(),
      isFlexible: false,
      tier: { enabled: false, allowedDiscountTypes: [], canTargetProducts: false, canUseQrSharing: false, canUseSpotlight: false },
    };
    expect(couponTierAllowed(noCoupons)).toBe(false);
  });
});
