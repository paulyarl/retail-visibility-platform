/**
 * GalleryAnalyticsService tests (§12 Sprint 8)
 *
 * Verifies:
 * - trackEvent: inserts row with correct fields
 * - trackEvent with gallery_opened: stamps viewed_at if null, doesn't overwrite if set
 * - trackEvent: enriches deviceType from userAgent
 * - trackEvent: computes ipHash as SHA-256(IP + salt) when salt configured; null when not
 * - trackEvents (batch): inserts multiple rows
 * - trackEvent: fire-and-forget (never throws)
 * - aggregateAnalytics: correct rollup
 * - aggregateAnalytics: avg_session_duration_ms uses MAX(dwell_ms) per session (G27)
 * - getTokenAnalytics: per-token summary with device breakdown
 * - getCampaignAnalytics: aggregates across multiple tokens
 * - getDashboardAnalytics: cross-campaign funnel + byArchetype
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGalleryEvents,
  mockPreviewTokens,
  mockGalleryAnalytics,
} = vi.hoisted(() => ({
  mockGalleryEvents: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  mockPreviewTokens: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  mockGalleryAnalytics: {
    upsert: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_gallery_events: mockGalleryEvents,
    mkt_deliverable_preview_tokens: mockPreviewTokens,
    mkt_gallery_analytics: mockGalleryAnalytics,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    galleryIpHashSalt: 'test-salt-123',
  },
}));

vi.mock('../../lib/id-generator', () => ({
  generateGalleryEventId: () => 'gevt-test-001',
  generateGalleryAnalyticsId: () => 'gan-test-001',
}));

import { GalleryAnalyticsService } from '../GalleryAnalyticsService';
import { audit } from '../../audit';
import { unifiedConfig } from '../../config/unifiedConfig';

const service = GalleryAnalyticsService.getInstance();

const TOKEN_ID = 'token-001';
const CAMPAIGN_ID = 'camp-001';

beforeEach(() => {
  vi.clearAllMocks();
  mockGalleryEvents.create.mockResolvedValue({ id: 'gevt-001' });
  mockGalleryEvents.createMany.mockResolvedValue({ count: 1 });
  mockPreviewTokens.findUnique.mockResolvedValue({
    id: TOKEN_ID,
    viewed_at: null,
    mkt_campaigns_list: { business_name: 'Test Biz' },
  });
  mockPreviewTokens.update.mockResolvedValue({});
  mockPreviewTokens.findMany.mockResolvedValue([]);
  mockGalleryEvents.findMany.mockResolvedValue([]);
  mockGalleryEvents.count.mockResolvedValue(0);
  mockGalleryAnalytics.upsert.mockResolvedValue({});
});

// ── trackEvent tests ───────────────────────────────────────────────────

describe('GalleryAnalyticsService.trackEvent', () => {
  it('inserts a row with correct fields', async () => {
    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'screenshot_viewed',
      sessionId: 'sess-1',
      screenshotIndex: 0,
      dwellMs: 5000,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      ip: '192.168.1.1',
    });

    expect(mockGalleryEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'gevt-test-001',
          token_id: TOKEN_ID,
          campaign_id: CAMPAIGN_ID,
          event_type: 'screenshot_viewed',
          session_id: 'sess-1',
          screenshot_index: 0,
          dwell_ms: 5000,
          device_type: 'mobile',
        }),
      }),
    );
  });

  it('stamps viewed_at on first gallery_opened when viewed_at is null', async () => {
    mockPreviewTokens.findUnique.mockResolvedValue({
      id: TOKEN_ID,
      viewed_at: null,
      mkt_campaigns_list: { business_name: 'Test Biz' },
    });

    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'gallery_opened',
    });

    expect(mockPreviewTokens.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TOKEN_ID },
        data: expect.objectContaining({ viewed_at: expect.any(Date) }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it('does not overwrite viewed_at when already set', async () => {
    mockPreviewTokens.findUnique.mockResolvedValue({
      id: TOKEN_ID,
      viewed_at: new Date('2024-01-01').toISOString(),
      mkt_campaigns_list: { business_name: 'Test Biz' },
    });

    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'gallery_opened',
    });

    expect(mockPreviewTokens.update).not.toHaveBeenCalled();
  });

  it('enriches deviceType from userAgent — desktop', async () => {
    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'gallery_opened',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(mockGalleryEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ device_type: 'desktop' }),
      }),
    );
  });

  it('enriches deviceType from userAgent — tablet', async () => {
    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'gallery_opened',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)',
    });

    expect(mockGalleryEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ device_type: 'tablet' }),
      }),
    );
  });

  it('computes ipHash as SHA-256(IP + salt) when salt is configured', async () => {
    await service.trackEvent({
      tokenId: TOKEN_ID,
      campaignId: CAMPAIGN_ID,
      eventType: 'gallery_opened',
      ip: '10.0.0.1',
    });

    const call = vi.mocked(mockGalleryEvents.create).mock.calls[0][0];
    expect(call.data.ip_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(call.data.ip_hash).not.toBe('10.0.0.1');
  });

  it('returns null ipHash when salt is not configured (graceful degradation)', async () => {
    // hashIp reads unifiedConfig.galleryIpHashSalt at call time.
    // Mutate the mock object to simulate empty salt, then restore.
    const originalSalt = (unifiedConfig as any).galleryIpHashSalt;
    (unifiedConfig as any).galleryIpHashSalt = '';

    const { hashIp } = await import('../GalleryAnalyticsService');
    expect(hashIp('10.0.0.1')).toBeNull(); // no salt → null

    // Restore for subsequent tests
    (unifiedConfig as any).galleryIpHashSalt = originalSalt;
  });

  it('is fire-and-forget — never throws on DB error', async () => {
    mockGalleryEvents.create.mockRejectedValue(new Error('DB connection failed'));
    await expect(
      service.trackEvent({
        tokenId: TOKEN_ID,
        campaignId: CAMPAIGN_ID,
        eventType: 'gallery_opened',
      }),
    ).resolves.toBeUndefined();
  });
});

// ── trackEvents (batch) tests ──────────────────────────────────────────

describe('GalleryAnalyticsService.trackEvents', () => {
  it('inserts multiple rows in one createMany call', async () => {
    mockGalleryEvents.createMany.mockResolvedValue({ count: 3 });

    const tracked = await service.trackEvents([
      { tokenId: TOKEN_ID, campaignId: CAMPAIGN_ID, eventType: 'gallery_opened', sessionId: 's1' },
      { tokenId: TOKEN_ID, campaignId: CAMPAIGN_ID, eventType: 'screenshot_viewed', sessionId: 's1', screenshotIndex: 0 },
      { tokenId: TOKEN_ID, campaignId: CAMPAIGN_ID, eventType: 'cta_clicked', sessionId: 's1' },
    ]);

    expect(tracked).toBe(3);
    expect(mockGalleryEvents.createMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockGalleryEvents.createMany).mock.calls[0][0];
    expect(call.data).toHaveLength(3);
  });

  it('is fire-and-forget — never throws on DB error', async () => {
    mockGalleryEvents.createMany.mockRejectedValue(new Error('DB error'));
    const tracked = await service.trackEvents([
      { tokenId: TOKEN_ID, campaignId: CAMPAIGN_ID, eventType: 'gallery_opened' },
    ]);
    expect(tracked).toBe(0);
  });
});

// ── aggregateAnalytics tests ───────────────────────────────────────────

describe('GalleryAnalyticsService.aggregateAnalytics', () => {
  it('computes correct rollup: total_opens, unique_sessions, cta_clicks', async () => {
    const events = [
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'gallery_opened', dwell_ms: null, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:00:00Z') },
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'screenshot_viewed', dwell_ms: 5000, screenshot_index: 0, device_type: 'mobile', created_at: new Date('2024-06-01T10:01:00Z') },
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'cta_clicked', dwell_ms: null, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:02:00Z') },
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's2', event_type: 'gallery_opened', dwell_ms: null, screenshot_index: null, device_type: 'desktop', created_at: new Date('2024-06-01T11:00:00Z') },
    ];
    mockGalleryEvents.findMany.mockResolvedValue(events);

    await service.aggregateAnalytics(30);

    expect(mockGalleryAnalytics.upsert).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockGalleryAnalytics.upsert).mock.calls[0][0];
    expect(call.create.total_opens).toBe(2);
    expect(call.create.unique_sessions).toBe(2);
    expect(call.create.cta_clicks).toBe(1);
  });

  it('uses MAX(dwell_ms) per session for avg_session_duration_ms (G27)', async () => {
    const events = [
      // Session s1: heartbeats with cumulative dwell 1000, 5000, 10000 → MAX = 10000
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'session_heartbeat', dwell_ms: 1000, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:00:00Z') },
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'session_heartbeat', dwell_ms: 5000, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:00:30Z') },
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'session_heartbeat', dwell_ms: 10000, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:01:00Z') },
      // Session s2: single heartbeat with dwell 20000 → MAX = 20000
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's2', event_type: 'session_heartbeat', dwell_ms: 20000, screenshot_index: null, device_type: 'desktop', created_at: new Date('2024-06-01T11:00:00Z') },
    ];
    mockGalleryEvents.findMany.mockResolvedValue(events);

    await service.aggregateAnalytics(30);

    const call = vi.mocked(mockGalleryAnalytics.upsert).mock.calls[0][0];
    // avg = (10000 + 20000) / 2 = 15000
    expect(call.create.avg_session_duration_ms).toBe(15000);
  });

  it('upserts (ON CONFLICT updates) — calls upsert not create', async () => {
    mockGalleryEvents.findMany.mockResolvedValue([
      { token_id: TOKEN_ID, campaign_id: CAMPAIGN_ID, tenant_id: 'platform', session_id: 's1', event_type: 'gallery_opened', dwell_ms: null, screenshot_index: null, device_type: 'mobile', created_at: new Date('2024-06-01T10:00:00Z') },
    ]);

    await service.aggregateAnalytics(30);

    expect(mockGalleryAnalytics.upsert).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockGalleryAnalytics.upsert).mock.calls[0][0];
    expect(call.where).toBeDefined();
    expect(call.update).toBeDefined();
    expect(call.create).toBeDefined();
  });
});

// ── getTokenAnalytics tests ────────────────────────────────────────────

describe('GalleryAnalyticsService.getTokenAnalytics', () => {
  it('returns per-token summary with device breakdown', async () => {
    mockGalleryEvents.findMany.mockResolvedValue([
      { event_type: 'gallery_opened', session_id: 's1', dwell_ms: null, device_type: 'mobile' },
      { event_type: 'gallery_opened', session_id: 's2', dwell_ms: null, device_type: 'desktop' },
      { event_type: 'screenshot_viewed', session_id: 's1', dwell_ms: 5000, device_type: 'mobile' },
      { event_type: 'cta_clicked', session_id: 's1', dwell_ms: null, device_type: 'mobile' },
    ]);

    const result = await service.getTokenAnalytics(TOKEN_ID);

    expect(result.tokenId).toBe(TOKEN_ID);
    expect(result.totalOpens).toBe(2);
    expect(result.uniqueSessions).toBe(2);
    expect(result.totalScreenshotViews).toBe(1);
    expect(result.ctaClicks).toBe(1);
    expect(result.mobileViews).toBe(3);
    expect(result.desktopViews).toBe(1);
  });
});

// ── getCampaignAnalytics tests ─────────────────────────────────────────

describe('GalleryAnalyticsService.getCampaignAnalytics', () => {
  it('aggregates across multiple tokens', async () => {
    mockPreviewTokens.findMany.mockResolvedValue([
      { id: 'token-1', gallery_archetype: 'A1', created_at: new Date(), viewed_at: new Date(), converted_at: null, expires_at: null },
      { id: 'token-2', gallery_archetype: 'A2', created_at: new Date(), viewed_at: null, converted_at: null, expires_at: null },
    ]);
    mockGalleryEvents.findMany.mockResolvedValue([
      { event_type: 'gallery_opened', session_id: 's1', dwell_ms: null, device_type: 'mobile' },
    ]);

    const result = await service.getCampaignAnalytics(CAMPAIGN_ID);

    expect(result.campaignId).toBe(CAMPAIGN_ID);
    expect(result.totalTokens).toBe(2);
    expect(result.perToken).toHaveLength(2);
  });
});

// ── getDashboardAnalytics tests ────────────────────────────────────────

describe('GalleryAnalyticsService.getDashboardAnalytics', () => {
  it('returns cross-campaign funnel + byArchetype', async () => {
    mockPreviewTokens.findMany.mockResolvedValue([
      { id: 't1', campaign_id: 'c1', gallery_archetype: 'A1', created_at: new Date(), viewed_at: new Date(), converted_at: new Date() },
      { id: 't2', campaign_id: 'c2', gallery_archetype: 'A2', created_at: new Date(), viewed_at: new Date(), converted_at: null },
      { id: 't3', campaign_id: 'c3', gallery_archetype: 'A2', created_at: new Date(), viewed_at: null, converted_at: null },
    ]);
    mockGalleryEvents.count.mockResolvedValue(50);

    const result = await service.getDashboardAnalytics({ daysBack: 30 });

    expect(result.funnel.totalTokens).toBe(3);
    expect(result.funnel.viewedTokens).toBe(2);
    expect(result.funnel.convertedTokens).toBe(1);
    expect(result.totalEvents).toBe(50);
    expect(result.byArchetype).toHaveLength(2); // A1 + A2
    const a1 = result.byArchetype.find((a: any) => a.archetype === 'A1');
    expect(a1.totalTokens).toBe(1);
    expect(a1.viewedTokens).toBe(1);
    expect(a1.convertedTokens).toBe(1);
  });
});
