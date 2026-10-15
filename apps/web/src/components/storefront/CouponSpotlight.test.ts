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
});
