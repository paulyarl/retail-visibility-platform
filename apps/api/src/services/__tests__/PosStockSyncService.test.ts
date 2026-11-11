/**
 * PosStockSyncService — reconcile + SWIS hand-off unit tests
 * (POS_STOCK_SYNC_SPEC.md §3, §9.1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockFindManyItems = vi.fn();
const mockFindFirstAccount = vi.fn();
const mockUpsertLocal = vi.fn();

vi.mock('../../prisma', () => ({
  prisma: {
    inventory_items: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
      findMany: (...args: any[]) => mockFindManyItems(...args),
    },
    google_oauth_accounts_list: {
      findFirst: (...args: any[]) => mockFindFirstAccount(...args),
    },
  },
}));

vi.mock('../../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../MerchantProductSync', () => ({
  upsertLocalInventoryForItem: (...args: any[]) => mockUpsertLocal(...args),
}));

import posStockSyncService from '../PosStockSyncService';

const TENANT = 'tid-test1';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

describe('reconcileStock', () => {
  it('updates changed items and reports swis_dirty only for swis_listed', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: 'item-1', stock: 5, swis_listed: true })
      .mockResolvedValueOnce({ id: 'item-2', stock: 3, swis_listed: false });
    const res = await posStockSyncService.reconcileStock(TENANT, [
      { inventoryItemId: 'item-1', newStock: 2, source: 'clover_poll' },
      { inventoryItemId: 'item-2', newStock: 0, source: 'clover_poll' },
    ]);
    expect(res.updated).toBe(2);
    expect(res.swisDirty).toEqual(['item-1']);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('skips unchanged items and fails missing items without writing', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: 'item-1', stock: 5, swis_listed: true })
      .mockResolvedValueOnce(null);
    const res = await posStockSyncService.reconcileStock(TENANT, [
      { inventoryItemId: 'item-1', newStock: 5, source: 'clover_poll' },
      { inventoryItemId: 'item-2', newStock: 9, source: 'clover_poll' },
    ]);
    expect(res.updated).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.swisDirty).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('clamps negative stock to zero', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'item-1', stock: 5, swis_listed: false });
    const res = await posStockSyncService.reconcileStock(TENANT, [
      { inventoryItemId: 'item-1', newStock: -4, source: 'square_poll' },
    ]);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { stock: 0 },
    });
    expect(res.updated).toBe(1);
  });
});

describe('swisPushForDirty', () => {
  it('returns empty result for no dirty items', async () => {
    const res = await posStockSyncService.swisPushForDirty(TENANT, []);
    expect(res).toEqual({ pushed: 0, skipped: 0, errors: [] });
    expect(mockFindFirstAccount).not.toHaveBeenCalled();
  });

  it('skips everything when tenant has no SWIS-enabled merchant link', async () => {
    mockFindFirstAccount.mockResolvedValueOnce(null);
    const res = await posStockSyncService.swisPushForDirty(TENANT, ['a', 'b']);
    expect(res.skipped).toBe(2);
    expect(mockUpsertLocal).not.toHaveBeenCalled();
  });

  it('skips when link lacks swis_enabled or store_code', async () => {
    mockFindFirstAccount.mockResolvedValueOnce({
      google_merchant_links_list: [{ swis_enabled: false, store_code: null }],
    });
    const res = await posStockSyncService.swisPushForDirty(TENANT, ['a']);
    expect(res.skipped).toBe(1);
    expect(mockUpsertLocal).not.toHaveBeenCalled();
  });

  it('pushes only items passing the SWIS gate', async () => {
    mockFindFirstAccount.mockResolvedValueOnce({
      google_merchant_links_list: [{ swis_enabled: true, store_code: 'store-1' }],
    });
    mockFindManyItems.mockResolvedValueOnce([{ id: 'item-1' }]);
    mockUpsertLocal.mockResolvedValueOnce({ success: true, productId: 'item-1' });
    const res = await posStockSyncService.swisPushForDirty(TENANT, ['item-1', 'item-2']);
    expect(res.pushed).toBe(1);
    expect(res.skipped).toBe(1);
    expect(mockUpsertLocal).toHaveBeenCalledWith(TENANT, 'item-1', 'store-1');
  });

  it('collects push errors instead of throwing', async () => {
    mockFindFirstAccount.mockResolvedValueOnce({
      google_merchant_links_list: [{ swis_enabled: true, store_code: 'store-1' }],
    });
    mockFindManyItems.mockResolvedValueOnce([{ id: 'item-1' }]);
    mockUpsertLocal.mockRejectedValueOnce(new Error('gmc quota'));
    const res = await posStockSyncService.swisPushForDirty(TENANT, ['item-1']);
    expect(res.errors).toEqual([{ itemId: 'item-1', error: 'gmc quota' }]);
  });
});
