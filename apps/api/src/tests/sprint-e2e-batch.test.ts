/**
 * Sprint End-to-End Batch Test
 *
 * Comprehensive test covering all endpoints and services created across:
 * - Sprint 5: Wholesale Matching (supplier match, Faire search, affiliate links, brand partner claims)
 * - Phase 1: BSaaS Bundle Promo Code Support (validatePromoCode with target checking)
 * - Phase 2: Renewal Coupon Awareness (calculateRenewalCharge)
 * - CouponTargetService (validateCouponTargets, setCCouponTargets, getTargetsForCoupon)
 * - Affiliate Click Expiry Job
 * - WholesaleMatchingResolver (tier gating logic)
 * - StorefrontGalleryResolver (Phase 2 — storefront namespace split)
 *
 * Run: npx vitest run src/tests/sprint-e2e-batch.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (available when vi.mock factories run) ──────────────

const {
  mockPrismaProductSuppliers,
  mockPrismaAffiliateClicks,
  mockPrismaBrandPartnerClaims,
  mockPrismaCouponTargetRules,
  mockPrismaFeaturesList,
  mockPrismaTenants,
  mockPrismaTenantFeaturePurchases,
  mockPrismaBsaasBundles,
  mockPromotionCodesList,
  mockCouponsRetrieve,
  mockValidateCouponTargets,
  mockGetTargetsForCoupon,
  mockSetCouponTargets,
  mockChargePaymentMethod,
  mockInvalidateEffectiveCapabilities,
} = vi.hoisted(() => ({
  mockPrismaProductSuppliers: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockPrismaAffiliateClicks: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  mockPrismaBrandPartnerClaims: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  mockPrismaCouponTargetRules: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  mockPrismaFeaturesList: {
    findUnique: vi.fn(),
  },
  mockPrismaTenants: {
    findUnique: vi.fn(),
  },
  mockPrismaTenantFeaturePurchases: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  mockPrismaBsaasBundles: {
    findUnique: vi.fn(),
  },
  mockPromotionCodesList: vi.fn(),
  mockCouponsRetrieve: vi.fn(),
  mockValidateCouponTargets: vi.fn(),
  mockGetTargetsForCoupon: vi.fn(),
  mockSetCouponTargets: vi.fn(),
  mockChargePaymentMethod: vi.fn(),
  mockInvalidateEffectiveCapabilities: vi.fn(),
}));

// ── Mock prisma ────────────────────────────────────────────────────────

vi.mock('../prisma', () => ({
  prisma: {
    product_suppliers: mockPrismaProductSuppliers,
    affiliate_clicks: mockPrismaAffiliateClicks,
    brand_partner_claims: mockPrismaBrandPartnerClaims,
    coupon_target_rules: mockPrismaCouponTargetRules,
    features_list: mockPrismaFeaturesList,
    tenants: mockPrismaTenants,
    tenant_feature_purchases: mockPrismaTenantFeaturePurchases,
    bsaas_bundles: mockPrismaBsaasBundles,
  },
}));

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    stripeSecretKey: 'sk_test_fake_key',
  },
}));

vi.mock('../services/CouponTargetService', () => ({
  default: {
    getInstance: () => ({
      validateCouponTargets: mockValidateCouponTargets,
      getTargetsForCoupon: mockGetTargetsForCoupon,
      setCouponTargets: mockSetCouponTargets,
    }),
  },
  CouponTargets: {},
  CouponTargetContext: {},
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      promotionCodes: { list: mockPromotionCodesList },
      coupons: { retrieve: mockCouponsRetrieve },
    };
  }),
}));

vi.mock('../services/EffectiveCapabilityResolver', () => ({
  invalidateEffectiveCapabilities: mockInvalidateEffectiveCapabilities,
  resolveEffectiveCapabilities: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/subscription/SubscriptionBillingService', () => ({
  getSubscriptionBillingService: () => ({
    chargePaymentMethod: mockChargePaymentMethod,
  }),
}));

vi.mock('../services/subscription/BillingNotificationService', () => ({
  getBillingNotificationService: () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import wholesaleMatchingService from '../services/WholesaleMatchingService';
import { resolveWholesaleMatching } from '../services/resolvers/WholesaleMatchingResolver';
import { calculateRenewalCharge } from '../jobs/bsaas-renewal';
import { validatePromoCode } from '../routes/bsaas-purchases';
import { processClickExpiry } from '../jobs/affiliate-click-expiry';

// ── Test data fixtures ─────────────────────────────────────────────────

const TEST_TENANT_ID = 'tenant_test_001';
const TEST_GTIN = '00845623000152';
const TEST_SUPPLIER_ID = 'psup_test_001';
const TEST_CLICK_ID = 'aclick_tenant_test_001_abc123';
const TEST_CLAIM_ID = 'bpc_abc123def456';

const SAMPLE_SUPPLIER_ROW = {
  id: TEST_SUPPLIER_ID,
  gtin: TEST_GTIN,
  supplier_name: 'Acme Wholesale Co.',
  supplier_type: 'wholesale',
  moq: 12,
  min_order_value: 500,
  external_link: 'https://faire.com/acme',
  affiliate_params: { ref: 'visibleshelf' },
  region: 'US',
  claim_type: 'verified',
  brand_partner_id: null,
  created_at: new Date(),
};

const SAMPLE_CLICK_ROW = {
  id: TEST_CLICK_ID,
  tenant_id: TEST_TENANT_ID,
  gtin: TEST_GTIN,
  supplier_id: TEST_SUPPLIER_ID,
  click_id: TEST_CLICK_ID,
  external_url: 'https://faire.com/acme?ref=visibleshelf&click_id=abc',
  status: 'pending',
  expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired
  converted_at: null,
  commission_amount: null,
};

const SAMPLE_CLAIM_ROW = {
  id: TEST_CLAIM_ID,
  brand_name: 'Acme Brand',
  gtin: TEST_GTIN,
  claim_type: 'verified',
  supplier_id: null,
  admin_approved: false,
  contact_email: 'contact@acmebrand.com',
  created_at: new Date(),
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: WholesaleMatchingService
// ═══════════════════════════════════════════════════════════════════════

describe('WholesaleMatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSupplierMatch', () => {
    it('returns matches sorted by claim_type priority', async () => {
      mockPrismaProductSuppliers.findMany.mockResolvedValue([
        { ...SAMPLE_SUPPLIER_ROW, claim_type: 'verified' },
        { ...SAMPLE_SUPPLIER_ROW, id: 'psup_2', claim_type: 'exclusive' },
        { ...SAMPLE_SUPPLIER_ROW, id: 'psup_3', claim_type: 'preferred' },
      ]);

      const result = await wholesaleMatchingService.checkSupplierMatch(TEST_GTIN);
      expect(result).toHaveLength(3);
      expect(result[0].claim_type).toBe('exclusive');
      expect(result[1].claim_type).toBe('preferred');
      expect(result[2].claim_type).toBe('verified');
    });

    it('returns empty array on DB error', async () => {
      mockPrismaProductSuppliers.findMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.checkSupplierMatch(TEST_GTIN);
      expect(result).toEqual([]);
    });

    it('returns empty array when no matches found', async () => {
      mockPrismaProductSuppliers.findMany.mockResolvedValue([]);
      const result = await wholesaleMatchingService.checkSupplierMatch('0000000000000');
      expect(result).toEqual([]);
    });
  });

  describe('buildAffiliateLink', () => {
    it('creates affiliate click record and returns link with tracking params', async () => {
      mockPrismaAffiliateClicks.create.mockResolvedValue({ id: TEST_CLICK_ID });

      const supplier = {
        id: TEST_SUPPLIER_ID,
        gtin: TEST_GTIN,
        supplier_name: 'Acme',
        supplier_type: 'wholesale',
        moq: 1,
        min_order_value: null,
        external_link: 'https://faire.com/acme',
        affiliate_params: {},
        region: 'US',
        claim_type: 'verified',
        brand_partner_id: null,
      };

      const result = await wholesaleMatchingService.buildAffiliateLink(supplier, TEST_TENANT_ID);

      expect(result.click_id).toBeTruthy();
      expect(result.affiliate_url).toContain('ref=visibleshelf');
      expect(result.affiliate_url).toContain('utm_source=visibleshelf');
      expect(result.affiliate_url).toContain('click_id=');
      expect(result.expires_at).toBeInstanceOf(Date);
      expect(mockPrismaAffiliateClicks.create).toHaveBeenCalledTimes(1);
    });

    it('still returns link even if DB create fails', async () => {
      mockPrismaAffiliateClicks.create.mockRejectedValue(new Error('DB error'));

      const supplier = {
        id: TEST_SUPPLIER_ID,
        gtin: TEST_GTIN,
        supplier_name: 'Acme',
        supplier_type: 'wholesale',
        moq: 1,
        min_order_value: null,
        external_link: 'https://faire.com/acme',
        affiliate_params: {},
        region: 'US',
        claim_type: 'verified',
        brand_partner_id: null,
      };

      const result = await wholesaleMatchingService.buildAffiliateLink(supplier, TEST_TENANT_ID);
      expect(result.click_id).toBeTruthy();
      expect(result.affiliate_url).toContain('faire.com');
    });

    it('uses faire.com fallback when external_link is empty', async () => {
      mockPrismaAffiliateClicks.create.mockResolvedValue({ id: TEST_CLICK_ID });

      const supplier = {
        id: TEST_SUPPLIER_ID,
        gtin: TEST_GTIN,
        supplier_name: 'Acme',
        supplier_type: 'wholesale',
        moq: 1,
        min_order_value: null,
        external_link: null,
        affiliate_params: {},
        region: 'US',
        claim_type: 'verified',
        brand_partner_id: null,
      };

      const result = await wholesaleMatchingService.buildAffiliateLink(supplier, TEST_TENANT_ID);
      expect(result.affiliate_url).toContain('faire.com/?');
    });
  });

  describe('trackAffiliateClick', () => {
    it('updates click status to converted with commission', async () => {
      mockPrismaAffiliateClicks.findFirst.mockResolvedValue({ id: TEST_CLICK_ID });
      mockPrismaAffiliateClicks.update.mockResolvedValue({});

      await wholesaleMatchingService.trackAffiliateClick(TEST_CLICK_ID, 'converted', 500);

      expect(mockPrismaAffiliateClicks.update).toHaveBeenCalledWith({
        where: { id: TEST_CLICK_ID },
        data: expect.objectContaining({
          status: 'converted',
          converted_at: expect.any(Date),
          commission_amount: 500,
        }),
      });
    });

    it('does nothing if click not found', async () => {
      mockPrismaAffiliateClicks.findFirst.mockResolvedValue(null);
      await wholesaleMatchingService.trackAffiliateClick('nonexistent', 'expired');
      expect(mockPrismaAffiliateClicks.update).not.toHaveBeenCalled();
    });
  });

  describe('getBrandPartnerClaims', () => {
    it('returns claims for a GTIN', async () => {
      mockPrismaBrandPartnerClaims.findMany.mockResolvedValue([SAMPLE_CLAIM_ROW]);
      const result = await wholesaleMatchingService.getBrandPartnerClaims(TEST_GTIN);
      expect(result).toHaveLength(1);
      expect(result[0].brand_name).toBe('Acme Brand');
    });

    it('returns empty array on error', async () => {
      mockPrismaBrandPartnerClaims.findMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.getBrandPartnerClaims(TEST_GTIN);
      expect(result).toEqual([]);
    });
  });

  describe('createBrandPartnerClaim', () => {
    it('creates a claim with default type verified', async () => {
      mockPrismaBrandPartnerClaims.create.mockResolvedValue(SAMPLE_CLAIM_ROW);
      const result = await wholesaleMatchingService.createBrandPartnerClaim('Acme Brand', TEST_GTIN);
      expect(result).not.toBeNull();
      expect(result!.brand_name).toBe('Acme Brand');
      expect(mockPrismaBrandPartnerClaims.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            brand_name: 'Acme Brand',
            gtin: TEST_GTIN,
            claim_type: 'verified',
            admin_approved: false,
          }),
        })
      );
    });

    it('creates a claim with specified type and email', async () => {
      mockPrismaBrandPartnerClaims.create.mockResolvedValue({
        ...SAMPLE_CLAIM_ROW,
        claim_type: 'exclusive',
        contact_email: 'x@y.com',
      });
      const result = await wholesaleMatchingService.createBrandPartnerClaim('Acme', TEST_GTIN, 'exclusive', 'x@y.com');
      expect(result).not.toBeNull();
      expect(result!.claim_type).toBe('exclusive');
    });

    it('returns null on DB error', async () => {
      mockPrismaBrandPartnerClaims.create.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.createBrandPartnerClaim('Acme', TEST_GTIN);
      expect(result).toBeNull();
    });
  });

  describe('approveBrandPartnerClaim', () => {
    it('sets admin_approved to true', async () => {
      mockPrismaBrandPartnerClaims.update.mockResolvedValue({});
      const result = await wholesaleMatchingService.approveBrandPartnerClaim(TEST_CLAIM_ID);
      expect(result).toBe(true);
      expect(mockPrismaBrandPartnerClaims.update).toHaveBeenCalledWith({
        where: { id: TEST_CLAIM_ID },
        data: { admin_approved: true },
      });
    });

    it('returns false on error', async () => {
      mockPrismaBrandPartnerClaims.update.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.approveBrandPartnerClaim(TEST_CLAIM_ID);
      expect(result).toBe(false);
    });
  });

  describe('rejectBrandPartnerClaim', () => {
    it('deletes the claim', async () => {
      mockPrismaBrandPartnerClaims.delete.mockResolvedValue({});
      const result = await wholesaleMatchingService.rejectBrandPartnerClaim(TEST_CLAIM_ID);
      expect(result).toBe(true);
      expect(mockPrismaBrandPartnerClaims.delete).toHaveBeenCalledWith({ where: { id: TEST_CLAIM_ID } });
    });

    it('returns false on error', async () => {
      mockPrismaBrandPartnerClaims.delete.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.rejectBrandPartnerClaim(TEST_CLAIM_ID);
      expect(result).toBe(false);
    });
  });

  describe('listAllBrandPartnerClaims', () => {
    it('returns paginated claims with filters', async () => {
      mockPrismaBrandPartnerClaims.findMany.mockResolvedValue([SAMPLE_CLAIM_ROW]);
      mockPrismaBrandPartnerClaims.count.mockResolvedValue(1);

      const result = await wholesaleMatchingService.listAllBrandPartnerClaims(
        { gtin: TEST_GTIN, approved: false },
        10,
        0
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty on error', async () => {
      mockPrismaBrandPartnerClaims.findMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.listAllBrandPartnerClaims();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('expireStaleClicks', () => {
    it('updates pending clicks past expiry to expired', async () => {
      mockPrismaAffiliateClicks.updateMany.mockResolvedValue({ count: 5 });
      const result = await wholesaleMatchingService.expireStaleClicks();
      expect(result).toBe(5);
      expect(mockPrismaAffiliateClicks.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          expires_at: { lt: expect.any(Date) },
        },
        data: { status: 'expired' },
      });
    });

    it('returns 0 on error', async () => {
      mockPrismaAffiliateClicks.updateMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.expireStaleClicks();
      expect(result).toBe(0);
    });
  });

  describe('getAffiliateAnalytics', () => {
    it('returns aggregated analytics for a tenant', async () => {
      mockPrismaAffiliateClicks.findMany.mockResolvedValue([
        { status: 'pending', commission_amount: null },
        { status: 'converted', commission_amount: 250 },
        { status: 'converted', commission_amount: 100 },
        { status: 'expired', commission_amount: null },
      ]);

      const result = await wholesaleMatchingService.getAffiliateAnalytics(TEST_TENANT_ID);
      expect(result.total_clicks).toBe(4);
      expect(result.pending).toBe(1);
      expect(result.converted).toBe(2);
      expect(result.expired).toBe(1);
      expect(result.total_commission).toBe(350);
    });

    it('returns zeros on error', async () => {
      mockPrismaAffiliateClicks.findMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.getAffiliateAnalytics(TEST_TENANT_ID);
      expect(result.total_clicks).toBe(0);
      expect(result.total_commission).toBe(0);
    });
  });

  describe('getAllSuppliers', () => {
    it('returns paginated suppliers', async () => {
      mockPrismaProductSuppliers.findMany.mockResolvedValue([SAMPLE_SUPPLIER_ROW]);
      mockPrismaProductSuppliers.count.mockResolvedValue(1);

      const result = await wholesaleMatchingService.getAllSuppliers(10, 0);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty on error', async () => {
      mockPrismaProductSuppliers.findMany.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.getAllSuppliers();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('saveSupplierMatch', () => {
    it('creates a new supplier when none exists', async () => {
      mockPrismaProductSuppliers.findFirst.mockResolvedValue(null);
      mockPrismaProductSuppliers.create.mockResolvedValue(SAMPLE_SUPPLIER_ROW);

      const result = await wholesaleMatchingService.saveSupplierMatch(TEST_GTIN, {
        supplier_name: 'Acme Wholesale Co.',
        supplier_type: 'wholesale',
        moq: 12,
      });

      expect(result).not.toBeNull();
      expect(result!.supplier_name).toBe('Acme Wholesale Co.');
      expect(mockPrismaProductSuppliers.create).toHaveBeenCalledTimes(1);
    });

    it('updates an existing supplier', async () => {
      mockPrismaProductSuppliers.findFirst.mockResolvedValue(SAMPLE_SUPPLIER_ROW);
      mockPrismaProductSuppliers.update.mockResolvedValue(SAMPLE_SUPPLIER_ROW);

      const result = await wholesaleMatchingService.saveSupplierMatch(TEST_GTIN, {
        supplier_name: 'Acme Wholesale Co.',
        moq: 24,
      });

      expect(result).not.toBeNull();
      expect(mockPrismaProductSuppliers.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaProductSuppliers.create).not.toHaveBeenCalled();
    });

    it('returns null on error', async () => {
      mockPrismaProductSuppliers.findFirst.mockRejectedValue(new Error('DB error'));
      const result = await wholesaleMatchingService.saveSupplierMatch(TEST_GTIN, {});
      expect(result).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: WholesaleMatchingResolver (tier gating)
// ═══════════════════════════════════════════════════════════════════════

describe('WholesaleMatchingResolver', () => {
  it('returns none tier when no features enabled', () => {
    const result = resolveWholesaleMatching({}, null);
    expect(result.enabled).toBe(false);
    expect(result.tier).toBe('none');
    expect(result.can_check_supplier_match).toBe(false);
    expect(result.can_search_faire).toBe(false);
    expect(result.can_build_affiliate_link).toBe(false);
    expect(result.can_view_brand_partners).toBe(false);
  });

  it('returns none tier when disabled flag is set', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_disabled: true, wholesale_matching_full: true }, null);
    expect(result.enabled).toBe(false);
    expect(result.tier).toBe('none');
  });

  it('returns search tier with search features only', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_search: true }, null);
    expect(result.enabled).toBe(true);
    expect(result.tier).toBe('search');
    expect(result.can_check_supplier_match).toBe(true);
    expect(result.can_search_faire).toBe(true);
    expect(result.can_build_affiliate_link).toBe(false);
    expect(result.can_view_brand_partners).toBe(true);
  });

  it('returns full tier with all features', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_full: true }, null);
    expect(result.enabled).toBe(true);
    expect(result.tier).toBe('full');
    expect(result.can_check_supplier_match).toBe(true);
    expect(result.can_search_faire).toBe(true);
    expect(result.can_build_affiliate_link).toBe(true);
    expect(result.can_view_brand_partners).toBe(true);
  });

  it('returns full tier when flexible flag is set', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_flexible: true }, null);
    expect(result.enabled).toBe(true);
    expect(result.tier).toBe('full');
    expect(result.is_flexible).toBe(true);
  });

  it('respects merchant preference to disable', () => {
    const result = resolveWholesaleMatching(
      { wholesale_matching_full: true },
      { wholesale_matching_enabled: false }
    );
    expect(result.enabled).toBe(false);
    expect(result.tier).toBe('none');
  });

  it('defaults to enabled when merchant pref is null', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_search: true }, null);
    expect(result.enabled).toBe(true);
  });

  it('search tier cannot build affiliate links', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_search: true }, null);
    expect(result.can_build_affiliate_link).toBe(false);
  });

  it('full tier can build affiliate links', () => {
    const result = resolveWholesaleMatching({ wholesale_matching_full: true }, null);
    expect(result.can_build_affiliate_link).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: calculateRenewalCharge (Phase 2 — renewal coupon awareness)
// ═══════════════════════════════════════════════════════════════════════

describe('calculateRenewalCharge', () => {
  const basePrice = 6900;

  it('charges full price when no coupon metadata exists', () => {
    const result = calculateRenewalCharge({ price_cents: basePrice }, 0);
    expect(result.chargedAmount).toBe(basePrice);
    expect(result.couponActive).toBe(false);
  });

  it('charges full price for "once" duration when renewalCount > 0', () => {
    const result = calculateRenewalCharge({
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c1',
      coupon_duration: 'once',
      coupon_percent_off: 50,
    }, 1);
    expect(result.chargedAmount).toBe(basePrice);
    expect(result.couponActive).toBe(false);
  });

  it('applies discount for "once" duration when renewalCount === 0', () => {
    const result = calculateRenewalCharge({
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c1',
      coupon_duration: 'once',
      coupon_percent_off: 50,
    }, 0);
    expect(result.chargedAmount).toBe(3450);
    expect(result.couponActive).toBe(true);
  });

  it('applies discount for "repeating" within duration_in_months', () => {
    const meta = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c2',
      coupon_duration: 'repeating',
      coupon_duration_in_months: 3,
      coupon_percent_off: 25,
    };
    expect(calculateRenewalCharge(meta, 0).chargedAmount).toBe(5175);
    expect(calculateRenewalCharge(meta, 1).chargedAmount).toBe(5175);
    expect(calculateRenewalCharge(meta, 2).chargedAmount).toBe(5175);
  });

  it('charges full price for "repeating" after duration_in_months', () => {
    const meta = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c2',
      coupon_duration: 'repeating',
      coupon_duration_in_months: 3,
      coupon_percent_off: 25,
    };
    expect(calculateRenewalCharge(meta, 3).chargedAmount).toBe(basePrice);
    expect(calculateRenewalCharge(meta, 4).chargedAmount).toBe(basePrice);
  });

  it('always applies discount for "forever" duration', () => {
    const meta = {
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c3',
      coupon_duration: 'forever',
      coupon_percent_off: 10,
    };
    expect(calculateRenewalCharge(meta, 0).chargedAmount).toBe(6210);
    expect(calculateRenewalCharge(meta, 100).chargedAmount).toBe(6210);
    expect(calculateRenewalCharge(meta, 100).couponActive).toBe(true);
  });

  it('caps amount_off at price', () => {
    const result = calculateRenewalCharge({
      price_cents: basePrice,
      original_price_cents: basePrice,
      coupon_id: 'c4',
      coupon_duration: 'forever',
      coupon_amount_off: 10000,
    }, 1);
    expect(result.discountCents).toBe(6900);
    expect(result.chargedAmount).toBe(0);
  });

  it('falls back to price_cents when original_price_cents missing', () => {
    const result = calculateRenewalCharge({
      price_cents: basePrice,
      coupon_id: 'c5',
      coupon_duration: 'forever',
      coupon_percent_off: 50,
    }, 1);
    expect(result.chargedAmount).toBe(3450);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: validatePromoCode (Phase 1 — bundle promo + targeting)
// ═══════════════════════════════════════════════════════════════════════

describe('validatePromoCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCouponTargets.mockResolvedValue({ valid: true, reason: null });
    mockGetTargetsForCoupon.mockResolvedValue(null);
  });

  const ctx = { featureKey: 'chatbot_skill_crm_assistant', tenantId: TEST_TENANT_ID };

  it('returns error when Stripe not configured', async () => {
    const { unifiedConfig } = await import('../config/unifiedConfig');
    const orig = unifiedConfig.stripeSecretKey;
    (unifiedConfig as any).stripeSecretKey = null;

    const result = await validatePromoCode('SUMMER50', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('stripe_not_configured');

    (unifiedConfig as any).stripeSecretKey = orig;
  });

  it('returns error for invalid promo code', async () => {
    mockPromotionCodesList.mockResolvedValue({ data: [] });
    const result = await validatePromoCode('INVALID', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('invalid_promo_code');
  });

  it('returns error when max redemptions reached', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p1', max_redemptions: 10, times_redeemed: 10, expires_at: null, coupon: 'c1' }],
    });
    const result = await validatePromoCode('USEDUP', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('promo_expired');
  });

  it('returns error when promo code expired', async () => {
    const pastTs = Math.floor((Date.now() - 86400000) / 1000);
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p1', max_redemptions: null, times_redeemed: 0, expires_at: pastTs, coupon: 'c1' }],
    });
    const result = await validatePromoCode('EXPIRED', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('promo_expired');
  });

  it('calculates percent_off discount correctly', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p1', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'c1' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c1', duration: 'once', percent_off: 50, amount_off: null,
    });
    const result = await validatePromoCode('SUMMER50', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(3450);
      expect(result.chargedAmount).toBe(3450);
      expect(result.couponDuration).toBe('once');
    }
  });

  it('calculates amount_off discount (capped at price)', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p2', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'c2' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c2', duration: 'forever', percent_off: null, amount_off: 10000,
    });
    const result = await validatePromoCode('BIGSAVE', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(6900);
      expect(result.chargedAmount).toBe(0);
    }
  });

  it('returns error when coupon target validation fails', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p3', max_redemptions: 100, times_redeemed: 5, expires_at: null, coupon: 'c3' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c3', duration: 'repeating', duration_in_months: 3, percent_off: 25, amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({ valid: false, reason: 'coupon_not_valid_for_feature' });
    const result = await validatePromoCode('TARGETED', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('coupon_not_valid_for_feature');
  });

  it('passes through when no target rules exist', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p0', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'c0' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c0', duration: 'once', percent_off: 10, amount_off: null,
    });
    const result = await validatePromoCode('WELCOME10', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(690);
      expect(result.targets).toBe(null);
    }
  });

  it('returns targets on success', async () => {
    const targets = { target_features: ['chatbot_skill_crm_assistant'], target_tiers: null };
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p4', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'c4' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c4', duration: 'repeating', duration_in_months: 6, percent_off: 25, amount_off: null,
    });
    mockGetTargetsForCoupon.mockResolvedValue(targets);
    const result = await validatePromoCode('RECUR25', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.targets).toEqual(targets);
      expect(result.couponDurationInMonths).toBe(6);
    }
  });

  it('returns error on Stripe API exception', async () => {
    mockPromotionCodesList.mockRejectedValue(new Error('Stripe API error'));
    const result = await validatePromoCode('ERROR', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('invalid_promo_code');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: Affiliate Click Expiry Job
// ═══════════════════════════════════════════════════════════════════════

describe('Affiliate Click Expiry Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processClickExpiry returns count of expired clicks', async () => {
    mockPrismaAffiliateClicks.updateMany.mockResolvedValue({ count: 3 });
    const result = await processClickExpiry();
    expect(result).toBe(3);
  });

  it('processClickExpiry returns 0 when no stale clicks', async () => {
    mockPrismaAffiliateClicks.updateMany.mockResolvedValue({ count: 0 });
    const result = await processClickExpiry();
    expect(result).toBe(0);
  });

  it('processClickExpiry returns 0 on error', async () => {
    mockPrismaAffiliateClicks.updateMany.mockRejectedValue(new Error('DB error'));
    const result = await processClickExpiry();
    expect(result).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: CouponTargetService (via mocked validatePromoCode integration)
// ═══════════════════════════════════════════════════════════════════════

describe('CouponTargetService integration (via validatePromoCode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ctx = { featureKey: 'chatbot_skill_crm_assistant', tenantId: TEST_TENANT_ID };

  it('rejects when target_features does not match featureKey', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p1', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'c1' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c1', duration: 'once', percent_off: 50, amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({
      valid: false,
      reason: 'feature_not_in_target_features',
    });

    const result = await validatePromoCode('TARGETED_WRONG', 6900, ctx);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('feature_not_in_target_features');
    }
  });

  it('accepts when target_features matches featureKey', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p2', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'c2' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c2', duration: 'once', percent_off: 30, amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({ valid: true, reason: null });
    mockGetTargetsForCoupon.mockResolvedValue({
      target_features: ['chatbot_skill_crm_assistant'],
      target_tiers: null,
    });

    const result = await validatePromoCode('TARGETED_RIGHT', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.discountCents).toBe(2070);
      expect(result.targets?.target_features).toEqual(['chatbot_skill_crm_assistant']);
    }
  });

  it('accepts when no target rules exist (pass-through)', async () => {
    mockPromotionCodesList.mockResolvedValue({
      data: [{ id: 'p3', max_redemptions: 100, times_redeemed: 0, expires_at: null, coupon: 'c3' }],
    });
    mockCouponsRetrieve.mockResolvedValue({
      id: 'c3', duration: 'forever', percent_off: 15, amount_off: null,
    });
    mockValidateCouponTargets.mockResolvedValue({ valid: true, reason: null });
    mockGetTargetsForCoupon.mockResolvedValue(null);

    const result = await validatePromoCode('NORULES', 6900, ctx);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.targets).toBe(null);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: Claim Type Priority Hierarchy
// ═══════════════════════════════════════════════════════════════════════

describe('Brand Partner Claim Type Priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sorts exclusive > preferred > verified', async () => {
    mockPrismaProductSuppliers.findMany.mockResolvedValue([
      { ...SAMPLE_SUPPLIER_ROW, id: 's1', claim_type: 'verified' },
      { ...SAMPLE_SUPPLIER_ROW, id: 's2', claim_type: 'exclusive' },
      { ...SAMPLE_SUPPLIER_ROW, id: 's3', claim_type: 'preferred' },
      { ...SAMPLE_SUPPLIER_ROW, id: 's4', claim_type: 'verified' },
    ]);

    const result = await wholesaleMatchingService.checkSupplierMatch(TEST_GTIN);
    expect(result[0].claim_type).toBe('exclusive');
    expect(result[1].claim_type).toBe('preferred');
    expect(result[2].claim_type).toBe('verified');
    expect(result[3].claim_type).toBe('verified');
  });

  it('handles unknown claim types at lowest priority', async () => {
    mockPrismaProductSuppliers.findMany.mockResolvedValue([
      { ...SAMPLE_SUPPLIER_ROW, id: 's1', claim_type: 'unknown_type' },
      { ...SAMPLE_SUPPLIER_ROW, id: 's2', claim_type: 'verified' },
    ]);

    const result = await wholesaleMatchingService.checkSupplierMatch(TEST_GTIN);
    expect(result[0].claim_type).toBe('verified');
    expect(result[1].claim_type).toBe('unknown_type');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: Affiliate Link URL Construction
// ═══════════════════════════════════════════════════════════════════════

describe('Affiliate Link URL Construction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaAffiliateClicks.create.mockResolvedValue({});
  });

  it('appends tracking params to existing URL with query string', async () => {
    const supplier = {
      id: TEST_SUPPLIER_ID,
      gtin: TEST_GTIN,
      supplier_name: 'Acme',
      supplier_type: 'wholesale',
      moq: 1,
      min_order_value: null,
      external_link: 'https://faire.com/acme?cat=tools',
      affiliate_params: {},
      region: 'US',
      claim_type: 'verified',
      brand_partner_id: null,
    };

    const result = await wholesaleMatchingService.buildAffiliateLink(supplier, TEST_TENANT_ID);
    expect(result.affiliate_url).toContain('cat=tools');
    expect(result.affiliate_url).toContain('&ref=visibleshelf');
    expect(result.affiliate_url).toContain('&click_id=');
  });

  it('appends tracking params to URL without query string', async () => {
    const supplier = {
      id: TEST_SUPPLIER_ID,
      gtin: TEST_GTIN,
      supplier_name: 'Acme',
      supplier_type: 'wholesale',
      moq: 1,
      min_order_value: null,
      external_link: 'https://supplier.com/page',
      affiliate_params: {},
      region: 'US',
      claim_type: 'verified',
      brand_partner_id: null,
    };

    const result = await wholesaleMatchingService.buildAffiliateLink(supplier, TEST_TENANT_ID);
    expect(result.affiliate_url).toContain('?ref=visibleshelf');
    expect(result.affiliate_url).toContain('utm_source=visibleshelf');
    expect(result.affiliate_url).toContain('utm_medium=wholesale_match');
    expect(result.affiliate_url).toContain(`utm_campaign=${TEST_TENANT_ID}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 9: Affiliate Analytics Aggregation
// ═══════════════════════════════════════════════════════════════════════

describe('Affiliate Analytics Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates correctly with mixed statuses and Decimal commission', async () => {
    mockPrismaAffiliateClicks.findMany.mockResolvedValue([
      { status: 'pending', commission_amount: null },
      { status: 'pending', commission_amount: null },
      { status: 'converted', commission_amount: { toNumber: () => 250 } as any },
      { status: 'converted', commission_amount: { toNumber: () => 100 } as any },
      { status: 'expired', commission_amount: null },
    ]);

    const result = await wholesaleMatchingService.getAffiliateAnalytics(TEST_TENANT_ID);
    expect(result.total_clicks).toBe(5);
    expect(result.pending).toBe(2);
    expect(result.converted).toBe(2);
    expect(result.expired).toBe(1);
  });

  it('returns all zeros when no clicks exist', async () => {
    mockPrismaAffiliateClicks.findMany.mockResolvedValue([]);
    const result = await wholesaleMatchingService.getAffiliateAnalytics(TEST_TENANT_ID);
    expect(result.total_clicks).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.converted).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.total_commission).toBe(0);
  });

  it('works without tenantId (platform-wide)', async () => {
    mockPrismaAffiliateClicks.findMany.mockResolvedValue([
      { status: 'converted', commission_amount: 500 },
    ]);
    const result = await wholesaleMatchingService.getAffiliateAnalytics();
    expect(result.total_clicks).toBe(1);
    expect(result.converted).toBe(1);
    expect(result.total_commission).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 10: StorefrontGalleryResolver (Phase 2 — storefront namespace split)
// ═══════════════════════════════════════════════════════════════════════

import { resolveStorefrontGallery } from '../services/resolvers/StorefrontGalleryResolver';

describe('StorefrontGalleryResolver', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontGallery({}, null);
    expect(result.enabled).toBe(false);
    expect(result.gallery_enabled).toBe(false);
    expect(result.can_use_gallery).toBe(false);
  });

  it('returns disabled when storefront_gallery_disabled is set', () => {
    const result = resolveStorefrontGallery({ storefront_gallery_enabled: true, storefront_gallery_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables gallery with new storefront_gallery_* keys', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_on: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('falls back to old storefront_opt_gallery_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_gallery_on: true,
    };
    const result = resolveStorefrontGallery({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.allowed_gallery_types).toEqual(['image_gallery_5', 'image_gallery_10', 'image_gallery_15']);
  });

  it('respects flexible key to enable all gallery types and modes', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_flexible: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.gallery_carousel_enabled).toBe(true);
    expect(result.gallery_magazine_enabled).toBe(true);
  });

  it('enables magazine mode via storefront_gallery_magazine key', () => {
    const features = {
      storefront_gallery_enabled: true,
      storefront_gallery_on: true,
      storefront_gallery_magazine: true,
    };
    const result = resolveStorefrontGallery(features, null);
    expect(result.gallery_magazine_enabled).toBe(true);
  });

  it('falls back to old storefront_opt_gallery_magazine key', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_gallery_on: true,
      storefront_opt_gallery_magazine: true,
    };
    const result = resolveStorefrontGallery({}, null, fallbackFeatures);
    expect(result.gallery_magazine_enabled).toBe(true);
  });

  it('downgrades magazine display mode to carousel when not tier-gated', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { gallery_display_mode: 'magazine' };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.gallery_display_mode).toBe('carousel');
    expect(result.can_use_magazine_gallery).toBe(false);
  });

  it('respects merchant preferences for image limits', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = {
      image_gallery_5: true,
      image_gallery_10: false,
      image_gallery_15: false,
      default_gallery_limit: 5,
    };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.merchant_preferences.image_gallery_5).toBe(true);
    expect(result.merchant_preferences.image_gallery_10).toBe(false);
    expect(result.default_gallery_limit).toBe(5);
  });

  it('can_use_gallery is false when merchant disables all gallery types', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const merchantPrefs = { image_gallery_5: false, image_gallery_10: false, image_gallery_15: false };
    const result = resolveStorefrontGallery(features, merchantPrefs);
    expect(result.can_use_gallery).toBe(false);
  });

  it('defaults gallery_display_mode to carousel and limit to 5', () => {
    const features = { storefront_gallery_enabled: true, storefront_gallery_on: true };
    const result = resolveStorefrontGallery(features, null);
    expect(result.gallery_display_mode).toBe('carousel');
    expect(result.default_gallery_limit).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 11: StorefrontHoursResolver (Phase 3 — storefront namespace split)
// ═══════════════════════════════════════════════════════════════════════

import { resolveStorefrontHours } from '../services/resolvers/StorefrontHoursResolver';

describe('StorefrontHoursResolver', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveStorefrontHours({}, null);
    expect(result.enabled).toBe(false);
    expect(result.hours_enabled).toBe(false);
    expect(result.can_show_hours_display).toBe(false);
  });

  it('returns disabled when storefront_hours_disabled is set', () => {
    const result = resolveStorefrontHours({ storefront_hours_enabled: true, storefront_hours_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables hours with new storefront_hours_* keys', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.enabled).toBe(true);
    expect(result.hours_enabled).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
  });

  it('falls back to old storefront_opt_hours_* keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_hours_on: true,
      storefront_opt_hours_animated: true,
      storefront_opt_hours_status: true,
    };
    const result = resolveStorefrontHours({}, null, fallbackFeatures);
    expect(result.enabled).toBe(true);
    expect(result.hours_enabled).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
  });

  it('respects flexible key to enable all hours types', () => {
    const features = { storefront_hours_enabled: true, storefront_hours_flexible: true };
    const result = resolveStorefrontHours(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
    expect(result.can_use_animated_hours).toBe(true);
    expect(result.can_show_hours_status).toBe(true);
  });

  it('enables hours display via storefront_hours_display key', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_display: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.hours_display_enabled).toBe(true);
    expect(result.can_show_hours_display).toBe(true);
  });

  it('respects individual hours feature keys', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.allowed_hours_types).toEqual(['hours_animated']);
    expect(result.can_use_animated_hours).toBe(true);
    expect(result.can_show_hours_status).toBe(false);
  });

  it('respects merchant preferences to filter effective hours', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const merchantPrefs = {
      hours_enabled: true,
      hours_display: true,
      hours_animated: false,
      hours_status: true,
    };
    const result = resolveStorefrontHours(features, merchantPrefs);
    expect(result.can_use_animated_hours).toBe(false);
    expect(result.can_show_hours_status).toBe(true);
  });

  it('disables hours display when merchant prefs hours_display is false', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_display: true,
    };
    const merchantPrefs = { hours_display: false };
    const result = resolveStorefrontHours(features, merchantPrefs);
    expect(result.hours_display_enabled).toBe(false);
    expect(result.can_show_hours_display).toBe(false);
  });

  it('defaults merchant preferences to true when null', () => {
    const features = {
      storefront_hours_enabled: true,
      storefront_hours_on: true,
      storefront_hours_animated: true,
      storefront_hours_status: true,
    };
    const result = resolveStorefrontHours(features, null);
    expect(result.merchant_preferences.hours_enabled).toBe(true);
    expect(result.merchant_preferences.hours_display).toBe(true);
    expect(result.merchant_preferences.hours_animated).toBe(true);
    expect(result.merchant_preferences.hours_status).toBe(true);
  });

  it('falls back to old storefront_opt_hours_animated keys', () => {
    const fallbackFeatures = {
      storefront_opt_enabled: true,
      storefront_opt_hours_on: true,
      storefront_opt_hours_animated: true,
    };
    const result = resolveStorefrontHours({}, null, fallbackFeatures);
    expect(result.allowed_hours_types).toEqual(['hours_animated']);
    expect(result.can_use_animated_hours).toBe(true);
  });

  it('returns empty allowed_hours_types when hours group is disabled', () => {
    const features = { storefront_hours_enabled: true };
    const result = resolveStorefrontHours(features, null);
    expect(result.hours_enabled).toBe(false);
    expect(result.allowed_hours_types).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION 11: DirectoryEntryOptionsResolver (Directory Entry Decouple Sprint)
// ═══════════════════════════════════════════════════════════════════════

import { resolveDirectoryEntryOptions } from '../services/resolvers/DirectoryEntryOptionsResolver';
import type { DirectoryEntryMerchantSettings } from '../services/resolvers/types';

describe('DirectoryEntryOptionsResolver', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveDirectoryEntryOptions({}, null);
    expect(result.enabled).toBe(false);
    expect(result.layout_enabled).toBe(false);
    expect(result.allowed_layouts).toEqual([]);
  });

  it('returns disabled when directory_entry_disabled is set', () => {
    const result = resolveDirectoryEntryOptions({ directory_entry_enabled: true, directory_entry_disabled: true }, null);
    expect(result.enabled).toBe(false);
  });

  it('enables with directory_entry_enabled key', () => {
    const result = resolveDirectoryEntryOptions({ directory_entry_enabled: true }, null);
    expect(result.enabled).toBe(true);
  });

  it('implicitly enables when any directory_entry_* feature is present', () => {
    const result = resolveDirectoryEntryOptions({ directory_entry_layout_classic: true }, null);
    expect(result.enabled).toBe(true);
  });

  it('respects flexible key to enable all layouts', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const result = resolveDirectoryEntryOptions(features, null);
    expect(result.is_flexible).toBe(true);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial', 'immersive', 'premium']);
  });

  it('respects individual layout feature keys', () => {
    const features = {
      directory_entry_enabled: true,
      directory_entry_layout_classic: true,
      directory_entry_layout_editorial: true,
    };
    const result = resolveDirectoryEntryOptions(features, null);
    expect(result.allowed_layouts).toEqual(['classic', 'editorial']);
    expect(result.can_use_layout_classic).toBe(true);
    expect(result.can_use_layout_editorial).toBe(true);
    expect(result.can_use_layout_immersive).toBe(false);
    expect(result.can_use_layout_premium).toBe(false);
  });

  it('uses merchant prefs directory_entry_layout as effective layout when allowed', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'immersive',
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.effective_layout).toBe('immersive');
  });

  it('falls back to first allowed layout when merchant choice is not in allowed list', () => {
    const features = {
      directory_entry_enabled: true,
      directory_entry_layout_classic: true,
    };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'premium',
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.effective_layout).toBe('classic');
  });

  it('reads directory_entry_opt_enabled from merchant prefs (not storefront_opt_enabled)', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: false,
      directory_entry_layout: 'classic',
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.merchant_preferences.directory_entry_opt_enabled).toBe(false);
  });

  it('defaults merchant prefs to true when null', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const result = resolveDirectoryEntryOptions(features, null);
    expect(result.merchant_preferences.directory_entry_opt_enabled).toBe(true);
    expect(result.merchant_preferences.directory_entry_layout).toBe('classic');
  });

  it('enables section flags via flexible', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const result = resolveDirectoryEntryOptions(features, null);
    expect(result.hours_enabled).toBe(true);
    expect(result.map_enabled).toBe(true);
    expect(result.contact_enabled).toBe(true);
    expect(result.gallery_enabled).toBe(true);
    expect(result.qr_enabled).toBe(true);
    expect(result.social_enabled).toBe(true);
    expect(result.seo_enabled).toBe(true);
  });

  it('respects merchant prefs to disable sections', () => {
    const features = { directory_entry_enabled: true, directory_entry_flexible: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'classic',
      hours_display: false,
      map_display: false,
      storefront_contact: false,
      storefront_social_media: false,
      enhanced_seo: false,
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.hours_enabled).toBe(false);
    expect(result.map_enabled).toBe(false);
    expect(result.contact_enabled).toBe(false);
    expect(result.social_enabled).toBe(false);
    expect(result.seo_enabled).toBe(false);
  });

  it('enables external link when tier allows and merchant pref is true', () => {
    const features = { directory_entry_enabled: true, directory_entry_external_link: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'classic',
      external_link_enabled: true,
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.can_show_external_link).toBe(true);
    expect(result.external_link_enabled).toBe(true);
  });

  it('disables external link when merchant pref is false', () => {
    const features = { directory_entry_enabled: true, directory_entry_external_link: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'classic',
      external_link_enabled: false,
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.can_show_external_link).toBe(true);
    expect(result.external_link_enabled).toBe(false);
  });

  it('disables external link when tier does not allow', () => {
    const features = { directory_entry_enabled: true };
    const prefs: DirectoryEntryMerchantSettings = {
      directory_entry_opt_enabled: true,
      directory_entry_layout: 'classic',
      external_link_enabled: true,
    };
    const result = resolveDirectoryEntryOptions(features, prefs);
    expect(result.can_show_external_link).toBe(false);
    expect(result.external_link_enabled).toBe(false);
  });

  it('does not read storefront_opt_enabled or parent domain fields', () => {
    const features = {
      directory_entry_enabled: true,
      directory_entry_flexible: true,
      // Parent domain fields present but should be ignored
      storefront_opt_enabled: true,
      image_gallery_5: true,
      qr_product: true,
    };
    const result = resolveDirectoryEntryOptions(features, null);
    // Result should be based on directory_entry_* features only
    expect(result.enabled).toBe(true);
    // merchant_preferences should not contain parent domain fields
    expect(result.merchant_preferences).not.toHaveProperty('storefront_opt_enabled');
    expect(result.merchant_preferences).not.toHaveProperty('image_gallery_5');
    expect(result.merchant_preferences).not.toHaveProperty('qr_product');
  });
});
