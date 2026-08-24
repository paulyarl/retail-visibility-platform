/**
 * directory-gbp-public routes tests
 *
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 9
 *
 * 7 tests:
 * 1. Unknown slug → 404
 * 2. Both gates pass → returns reviews with public fields
 * 3. Hard gate fails (no entitlement) → { enabled: false }
 * 4. Soft gate fails (merchant pref off) → { enabled: false }
 * 5. Posts endpoint — both gates pass → returns published posts only
 * 6. Photos endpoint — both gates pass → returns photos with public fields only
 * 7. Public field filtering — reviews exclude internal fields (sentiment, ai_drafts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockTenantsFindUnique,
  mockTenantsFindFirst,
  mockDirListingsFindFirst,
  mockGbpReviewsFindMany,
  mockGbpLocationsFindFirst,
  mockGbpPostsFindMany,
  mockGbpMediaFindMany,
  mockResolveEffectiveCapabilitiesFromMV,
} = vi.hoisted(() => ({
  mockTenantsFindUnique: vi.fn(),
  mockTenantsFindFirst: vi.fn(),
  mockDirListingsFindFirst: vi.fn(),
  mockGbpReviewsFindMany: vi.fn(),
  mockGbpLocationsFindFirst: vi.fn(),
  mockGbpPostsFindMany: vi.fn(),
  mockGbpMediaFindMany: vi.fn(),
  mockResolveEffectiveCapabilitiesFromMV: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenants: {
      findUnique: mockTenantsFindUnique,
      findFirst: mockTenantsFindFirst,
    },
    directory_listings_list: {
      findFirst: mockDirListingsFindFirst,
    },
    gbp_reviews: {
      findMany: mockGbpReviewsFindMany,
    },
    gbp_locations_list: {
      findFirst: mockGbpLocationsFindFirst,
    },
    gbp_posts: {
      findMany: mockGbpPostsFindMany,
    },
    gbp_media: {
      findMany: mockGbpMediaFindMany,
    },
  },
}));

vi.mock('../services/EffectiveCapabilityResolver', () => ({
  resolveEffectiveCapabilitiesFromMV: mockResolveEffectiveCapabilitiesFromMV,
}));

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

import directoryGbpPublicRoutes from '../routes/directory-gbp-public';

const app = express();
app.use(express.json());
app.use('/api/public/directory', directoryGbpPublicRoutes);

const TENANT_ID = 'tid-test-123';
const SLUG = 'test-business';

function mockTenantFound() {
  mockTenantsFindUnique.mockResolvedValue({ id: TENANT_ID });
  mockTenantsFindFirst.mockResolvedValue(null);
  mockDirListingsFindFirst.mockResolvedValue(null);
}

function mockTenantNotFound() {
  mockTenantsFindUnique.mockResolvedValue(null);
  mockTenantsFindFirst.mockResolvedValue(null);
  mockDirListingsFindFirst.mockResolvedValue(null);
}

function mockGatesEnabled(reviewsEnabled = true, contentEnabled = true) {
  mockResolveEffectiveCapabilitiesFromMV.mockResolvedValue({
    effective: {
      gbp_management: {
        enabled: true,
        is_flexible: true,
        can_show_reviews: true,
        can_show_content: true,
        can_use_ai_response: true,
        can_use_posts_scheduler: true,
        reviews_enabled: reviewsEnabled,
        content_enabled: contentEnabled,
        merchant_preferences: {
          gbp_reviews_display: reviewsEnabled,
          gbp_content_display: contentEnabled,
        },
        features: {},
      },
    },
  });
}

function mockGatesDisabled() {
  mockResolveEffectiveCapabilitiesFromMV.mockResolvedValue({
    effective: {
      gbp_management: {
        enabled: false,
        is_flexible: false,
        can_show_reviews: false,
        can_show_content: false,
        can_use_ai_response: false,
        can_use_posts_scheduler: false,
        reviews_enabled: false,
        content_enabled: false,
        merchant_preferences: {
          gbp_reviews_display: true,
          gbp_content_display: true,
        },
        features: {},
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/public/directory/:slug/gbp-reviews', () => {
  it('1. returns 404 for unknown slug', async () => {
    mockTenantNotFound();
    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-reviews`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('2. returns reviews with public fields when both gates pass', async () => {
    mockTenantFound();
    mockGatesEnabled(true, true);
    mockGbpReviewsFindMany.mockResolvedValue([
      {
        id: 'rev-1',
        reviewer_name: 'John D.',
        star_rating: 5,
        comment: 'Great service!',
        review_reply: 'Thank you!',
        google_create_time: '2024-01-15T10:00:00Z',
      },
    ]);
    mockGbpLocationsFindFirst.mockResolvedValue({
      cached_average_rating: 4.5,
      cached_review_count: 10,
      business_name: 'Test Business',
    });

    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-reviews`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.aggregateRating).toBe(4.5);
    expect(res.body.data.totalReviewCount).toBe(10);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].reviewerName).toBe('John D.');
    expect(res.body.data.reviews[0].starRating).toBe(5);
  });

  it('3. returns { enabled: false } when hard gate fails (no entitlement)', async () => {
    mockTenantFound();
    mockGatesDisabled();
    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-reviews`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.reviews).toBeUndefined();
  });

  it('4. returns { enabled: false } when soft gate fails (merchant pref off)', async () => {
    mockTenantFound();
    // Hard gate passes but merchant gate fails
    mockResolveEffectiveCapabilitiesFromMV.mockResolvedValue({
      effective: {
        gbp_management: {
          enabled: true,
          is_flexible: false,
          can_show_reviews: true,
          can_show_content: true,
          can_use_ai_response: false,
          can_use_posts_scheduler: false,
          reviews_enabled: false,
          content_enabled: true,
          merchant_preferences: {
            gbp_reviews_display: false,
            gbp_content_display: true,
          },
          features: {},
        },
      },
    });
    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  });

  it('7. public field filtering — reviews exclude internal fields', async () => {
    mockTenantFound();
    mockGatesEnabled(true, true);
    mockGbpReviewsFindMany.mockResolvedValue([
      {
        id: 'rev-1',
        reviewer_name: 'Jane',
        star_rating: 4,
        comment: 'Good',
        review_reply: 'Thanks',
        google_create_time: '2024-02-01T00:00:00Z',
      },
    ]);
    mockGbpLocationsFindFirst.mockResolvedValue(null);

    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-reviews`);
    expect(res.status).toBe(200);
    const review = res.body.data.reviews[0];
    // Public fields should be present
    expect(review).toHaveProperty('id');
    expect(review).toHaveProperty('reviewerName');
    expect(review).toHaveProperty('starRating');
    expect(review).toHaveProperty('comment');
    expect(review).toHaveProperty('reviewReply');
    // Internal fields should NOT be present
    expect(review).not.toHaveProperty('sentiment');
    expect(review).not.toHaveProperty('sentiment_score');
    expect(review).not.toHaveProperty('reply_status');
    expect(review).not.toHaveProperty('ai_drafts');
    expect(review).not.toHaveProperty('dispute_status');
  });
});

describe('GET /api/public/directory/:slug/gbp-posts', () => {
  it('5. returns published posts when both gates pass', async () => {
    mockTenantFound();
    mockGatesEnabled(true, true);
    mockGbpPostsFindMany.mockResolvedValue([
      {
        id: 'post-1',
        topic_type: 'OFFER',
        summary: '20% off this weekend!',
        media_url: 'https://example.com/photo.jpg',
        call_to_action_type: 'ORDER',
        call_to_action_url: 'https://example.com/order',
        event_title: null,
        event_start_date: null,
        event_end_date: null,
        offer_coupon_code: 'WEEKEND20',
        offer_redeem_url: 'https://example.com/redeem',
        offer_terms: 'Limit one per customer',
        google_create_time: '2024-03-01T00:00:00Z',
        published_at: '2024-03-01T12:00:00Z',
      },
    ]);

    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-posts`);
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.posts).toHaveLength(1);
    expect(res.body.data.posts[0].topicType).toBe('OFFER');
    expect(res.body.data.posts[0].offerCouponCode).toBe('WEEKEND20');
    // Internal fields should not be present
    expect(res.body.data.posts[0]).not.toHaveProperty('status');
    expect(res.body.data.posts[0]).not.toHaveProperty('scheduled_for');
    expect(res.body.data.posts[0]).not.toHaveProperty('post_name');
  });
});

describe('GET /api/public/directory/:slug/gbp-photos', () => {
  it('6. returns photos with public fields only when both gates pass', async () => {
    mockTenantFound();
    mockGatesEnabled(true, true);
    mockGbpMediaFindMany.mockResolvedValue([
      {
        id: 'media-1',
        category: 'EXTERIOR',
        source_url: 'https://example.com/exterior.jpg',
        google_url: 'https://lh3.googleusercontent.com/photo.jpg',
        description: 'Storefront exterior',
      },
    ]);

    const res = await request(app).get(`/api/public/directory/${SLUG}/gbp-photos`);
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.photos).toHaveLength(1);
    expect(res.body.data.photos[0].category).toBe('EXTERIOR');
    expect(res.body.data.photos[0].sourceUrl).toBe('https://example.com/exterior.jpg');
    // Internal fields should not be present
    expect(res.body.data.photos[0]).not.toHaveProperty('view_count');
  });
});
