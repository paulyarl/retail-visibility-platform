import { describe, it, expect } from 'vitest';
import { toStoredDiscountValue, toFormDiscountValue, discountValueRequired } from './CouponManagementClient';

// tenant_coupons.discount_value is an integer. percent_off holds a percentage;
// fixed_amount holds CENTS, so the form (dollars and cents) must convert at the boundary.
// Before this, a merchant typing 10.99 for Fixed Amount posted 10.99 straight at an Int
// column, and the value round-tripped as the wrong unit.
describe('coupon discount value conversion', () => {
  it('stores fixed_amount as cents', () => {
    expect(toStoredDiscountValue('fixed_amount', 10.99)).toBe(1099);
    expect(toStoredDiscountValue('fixed_amount', 5)).toBe(500);
  });

  it('leaves percent_off as a percentage', () => {
    expect(toStoredDiscountValue('percent_off', 20)).toBe(20);
  });

  it('stores no value for free_shipping and bogo', () => {
    expect(toStoredDiscountValue('free_shipping', 10)).toBe(0);
    expect(toStoredDiscountValue('bogo', 10)).toBe(0);
  });

  it('round-trips back to dollars and cents for editing', () => {
    expect(toFormDiscountValue('fixed_amount', 1099)).toBe(10.99);
    expect(toFormDiscountValue('percent_off', 20)).toBe(20);
  });

  it('only requires a value for percent_off and fixed_amount', () => {
    expect(discountValueRequired('percent_off')).toBe(true);
    expect(discountValueRequired('fixed_amount')).toBe(true);
    expect(discountValueRequired('free_shipping')).toBe(false);
    expect(discountValueRequired('bogo')).toBe(false);
  });
});
