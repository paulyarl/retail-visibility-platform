import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock functions are available when vi.mock factories run (factories are hoisted above const declarations)
const { mockPromotionCodesList, mockCouponsRetrieve, mockValidateCouponTargets, mockGetTargetsForCoupon } = vi.hoisted(() => ({
  mockPromotionCodesList: vi.fn(),
  mockCouponsRetrieve: vi.fn(),
  mockValidateCouponTargets: vi.fn(),
  mockGetTargetsForCoupon: vi.fn(),
}));

// Mock dependencies before importing
vi.mock('../prisma', () => ({
  prisma: {
    bsaas_bundles: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    stripeSecretKey: 'sk_test_fake_key',
  },
}));

// Mock CouponTargetService
vi.mock('../services/CouponTargetService', () => ({
  default: {
    getInstance: () => ({
      validateCouponTargets: mockValidateCouponTargets,
      getTargetsForCoupon: mockGetTargetsForCoupon,
    }),
  },
  CouponTargets: {},
  CouponTargetContext: {},
}));

// Mock stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function() {
    return {
      promotionCodes: { list: mockPromotionCodesList },
      coupons: { retrieve: mockCouponsRetrieve },
    };
  }),
}));

import { validatePromoCode } from './bsaas-purchases';

describe('validatePromoCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCouponTargets.mockResolvedValue({ valid: true, reason: null });
    mockGetTargetsForCoupon.mockResolvedValue(null);
  });

  const baseContext = { featureKey: 'chatbot_skill_crm_assistant', tenantId: 'tenant123' };

  it('returns error when Stripe is not configured', async () => {
    // Temporarily override the mock
    const { unifiedConfig } = await import('../config/unifiedConfig');
    const originalKey = unifiedConfig.stripeSecretKey;
    (unifiedConfig as any).stripeSecretKey = null;

    const result = await validatePromoCode('SUMMER50', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('stripe_not_configured');
    }

    (unifiedConfig as any).stripeSecretKey = originalKey;
  });

  it('returns error for invalid promo code (not found)', async () => {
    mockPromotionCodesList.mockResolvedValue({ data: [] });

    const result = await validatePromoCode('INVALID', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('invalid_promo_code');
    }
  });

  it('returns error when max redemptions reached', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_123', max_redemptions: 10, times_redeemed: 10, expires_at: null, coupon: 'coupon_123' }],
    });

    const result = await validatePromoCode('USEDUP', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('promo_expired');
    }
  });

  it('returns error when promo code has expired', async () => {
    const pastTimestamp = Math.floor((Date.now() - 86400000) / 1000); // 1 day ago
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_123', max_redemptions: null, times_redeemed: 0, expires_at: pastTimestamp, coupon: 'coupon_123' }],
    });

    const result = await validatePromoCode('EXPIRED', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('promo_expired');
    }
  });

  it('calculates percent_off discount correctly', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_123', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'coupon_123' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'coupon_123',
      duration: 'once',
      percent_off: 50,
      amount_off: null,
    });

    const result = await validatePromoCode('SUMMER50', 6900, baseContext);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(3450);
      expect(result.chargedAmount).toBe(3450);
      expect(result.couponPercentOff).toBe(50);
      expect(result.couponDuration).toBe('once');
    }
  });

  it('calculates amount_off discount correctly (capped at price)', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_456', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'coupon_456' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'coupon_456',
      duration: 'forever',
      percent_off: null,
      amount_off: 10000, // $100 off
    });

    const result = await validatePromoCode('BIGSAVE', 6900, baseContext);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(6900); // capped at price
      expect(result.chargedAmount).toBe(0);
      expect(result.couponAmountOff).toBe(10000);
      expect(result.couponDuration).toBe('forever');
    }
  });

  it('returns error when coupon target validation fails', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_789', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'coupon_789' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'coupon_789',
      duration: 'repeating',
      duration_in_months: 3,
      percent_off: 25,
      amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({
      valid: false,
      reason: 'coupon_not_valid_for_feature',
    });

    const result = await validatePromoCode('TARGETED', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('coupon_not_valid_for_feature');
    }
  });

  it('passes through when no target rules exist', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_000', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'coupon_000' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'coupon_000',
      duration: 'once',
      percent_off: 10,
      amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({ valid: true, reason: null });
    mockGetTargetsForCoupon.mockResolvedValue(null);

    const result = await validatePromoCode('WELCOME10', 6900, baseContext);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(690);
      expect(result.chargedAmount).toBe(6210);
      expect(result.targets).toBe(null);
    }
  });

  it('returns targets from CouponTargetService on success', async () => {
    const mockTargets = { target_features: ['chatbot_skill_crm_assistant'], target_tiers: null };
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'promo_111', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'coupon_111' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'coupon_111',
      duration: 'repeating',
      duration_in_months: 6,
      percent_off: 25,
      amount_off: null,
    });
    mockGetTargetsForCoupon.mockResolvedValue(mockTargets);

    const result = await validatePromoCode('RECUR25', 6900, baseContext);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.targets).toEqual(mockTargets);
      expect(result.couponDurationInMonths).toBe(6);
    }
  });

  it('returns error on Stripe API exception', async () => {
    mockPromotionCodesList.mockRejectedValue(new Error('Stripe API error'));

    const result = await validatePromoCode('ERROR', 6900, baseContext);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('invalid_promo_code');
    }
  });
});
