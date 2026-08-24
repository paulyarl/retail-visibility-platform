/**
 * gbpReviewIngestion tests
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 1 + Task 7
 *
 * Test cases:
 * 1. New review fires gbp_new_review alert per linked customer (mkt_direct
 *    targeting — metadata.customer_id) so the portal read-time targeting
 *    filter in marketing-customer.ts surfaces it.
 * 2. Falls back to a tenant-scoped alert when no customer link exists.
 * 3. Alert metadata carries Int star_rating (mapped from Google's enum).
 * 4. Already-ingested reviews do not fire alerts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockListReviews,
  mockGbpReviewsFindMany,
  mockGbpReviewsUpdate,
  mockGbpLocationsUpdateMany,
  mockGbpLinksFindMany,
  mockCrmAlertCreate,
} = vi.hoisted(() => ({
  mockListReviews: vi.fn(),
  mockGbpReviewsFindMany: vi.fn(),
  mockGbpReviewsUpdate: vi.fn(),
  mockGbpLocationsUpdateMany: vi.fn(),
  mockGbpLinksFindMany: vi.fn(),
  mockCrmAlertCreate: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    gbp_reviews: {
      findMany: mockGbpReviewsFindMany,
      update: mockGbpReviewsUpdate,
    },
    gbp_locations_list: {
      updateMany: mockGbpLocationsUpdateMany,
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

vi.mock('../services/CrmAlertService', () => ({
  CrmAlertService: {
    getInstance: () => ({
      create: mockCrmAlertCreate,
    }),
  },
}));

vi.mock('../services/GBPAdvancedSync', () => ({
  listReviews: mockListReviews,
}));

import { runIngestionForTenant } from '../jobs/gbpReviewIngestion';

// ── Test constants ───────────────────────────────────────────────────────

const TENANT_ID = 'tenant_001';

const NEW_REVIEW = {
  name: 'accounts/a1/locations/l1/reviews/r1',
  starRating: 'FIVE' as const,
  comment: 'Best coffee in town!',
  reviewer: { displayName: 'Jane D.' },
  createTime: '2026-08-24T10:00:00Z',
  updateTime: '2026-08-24T10:00:00Z',
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGbpReviewsFindMany.mockResolvedValue([]); // nothing previously stored → all new
  mockGbpReviewsUpdate.mockResolvedValue({});
  mockGbpLocationsUpdateMany.mockResolvedValue({ count: 1 });
  mockCrmAlertCreate.mockResolvedValue({});
  mockGbpLinksFindMany.mockResolvedValue([]);
  mockListReviews.mockResolvedValue({
    success: true,
    reviews: [NEW_REVIEW],
    averageRating: 4.5,
    totalReviewCount: 23,
    nextPageToken: undefined,
  });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('gbpReviewIngestion — alert targeting', () => {
  it('1. fires gbp_new_review alert per linked customer with metadata.customer_id (mkt_direct)', async () => {
    mockGbpLinksFindMany.mockResolvedValue([
      { customer_id: 'cust_001' },
      { customer_id: 'cust_002' },
    ]);

    const newCount = await runIngestionForTenant(TENANT_ID);

    expect(newCount).toBe(1);
    expect(mockCrmAlertCreate).toHaveBeenCalledTimes(2);
    for (const customerId of ['cust_001', 'cust_002']) {
      expect(mockCrmAlertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'platform',
          type: 'gbp_new_review',
          metadata: expect.objectContaining({
            customer_id: customerId,
            tenant_id: TENANT_ID,
            review_id: NEW_REVIEW.name,
          }),
        }),
      );
    }
  });

  it('2. falls back to tenant-scoped alert when no customer link exists', async () => {
    mockGbpLinksFindMany.mockResolvedValue([]);

    await runIngestionForTenant(TENANT_ID);

    expect(mockCrmAlertCreate).toHaveBeenCalledTimes(1);
    const alert = mockCrmAlertCreate.mock.calls[0][0];
    expect(alert.type).toBe('gbp_new_review');
    expect(alert.metadata.tenant_id).toBe(TENANT_ID);
    expect(alert.metadata.customer_id).toBeUndefined();
  });

  it('3. maps Google enum starRating to Int in alert metadata + title', async () => {
    mockGbpLinksFindMany.mockResolvedValue([{ customer_id: 'cust_001' }]);

    await runIngestionForTenant(TENANT_ID);

    const alert = mockCrmAlertCreate.mock.calls[0][0];
    expect(alert.metadata.star_rating).toBe(5);
    expect(alert.title).toContain('5★');
    expect(alert.title).not.toContain('FIVE');
  });

  it('4. does not fire alerts for already-ingested reviews', async () => {
    const createdAt = new Date('2026-08-20T10:00:00Z');
    mockGbpReviewsFindMany.mockResolvedValue([
      {
        google_review_id: NEW_REVIEW.name,
        created_at: createdAt,
        updated_at: new Date('2026-08-21T10:00:00Z'), // updated later → not new
        reply_status: 'PUBLISHED',
        is_replied: true,
      },
    ]);

    const newCount = await runIngestionForTenant(TENANT_ID);

    expect(newCount).toBe(0);
    expect(mockCrmAlertCreate).not.toHaveBeenCalled();
  });
});
