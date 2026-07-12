import { describe, it, expect } from 'vitest';
import { calculateRenewalCharge } from './bsaas-renewal';

describe('calculateRenewalCharge', () => {
  const basePrice = 6900;

  it('charges full price when no coupon metadata exists', () => {
    const metadata = { price_cents: basePrice };
    const result = calculateRenewalCharge(metadata, 0);
    expect(result.chargedAmount).toBe(basePrice);
    expect(result.discountCents).toBe(0);
    expect(result.couponActive).toBe(false);
  });

  it('charges full price when renewalCount > 0 for "once" duration', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_123',
      coupon_duration: 'once',
      coupon_percent_off: 50,
    };
    const result = calculateRenewalCharge(metadata, 1);
    expect(result.chargedAmount).toBe(basePrice);
    expect(result.discountCents).toBe(0);
    expect(result.couponActive).toBe(false);
  });

  it('applies discount for "once" duration when renewalCount === 0', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_123',
      coupon_duration: 'once',
      coupon_percent_off: 50,
    };
    const result = calculateRenewalCharge(metadata, 0);
    expect(result.chargedAmount).toBe(3450);
    expect(result.discountCents).toBe(3450);
    expect(result.couponActive).toBe(true);
  });

  it('applies discount for "repeating" duration when renewalCount < duration_in_months', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_456',
      coupon_duration: 'repeating',
      coupon_duration_in_months: 3,
      coupon_percent_off: 25,
    };
    expect(calculateRenewalCharge(metadata, 0).chargedAmount).toBe(5175);
    expect(calculateRenewalCharge(metadata, 1).chargedAmount).toBe(5175);
    expect(calculateRenewalCharge(metadata, 2).chargedAmount).toBe(5175);
  });

  it('charges full price for "repeating" duration when renewalCount >= duration_in_months', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_456',
      coupon_duration: 'repeating',
      coupon_duration_in_months: 3,
      coupon_percent_off: 25,
    };
    expect(calculateRenewalCharge(metadata, 3).chargedAmount).toBe(basePrice);
    expect(calculateRenewalCharge(metadata, 4).chargedAmount).toBe(basePrice);
    expect(calculateRenewalCharge(metadata, 3).couponActive).toBe(false);
  });

  it('always applies discount for "forever" duration', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_789',
      coupon_duration: 'forever',
      coupon_percent_off: 10,
    };
    expect(calculateRenewalCharge(metadata, 0).chargedAmount).toBe(6210);
    expect(calculateRenewalCharge(metadata, 5).chargedAmount).toBe(6210);
    expect(calculateRenewalCharge(metadata, 100).chargedAmount).toBe(6210);
    expect(calculateRenewalCharge(metadata, 100).couponActive).toBe(true);
  });

  it('applies amount_off discount correctly (capped at price)', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'coupon_000',
      coupon_duration: 'forever',
      coupon_amount_off: 10000, // $100 off
    };
    const result = calculateRenewalCharge(metadata, 1);
    expect(result.discountCents).toBe(6900); // capped at price
    expect(result.chargedAmount).toBe(0);
  });

  it('falls back to price_cents when original_price_cents is missing', () => {
    const metadata = {
      price_cents: basePrice,
      coupon_id: 'coupon_111',
      coupon_duration: 'forever',
      coupon_percent_off: 50,
    };
    const result = calculateRenewalCharge(metadata, 1);
    expect(result.chargedAmount).toBe(3450);
  });

  it('handles missing coupon_id gracefully', () => {
    const metadata = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_duration: 'forever',
      coupon_percent_off: 50,
    };
    const result = calculateRenewalCharge(metadata, 1);
    expect(result.chargedAmount).toBe(basePrice);
    expect(result.couponActive).toBe(false);
  });
});
