/**
 * gbpPostScheduler tests
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §10 quality gate #5
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE3.md Task 8
 *
 * Test cases:
 * 1. Publishes due SCHEDULED rows (past scheduled_for) → status = PUBLISHED
 * 2. Does not publish future-scheduled rows (scheduled_for > NOW())
 * 3. Marks FAILED on Google API error
 * 4. Never double-publishes (once PUBLISHED, the row is skipped)
 * 5. Respects gbp_posts_scheduler entitlement (skips tenants without it)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockHasFeature,
  mockGbpPostsFindMany,
  mockGbpPostsUpdate,
  mockGbpPostsUpdateMany,
  mockTenantGbpOptionsFindUnique,
  mockCreatePost,
  mockEmitGbpActivity,
  mockCrmAlertsFindFirst,
  mockGbpLinksFindMany,
  mockCrmAlertCreate,
} = vi.hoisted(() => ({
  mockHasFeature: vi.fn(),
  mockGbpPostsFindMany: vi.fn(),
  mockGbpPostsUpdate: vi.fn(),
  mockGbpPostsUpdateMany: vi.fn(),
  mockTenantGbpOptionsFindUnique: vi.fn(),
  mockCreatePost: vi.fn(),
  mockEmitGbpActivity: vi.fn(),
  mockCrmAlertsFindFirst: vi.fn(),
  mockGbpLinksFindMany: vi.fn(),
  mockCrmAlertCreate: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    gbp_posts: {
      findMany: mockGbpPostsFindMany,
      update: mockGbpPostsUpdate,
      updateMany: mockGbpPostsUpdateMany,
    },
    tenant_gbp_options_settings: {
      // null → 'auto_publish' default; set a row in tests to exercise the gate
      findUnique: mockTenantGbpOptionsFindUnique,
    },
    crm_alerts: {
      findFirst: mockCrmAlertsFindFirst,
    },
    mkt_customer_gbp_links: {
      findMany: mockGbpLinksFindMany,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/platform-scope', () => ({
  PLATFORM_SCOPE: 'platform',
}));

vi.mock('../lib/google/gbp-activity', () => ({
  emitGbpActivity: mockEmitGbpActivity,
}));

vi.mock('../services/CrmAlertService', () => ({
  CrmAlertService: {
    getInstance: () => ({
      create: mockCrmAlertCreate,
    }),
  },
}));

vi.mock('../services/permissions/PermissionServiceFactory', () => ({
  permissionServiceFactory: {
    hasFeature: mockHasFeature,
  },
}));

vi.mock('../services/GBPAdvancedSync', () => ({
  createPost: mockCreatePost,
}));

import { runSchedulerPass } from '../jobs/gbpPostScheduler';

// ── Test constants ───────────────────────────────────────────────────────

const TENANT_ID = 'tenant_001';
const NOW = new Date();
const PAST_DATE = new Date(NOW.getTime() - 60 * 1000); // 1 min ago
const FUTURE_DATE = new Date(NOW.getTime() + 60 * 60 * 1000); // 1 hour ahead

const BASE_POST = {
  id: 'post_001',
  tenant_id: TENANT_ID,
  summary: 'Check out our new menu!',
  topic_type: 'STANDARD',
  call_to_action_type: null,
  call_to_action_url: null,
  media_url: null,
  event_title: null,
  event_start_date: null,
  event_end_date: null,
  offer_coupon_code: null,
  offer_redeem_url: null,
  offer_terms: null,
  status: 'SCHEDULED',
  scheduled_for: PAST_DATE,
  post_name: null,
  google_post_id: null,
  attempts: 0,
  created_by: 'tenant',
  batch_id: null,
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: entitled
  mockHasFeature.mockResolvedValue(true);
  mockGbpPostsUpdate.mockResolvedValue({});
  // Claim-by-update succeeds by default (count: 1); set {count: 0} in tests
  // to simulate another worker taking the row.
  mockGbpPostsUpdateMany.mockResolvedValue({ count: 1 });
  mockEmitGbpActivity.mockResolvedValue(undefined);
  mockTenantGbpOptionsFindUnique.mockResolvedValue(null);
  mockCreatePost.mockResolvedValue({ success: true, postId: 'google_post_123' });
  // Default: no expired posts (findMany returns [] for the expiry scan)
  mockCrmAlertsFindFirst.mockResolvedValue(null);
  mockGbpLinksFindMany.mockResolvedValue([]);
  mockCrmAlertCreate.mockResolvedValue({});
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('gbpPostScheduler', () => {
  it('1. Publishes due SCHEDULED rows (past scheduled_for) → status = PUBLISHED', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_001', scheduled_for: PAST_DATE },
    ]);

    await runSchedulerPass();

    expect(mockCreatePost).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
      summary: 'Check out our new menu!',
    }), { persist: false });
    expect(mockGbpPostsUpdate).toHaveBeenCalledWith({
      where: { id: 'post_001' },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        published_at: expect.any(Date),
        post_name: 'google_post_123',
      }),
    });
  });

  it('2. Does not publish future-scheduled rows (scheduled_for > NOW())', async () => {
    // findMany is mocked — the real query filters by scheduled_for <= NOW()
    // but we simulate the case where the DB returns no rows because all are future
    mockGbpPostsFindMany.mockResolvedValue([]);

    await runSchedulerPass();

    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockGbpPostsUpdate).not.toHaveBeenCalled();
  });

  it('3. Retries with backoff on Google API error (attempts < 3 → SCHEDULED)', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_002' },
    ]);
    mockCreatePost.mockResolvedValue({ success: false, error: 'API error: 500' });

    await runSchedulerPass();

    expect(mockGbpPostsUpdate).toHaveBeenCalledWith({
      where: { id: 'post_002' },
      data: expect.objectContaining({
        status: 'SCHEDULED',
        attempts: 1,
        last_error: 'API error: 500',
        publishing_started_at: null,
        scheduled_for: expect.any(Date),
      }),
    });
  });

  it('3b. Skips when another worker already claimed the row (claim lease)', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_claimed' },
    ]);
    // claim updateMany → 0 rows matched (status no longer SCHEDULED)
    mockGbpPostsUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // stale reclaim sweep
      .mockResolvedValueOnce({ count: 0 }); // per-post claim fails

    await runSchedulerPass();

    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockGbpPostsUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'post_claimed' }, data: expect.objectContaining({ status: 'PUBLISHED' }) })
    );
  });

  it('3c. Terminal failure at max attempts → FAILED + ops activity event', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_003', attempts: 2 },
    ]);
    mockCreatePost.mockResolvedValue({ success: false, error: 'API error: 500' });

    await runSchedulerPass();

    expect(mockGbpPostsUpdate).toHaveBeenCalledWith({
      where: { id: 'post_003' },
      data: expect.objectContaining({
        status: 'FAILED',
        attempts: 3,
        last_error: 'API error: 500',
      }),
    });
    expect(mockEmitGbpActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'post_failed',
        tenantId: TENANT_ID,
        visibleToMerchant: false,
      })
    );
  });

  it('3d. 429 reschedules without burning an attempt (Retry-After)', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_429' },
    ]);
    mockCreatePost.mockResolvedValue({ success: false, error: 'API error: 429', status: 429, retryAfterMs: 120_000 });

    await runSchedulerPass();

    expect(mockGbpPostsUpdate).toHaveBeenCalledWith({
      where: { id: 'post_429' },
      data: expect.objectContaining({
        status: 'SCHEDULED',
        scheduled_for: expect.any(Date),
        publishing_started_at: null,
      }),
    });
    // attempts stays untouched on 429
    expect(mockGbpPostsUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: 1 }) })
    );
  });

  it('3e. Emits a merchant-visible post_published activity on success', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_evt', created_by: 'admin' },
    ]);

    await runSchedulerPass();

    expect(mockEmitGbpActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'post_published',
        actor: 'admin',
        tenantId: TENANT_ID,
      })
    );
  });

  it('4. Never double-publishes (once PUBLISHED, the row is skipped)', async () => {
    // The scheduler only queries status = 'SCHEDULED' rows.
    // PUBLISHED rows are never returned by findMany, so they can't be reprocessed.
    // We simulate this by returning an empty array (no SCHEDULED rows).
    mockGbpPostsFindMany.mockResolvedValue([]);

    await runSchedulerPass();

    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('5. Respects gbp_posts_scheduler entitlement (skips tenants without it)', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_003', tenant_id: 'tenant_no_entitlement' },
    ]);
    mockHasFeature.mockResolvedValue(false); // Not entitled

    await runSchedulerPass();

    // Should NOT call createPost for unentitled tenant
    expect(mockCreatePost).not.toHaveBeenCalled();
    // Should NOT update the post status (leaves as SCHEDULED for potential future entitlement)
    expect(mockGbpPostsUpdate).not.toHaveBeenCalled();
  });
});

// ── Post-expiration upgrade trigger (§5.1) ───────────────────────────────
//
// NOTE: the scheduler caches entitlement checks per tenant for 1 minute at
// module level — each trigger test uses a distinct tenant ID to stay clear
// of cache cross-contamination with tests 1–5.

function expiredPostFor(tenantId: string) {
  return {
    id: `post_expired_${tenantId}`,
    tenant_id: tenantId,
    summary: 'Holiday sale — 20% off everything in store this week only!',
    status: 'PUBLISHED',
    event_end_date: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), // expired 7 days ago
  };
}

describe('gbpPostScheduler — post-expiration trigger', () => {
  it('6. Emits gbp_post_expired alert per linked customer (mkt_direct) for expired posts when unentitled', async () => {
    const post = expiredPostFor('tenant_exp_6');
    // First findMany call: due SCHEDULED posts → none
    // Second findMany call: expired posts scan → one expired post
    mockGbpPostsFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([post]);
    mockHasFeature.mockResolvedValue(false); // no scheduler entitlement
    mockGbpLinksFindMany.mockResolvedValue([{ customer_id: 'cust_001' }]);

    await runSchedulerPass();

    expect(mockCrmAlertCreate).toHaveBeenCalledTimes(1);
    expect(mockCrmAlertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'platform',
        type: 'gbp_post_expired',
        metadata: expect.objectContaining({
          customer_id: 'cust_001',
          tenant_id: 'tenant_exp_6',
          post_id: post.id,
        }),
      }),
    );
  });

  it('7. Never fires twice for the same post (deduped via existing alert)', async () => {
    const post = expiredPostFor('tenant_exp_7');
    mockGbpPostsFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([post]);
    mockHasFeature.mockResolvedValue(false);
    mockCrmAlertsFindFirst.mockResolvedValue({ id: 'alert-existing' }); // already fired

    await runSchedulerPass();

    expect(mockCrmAlertCreate).not.toHaveBeenCalled();
  });

  it('8. Suppressed when the tenant has the gbp_posts_scheduler entitlement', async () => {
    const post = expiredPostFor('tenant_exp_8');
    mockGbpPostsFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([post]);
    mockHasFeature.mockResolvedValue(true); // entitled → trigger suppressed

    await runSchedulerPass();

    expect(mockCrmAlertCreate).not.toHaveBeenCalled();
  });
});
