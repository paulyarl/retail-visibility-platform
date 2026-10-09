import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  tenantsFindUnique: vi.fn(),
  tenantsFindMany: vi.fn(),
  itemsUpdateMany: vi.fn(),
  poolQuery: vi.fn(),
  expireDemoTenant: vi.fn(),
}));
const { tenantsFindUnique, tenantsFindMany, itemsUpdateMany, poolQuery, expireDemoTenant } = mocks;

vi.mock('../../prisma', () => ({
  prisma: {
    tenants: { findUnique: mocks.tenantsFindUnique, findMany: mocks.tenantsFindMany },
    inventory_items: { updateMany: mocks.itemsUpdateMany },
  },
}));
vi.mock('../../utils/db-pool', () => ({ getDirectPool: () => ({ query: mocks.poolQuery }) }));
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../services/DemoTenantService', () => ({
  default: { expireDemoTenant: mocks.expireDemoTenant },
}));

import {
  isSeedPreviewTenant,
  SEED_PREVIEW_SANDBOX_RESPONSE,
  archiveTenantProducts,
  refreshStorefrontDiscoveryMv,
  retireSeedPreviewsForSource,
  SEED_PREVIEW_TEMPLATE,
} from '../seed-preview';

// Seed-preview storefront spec §5b/B-9/B-10 — the checkout guard decides
// whether real payment processing is reachable, and B-1 retirement relies on
// the post-commit MV refresh + product archival helpers.

describe('isSeedPreviewTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true only when demo_template is seed_preview', async () => {
    tenantsFindUnique.mockResolvedValue({ demo_template: SEED_PREVIEW_TEMPLATE });
    await expect(isSeedPreviewTenant('t1')).resolves.toBe(true);
    expect(tenantsFindUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { demo_template: true },
    });
  });

  it('returns false for real tenants and other demo templates', async () => {
    tenantsFindUnique.mockResolvedValue({ demo_template: null });
    await expect(isSeedPreviewTenant('t2')).resolves.toBe(false);
    tenantsFindUnique.mockResolvedValue({ demo_template: 'quick_start' });
    await expect(isSeedPreviewTenant('t3')).resolves.toBe(false);
  });

  it('fails closed when the tenant does not exist', async () => {
    tenantsFindUnique.mockResolvedValue(null);
    await expect(isSeedPreviewTenant('ghost')).resolves.toBe(false);
  });

  it('short-circuits on nullish ids and the demo-tenant sentinel without a DB read', async () => {
    await expect(isSeedPreviewTenant(null)).resolves.toBe(false);
    await expect(isSeedPreviewTenant(undefined)).resolves.toBe(false);
    await expect(isSeedPreviewTenant('demo-tenant')).resolves.toBe(false);
    expect(tenantsFindUnique).not.toHaveBeenCalled();
  });
});

describe('SEED_PREVIEW_SANDBOX_RESPONSE', () => {
  it('declares sandbox + demo_checkout + no payment', () => {
    expect(SEED_PREVIEW_SANDBOX_RESPONSE).toMatchObject({
      success: true,
      sandbox: true,
      demo_checkout: true,
    });
  });
});

describe('archiveTenantProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives only active/inactive items for the tenant', async () => {
    itemsUpdateMany.mockResolvedValue({ count: 7 });
    await expect(archiveTenantProducts('t1')).resolves.toBe(7);
    expect(itemsUpdateMany).toHaveBeenCalledWith({
      where: { tenant_id: 't1', item_status: { in: ['active', 'inactive'] } },
      data: { item_status: 'archived' },
    });
  });
});

describe('refreshStorefrontDiscoveryMv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tries CONCURRENTLY first', async () => {
    poolQuery.mockResolvedValue({});
    await refreshStorefrontDiscoveryMv();
    expect(poolQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_storefront_discovery',
    );
  });

  it('falls back to a blocking refresh on 55000 (concurrent-not-allowed)', async () => {
    poolQuery.mockRejectedValueOnce({ code: '55000' });
    await refreshStorefrontDiscoveryMv();
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      'REFRESH MATERIALIZED VIEW mv_storefront_discovery',
    );
  });

  it('rethrows non-55000 failures so callers can log without masking', async () => {
    poolQuery.mockRejectedValue(new Error('relation does not exist'));
    await expect(refreshStorefrontDiscoveryMv()).rejects.toThrow('relation does not exist');
  });
});

describe('retireSeedPreviewsForSource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expires every live seed_preview sourced from the tenant', async () => {
    tenantsFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    expireDemoTenant.mockResolvedValue(undefined);
    await expect(retireSeedPreviewsForSource('src-tenant')).resolves.toBe(2);
    expect(tenantsFindMany).toHaveBeenCalledWith({
      where: {
        demo_source_tenant_id: 'src-tenant',
        is_demo: true,
        demo_template: SEED_PREVIEW_TEMPLATE,
        location_status: 'active',
      },
      select: { id: true },
    });
    expect(expireDemoTenant).toHaveBeenCalledWith('p1');
    expect(expireDemoTenant).toHaveBeenCalledWith('p2');
  });

  it('keeps retiring remaining previews when one expiry fails (non-blocking on claim)', async () => {
    tenantsFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    expireDemoTenant
      .mockRejectedValueOnce(new Error('tx aborted'))
      .mockResolvedValueOnce(undefined);
    await expect(retireSeedPreviewsForSource('src-tenant')).resolves.toBe(2);
    expect(expireDemoTenant).toHaveBeenCalledTimes(2);
  });

  it('returns 0 and never touches expiry when no live preview exists', async () => {
    tenantsFindMany.mockResolvedValue([]);
    await expect(retireSeedPreviewsForSource('src-tenant')).resolves.toBe(0);
    expect(expireDemoTenant).not.toHaveBeenCalled();
  });
});
