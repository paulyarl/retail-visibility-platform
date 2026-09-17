/**
 * DirectoryPresenceTrafficService — SQL-path tests
 *
 * Verifies the Layer 1 + Layer 2 readout
 * (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §3, §6):
 * - bigint → Number conversion across count rows
 * - per-seed mapping (counts, daily, referrers, device split, surface split)
 * - getSeedTraffic returns null when the seed does not exist
 * - dashboard mapping (totals, top seeds, category breakdown, daily, surfaces)
 * - seed filters propagate as bound params ($1..$n) — never interpolated
 * - surface filter binds on the behavior table; the surface split is unfiltered
 * - window is clamped to the allowed 7/30/90 set
 *
 * Query order (asserted): per-seed = counts → daily → referrers → device → surfaces.
 *                         dashboard = totals → top seeds → categories → daily → surfaces.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe, mockFindUnique, mockLogger } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockFindUnique: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
    directory_presence_seeds: { findUnique: mockFindUnique },
  },
}));

vi.mock('../../logger', () => ({ logger: mockLogger }));

import directoryTrafficService, {
  clampTrafficWindow,
  DEFAULT_TRAFFIC_WINDOW,
} from '../DirectoryPresenceTrafficService';

const seedRow = {
  id: 'dps-1',
  tenant_id: 'tenant-1',
  listing_id: 'dll-1',
  category: 'Indian Grocery',
  city: 'Madison',
  state: 'WI',
  status: 'published',
  seed_batch: 'batch-1',
  directory_listings_list: { business_name: 'Madison Spice', slug: 'madison-spice' },
};

describe('clampTrafficWindow', () => {
  it('accepts the allowed windows', () => {
    expect(clampTrafficWindow(7)).toBe(7);
    expect(clampTrafficWindow(30)).toBe(30);
    expect(clampTrafficWindow(90)).toBe(90);
  });

  it('defaults anything else', () => {
    expect(clampTrafficWindow(undefined)).toBe(DEFAULT_TRAFFIC_WINDOW);
    expect(clampTrafficWindow(45)).toBe(DEFAULT_TRAFFIC_WINDOW);
    expect(clampTrafficWindow(Number.NaN)).toBe(DEFAULT_TRAFFIC_WINDOW);
  });
});

describe('DirectoryPresenceTrafficService.getSeedTraffic', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
    mockFindUnique.mockReset();
  });

  it('returns null when the seed does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await directoryTrafficService.getSeedTraffic('missing', 30);
    expect(result).toBeNull();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('maps counts, daily, referrers, device split, and surface split', async () => {
    mockFindUnique.mockResolvedValueOnce(seedRow);
    mockQueryRawUnsafe
      // counts
      .mockResolvedValueOnce([
        {
          views: 42n,
          unique_sessions: 17n,
          views_7d: 9n,
          views_30d: 42n,
          views_90d: 42n,
          avg_duration_seconds: 31.5,
        },
      ])
      // daily
      .mockResolvedValueOnce([
        { day: '2026-09-01', views: 20n, unique_sessions: 8n },
        { day: '2026-09-02', views: 22n, unique_sessions: 9n },
      ])
      // referrers
      .mockResolvedValueOnce([{ referrer: 'google', views: 30n }])
      // device split
      .mockResolvedValueOnce([{ device_type: 'mobile', views: 40n }])
      // surface split
      .mockResolvedValueOnce([
        { surface: 'directory_seed', views: 30n, unique_sessions: 12n },
        { surface: 'untagged', views: 12n, unique_sessions: 5n },
      ]);

    const result = await directoryTrafficService.getSeedTraffic('dps-1', 30);

    expect(result).not.toBeNull();
    expect(result!.businessName).toBe('Madison Spice');
    expect(result!.slug).toBe('madison-spice');
    expect(result!.surface).toBeNull();
    expect(result!.views).toBe(42);
    expect(result!.uniqueSessions).toBe(17);
    expect(result!.views7d).toBe(9);
    expect(result!.avgDurationSeconds).toBe(31.5);
    expect(result!.daily).toEqual([
      { day: '2026-09-01', views: 20, uniqueSessions: 8 },
      { day: '2026-09-02', views: 22, uniqueSessions: 9 },
    ]);
    expect(result!.topReferrers).toEqual([{ referrer: 'google', views: 30 }]);
    expect(result!.deviceSplit).toEqual([{ deviceType: 'mobile', views: 40 }]);
    expect(result!.surfaceBreakdown).toEqual([
      { surface: 'directory_seed', views: 30, uniqueSessions: 12 },
      { surface: 'untagged', views: 12, uniqueSessions: 5 },
    ]);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
    // Tenant id is always bound, never interpolated.
    for (const call of mockQueryRawUnsafe.mock.calls) {
      expect(call[1]).toBe('tenant-1');
    }
  });

  it('binds the surface filter on the event queries but not the split query', async () => {
    mockFindUnique.mockResolvedValueOnce(seedRow);
    mockQueryRawUnsafe.mockResolvedValue([]);

    await directoryTrafficService.getSeedTraffic('dps-1', 30, 'directory_seed');

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
    const calls = mockQueryRawUnsafe.mock.calls;
    // First four queries carry the surface predicate as $2.
    for (const call of calls.slice(0, 4)) {
      expect(call.slice(1)).toEqual(['tenant-1', 'directory_seed']);
      expect(String(call[0])).toContain("context->>'surface' = $2");
    }
    // The split query is deliberately unfiltered.
    expect(calls[4].slice(1)).toEqual(['tenant-1']);
    expect(String(calls[4][0])).not.toContain("context->>'surface' = $2");
  });
});

describe('DirectoryPresenceTrafficService.getTrafficDashboard', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
  });

  it('maps totals, top seeds, category breakdown, daily trend, and surfaces', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([
        { views: 100n, unique_sessions: 40n, seeds_with_traffic: 3n, total_seeds: 10n },
      ])
      .mockResolvedValueOnce([
        {
          seed_id: 'dps-1',
          tenant_id: 'tenant-1',
          listing_id: 'dll-1',
          category: 'Indian Grocery',
          city: 'Madison',
          state: 'WI',
          status: 'published',
          seed_batch: 'batch-1',
          business_name: 'Madison Spice',
          slug: 'madison-spice',
          views: 60n,
          unique_sessions: 25n,
          views_7d: 12n,
          views_30d: 60n,
        },
      ])
      .mockResolvedValueOnce([
        { category: 'Indian Grocery', views: 60n, unique_sessions: 25n, seeds: 1n },
      ])
      .mockResolvedValueOnce([{ day: '2026-09-01', views: 60n, unique_sessions: 25n }])
      .mockResolvedValueOnce([{ surface: 'directory_seed', views: 60n, unique_sessions: 25n }]);

    const result = await directoryTrafficService.getTrafficDashboard(30);

    expect(result.daysBack).toBe(30);
    expect(result.surface).toBeNull();
    expect(result.totals).toEqual({
      views: 100,
      uniqueSessions: 40,
      seedsWithTraffic: 3,
      totalSeeds: 10,
    });
    expect(result.topSeeds).toHaveLength(1);
    expect(result.topSeeds[0]).toMatchObject({
      seedId: 'dps-1',
      businessName: 'Madison Spice',
      views: 60,
      views7d: 12,
    });
    expect(result.categoryBreakdown).toEqual([
      { category: 'Indian Grocery', views: 60, uniqueSessions: 25, seeds: 1 },
    ]);
    expect(result.daily).toEqual([{ day: '2026-09-01', views: 60, uniqueSessions: 25 }]);
    expect(result.surfaceBreakdown).toEqual([
      { surface: 'directory_seed', views: 60, uniqueSessions: 25 },
    ]);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
  });

  it('binds seed filters as positional params on every query', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await directoryTrafficService.getTrafficDashboard(7, {
      seedBatch: 'batch-9',
      status: 'invited',
      category: 'Halal Grocery',
      city: 'Chicago',
      state: 'IL',
    });

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
    for (const call of mockQueryRawUnsafe.mock.calls) {
      const params = call.slice(1);
      expect(params).toEqual(['batch-9', 'invited', 'Halal Grocery', 'Chicago', 'IL']);
      expect(String(call[0])).toContain('s.seed_batch = $1');
      expect(String(call[0])).toContain('s.state = $5');
    }
  });

  it('binds the surface filter on the event queries but not the split query', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await directoryTrafficService.getTrafficDashboard(30, {
      category: 'Halal Grocery',
      surface: 'directory_seed',
    });

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(5);
    const calls = mockQueryRawUnsafe.mock.calls;
    // First four queries bind [category, surface] and reference $2.
    for (const call of calls.slice(0, 4)) {
      expect(call.slice(1)).toEqual(['Halal Grocery', 'directory_seed']);
      expect(String(call[0])).toContain("b.context->>'surface' = $2");
    }
    // The split query drops the surface param (seed filters only).
    expect(calls[4].slice(1)).toEqual(['Halal Grocery']);
    expect(String(calls[4][0])).not.toContain("b.context->>'surface' = $2");
  });
});
