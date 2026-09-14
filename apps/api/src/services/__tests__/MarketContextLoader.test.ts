/**
 * MarketContextLoader tests — spec Phase 1.
 * docs/LocalBiz/INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md
 *
 * Covers:
 * - category-only, location-only, both, neither
 * - national ('__all__') campaigns load category intelligence only
 * - missing inputs short-circuit without a DB call
 * - DB failure degrades to empty (graceful, not blocking)
 * - 5-minute TTL cache per (category, city, state)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { MarketContextLoader } from '../intelligence/MarketContextLoader';

const loader = MarketContextLoader.getInstance();

const CATEGORY_CTX = {
  category_profile: { business_model: 'brick-and-mortar grocery' },
  category_signals: ['fresh produce', 'halal counter'],
  market_density: 'moderate',
  prospect_signals: ['handwritten signage'],
};

const LOCATION_CTX = {
  city_profile: { metro_description: 'mid-size midwestern metro' },
  market_gaps: [{ category: 'african_grocery', signal: 'unmet demand', area: 'Far Eastside' }],
  metro_dynamics: [{ city: 'Carmel', relationship: 'suburb', character: 'affluent' }],
};

beforeEach(() => {
  mockQueryRaw.mockReset();
  loader.resetCache();
});

describe('MarketContextLoader.loadMarketContext', () => {
  it('returns category + location intelligence when both rows exist', async () => {
    mockQueryRaw.mockResolvedValue([
      { category_key: 'african_grocery', context: CATEGORY_CTX },
      { category_key: '__location__', context: LOCATION_CTX },
    ]);

    const result = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(result.category).toEqual(CATEGORY_CTX);
    expect(result.location).toEqual(LOCATION_CTX);
    expect(loader.hasCategoryIntelligence(result.category)).toBe(true);
    expect(loader.hasLocationIntelligence(result.location)).toBe(true);
  });

  it('returns category-only when the location row is absent', async () => {
    mockQueryRaw.mockResolvedValue([
      { category_key: 'african_grocery', context: CATEGORY_CTX },
    ]);

    const result = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(result.category).toEqual(CATEGORY_CTX);
    expect(result.location).toEqual({});
    expect(loader.hasLocationIntelligence(result.location)).toBe(false);
  });

  it('returns location-only when the category row is absent', async () => {
    mockQueryRaw.mockResolvedValue([
      { category_key: '__location__', context: LOCATION_CTX },
    ]);

    const result = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(result.category).toEqual({});
    expect(result.location).toEqual(LOCATION_CTX);
    expect(loader.hasCategoryIntelligence(result.category)).toBe(false);
  });

  it('returns empty objects when neither row exists', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(result).toEqual({ category: {}, location: {} });
  });

  it('loads only the national category row for national (__all__) campaigns', async () => {
    mockQueryRaw.mockResolvedValue([
      { category_key: 'african_grocery', context: CATEGORY_CTX },
    ]);

    const result = await loader.loadMarketContext('african_grocery', '__all__', '__all__');

    expect(result.category).toEqual(CATEGORY_CTX);
    expect(result.location).toEqual({});
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('short-circuits without a DB call when inputs are missing', async () => {
    for (const [cat, city, st] of [
      [null, 'Indianapolis', 'IN'],
      ['african_grocery', null, 'IN'],
      ['african_grocery', 'Indianapolis', null],
      ['', 'Indianapolis', 'IN'],
    ] as const) {
      const result = await loader.loadMarketContext(cat as any, city, st);
      expect(result).toEqual({ category: {}, location: {} });
    }
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('degrades to empty on a DB failure', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(result).toEqual({ category: {}, location: {} });
  });

  it('serves repeat loads from cache within the TTL', async () => {
    mockQueryRaw.mockResolvedValue([
      { category_key: 'african_grocery', context: CATEGORY_CTX },
    ]);

    const first = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');
    const second = await loader.loadMarketContext('african_grocery', 'INDIANAPOLIS', 'in');

    expect(second).toEqual(first);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not cache DB failures — a retry hits the DB again', async () => {
    mockQueryRaw
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce([{ category_key: 'african_grocery', context: CATEGORY_CTX }]);

    const failed = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');
    const retried = await loader.loadMarketContext('african_grocery', 'Indianapolis', 'IN');

    expect(failed).toEqual({ category: {}, location: {} });
    expect(retried.category).toEqual(CATEGORY_CTX);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});
