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
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockComputeContexts: vi.fn(),
  mockGbpLinksFindFirst: vi.fn(),
  mockGbpLocationsFindMany: vi.fn(),
  mockGbpLocationsUpdateMany: vi.fn(),
  mockOauthAccountsFindFirst: vi.fn(),
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
      updateMany: mockGbpLocationsUpdateMany,
    },
    google_oauth_accounts_list: {
      findFirst: mockOauthAccountsFindFirst,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
});
