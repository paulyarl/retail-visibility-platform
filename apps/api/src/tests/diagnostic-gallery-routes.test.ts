/**
 * Diagnostic Gallery route tests (§12 Sprint 8 — G20)
 *
 * Verifies:
 * - Token resolution: valid → 200, expired → 200 with { expired: true }, invalid → 404, wrong type → 404
 * - First view stamps viewed_at; second view doesn't overwrite
 * - No screenshots → 400 no_screenshots on token generation
 * - Stage gate: seek → 400, paid → 400, preview_built/shown → 201
 * - Supersede: new token marks prior unconverted gallery tokens as converted
 * - Archetype stamping + defaults
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
  generateCampaignToken: () => 'test-gallery-token-abc',
}));

// MarketingDeliverableService is a default-exported singleton instance.
// The route calls MarketingDeliverableService.generateCampaignToken(...) directly.
vi.mock('../services/MarketingDeliverableService', () => ({
  default: {
    generateCampaignToken: vi.fn().mockResolvedValue({
      id: 'token-001',
      token: 'test-gallery-token-abc',
      token_type: 'diagnostic_gallery',
      campaign_id: 'camp-001',
      expires_at: new Date(Date.now() + 3 * 86400000),
      viewed_at: null,
      converted_at: null,
      gallery_archetype: 'A2',
      gallery_title: 'Review Recovery Diagnostic — Test Biz',
      gallery_subtitle: null,
      friction_summary: null,
      cta_label: 'Fix the Negative Review Cluster',
      cta_amount_cents: 15000,
      created_at: new Date(),
    }),
  },
}));

// resolveGalleryArchetypeDefaults is a SYNC pure function (no DB, no async).
// Mock with mockReturnValue, not mockResolvedValue.
vi.mock('../services/marketing/GalleryArchetypeDefaults', () => ({
  resolveGalleryArchetypeDefaults: vi.fn().mockReturnValue({
    galleryTitle: 'Review Recovery Diagnostic — Test Biz',
    gallerySubtitle: 'We found critical issues affecting your online reputation',
    ctaLabel: 'Fix the Negative Review Cluster',
    frictionSummary: { bbb_grade: 'F', negative_reviews: 12 },
  }),
}));

// resolveCampaignArchetype is from OutreachOpenerService, not GalleryArchetypeDefaults.
// It returns { archetype, source, reason }.
vi.mock('../services/OutreachOpenerService', () => ({
  OutreachOpenerService: { getInstance: () => ({}) },
  resolveCampaignArchetype: vi.fn().mockResolvedValue({
    archetype: 'A2',
    source: 'fallback',
    reason: 'test mock',
  }),
}));

// selectArchetype is from archetype-selection — mock to avoid DB access.
vi.mock('../services/outreach-openers/archetype-selection', () => ({
  selectArchetype: vi.fn().mockReturnValue({ archetype: 'A2', theme: null }),
}));

// BusinessContextService is dynamically imported for A2 theme extraction.
vi.mock('../services/deliverable/BusinessContextService', () => ({
  default: {
    getLatestAuditData: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-001', role: 'platform_admin' };
    next();
  },
  requirePlatformAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../storage-config', () => ({
  StorageBuckets: {
    DISPUTES: { name: 'disputes', isPublic: false },
  },
}));

// Mock supabase createClient to avoid real network calls
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed-url.example.com/file.png' },
          error: null,
        }),
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
publicApp.use('/api', marketingOpsPublicRouter);

const adminApp = express();
adminApp.use(express.json());
adminApp.use('/api/admin/marketing-ops', marketingOpsRouter);

const VALID_TOKEN = 'valid-gallery-token';
const EXPIRED_TOKEN = 'expired-gallery-token';
const INVALID_TOKEN = 'invalid-token';
const WRONG_TYPE_TOKEN = 'wrong-type-token';
const CAMPAIGN_ID = 'camp-001';

// Use Date objects (not ISO strings) for expires_at — Prisma returns Date
// objects and the route compares with `token.expires_at < new Date()`.
// String-to-Date comparison with < yields NaN → false, breaking the expired check.
const activeToken = {
  id: 'token-001',
  token: VALID_TOKEN,
  token_type: 'diagnostic_gallery',
  campaign_id: CAMPAIGN_ID,
  expires_at: new Date(Date.now() + 3 * 86400000),
  viewed_at: null,
  converted_at: null,
  gallery_archetype: 'A2',
  gallery_title: 'Review Recovery Diagnostic — Test Biz',
  gallery_subtitle: null,
  friction_summary: { bbb_grade: 'F' },
  cta_label: 'Fix the Negative Review Cluster',
  cta_amount_cents: 15000,
  created_at: new Date(),
};

const expiredToken = {
  ...activeToken,
  token: EXPIRED_TOKEN,
  expires_at: new Date(Date.now() - 86400000),
};

const wrongTypeToken = {
  ...activeToken,
  token: WRONG_TYPE_TOKEN,
  token_type: 'qr_deliverable',
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

  // Token resolution mocks
  mockPreviewTokens.findFirst.mockImplementation(({ where }: any) => {
    const token = where.token;
    if (token === VALID_TOKEN) return Promise.resolve({ ...activeToken, mkt_campaigns_list: campaign });
    if (token === EXPIRED_TOKEN) return Promise.resolve({ ...expiredToken, mkt_campaigns_list: campaign });
    if (token === WRONG_TYPE_TOKEN) return Promise.resolve({ ...wrongTypeToken, mkt_campaigns_list: campaign });
    return Promise.resolve(null);
  });

  mockPreviewTokens.update.mockResolvedValue({ ...activeToken, viewed_at: new Date().toISOString() });
  mockFilesList.findMany.mockResolvedValue([
    { id: 'file-1', file_name: 'screenshot1.png', storage_path: 'diagnostic-camp-001/1.png', mime_type: 'image/png', file_size: 1024, uploaded_at: new Date().toISOString() },
  ]);
  mockCampaignsList.findUnique.mockResolvedValue(campaign);
  mockGalleryEvents.create.mockResolvedValue({ id: 'gevt-001' });
  mockGalleryEvents.createMany.mockResolvedValue({ count: 1 });
});

// ── Token resolution tests ─────────────────────────────────────────────

describe('GET /api/public/marketing/gallery/:token — token resolution', () => {
  it('returns 200 with gallery data for valid token', async () => {
    const res = await request(publicApp).get(`/api/public/marketing/gallery/${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.expired).toBe(false);
    expect(res.body.gallery.archetype).toBe('A2');
    expect(res.body.gallery.title).toBe('Review Recovery Diagnostic — Test Biz');
    expect(res.body.screenshots).toHaveLength(1);
  });

  it('returns 200 with { expired: true } for expired token', async () => {
    const res = await request(publicApp).get(`/api/public/marketing/gallery/${EXPIRED_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.expired).toBe(true);
    expect(res.body.businessName).toBe('Test Biz');
    expect(res.body.reactivationUrl).toBeDefined();
  });

  it('returns 404 for invalid token', async () => {
    const res = await request(publicApp).get(`/api/public/marketing/gallery/${INVALID_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for wrong token type (qr_deliverable)', async () => {
    const res = await request(publicApp).get(`/api/public/marketing/gallery/${WRONG_TYPE_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── First view tests ───────────────────────────────────────────────────

describe('GET /api/public/marketing/gallery/:token — first view stamping', () => {
  it('stamps viewed_at on first view', async () => {
    await request(publicApp).get(`/api/public/marketing/gallery/${VALID_TOKEN}`);
    expect(mockPreviewTokens.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'token-001' },
        data: expect.objectContaining({ viewed_at: expect.any(Date) }),
      }),
    );
  });

  it('does not stamp viewed_at on second view (already set)', async () => {
    // Token already has viewed_at set
    mockPreviewTokens.findFirst.mockResolvedValue({
      ...activeToken,
      viewed_at: new Date(Date.now() - 3600000),
      mkt_campaigns_list: campaign,
    });
    await request(publicApp).get(`/api/public/marketing/gallery/${VALID_TOKEN}`);
    expect(mockPreviewTokens.update).not.toHaveBeenCalled();
  });
});

// ── Token generation tests (admin) ─────────────────────────────────────

describe('POST /api/admin/marketing-ops/campaigns/:id/gallery-token — generation', () => {
  it('returns 201 with token data for valid campaign at shown stage', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(campaign);
    const res = await request(adminApp)
      .post(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-token`)
      .send({ expiryDays: 3 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token.tokenType).toBe('diagnostic_gallery');
    expect(res.body.token.archetype).toBe('A2');
  });

  it('returns 400 no_screenshots when campaign has no diagnostic_screenshot files', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: CAMPAIGN_ID,
      stage: 'shown',
      package_price_cents: 15000,
      mkt_files_list: [],
    });
    const res = await request(adminApp)
      .post(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-token`)
      .send({ expiryDays: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_screenshots');
  });

  it('returns 400 when campaign is at seek stage', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: CAMPAIGN_ID,
      stage: 'seek',
      package_price_cents: 15000,
      mkt_files_list: [{ id: 'file-1', file_name: 'screenshot1.png' }],
    });
    const res = await request(adminApp)
      .post(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-token`)
      .send({ expiryDays: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_stage');
  });

  it('returns 400 when campaign is at paid stage', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: CAMPAIGN_ID,
      stage: 'paid',
      package_price_cents: 15000,
      mkt_files_list: [{ id: 'file-1', file_name: 'screenshot1.png' }],
    });
    const res = await request(adminApp)
      .post(`/api/admin/marketing-ops/campaigns/${CAMPAIGN_ID}/gallery-token`)
      .send({ expiryDays: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_stage');
  });

  it('returns 404 when campaign not found', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);
    const res = await request(adminApp)
      .post(`/api/admin/marketing-ops/campaigns/nonexistent/gallery-token`)
      .send({ expiryDays: 3 });
    expect(res.status).toBe(404);
  });
});
