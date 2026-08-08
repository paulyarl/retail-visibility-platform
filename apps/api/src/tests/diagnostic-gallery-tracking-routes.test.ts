/**
 * Diagnostic Gallery tracking route tests (§12 Sprint 8 — G20)
 *
 * Verifies:
 * - POST /events: valid event → 200, row created
 * - POST /events: invalid eventType → 400
 * - POST /events: expired token (non-open) → 404
 * - POST /events: expired token (gallery_opened) → 200
 * - POST /events/batch: multiple events → 200, tracked: N
 * - POST /events/batch: empty array → 200, tracked: 0
 * - Rate limiting: >60 events/min from same IP → 429
 * - GET /campaigns/:id/gallery-analytics: no auth → 401
 * - GET /gallery-analytics/dashboard: no auth → 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ──────────────────────────────────────────────────────────────

const {
  mockCampaignsList,
  mockPreviewTokens,
  mockFilesList,
  mockGalleryEvents,
  mockGalleryAnalytics,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn() },
  mockPreviewTokens: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  mockFilesList: { findMany: vi.fn() },
  mockGalleryEvents: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  mockGalleryAnalytics: { upsert: vi.fn() },
}));

vi.mock('../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_deliverable_preview_tokens: mockPreviewTokens,
    mkt_files_list: mockFilesList,
    mkt_gallery_events: mockGalleryEvents,
    mkt_gallery_analytics: mockGalleryAnalytics,
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-key',
    galleryIpHashSalt: 'test-salt',
    recoveryMaxAttachmentBytes: 10 * 1024 * 1024,
  },
}));

vi.mock('../audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/id-generator', () => ({
  generateGalleryEventId: () => 'gevt-test-001',
  generateGalleryAnalyticsId: () => 'gan-test-001',
  generateCampaignToken: () => 'test-token',
}));

// MarketingDeliverableService is a default-exported singleton instance.
vi.mock('../services/MarketingDeliverableService', () => ({
  default: {
    generateCampaignToken: vi.fn().mockResolvedValue({
      id: 'token-001',
      token: 'test-token',
      token_type: 'diagnostic_gallery',
      campaign_id: 'camp-001',
      gallery_archetype: 'A2',
      gallery_title: 'Test',
      gallery_subtitle: null,
      friction_summary: null,
      cta_label: 'Fix It',
      cta_amount_cents: 15000,
      expires_at: new Date(Date.now() + 3 * 86400000),
      viewed_at: null,
      converted_at: null,
      created_at: new Date(),
    }),
  },
}));

// resolveGalleryArchetypeDefaults is SYNC — use mockReturnValue.
vi.mock('../services/marketing/GalleryArchetypeDefaults', () => ({
  resolveGalleryArchetypeDefaults: vi.fn().mockReturnValue({
    galleryTitle: 'Test',
    gallerySubtitle: 'Issues found',
    ctaLabel: 'Fix It',
    frictionSummary: {},
  }),
}));

// resolveCampaignArchetype is from OutreachOpenerService.
vi.mock('../services/OutreachOpenerService', () => ({
  OutreachOpenerService: { getInstance: () => ({}) },
  resolveCampaignArchetype: vi.fn().mockResolvedValue({
    archetype: 'A2',
    source: 'fallback',
    reason: 'test mock',
  }),
}));

vi.mock('../services/outreach-openers/archetype-selection', () => ({
  selectArchetype: vi.fn().mockReturnValue({ archetype: 'A2', theme: null }),
}));

vi.mock('../services/deliverable/BusinessContextService', () => ({
  default: {
    getLatestAuditData: vi.fn().mockResolvedValue(null),
  },
}));

// Mock auth — we need to control whether auth is present or not
const { mockAuthenticateToken, mockRequirePlatformAdmin } = vi.hoisted(() => ({
  mockAuthenticateToken: vi.fn(),
  mockRequirePlatformAdmin: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock('../storage-config', () => ({
  StorageBuckets: {
    DISPUTES: { name: 'disputes', isPublic: false },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example.com/f.png' }, error: null }),
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

import marketingOpsPublicRouter from '../routes/marketing-ops-public';
import marketingOpsRouter from '../routes/marketing-ops';

// ── Test apps ──────────────────────────────────────────────────────────

const publicApp = express();
publicApp.use(express.json());
// Trust proxy so req.ip works consistently in tests
publicApp.set('trust proxy', true);
publicApp.use('/api', marketingOpsPublicRouter);

const adminApp = express();
adminApp.use(express.json());
adminApp.use('/api/admin/marketing-ops', marketingOpsRouter);

const VALID_TOKEN = 'valid-tracking-token';
const EXPIRED_TOKEN = 'expired-tracking-token';
const CAMPAIGN_ID = 'camp-001';

// Use Date objects for expires_at — Prisma returns Date objects and the
// route compares with `token.expires_at < new Date()`.
const activeToken = {
  id: 'token-001',
  token: VALID_TOKEN,
  token_type: 'diagnostic_gallery',
  campaign_id: CAMPAIGN_ID,
  expires_at: new Date(Date.now() + 3 * 86400000),
  viewed_at: null,
  converted_at: null,
  gallery_archetype: 'A2',
  gallery_title: 'Test',
  gallery_subtitle: null,
  friction_summary: null,
  cta_label: 'Fix It',
  cta_amount_cents: 15000,
  created_at: new Date(),
};

const expiredToken = {
  ...activeToken,
  token: EXPIRED_TOKEN,
  expires_at: new Date(Date.now() - 86400000),
};

const campaign = {
  id: CAMPAIGN_ID,
  business_name: 'Test Biz',
  stage: 'shown',
  package_price_cents: 15000,
  mkt_files_list: [{ id: 'file-1', file_name: 'screenshot1.png' }],
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default: auth passes for admin routes
  mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: 'admin-001', role: 'platform_admin' };
    next();
  });
  mockRequirePlatformAdmin.mockImplementation((_req: any, _res: any, next: any) => next());

  mockPreviewTokens.findFirst.mockImplementation(({ where }: any) => {
    if (where.token === VALID_TOKEN) return Promise.resolve({ ...activeToken, mkt_campaigns_list: campaign });
    if (where.token === EXPIRED_TOKEN) return Promise.resolve({ ...expiredToken, mkt_campaigns_list: campaign });
    return Promise.resolve(null);
  });

  mockPreviewTokens.update.mockResolvedValue({ ...activeToken, viewed_at: new Date().toISOString() });
  mockPreviewTokens.findMany.mockResolvedValue([]);
  mockFilesList.findMany.mockResolvedValue([]);
  mockCampaignsList.findUnique.mockResolvedValue(campaign);
  mockGalleryEvents.create.mockResolvedValue({ id: 'gevt-001' });
  mockGalleryEvents.createMany.mockResolvedValue({ count: 1 });
  mockGalleryEvents.findMany.mockResolvedValue([]);
  mockGalleryEvents.count.mockResolvedValue(0);
  mockGalleryAnalytics.upsert.mockResolvedValue({});
});

// ── POST /events tests ─────────────────────────────────────────────────

describe('POST /api/public/marketing/gallery/:token/events', () => {
  it('returns 200 and tracks a valid event', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events`)
      .send({ eventType: 'gallery_opened', sessionId: 's1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tracked).toBe(true);
  });

  it('returns 400 for invalid eventType', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events`)
      .send({ eventType: 'invalid_event_type' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 404 for expired token with non-opened event', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${EXPIRED_TOKEN}/events`)
      .send({ eventType: 'screenshot_viewed' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Token expired');
  });

  it('returns 200 for expired token with gallery_opened event', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${EXPIRED_TOKEN}/events`)
      .send({ eventType: 'gallery_opened' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for invalid token', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/nonexistent-token/events`)
      .send({ eventType: 'gallery_opened' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Invalid or unknown token');
  });
});

// ── POST /events/batch tests ───────────────────────────────────────────

describe('POST /api/public/marketing/gallery/:token/events/batch', () => {
  it('returns 200 with tracked count for multiple events', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events/batch`)
      .send({
        events: [
          { eventType: 'gallery_opened', sessionId: 's1' },
          { eventType: 'screenshot_viewed', sessionId: 's1', screenshotIndex: 0 },
          { eventType: 'cta_clicked', sessionId: 's1' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tracked).toBe(3);
  });

  it('returns 200 with tracked: 0 for events array that is empty after filtering expired', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${EXPIRED_TOKEN}/events/batch`)
      .send({
        events: [
          { eventType: 'screenshot_viewed', sessionId: 's1' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.tracked).toBe(0);
  });

  it('returns 400 for empty events array', async () => {
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events/batch`)
      .send({ events: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

// ── Rate limiting tests ────────────────────────────────────────────────

describe('Rate limiting — 60 events/min per IP', () => {
  it('returns 429 after 60 events from the same IP', async () => {
    // The in-memory rate limiter resets per test run since the module is
    // re-imported. We send 60 events (should all pass), then the 61st
    // should get 429.
    //
    // Note: supertest may use different source IPs per request in some
    // environments. We force a consistent IP via the trust proxy setting
    // and X-Forwarded-For header.
    const ip = '203.0.113.42';

    // Send 60 events — all should succeed
    for (let i = 0; i < 60; i++) {
      const res = await request(publicApp)
        .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events`)
        .set('X-Forwarded-For', ip)
        .send({ eventType: 'session_heartbeat', sessionId: 's1', dwellMs: i * 1000 });
      expect(res.status).toBe(200);
    }

    // 61st event from the same IP should be rate limited
    const res = await request(publicApp)
      .post(`/api/public/marketing/gallery/${VALID_TOKEN}/events`)
      .set('X-Forwarded-For', ip)
      .send({ eventType: 'session_heartbeat', sessionId: 's1', dwellMs: 60000 });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });
});

// ── Admin analytics auth tests ─────────────────────────────────────────
// Admin router is mounted at /api/admin/marketing-ops, so all request paths
// must include that prefix.

describe('Admin analytics endpoints — auth required', () => {
  it('GET /campaigns/:id/gallery-analytics returns 401 without auth', async () => {
    // Override mock to simulate no auth — the middleware should reject
    mockAuthenticateToken.mockImplementation((_req: any, res: any) => {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    });

    const res = await request(adminApp).get(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-analytics`);

    expect(res.status).toBe(401);
  });

  it('GET /gallery-analytics/dashboard returns 401 without auth', async () => {
    mockAuthenticateToken.mockImplementation((_req: any, res: any) => {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    });

    const res = await request(adminApp).get('/api/admin/marketing-ops/gallery-analytics/dashboard');

    expect(res.status).toBe(401);
  });

  it('GET /gallery-analytics/dashboard returns 200 with auth + byArchetype array', async () => {
    mockPreviewTokens.findMany.mockResolvedValue([
      { id: 't1', campaign_id: 'c1', gallery_archetype: 'A1', created_at: new Date(), viewed_at: new Date(), converted_at: null },
    ]);
    mockGalleryEvents.count.mockResolvedValue(10);

    const res = await request(adminApp).get('/api/admin/marketing-ops/gallery-analytics/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.byArchetype).toBeDefined();
    expect(Array.isArray(res.body.data.byArchetype)).toBe(true);
  });

  it('GET /campaigns/:id/gallery-analytics returns 200 with auth', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(campaign);
    mockPreviewTokens.findMany.mockResolvedValue([]);
    mockGalleryEvents.findMany.mockResolvedValue([]);

    const res = await request(adminApp).get(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-analytics`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaignId).toBe(CAMPAIGN_ID);
  });
});
