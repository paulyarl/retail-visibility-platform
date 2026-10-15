import { describe, it, expect } from 'vitest';
import { formatCouponDiscount } from './FunnelOfferCard';

// Regression: funnel coupon_offer steps read tenant_coupons.discount_type (via
// FunnelEngine.getProductFunnelPreview), but the formatter compared against
// 'percentage' — a value the API never emits — so percent_off fell through to the
// fallback and rendered "15 OFF" instead of "15% OFF", and free_shipping / bogo
// rendered as "0 OFF".
const coupon = (discount_type: string, discount_value: number) => ({ code: 'SAVE', discount_type, discount_value });

describe('formatCouponDiscount', () => {
  it('labels the canonical tenant_coupons discount types', () => {
    expect(formatCouponDiscount(coupon('percent_off', 15))).toBe('15% OFF');
    expect(formatCouponDiscount(coupon('fixed_amount', 10))).toBe('$10.00 OFF');
    expect(formatCouponDiscount(coupon('free_shipping', 0))).toBe('FREE SHIPPING');
    expect(formatCouponDiscount(coupon('bogo', 0))).toBe('BUY ONE GET ONE');
  });

  it('falls back for unknown types', () => {
    expect(formatCouponDiscount(coupon('something_else', 5))).toBe('SPECIAL OFFER');
  });
});
