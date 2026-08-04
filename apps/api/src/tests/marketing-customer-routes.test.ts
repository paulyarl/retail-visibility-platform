/**
 * marketing-customer routes tests (§11 acceptance)
 *
 * Verifies:
 * - JWT required: no auth → 401 unauthorized
 * - Context separation: storefront-only customer → 403 context_required
 * - Cross-customer isolation: customer A gets 404 on customer B's campaigns
 * - Platform-context customer gets 200 on overview
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks (must use vi.hoisted for variables referenced in vi.mock factories) ──

const {
  mockVerifyAccessToken,
  mockComputeContexts,
  mockCampaignsList,
  mockRevenue,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockComputeContexts: vi.fn(),
  mockCampaignsList: vi.fn(),
  mockRevenue: vi.fn(),
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
    mkt_campaigns_list: {
      findMany: mockCampaignsList,
      findFirst: mockCampaignsList,
    },
    marketing_revenue: {
      findMany: mockRevenue,
      findFirst: mockRevenue,
    },
    customer_saved_coupons: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    customers: {
      findUnique: vi.fn().mockResolvedValue({ email: 'test@example.com', metadata: {} }),
    },
    crm_alerts: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    crm_customer_alert_states: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/MarketingCustomerProjection', () => ({
  buildPortalOverview: vi.fn().mockResolvedValue({
    totalSpentCents: 0,
    activeEngagements: 0,
    deliverablesReady: 0,
    campaigns: [],
    recentPurchases: [],
  }),
  buildReceiptViewModel: vi.fn(),
  projectCampaign: vi.fn(),
  projectCampaigns: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/marketing/MarketingReceiptPdfService', () => ({
  MarketingReceiptPdfService: {
    generate: vi.fn(),
  },
}));

vi.mock('../services/CustomerPaymentMethodsService', () => ({
  CustomerPaymentMethodsService: {
    getInstance: () => ({
      savePaymentMethodFromIntent: vi.fn(),
      getPaymentMethod: vi.fn().mockResolvedValue(null),
      getOrCreateStripeCustomer: vi.fn().mockResolvedValue({ id: 'cus_test' }),
    }),
  },
}));

vi.mock('../services/CouponService', () => ({
  CouponService: {
    getInstance: () => ({
      validateCoupon: vi.fn().mockResolvedValue({ valid: false }),
    }),
  },
}));

vi.mock('../services/MarketingCampaignService', () => ({
  default: {
    markCampaignPaid: vi.fn(),
  },
}));

vi.mock('../services/MarketingDeliverableService', () => ({
  MarketingDeliverableService: {
    getInstance: () => ({
      upgradeDeliverableToPaid: vi.fn(),
    }),
  },
}));

vi.mock('../services/subscription/SubscriptionBillingService', () => ({
  getSubscriptionBillingService: () => ({
    createOneTimePaymentIntent: vi.fn().mockResolvedValue({ error: 'not configured' }),
    getPaymentIntentStatus: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    stripeInstance: null,
  }),
}));

vi.mock('../services/marketing/MarketingReceiptEmailService', () => ({
  MarketingReceiptEmailService: {
    send: vi.fn().mockResolvedValue({ sent: true }),
  },
}));

vi.mock('../lib/platform-scope', () => ({
  PLATFORM_SCOPE: 'platform',
}));

import marketingCustomerRouter from '../routes/marketing-customer';

// ── Test app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/customer/marketing', marketingCustomerRouter);

const TEST_TOKEN = 'test-customer-jwt';
const PLATFORM_CUSTOMER_ID = 'cust_platform_001';
const STOREFRONT_ONLY_CUSTOMER_ID = 'cust_storefront_001';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid token → platform customer
  mockVerifyAccessToken.mockReturnValue({ customerId: PLATFORM_CUSTOMER_ID });
  mockComputeContexts.mockResolvedValue({ storefront: false, platform: true });
});

// ── Auth tests ──────────────────────────────────────────────────────────

describe('marketing-customer routes — auth', () => {
  it('returns 401 when no JWT provided', async () => {
    const res = await request(app).get('/api/customer/marketing/overview');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when JWT is invalid', async () => {
    mockVerifyAccessToken.mockReturnValue(null);
    const res = await request(app)
      .get('/api/customer/marketing/overview')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });
});

// ── Context separation tests (§4.2) ─────────────────────────────────────

describe('marketing-customer routes — context gating', () => {
  it('returns 403 context_required for storefront-only customer', async () => {
    mockVerifyAccessToken.mockReturnValue({ customerId: STOREFRONT_ONLY_CUSTOMER_ID });
    mockComputeContexts.mockResolvedValue({ storefront: true, platform: false });

    const res = await request(app)
      .get('/api/customer/marketing/overview')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('context_required');
  });

  it('returns 200 for platform-context customer', async () => {
    mockVerifyAccessToken.mockReturnValue({ customerId: PLATFORM_CUSTOMER_ID });
    mockComputeContexts.mockResolvedValue({ storefront: false, platform: true });

    const res = await request(app)
      .get('/api/customer/marketing/overview')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for zero-context customer (no relationships)', async () => {
    mockVerifyAccessToken.mockReturnValue({ customerId: 'cust_zero_001' });
    mockComputeContexts.mockResolvedValue({ storefront: false, platform: false });

    const res = await request(app)
      .get('/api/customer/marketing/overview')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('context_required');
  });
});

// ── Cross-customer isolation (§11) ──────────────────────────────────────

describe('marketing-customer routes — cross-customer isolation', () => {
  it('customer A gets 404 on customer B campaign', async () => {
    // Customer A is authenticated with platform context
    mockVerifyAccessToken.mockReturnValue({ customerId: 'cust_A' });
    mockComputeContexts.mockResolvedValue({ storefront: false, platform: true });

    // findFirst returns null — campaign belongs to customer B, not A
    mockCampaignsList.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/customer/marketing/campaigns/mkt-customer-B-campaign')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('customer A gets 404 on customer B receipt', async () => {
    mockVerifyAccessToken.mockReturnValue({ customerId: 'cust_A' });
    mockComputeContexts.mockResolvedValue({ storefront: false, platform: true });
    mockRevenue.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/customer/marketing/receipts/rev-customer-B')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
