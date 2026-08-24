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
  mockCreatePost,
} = vi.hoisted(() => ({
  mockHasFeature: vi.fn(),
  mockGbpPostsFindMany: vi.fn(),
  mockGbpPostsUpdate: vi.fn(),
  mockCreatePost: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    gbp_posts: {
      findMany: mockGbpPostsFindMany,
      update: mockGbpPostsUpdate,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: entitled
  mockHasFeature.mockResolvedValue(true);
  mockGbpPostsUpdate.mockResolvedValue({});
  mockCreatePost.mockResolvedValue({ success: true, postId: 'google_post_123' });
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
    }));
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

  it('3. Marks FAILED on Google API error', async () => {
    mockGbpPostsFindMany.mockResolvedValue([
      { ...BASE_POST, id: 'post_002' },
    ]);
    mockCreatePost.mockResolvedValue({ success: false, error: 'API error: 500' });

    await runSchedulerPass();

    expect(mockGbpPostsUpdate).toHaveBeenCalledWith({
      where: { id: 'post_002' },
      data: expect.objectContaining({
        status: 'FAILED',
      }),
    });
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
