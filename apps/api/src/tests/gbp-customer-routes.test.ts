/**
 * gbp-customer routes tests
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §10 quality gate #3
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE0.md Task 10b
 *
 * Mirrors the 7-test marketing-customer-routes.test.ts pattern:
 * 1. No auth → 401
 * 2. Invalid token → 401
 * 3. Storefront-only context → 403 context_required
 * 4. Zero context → 403
 * 5. Platform context → 200 (returns tenantId + connected status)
 * 6. Cross-customer isolation → 404 (no bridge link → 404)
 * 7. Double-wrap contract — response shape is { success: true, data: { ... } }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockVerifyAccessToken,
  mockComputeContexts,
  mockGbpLinksFindFirst,
  mockGbpLocationsFindMany,
  mockGbpLocationsUpdateMany,
  mockOauthAccountsFindFirst,
  mockFetchOptions,
  mockStartVerification,
  mockCompleteVerification,
  mockGbpReviewsFindFirst,
  mockGbpReviewsFindMany,
  mockGbpReviewsCount,
  mockGbpReviewsUpdate,
  mockMktCampaignsFindFirst,
  mockGenerateDrafts,
  mockReplyToReview,
  mockGenerateIntakeLink,
  mockSubmitRegistryIntake,
  mockGbpPostsFindFirst,
  mockGbpPostsFindMany,
  mockGbpPostsCount,
  mockGbpPostsCreate,
  mockGbpPostsDelete,
  mockGbpMediaCreate,
  mockGbpLocationsFindFirstForMedia,
  mockCreatePost,
  mockDeletePost,
  mockListMedia,
  mockUploadPhoto,
  mockUploadPhotoBinary,
  mockHasFeature,
  mockResolveGoldStandard,
  mockResolveEffectiveCapabilities,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockComputeContexts: vi.fn(),
  mockGbpLinksFindFirst: vi.fn(),
  mockGbpLocationsFindMany: vi.fn(),
  mockGbpLocationsUpdateMany: vi.fn(),
  mockOauthAccountsFindFirst: vi.fn(),
  mockFetchOptions: vi.fn(),
  mockStartVerification: vi.fn(),
  mockCompleteVerification: vi.fn(),
  mockGbpReviewsFindFirst: vi.fn(),
  mockGbpReviewsFindMany: vi.fn(),
  mockGbpReviewsCount: vi.fn(),
  mockGbpReviewsUpdate: vi.fn(),
  mockMktCampaignsFindFirst: vi.fn(),
  mockGenerateDrafts: vi.fn(),
  mockReplyToReview: vi.fn(),
  mockGenerateIntakeLink: vi.fn(),
  mockSubmitRegistryIntake: vi.fn(),
  mockGbpPostsFindFirst: vi.fn(),
  mockGbpPostsFindMany: vi.fn(),
  mockGbpPostsCount: vi.fn(),
  mockGbpPostsCreate: vi.fn(),
  mockGbpPostsDelete: vi.fn(),
  mockGbpMediaCreate: vi.fn(),
  mockGbpLocationsFindFirstForMedia: vi.fn(),
  mockCreatePost: vi.fn(),
  mockDeletePost: vi.fn(),
  mockListMedia: vi.fn(),
  mockUploadPhoto: vi.fn(),
  mockUploadPhotoBinary: vi.fn(),
  mockHasFeature: vi.fn(),
  mockResolveGoldStandard: vi.fn(),
  mockResolveEffectiveCapabilities: vi.fn(),
}));

vi.mock('../services/CustomerTokenService', () => ({
  CustomerTokenService: {
    getInstance: () => ({
      verifyAccessToken: mockVerifyAccessToken,
    }),
    extractBearerToken: (req: any) => {
      const auth = req.headers?.authorization;
      if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
      return null;
    },
  },
}));

vi.mock('../services/CustomerAuthService', () => ({
  CustomerAuthService: {
    getInstance: () => ({
      computeContexts: mockComputeContexts,
    }),
  },
}));

vi.mock('../prisma', () => ({
  prisma: {
    mkt_customer_gbp_links: {
      findFirst: mockGbpLinksFindFirst,
      upsert: vi.fn().mockResolvedValue({}),
    },
    gbp_locations_list: {
      findMany: mockGbpLocationsFindMany,
      findFirst: mockGbpLocationsFindFirstForMedia,
      updateMany: mockGbpLocationsUpdateMany,
    },
    google_oauth_accounts_list: {
      findFirst: mockOauthAccountsFindFirst,
    },
    gbp_reviews: {
      findFirst: mockGbpReviewsFindFirst,
      findMany: mockGbpReviewsFindMany,
      count: mockGbpReviewsCount,
      update: mockGbpReviewsUpdate,
    },
    gbp_posts: {
      findFirst: mockGbpPostsFindFirst,
      findMany: mockGbpPostsFindMany,
      count: mockGbpPostsCount,
      create: mockGbpPostsCreate,
      delete: mockGbpPostsDelete,
    },
    gbp_media: {
      create: mockGbpMediaCreate,
    },
    mkt_campaigns_list: {
      findFirst: mockMktCampaignsFindFirst,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/GBPVerificationService', () => ({
  GBPVerificationService: {
    getInstance: () => ({
      fetchOptions: mockFetchOptions,
      start: mockStartVerification,
      complete: mockCompleteVerification,
    }),
  },
}));

vi.mock('../services/GBPReviewReplyService', () => ({
  GBPReviewReplyService: {
    getInstance: () => ({
      generateDrafts: mockGenerateDrafts,
    }),
  },
}));

vi.mock('../services/GBPAdvancedSync', () => ({
  replyToReview: mockReplyToReview,
  createPost: mockCreatePost,
  deletePost: mockDeletePost,
  listMedia: mockListMedia,
  uploadPhoto: mockUploadPhoto,
  uploadPhotoBinary: mockUploadPhotoBinary,
}));

vi.mock('../services/intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({
      resolveGoldStandard: mockResolveGoldStandard,
    }),
  },
}));

vi.mock('../services/permissions/PermissionServiceFactory', () => ({
  permissionServiceFactory: {
    hasFeature: mockHasFeature,
  },
}));

vi.mock('../services/EffectiveCapabilityResolver', () => ({
  resolveEffectiveCapabilitiesFromMV: mockResolveEffectiveCapabilities,
}));

vi.mock('../services/DisputeIntakeService', () => ({
  DisputeIntakeService: {
    getInstance: () => ({
      generateIntakeLink: mockGenerateIntakeLink,
      submitRegistryIntake: mockSubmitRegistryIntake,
    }),
  },
}));

vi.mock('../lib/id-generator', () => ({
  generateQuickStart: vi.fn().mockReturnValue('gbpl-TEST1234'),
}));

import gbpCustomerRouter from '../routes/gbp-customer';

// ── Test app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/customer/marketing/gbp', gbpCustomerRouter);

const TEST_TOKEN = 'test-customer-jwt';
const PLATFORM_CUSTOMER_ID = 'cust_platform_001';
const STOREFRONT_ONLY_CUSTOMER_ID = 'cust_storefront_001';
const TENANT_ID = 'tenant_001';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid token → platform customer
  mockVerifyAccessToken.mockReturnValue({ customerId: PLATFORM_CUSTOMER_ID });
  mockComputeContexts.mockResolvedValue({ storefront: false, platform: true });
  // Default: no drift reconciliation
  mockOauthAccountsFindFirst.mockResolvedValue(null);
  mockGbpLocationsUpdateMany.mockResolvedValue({ count: 0 });
  // Default: bridge link exists
  mockGbpLinksFindFirst.mockResolvedValue({
    id: 'gbpl-001',
    customer_id: PLATFORM_CUSTOMER_ID,
    tenant_id: TENANT_ID,
  });
  // Default: no locations
  mockGbpLocationsFindMany.mockResolvedValue([]);
  // Default: no gbp_management capability block
  mockResolveEffectiveCapabilities.mockResolvedValue(null);
});

// ── Auth tests ──────────────────────────────────────────────────────────

describe('gbp-customer routes — auth', () => {
  it('returns 401 when no JWT provided', async () => {
    const res = await request(app).get('/api/customer/marketing/gbp/status');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when JWT is invalid', async () => {
    mockVerifyAccessToken.mockReturnValue(null);
    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });
});

// ── Context gating tests ────────────────────────────────────────────────

describe('gbp-customer routes — context gating', () => {
  it('returns 403 context_required for storefront-only customer', async () => {
    mockVerifyAccessToken.mockReturnValue({ customerId: STOREFRONT_ONLY_CUSTOMER_ID });
    mockComputeContexts.mockResolvedValue({ storefront: true, platform: false });

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('context_required');
  });

  it('returns 403 context_required for zero-context customer', async () => {
    mockComputeContexts.mockResolvedValue({ storefront: false, platform: false });

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('context_required');
  });
});

// ── /status tests ───────────────────────────────────────────────────────

describe('gbp-customer routes — GET /status', () => {
  it('returns 200 with tenantId + connected status for platform-context customer with bridge', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: 'gbpl-001',
      customer_id: PLATFORM_CUSTOMER_ID,
      tenant_id: TENANT_ID,
    });
    mockGbpLocationsFindMany.mockResolvedValue([
      {
        id: 'loc-001',
        location_id: 'google-loc-001',
        location_name: 'Test Business',
        business_name: null,
        tenant_id: TENANT_ID,
        verification_state: 'UNVERIFIED',
        cached_average_rating: 4.5,
        cached_review_count: 23,
        rating_cache_updated: new Date('2026-08-23'),
        address: '123 Main St',
        phone_number: '555-0100',
        website_url: 'https://example.com',
        category: 'restaurant',
      },
    ]);

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantId).toBe(TENANT_ID);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.location).toBeDefined();
    expect(res.body.data.location.verificationState).toBe('UNVERIFIED');
    expect(res.body.data.location.cachedAverageRating).toBe(4.5);
  });

  it('returns 404 when no GBP bridge link exists (cross-customer isolation)', async () => {
    mockGbpLinksFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('no_gbp_link');
  });

  it('returns double-wrap contract: { success: true, data: { ... } }', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: 'gbpl-001',
      customer_id: PLATFORM_CUSTOMER_ID,
      tenant_id: TENANT_ID,
    });
    mockGbpLocationsFindMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.tenantId).toBe(TENANT_ID);
    expect(res.body.data.connected).toBe(false);
    expect(res.body.data.location).toBeNull();
  });

  it('returns capabilities payload for upgrade-funnel CTAs', async () => {
    mockResolveEffectiveCapabilities.mockResolvedValue({
      effective: {
        gbp_management: {
          enabled: true,
          can_use_ai_response: true,
          can_use_posts_scheduler: false,
          can_show_reviews: true,
          can_show_content: false,
        },
      },
    });

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(mockResolveEffectiveCapabilities).toHaveBeenCalledWith(TENANT_ID);
    expect(res.body.data.capabilities).toEqual({
      canUseAiResponse: true,
      canUsePostsScheduler: false,
      canShowReviews: true,
      canShowContent: false,
    });
  });

  it('returns null capabilities when capability resolution fails (status still 200)', async () => {
    mockResolveEffectiveCapabilities.mockRejectedValue(new Error('resolver down'));

    const res = await request(app)
      .get('/api/customer/marketing/gbp/status')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.capabilities).toBeNull();
  });
});

// ── /verification/* tests (Phase 1) ──────────────────────────────────────

describe('gbp-customer routes — GET /verification/options', () => {
  it('returns 200 with options array', async () => {
    mockFetchOptions.mockResolvedValue({
      success: true,
      options: [
        { method: 'SMS', label: 'Text message (SMS)', data: {} },
        { method: 'MAIL', label: 'Postcard by mail', data: {} },
      ],
    });

    const res = await request(app)
      .get('/api/customer/marketing/gbp/verification/options')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.options).toHaveLength(2);
    expect(res.body.data.options[0].method).toBe('SMS');
  });
});

describe('gbp-customer routes — POST /verification/start', () => {
  it('returns 200 with pending status', async () => {
    mockStartVerification.mockResolvedValue({
      success: true,
      pending: true,
      verificationId: 'verifications/123',
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/verification/start')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ method: 'SMS', label: 'Text message (SMS)' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pending).toBe(true);
    expect(res.body.data.verificationId).toBe('verifications/123');
  });

  it('returns 400 when method is missing', async () => {
    const res = await request(app)
      .post('/api/customer/marketing/gbp/verification/start')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });
});

describe('gbp-customer routes — POST /verification/complete', () => {
  it('returns 200 with verified status on success', async () => {
    mockCompleteVerification.mockResolvedValue({
      success: true,
      verified: true,
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/verification/complete')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ pin: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
  });

  it('returns 400 when PIN is missing', async () => {
    const res = await request(app)
      .post('/api/customer/marketing/gbp/verification/complete')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });
});

// ── /reviews/* tests (Phase 2) ───────────────────────────────────────────

describe('gbp-customer routes — GET /reviews', () => {
  it('returns 200 with paginated reviews', async () => {
    mockGbpReviewsFindMany.mockResolvedValue([
      { id: 'rev-001', tenant_id: TENANT_ID, star_rating: 5, comment: 'Great!', reply_status: 'NONE' },
      { id: 'rev-002', tenant_id: TENANT_ID, star_rating: 3, comment: 'Okay', reply_status: 'PUBLISHED' },
    ]);
    mockGbpReviewsCount.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/customer/marketing/gbp/reviews?page=1&pageSize=20')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reviews).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
    expect(res.body.data.pagination.page).toBe(1);
  });
});

describe('gbp-customer routes — POST /reviews/:id/reply', () => {
  it('returns 200 and updates reply_status to PUBLISHED', async () => {
    mockGbpReviewsFindFirst.mockResolvedValue({
      id: 'rev-001',
      tenant_id: TENANT_ID,
      google_review_id: 'accounts/123/reviews/789',
      reply_status: 'NONE',
    });
    mockReplyToReview.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/reviews/rev-001/reply')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ comment: 'Thank you for your review!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.published).toBe(true);
    expect(mockGbpReviewsUpdate).toHaveBeenCalledWith({
      where: { id: 'rev-001' },
      data: expect.objectContaining({ reply_status: 'PUBLISHED' }),
    });
  });
});

describe('gbp-customer routes — POST /reviews/:id/ai-draft', () => {
  it('returns 200 with 3 drafts (entitled)', async () => {
    mockGenerateDrafts.mockResolvedValue({
      drafts: [
        { angle: 'warm_direct', text: 'Thanks!' },
        { angle: 'professional_concise', text: 'Thank you.' },
        { angle: 'empathetic_detailed', text: 'We appreciate...' },
      ],
      previewMode: false,
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/reviews/rev-001/ai-draft')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.drafts).toHaveLength(3);
    expect(res.body.data.previewMode).toBe(false);
  });

  it('returns 200 with 1 preview draft (unentitled)', async () => {
    mockGenerateDrafts.mockResolvedValue({
      drafts: [{ angle: 'preview', text: 'Thanks for the review!' }],
      previewMode: true,
      upgradeCta: 'Upgrade to GBP Pro',
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/reviews/rev-001/ai-draft')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.drafts).toHaveLength(1);
    expect(res.body.data.previewMode).toBe(true);
    expect(res.body.data.upgradeCta).toBeDefined();
  });
});

describe('gbp-customer routes — POST /reviews/:id/dispute', () => {
  it('returns 200 and creates intake record', async () => {
    mockGbpReviewsFindFirst.mockResolvedValue({
      id: 'rev-001',
      tenant_id: TENANT_ID,
      google_review_id: 'accounts/123/reviews/789',
      reviewer_name: 'Jane',
      star_rating: 1,
      comment: 'Bad',
    });
    mockMktCampaignsFindFirst.mockResolvedValue({ id: 'camp-001' });
    mockGenerateIntakeLink.mockResolvedValue({
      intakeId: 'intake-001',
      token: 'dispute-token-123',
      url: 'https://example.com/dispute',
    });
    mockSubmitRegistryIntake.mockResolvedValue({
      intakeId: 'intake-001',
      campaignId: 'camp-001',
      stage: 'review_dispute_submitted',
      alreadySubmitted: false,
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/reviews/rev-001/dispute')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({
        ownerEmail: 'owner@example.com',
        evidencePayload: { dispute_reason: 'spam', dispute_explanation: 'Fake review' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intakeId).toBe('intake-001');
    expect(mockGbpReviewsUpdate).toHaveBeenCalledWith({
      where: { id: 'rev-001' },
      data: expect.objectContaining({ reply_status: 'DISPUTED' }),
    });
  });
});

// ── /posts/* and /media/* tests (Phase 3) ────────────────────────────────

describe('gbp-customer routes — GET /posts', () => {
  it('returns 200 with paginated posts', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { id: 'post-001', tenant_id: TENANT_ID, summary: 'Hello!', status: 'PUBLISHED', topic_type: 'STANDARD' },
      { id: 'post-002', tenant_id: TENANT_ID, summary: 'Sale!', status: 'SCHEDULED', topic_type: 'OFFER' },
    ]);
    mockGbpPostsCount.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/customer/marketing/gbp/posts?page=1&pageSize=20')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.posts).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });
});

describe('gbp-customer routes — POST /posts (immediate)', () => {
  it('returns 200, status = PUBLISHED (immediate publish)', async () => {
    mockCreatePost.mockResolvedValue({ success: true, postId: 'google_post_123' });
    mockGbpPostsCreate.mockResolvedValue({
      id: 'post-001',
      tenant_id: TENANT_ID,
      summary: 'Test post',
      status: 'PUBLISHED',
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/posts')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ summary: 'Test post', topicType: 'STANDARD' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scheduled).toBe(false);
    expect(mockCreatePost).toHaveBeenCalled();
  });
});

describe('gbp-customer routes — POST /posts (scheduled)', () => {
  it('returns 200, status = SCHEDULED (requires gbp_posts_scheduler)', async () => {
    mockHasFeature.mockResolvedValue(true);
    mockGbpPostsCreate.mockResolvedValue({
      id: 'post-002',
      tenant_id: TENANT_ID,
      summary: 'Scheduled post',
      status: 'SCHEDULED',
      scheduled_for: '2026-12-25T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/customer/marketing/gbp/posts')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({
        summary: 'Scheduled post',
        topicType: 'STANDARD',
        scheduledFor: '2026-12-25T00:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scheduled).toBe(true);
    expect(mockCreatePost).not.toHaveBeenCalled(); // Should NOT publish immediately
  });

  it('returns 403 when scheduling without gbp_posts_scheduler entitlement', async () => {
    mockHasFeature.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/customer/marketing/gbp/posts')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({
        summary: 'Scheduled post',
        topicType: 'STANDARD',
        scheduledFor: '2026-12-25T00:00:00.000Z',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('scheduling_not_entitled');
  });
});

describe('gbp-customer routes — DELETE /posts/:id', () => {
  it('returns 200, post deleted', async () => {
    mockGbpPostsFindFirst.mockResolvedValue({
      id: 'post-001',
      tenant_id: TENANT_ID,
      status: 'PUBLISHED',
      post_name: 'accounts/123/locations/456/localPosts/789',
    });
    mockDeletePost.mockResolvedValue({ success: true });
    mockGbpPostsDelete.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/customer/marketing/gbp/posts/post-001')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);
    expect(mockDeletePost).toHaveBeenCalled();
    expect(mockGbpPostsDelete).toHaveBeenCalled();
  });
});

describe('gbp-customer routes — GET /media', () => {
  it('returns 200 with media list + benchmark', async () => {
    mockListMedia.mockResolvedValue({
      success: true,
      media: [
        { mediaFormat: 'PHOTO', sourceUrl: 'https://example.com/1.jpg', locationAssociation: { category: 'EXTERIOR' } },
        { mediaFormat: 'PHOTO', sourceUrl: 'https://example.com/2.jpg', locationAssociation: { category: 'INTERIOR' } },
      ],
    });
    mockGbpLocationsFindFirstForMedia.mockResolvedValue({ category: 'restaurant' });
    mockResolveGoldStandard.mockResolvedValue({
      id: 'gs-001',
      category_name: 'restaurant',
      configuration_json: {
        expected_fields: {
          platforms: {
            google: { expected_photo_count: 10 },
          },
        },
      },
    });

    const res = await request(app)
      .get('/api/customer/marketing/gbp/media')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.media).toHaveLength(2);
    expect(res.body.data.benchmark).not.toBeNull();
    expect(res.body.data.benchmark.expectedPhotoCount).toBe(10);
    expect(res.body.data.benchmark.currentPhotoCount).toBe(2);
  });
});

describe('gbp-customer routes — POST /media/upload (sourceUrl)', () => {
  it('returns 200 with mediaItemId', async () => {
    mockUploadPhoto.mockResolvedValue({ success: true, mediaItemId: 'media_123' });
    mockGbpMediaCreate.mockResolvedValue({});

    const res = await request(app)
      .post('/api/customer/marketing/gbp/media/upload')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({
        sourceUrl: 'https://example.com/photo.jpg',
        category: 'EXTERIOR',
        description: 'Storefront',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mediaItemId).toBe('media_123');
    expect(mockUploadPhoto).toHaveBeenCalled();
  });
});
