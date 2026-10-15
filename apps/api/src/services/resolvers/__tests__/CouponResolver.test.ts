import { describe, it, expect } from 'vitest';
import { resolveCouponOptions } from '../CouponResolver';

// Tier feature set mirroring the omnichannel tier: coupons allowed, all discount
// types on, spotlight included.
const tierFeatures = {
  coupon_enabled: true,
  coupon_discount_types_on: true,
  coupon_targeted: false,
  coupon_limited_redemption: true,
  coupon_analytics: true,
  coupon_qr_sharing: true,
  coupon_spotlight: true,
};

// Regression: with no tenant_coupon_options_settings row the resolver defaulted every
// merchant gate to true, so the effective manifest reported coupon_options.enabled and
// can_use_spotlight = true for a merchant who had never opted in. The storefront then
// rendered the spotlight component and coupon creation was allowed. Coupons are opt-in —
// the master switch is the trigger.
describe('resolveCouponOptions master switch', () => {
  it('treats coupons as disabled when the merchant has no settings row', () => {
    const caps = resolveCouponOptions(tierFeatures, null);
    expect(caps.enabled).toBe(false);
    expect(caps.can_create_coupons).toBe(false);
    expect(caps.can_use_spotlight).toBe(false);
    expect(caps.allowed_discount_types).toEqual([]);
    expect(caps.merchant_preferences).toBeNull();
  });

  it('stays disabled when the merchant explicitly turned coupons off', () => {
    const caps = resolveCouponOptions(tierFeatures, { coupon_enabled: false });
    expect(caps.enabled).toBe(false);
    expect(caps.can_use_spotlight).toBe(false);
  });

  it('enables coupons once the merchant flips the master switch on', () => {
    const caps = resolveCouponOptions(tierFeatures, { coupon_enabled: true });
    expect(caps.enabled).toBe(true);
    expect(caps.can_create_coupons).toBe(true);
    expect(caps.can_use_spotlight).toBe(true);
    expect(caps.allowed_discount_types).toEqual(['percent_off', 'fixed_amount', 'free_shipping', 'bogo']);
  });
});

// The merchant settings page must gate its switches on the plan's allowance, not on the
// effective can_use_* flags — those already fold in the merchant's own toggles, so a
// switch that is off would report itself as unavailable and could never be turned back on.
describe('resolveCouponOptions tier allowance', () => {
  it('reports spotlight as tier-allowed while the merchant gate keeps it effective-off', () => {
    const caps = resolveCouponOptions(tierFeatures, { coupon_enabled: true, spotlight_enabled: false });
    expect(caps.enabled).toBe(true);
    expect(caps.can_use_spotlight).toBe(false);
    expect(caps.tier.enabled).toBe(true);
    expect(caps.tier.can_use_spotlight).toBe(true);
  });

  it('still reports tier allowance when no settings row exists', () => {
    const caps = resolveCouponOptions(tierFeatures, null);
    expect(caps.enabled).toBe(false);
    expect(caps.tier.enabled).toBe(true);
    expect(caps.tier.allowed_discount_types).toEqual(['percent_off', 'fixed_amount', 'free_shipping', 'bogo']);
  });

  it('omits features the plan does not include', () => {
    const caps = resolveCouponOptions(tierFeatures, { coupon_enabled: true });
    expect(caps.tier.can_target_products).toBe(false);
    expect(caps.can_target_products).toBe(false);
  });
});
