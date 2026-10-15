import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CouponSpotlight from './CouponSpotlight';

vi.mock('@/hooks/tenant-access/usePublicCapabilityAccess', () => ({
  usePublicCouponOptionsCapability: () => ({
    data: { enabled: true, canUseSpotlight: true },
    loading: false,
    error: null,
    refetch: async () => {},
  }),
}));

// Regression: the panel rendered whenever the capability allowed it, even with no
// featured coupon — the truthy envelope returned by getSpotlightCoupon slipped past
// `if (!coupon)`, producing an empty "Special Offer" card (blank code) that eroded
// storefront trust. A coupon is only renderable when it carries a code.
describe('CouponSpotlight', () => {
  const render = (coupon: any) =>
    renderToStaticMarkup(createElement(CouponSpotlight, { tenantId: 'tid-8622qs2t', coupon }));

  it('renders nothing for a coupon payload without a code', () => {
    expect(render({ id: 'cpn_1', discountType: 'percent_off', discountValue: 10 })).toBe('');
    expect(render({})).toBe('');
    expect(render(null)).toBe('');
  });

  it('renders the offer when a valid coupon is supplied', () => {
    const html = render({ id: 'cpn_1', code: 'SAVE10', discountType: 'percent_off', discountValue: 10 });
    expect(html).toContain('SAVE10');
  });

  // Regression: the component typed discountType as 'percent' | 'fixed' | 'gift', but the
  // API emits the canonical 'percent_off' | 'fixed_amount' | 'free_shipping' | 'bogo'.
  // Nothing matched, so every real coupon fell through to the generic "Special Offer".
  it('labels the canonical API discount types', () => {
    expect(render({ id: 'c1', code: 'PCT', discountType: 'percent_off', discountValue: 15 })).toContain('15% off');
    // fixed_amount is stored in cents
    expect(render({ id: 'c2', code: 'AMT', discountType: 'fixed_amount', discountValue: 1099 })).toContain('$10.99 off');
    expect(render({ id: 'c3', code: 'SHIP', discountType: 'free_shipping', discountValue: 0 })).toContain('Free Shipping');
    expect(render({ id: 'c4', code: 'BOGO', discountType: 'bogo', discountValue: 0 })).toContain('Buy one get one');
  });

  it('renders the merchant promotion message and terms', () => {
    const html = render({
      id: 'c1',
      code: 'PCT',
      discountType: 'percent_off',
      discountValue: 15,
      promotionalMessage: 'Fresh produce restock this week',
      termsSummary: 'One per customer',
    });
    expect(html).toContain('Fresh produce restock this week');
    expect(html).toContain('One per customer');
  });
});
