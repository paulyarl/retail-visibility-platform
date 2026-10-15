import { describe, it, expect, vi, afterEach } from 'vitest';
import { PublicCouponService } from './PublicCouponService';

// Regression: GET /coupons/spotlight answers { success: true, data: null } when the
// merchant has no featured coupon. `getSpotlightCoupon` unwrapped with
// `result.data?.data || result.data`, so the null payload fell through to the truthy
// *envelope* — CouponSpotlight then rendered an empty "Special Offer" panel with a
// blank code and fired a phantom spotlight view event.
describe('PublicCouponService.getSpotlightCoupon', () => {
  afterEach(() => vi.restoreAllMocks());

  const service = PublicCouponService.getInstance();

  it('returns null when the API envelope carries a null payload', async () => {
    vi.spyOn(service as any, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: null },
    });

    expect(await service.getSpotlightCoupon('tid-8622qs2t')).toBeNull();
  });

  it('returns the coupon when the API envelope carries a payload', async () => {
    const coupon = { id: 'cpn_1', code: 'SAVE10', discountType: 'percent_off', discountValue: 10 };
    vi.spyOn(service as any, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: coupon },
    });

    expect(await service.getSpotlightCoupon('tid-8622qs2t')).toEqual(coupon);
  });
});
