/**
 * Sprint 10 - Customer Coupon Wallet End-to-End Batch Test
 *
 * Covers CustomerCouponWalletService save/unsave/list/stats/redemption/reminder
 * paths with mocked prisma, CouponService, and CouponAnalyticsService.
 *
 * Run: npx vitest run src/tests/sprint10-customer-coupon-wallet.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ───────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockGetCoupon,
  mockGetCouponByCode,
  mockTrackCouponEvent,
  mockGenerateSavedCouponId,
  mockGenerateCouponReminderId,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetCoupon: vi.fn(),
  mockGetCouponByCode: vi.fn(),
  mockTrackCouponEvent: vi.fn().mockResolvedValue(undefined),
  mockGenerateSavedCouponId: vi.fn().mockReturnValue('scpn-test-001'),
  mockGenerateCouponReminderId: vi.fn().mockReturnValue('crmd-test-001'),
}));

vi.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/CouponService', () => ({
  CouponService: {
    getInstance: () => ({
      getCoupon: mockGetCoupon,
      getCouponByCode: mockGetCouponByCode,
    }),
  },
}));

vi.mock('../services/CouponAnalyticsService', () => ({
  trackCouponEvent: mockTrackCouponEvent,
}));

vi.mock('../lib/id-generator', () => ({
  generateSavedCouponId: mockGenerateSavedCouponId,
  generateCouponReminderId: mockGenerateCouponReminderId,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import { CustomerCouponWalletService } from '../services/CustomerCouponWalletService';

// ── Test fixtures ──────────────────────────────────────────────────────

const TEST_CUSTOMER_ID = 'cust_test_001';
const TEST_TENANT_ID = 'tenant_test_001';
const TEST_COUPON_ID = 'cpn-tenant_test_001-abc123';
const TEST_SAVED_COUPON_ID = 'scpn-test-001';

const TEST_COUPON = {
  id: TEST_COUPON_ID,
  tenantId: TEST_TENANT_ID,
  code: 'SUMMER50',
  discountType: 'percent_off',
  discountValue: 50,
  promotionalMessage: '50% off summer sale',
  termsSummary: 'Valid in-store only',
  isActive: true,
  expiresAt: null,
  maxRedemptions: null,
  redemptionCount: 0,
};

const makeSavedRow = (overrides: Record<string, any> = {}) => ({
  id: TEST_SAVED_COUPON_ID,
  coupon_id: TEST_COUPON_ID,
  tenant_id: TEST_TENANT_ID,
  tenant_name: 'Test Merchant',
  tenant_logo: null,
  code: 'SUMMER50',
  discount_type: 'percent_off',
  discount_value: 50,
  promotional_message: '50% off summer sale',
  terms_summary: 'Valid in-store only',
  coupon_expires_at: null,
  status: 'saved',
  saved_at: new Date(),
  redeemed_at: null,
  expired_at: null,
  ...overrides,
});

const makeStatsRow = (overrides: Record<string, any> = {}) => ({
  total_saved: 3,
  active: 2,
  expiring_soon: 1,
  redeemed: 1,
  total_savings_cents: 500,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockReset();
  mockGetCoupon.mockReset();
  mockGetCouponByCode.mockReset();
  // Keep default implementations for these; only clear call history
  mockTrackCouponEvent.mockClear();
  mockGenerateSavedCouponId.mockClear();
  mockGenerateCouponReminderId.mockClear();
  (CustomerCouponWalletService as any).instance = undefined;
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION: CustomerCouponWalletService
// ═══════════════════════════════════════════════════════════════════════

describe('CustomerCouponWalletService', () => {
  describe('saveCoupon', () => {
    it('saves an active coupon and returns the saved record', async () => {
      mockGetCoupon.mockResolvedValue(TEST_COUPON);
      mockQueryRaw
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([makeSavedRow()]);

      const result = await CustomerCouponWalletService.getInstance().saveCoupon(
        TEST_CUSTOMER_ID,
        TEST_TENANT_ID,
        TEST_COUPON_ID
      );

      expect(result.savedCouponId).toBe(TEST_SAVED_COUPON_ID);
      expect(mockGetCoupon).toHaveBeenCalledWith(TEST_TENANT_ID, TEST_COUPON_ID);
      expect(mockTrackCouponEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          couponId: TEST_COUPON_ID,
          eventType: 'save',
          surface: 'wallet',
          source: 'customer_wallet',
        })
      );
    });

    it('throws coupon_not_found when coupon does not exist', async () => {
      mockGetCoupon.mockResolvedValue(null);

      await expect(
        CustomerCouponWalletService.getInstance().saveCoupon(
          TEST_CUSTOMER_ID,
          TEST_TENANT_ID,
          TEST_COUPON_ID
        )
      ).rejects.toThrow('coupon_not_found');
    });

    it('throws coupon_inactive for inactive coupon', async () => {
      mockGetCoupon.mockResolvedValue({ ...TEST_COUPON, isActive: false });

      await expect(
        CustomerCouponWalletService.getInstance().saveCoupon(
          TEST_CUSTOMER_ID,
          TEST_TENANT_ID,
          TEST_COUPON_ID
        )
      ).rejects.toThrow('coupon_inactive');
    });

    it('throws coupon_expired for past expiration', async () => {
      mockGetCoupon.mockResolvedValue({
        ...TEST_COUPON,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(
        CustomerCouponWalletService.getInstance().saveCoupon(
          TEST_CUSTOMER_ID,
          TEST_TENANT_ID,
          TEST_COUPON_ID
        )
      ).rejects.toThrow('coupon_expired');
    });

    it('throws coupon_exhausted when redemptions are maxed', async () => {
      mockGetCoupon.mockResolvedValue({
        ...TEST_COUPON,
        maxRedemptions: 5,
        redemptionCount: 5,
      });

      await expect(
        CustomerCouponWalletService.getInstance().saveCoupon(
          TEST_CUSTOMER_ID,
          TEST_TENANT_ID,
          TEST_COUPON_ID
        )
      ).rejects.toThrow('coupon_exhausted');
    });
  });

  describe('saveCouponByCode', () => {
    it('resolves coupon by code then saves it', async () => {
      mockGetCouponByCode.mockResolvedValue(TEST_COUPON);
      mockGetCoupon.mockResolvedValue(TEST_COUPON);
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeSavedRow({ code: 'WELCOME10' })]);

      const result = await CustomerCouponWalletService.getInstance().saveCouponByCode(
        TEST_CUSTOMER_ID,
        TEST_TENANT_ID,
        'WELCOME10'
      );

      expect(result.code).toBe('WELCOME10');
      expect(mockGetCouponByCode).toHaveBeenCalledWith(TEST_TENANT_ID, 'WELCOME10');
    });
  });

  describe('unsaveCoupon', () => {
    it('deletes the saved coupon and tracks unsave event', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([makeSavedRow()])
        .mockResolvedValueOnce([]);

      await CustomerCouponWalletService.getInstance().unsaveCoupon(
        TEST_CUSTOMER_ID,
        TEST_SAVED_COUPON_ID
      );

      expect(mockTrackCouponEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'unsave',
          surface: 'wallet',
          source: 'customer_wallet',
        })
      );
    });

    it('throws saved_coupon_not_found when row missing', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      await expect(
        CustomerCouponWalletService.getInstance().unsaveCoupon(
          TEST_CUSTOMER_ID,
          TEST_SAVED_COUPON_ID
        )
      ).rejects.toThrow('saved_coupon_not_found');
    });
  });

  describe('listWallet', () => {
    it('returns mapped saved coupons for a customer', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        makeSavedRow(),
        makeSavedRow({ id: 'scpn-test-002', code: 'WELCOME10', status: 'redeemed' }),
      ]);

      const result = await CustomerCouponWalletService.getInstance().listWallet(
        TEST_CUSTOMER_ID
      );

      expect(result).toHaveLength(2);
      expect(result[0].savedCouponId).toBe(TEST_SAVED_COUPON_ID);
      expect(result[1].status).toBe('redeemed');
    });

    it('filters by status when provided', async () => {
      mockQueryRaw.mockResolvedValueOnce([makeSavedRow({ status: 'redeemed' })]);

      const result = await CustomerCouponWalletService.getInstance().listWallet(
        TEST_CUSTOMER_ID,
        { status: 'redeemed' }
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('redeemed');
    });
  });

  describe('listWalletByTenant', () => {
    it('delegates to listWallet with tenant and status', async () => {
      mockQueryRaw.mockResolvedValueOnce([makeSavedRow()]);

      const result = await CustomerCouponWalletService.getInstance().listWalletByTenant(
        TEST_CUSTOMER_ID,
        TEST_TENANT_ID
      );

      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe(TEST_TENANT_ID);
    });
  });

  describe('getWalletStats', () => {
    it('returns aggregated wallet stats', async () => {
      mockQueryRaw.mockResolvedValueOnce([makeStatsRow()]);

      const result = await CustomerCouponWalletService.getInstance().getWalletStats(
        TEST_CUSTOMER_ID
      );

      expect(result.totalSaved).toBe(3);
      expect(result.active).toBe(2);
      expect(result.expiringSoon).toBe(1);
      expect(result.redeemed).toBe(1);
      expect(result.totalSavingsCents).toBe(500);
    });

    it('returns zeros when stats query is empty', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      const result = await CustomerCouponWalletService.getInstance().getWalletStats(
        TEST_CUSTOMER_ID
      );

      expect(result.totalSaved).toBe(0);
      expect(result.totalSavingsCents).toBe(0);
    });
  });

  describe('getExpiringSoon', () => {
    it('returns coupons expiring within threshold', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        makeSavedRow({ coupon_expires_at: new Date(Date.now() + 86400000) }),
      ]);

      const result = await CustomerCouponWalletService.getInstance().getExpiringSoon(
        TEST_CUSTOMER_ID,
        7
      );

      expect(result).toHaveLength(1);
      expect(result[0].expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('markRedeemed', () => {
    it('updates matching rows to redeemed', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      await CustomerCouponWalletService.getInstance().markRedeemed(
        TEST_CUSTOMER_ID,
        TEST_COUPON_ID,
        'order_test_001'
      );

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncExpiredStatuses', () => {
    it('counts rows returned by the expiration update query', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'scpn-expired-001' }, { id: 'scpn-expired-002' }]);

      const result = await CustomerCouponWalletService.getInstance().syncExpiredStatuses();

      expect(result.updated).toBe(2);
    });
  });

  describe('recordReminder', () => {
    it('inserts a reminder record for an eligible saved coupon', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ tenant_id: TEST_TENANT_ID }])
        .mockResolvedValueOnce([]);

      await CustomerCouponWalletService.getInstance().recordReminder(
        TEST_SAVED_COUPON_ID,
        TEST_CUSTOMER_ID,
        '24h'
      );

      expect(mockGenerateCouponReminderId).toHaveBeenCalledWith(TEST_TENANT_ID);
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it('does nothing when saved coupon is missing', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      await CustomerCouponWalletService.getInstance().recordReminder(
        'missing-id',
        TEST_CUSTOMER_ID,
        '24h'
      );

      expect(mockGenerateCouponReminderId).not.toHaveBeenCalled();
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
