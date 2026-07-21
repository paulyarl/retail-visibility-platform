import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResolveEffectiveCapabilities, mockFunnelFindMany, mockFunnelFindUnique, mockItemsFindMany, mockCouponsFindMany } = vi.hoisted(() => ({
  mockResolveEffectiveCapabilities: vi.fn(),
  mockFunnelFindMany: vi.fn(),
  mockFunnelFindUnique: vi.fn(),
  mockItemsFindMany: vi.fn(),
  mockCouponsFindMany: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenant_sales_funnels: {
      findMany: mockFunnelFindMany,
      findUnique: mockFunnelFindUnique,
    },
    inventory_items: { findMany: mockItemsFindMany },
    tenant_coupons: { findMany: mockCouponsFindMany },
  },
}));

vi.mock('./EffectiveCapabilityResolver', () => ({
  resolveEffectiveCapabilities: mockResolveEffectiveCapabilities,
}));

import FunnelEngine from './FunnelEngine';

describe('FunnelEngine.getProductFunnelPreview', () => {
  const tenantId = 'tenant_test';
  const productId = 'prod_test';

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveCapabilities.mockResolvedValue({
      effective: {
        funnel: {
          enabled: true,
          allowed_steps: ['order_bump', 'upsell', 'downsell', 'oto', 'coupon_offer'],
        },
      },
    });
    mockFunnelFindUnique.mockResolvedValue({ metadata: {} });
    mockItemsFindMany.mockResolvedValue([]);
    mockCouponsFindMany.mockResolvedValue([]);
  });

  it('returns null when no funnel matches the product', async () => {
    mockFunnelFindMany.mockResolvedValue([]);

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).toBeNull();
  });

  it('returns null when show_preview is false', async () => {
    mockFunnelFindMany.mockResolvedValue([
      {
        id: 'funnel_1',
        tenant_id: tenantId,
        name: 'Funnel 1',
        entry_item_id: productId,
        trigger_type: 'product',
        metadata: { show_preview: false },
        tenant_funnel_steps: [
          {
            id: 'step_1',
            funnel_id: 'funnel_1',
            tenant_id: tenantId,
            step_type: 'upsell',
            offer_item_id: 'offer_1',
            display_title: 'Upsell',
            display_description: null,
            price_cents: 1000,
            discount_cents: 0,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    ]);
    mockFunnelFindUnique.mockResolvedValue({ metadata: { show_preview: false } });

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).toBeNull();
    expect(mockFunnelFindUnique).toHaveBeenCalledWith({
      where: { id: 'funnel_1' },
      select: { metadata: true },
    });
  });

  it('skips cart_value triggered funnels on the product page', async () => {
    mockFunnelFindMany.mockResolvedValue([
      {
        id: 'funnel_1',
        tenant_id: tenantId,
        name: 'Funnel 1',
        entry_item_id: productId,
        trigger_type: 'cart_value',
        min_cart_value_cents: 0,
        metadata: {},
        tenant_funnel_steps: [
          {
            id: 'step_1',
            funnel_id: 'funnel_1',
            tenant_id: tenantId,
            step_type: 'upsell',
            offer_item_id: 'offer_1',
            display_title: 'Upsell',
            display_description: null,
            price_cents: 1000,
            discount_cents: 0,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    ]);

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).toBeNull();
  });

  it('resolves an always-triggered funnel with enriched offer items', async () => {
    mockFunnelFindMany.mockResolvedValue([
      {
        id: 'funnel_always',
        tenant_id: tenantId,
        name: 'Always Funnel',
        entry_item_id: null,
        trigger_type: 'always',
        metadata: {},
        tenant_funnel_steps: [
          {
            id: 'step_1',
            funnel_id: 'funnel_always',
            tenant_id: tenantId,
            step_type: 'upsell',
            offer_item_id: 'offer_1',
            display_title: 'Upgrade',
            display_description: 'Better version',
            price_cents: 500,
            discount_cents: 100,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    ]);
    mockFunnelFindUnique.mockResolvedValue({ metadata: { show_preview: true } });
    mockItemsFindMany.mockResolvedValue([
      {
        id: 'offer_1',
        name: 'Upgrade Item',
        image_url: 'https://example.com/upgrade.png',
        product_type: 'digital',
        price_cents: 1000,
        stock: 0,
        description: 'Better digital thing',
      },
    ]);

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).not.toBeNull();
    expect(result?.funnel_id).toBe('funnel_always');
    expect(result?.trigger_type).toBe('always');
    expect(result?.steps).toHaveLength(1);
    expect(result?.steps[0].offer_item).toEqual({
      name: 'Upgrade Item',
      image_url: 'https://example.com/upgrade.png',
      product_type: 'digital',
      price_cents: 1000,
      stock: 0,
      description: 'Better digital thing',
    });
    expect(result?.steps[0].coupon).toBeNull();
  });

  it('batch-enriches coupon_offer steps with coupon details', async () => {
    mockFunnelFindMany.mockResolvedValue([
      {
        id: 'funnel_coupon',
        tenant_id: tenantId,
        name: 'Coupon Funnel',
        entry_item_id: productId,
        trigger_type: 'product',
        metadata: {},
        tenant_funnel_steps: [
          {
            id: 'step_1',
            funnel_id: 'funnel_coupon',
            tenant_id: tenantId,
            step_type: 'coupon_offer',
            offer_item_id: 'coupon_1',
            display_title: 'Save 20%',
            display_description: null,
            price_cents: null,
            discount_cents: 0,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    ]);
    mockFunnelFindUnique.mockResolvedValue({ metadata: {} });
    mockItemsFindMany.mockResolvedValue([]);
    mockCouponsFindMany.mockResolvedValue([
      { id: 'coupon_1', code: 'SAVE20', discount_type: 'percent_off', discount_value: 20 },
    ]);

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).not.toBeNull();
    expect(result?.steps[0].step_type).toBe('coupon_offer');
    expect(result?.steps[0].coupon).toEqual({
      code: 'SAVE20',
      discount_type: 'percent_off',
      discount_value: 20,
    });
    expect(result?.steps[0].offer_item).toBeNull();
  });

  it('filters out steps that are not allowed by the tenant plan', async () => {
    mockResolveEffectiveCapabilities.mockResolvedValue({
      effective: {
        funnel: {
          enabled: true,
          allowed_steps: ['order_bump'],
        },
      },
    });
    mockFunnelFindMany.mockResolvedValue([
      {
        id: 'funnel_filtered',
        tenant_id: tenantId,
        name: 'Filtered Funnel',
        entry_item_id: productId,
        trigger_type: 'product',
        metadata: {},
        tenant_funnel_steps: [
          {
            id: 'step_1',
            funnel_id: 'funnel_filtered',
            tenant_id: tenantId,
            step_type: 'upsell',
            offer_item_id: 'offer_1',
            display_title: 'Upsell',
            display_description: null,
            price_cents: 1000,
            discount_cents: 0,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    ]);

    const engine = FunnelEngine.getInstance();
    const result = await engine.getProductFunnelPreview(tenantId, productId);

    expect(result).toBeNull();
  });
});
