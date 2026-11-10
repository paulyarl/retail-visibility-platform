/**
 * square-stock-sync — buildStockDiffs pure-mapping tests
 * (POS_STOCK_SYNC_SPEC §6.3, §9.1).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../prisma', () => ({ prisma: {} }));
vi.mock('../../logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../../config/unifiedConfig', () => ({ unifiedConfig: { squareEnvironment: 'sandbox' } }));
vi.mock('../square/SquareOAuthService', () => ({ SquareOAuthService: class {} }));
vi.mock('../square/square-client', () => ({ SquareClientService: class {} }));
vi.mock('../PosStockSyncService', () => ({ default: {} }));

import { buildStockDiffs } from '../square/square-stock-sync';

const MAPPINGS = [
  { square_item_variation_id: 'var-1', inventory_item_id: 'item-1' },
  { square_item_variation_id: 'var-2', inventory_item_id: 'item-2' },
  { square_item_variation_id: null, inventory_item_id: 'item-3' },
];

describe('buildStockDiffs', () => {
  it('maps IN_STOCK counts to diffs through variation ids', () => {
    const { diffs, unmatched } = buildStockDiffs(
      [
        { catalogObjectId: 'var-1', quantity: '7', state: 'IN_STOCK' },
        { catalogObjectId: 'var-2', quantity: '0', state: 'IN_STOCK' },
      ],
      MAPPINGS,
    );
    expect(diffs).toEqual([
      { inventoryItemId: 'item-1', newStock: 7, source: 'square_poll', posItemId: 'var-1' },
      { inventoryItemId: 'item-2', newStock: 0, source: 'square_poll', posItemId: 'var-2' },
    ]);
    expect(unmatched).toBe(0);
  });

  it('ignores non-IN_STOCK counts and counts unmapped variations', () => {
    const { diffs, unmatched } = buildStockDiffs(
      [
        { catalogObjectId: 'var-1', quantity: '3', state: 'SOLD' },
        { catalogObjectId: 'var-9', quantity: '5', state: 'IN_STOCK' },
      ],
      MAPPINGS,
    );
    expect(diffs).toEqual([]);
    expect(unmatched).toBe(1);
  });

  it('coerces bad quantities to zero', () => {
    const { diffs } = buildStockDiffs(
      [{ catalogObjectId: 'var-1', quantity: 'abc', state: 'IN_STOCK' }],
      MAPPINGS,
    );
    expect(diffs[0].newStock).toBe(0);
  });
});
