/**
 * DirectoryPresenceAnalyticsService — Layer 3 tests
 *
 * Verifies (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §5, §12):
 * - parseDeviceType classification
 * - rate limiter: 60 events/min per IP, then rejects
 * - trackEvent inserts one row and never throws (fire-and-forget)
 * - trackEvents builds a multi-row INSERT with sequential params
 * - getListingEngagement maps per-event-type counts + device split
 * - getClaimFunnel computes view → click → accept rates
 * - getSeedEngagement returns null when the seed does not exist
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe, mockExecuteRawUnsafe, mockFindUnique, mockLogger } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockFindUnique: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    directory_presence_seeds: { findUnique: mockFindUnique },
  },
}));

vi.mock('../../logger', () => ({ logger: mockLogger }));

import directoryPresenceAnalyticsService, {
  parseDeviceType,
  checkDirectoryPresenceRateLimit,
} from '../DirectoryPresenceAnalyticsService';

describe('parseDeviceType', () => {
  it('classifies user agents', () => {
    expect(parseDeviceType('Mozilla/5.0 (iPad; CPU OS 15_0)')).toBe('tablet');
    expect(parseDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)')).toBe('mobile');
    expect(parseDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(parseDeviceType(null)).toBe('unknown');
    expect(parseDeviceType('curl/7.68.0')).toBe('unknown');
  });
});

describe('checkDirectoryPresenceRateLimit', () => {
  it('allows 60 events per window then rejects', () => {
    const ip = `test-ip-${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      expect(checkDirectoryPresenceRateLimit(ip)).toBe(true);
    }
    expect(checkDirectoryPresenceRateLimit(ip)).toBe(false);
  });
});

describe('DirectoryPresenceAnalyticsService.trackEvent', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
  });

  it('inserts a single row', async () => {
    mockExecuteRawUnsafe.mockResolvedValueOnce(1);

    await directoryPresenceAnalyticsService.trackEvent({
      tenantId: 'tenant-1',
      listingId: 'dll-1',
      slug: 'madison-spice',
      sessionId: 'sess-1',
      eventType: 'listing_viewed',
      userAgent: 'Mozilla/5.0 (iPhone)',
      ip: '1.2.3.4',
    });

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO directory_presence_events');
    expect(params).toHaveLength(11);
    expect(params[0]).toMatch(/^dpe-/);
    expect(params[1]).toBe('tenant-1');
    expect(params[5]).toBe('listing_viewed');
    expect(params[9]).toBe('mobile');
  });

  it('never throws when the insert fails', async () => {
    mockExecuteRawUnsafe.mockRejectedValueOnce(new Error('db down'));
    await expect(
      directoryPresenceAnalyticsService.trackEvent({
        tenantId: 't',
        listingId: 'l',
        slug: 's',
        eventType: 'listing_viewed',
      }),
    ).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('DirectoryPresenceAnalyticsService.trackEvents', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
  });

  it('builds a multi-row insert with sequential params', async () => {
    mockExecuteRawUnsafe.mockResolvedValueOnce(2);

    const tracked = await directoryPresenceAnalyticsService.trackEvents([
      { tenantId: 't', listingId: 'l', slug: 's', eventType: 'listing_viewed' },
      { tenantId: 't', listingId: 'l', slug: 's', eventType: 'session_end' },
    ]);

    expect(tracked).toBe(2);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(String(sql)).toContain('VALUES ($1');
    expect(String(sql)).toContain('$22)');
    expect(params).toHaveLength(22);
  });

  it('returns 0 without querying when the batch is empty', async () => {
    const tracked = await directoryPresenceAnalyticsService.trackEvents([]);
    expect(tracked).toBe(0);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('DirectoryPresenceAnalyticsService.getListingEngagement', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
  });

  it('maps event counts, dwell, and device split', async () => {
    mockQueryRawUnsafe
      // counts
      .mockResolvedValueOnce([
        { event_type: 'listing_viewed', events: 10n, sessions: 6n },
        { event_type: 'claim_clicked', events: 3n, sessions: 3n },
      ])
      // dwell
      .mockResolvedValueOnce([{ avg_dwell_ms: 12345.6 }])
      // device split
      .mockResolvedValueOnce([{ device_type: 'mobile', events: 12n }]);

    const result = await directoryPresenceAnalyticsService.getListingEngagement('tenant-1', 30);

    expect(result.views).toBe(10);
    expect(result.claimClicks).toBe(3);
    expect(result.callClicks).toBe(0);
    expect(result.uniqueSessions).toBe(6);
    expect(result.avgDwellMs).toBe(12345.6);
    expect(result.deviceSplit).toEqual([{ deviceType: 'mobile', events: 12 }]);
  });
});

describe('DirectoryPresenceAnalyticsService.getClaimFunnel', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
  });

  it('computes view → click → accept rates', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ views: 100n, view_sessions: 40n, claim_clicks: 25n }])
      .mockResolvedValueOnce([{ accepted: 5n }]);

    const funnel = await directoryPresenceAnalyticsService.getClaimFunnel('tenant-1', 30);

    expect(funnel.views).toBe(100);
    expect(funnel.claimClicks).toBe(25);
    expect(funnel.claimsAccepted).toBe(5);
    expect(funnel.viewToClickRate).toBe(0.25);
    expect(funnel.clickToAcceptRate).toBe(0.2);
    expect(funnel.viewToAcceptRate).toBe(0.05);
  });

  it('returns null rates when the denominator is zero', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ views: 0n, view_sessions: 0n, claim_clicks: 0n }])
      .mockResolvedValueOnce([{ accepted: 0n }]);

    const funnel = await directoryPresenceAnalyticsService.getClaimFunnel('tenant-1', 30);
    expect(funnel.viewToClickRate).toBeNull();
    expect(funnel.clickToAcceptRate).toBeNull();
  });
});

describe('DirectoryPresenceAnalyticsService.getSeedEngagement', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
    mockFindUnique.mockReset();
  });

  it('returns null when the seed does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await directoryPresenceAnalyticsService.getSeedEngagement('missing', 30);
    expect(result).toBeNull();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });
});
