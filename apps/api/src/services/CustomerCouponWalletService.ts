/**
 * Customer Coupon Wallet Service
 *
 * Manages saved coupons for customers across merchants.
 * A customer can save coupons from a storefront/directory spotlight,
 * view them in a wallet, and apply them at checkout.
 */

import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import { CouponService, Coupon } from './CouponService';
import { trackCouponEvent } from './CouponAnalyticsService';
import { generateSavedCouponId, generateCouponReminderId } from '../lib/id-generator';
import { logger } from '../logger';

// ====================
// TYPES
// ====================

export type SavedCouponStatus = 'saved' | 'redeemed' | 'expired';

export interface SavedCoupon {
  savedCouponId: string;
  couponId: string;
  tenantId: string;
  tenantName: string | null;
  tenantLogo: string | null;
  code: string;
  discountType: string;
  discountValue: number;
  promotionalMessage: string | null;
  termsSummary: string | null;
  expiresAt: Date | null;
  status: SavedCouponStatus;
  savedAt: Date;
  redeemedAt: Date | null;
  expiredAt: Date | null;
}

export interface WalletStats {
  totalSaved: number;
  active: number;
  expiringSoon: number;
  redeemed: number;
  totalSavingsCents: number;
}

export interface WalletFilters {
  status?: SavedCouponStatus;
  tenantId?: string;
  couponId?: string;
  limit?: number;
  offset?: number;
}

interface SavedCouponRow {
  id: string;
  coupon_id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_logo: string | null;
  code: string;
  discount_type: string;
  discount_value: number | string;
  promotional_message: string | null;
  terms_summary: string | null;
  coupon_expires_at: Date | null;
  status: string;
  saved_at: Date;
  redeemed_at: Date | null;
  expired_at: Date | null;
}

// ====================
// SERVICE
// ====================

export class CustomerCouponWalletService extends BaseService {
  private static instance: CustomerCouponWalletService;

  private constructor() {
    super();
  }

  static getInstance(): CustomerCouponWalletService {
    if (!CustomerCouponWalletService.instance) {
      CustomerCouponWalletService.instance = new CustomerCouponWalletService();
    }
    return CustomerCouponWalletService.instance;
  }

  // ─── Helpers ───

  private mapSavedCoupon(row: SavedCouponRow): SavedCoupon {
    return {
      savedCouponId: row.id,
      couponId: row.coupon_id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantLogo: row.tenant_logo,
      code: row.code,
      discountType: row.discount_type,
      discountValue: typeof row.discount_value === 'string' ? Number(row.discount_value) : Number(row.discount_value),
      promotionalMessage: row.promotional_message,
      termsSummary: row.terms_summary,
      expiresAt: row.coupon_expires_at,
      status: row.status as SavedCouponStatus,
      savedAt: row.saved_at,
      redeemedAt: row.redeemed_at,
      expiredAt: row.expired_at,
    };
  }

  private validateCouponForSaving(coupon: Coupon | null): void {
    if (!coupon) {
      throw new Error('coupon_not_found');
    }
    if (!coupon.isActive) {
      throw new Error('coupon_inactive');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new Error('coupon_expired');
    }
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new Error('coupon_exhausted');
    }
  }

  // ─── Save / Unsave ───

  async saveCoupon(
    customerId: string,
    tenantId: string,
    couponId: string,
    surface: string = 'wallet'
  ): Promise<SavedCoupon> {
    const coupon = await CouponService.getInstance().getCoupon(tenantId, couponId);
    this.validateCouponForSaving(coupon);

    const id = generateSavedCouponId(tenantId);
    const now = new Date();

    try {
      await this.prisma.$queryRaw(Prisma.sql`
        INSERT INTO customer_saved_coupons (
          id, customer_id, tenant_id, coupon_id, status, reminder_enabled,
          saved_at, created_at, updated_at
        ) VALUES (
          ${id}, ${customerId}, ${tenantId}, ${couponId}, 'saved', true,
          ${now}, ${now}, ${now}
        )
        ON CONFLICT (customer_id, coupon_id) DO NOTHING
      `);
    } catch (error: any) {
      logger.error('[CustomerCouponWallet] Save insert failed', undefined, {
        customerId,
        tenantId,
        couponId,
        error: error.message,
      });
      throw new Error('save_failed');
    }

    // Track save event (fire-and-forget)
    trackCouponEvent({
      tenantId,
      couponId,
      couponCode: coupon!.code,
      eventType: 'save',
      surface: surface as any,
      source: 'customer_wallet',
    }).catch(() => {});

    // Return the saved record (newly inserted or pre-existing due to unique constraint)
    const existing = await this.getSavedCouponByCoupon(customerId, tenantId, couponId);
    if (!existing) {
      throw new Error('save_failed');
    }
    return existing;
  }

  async saveCouponByCode(
    customerId: string,
    tenantId: string,
    couponCode: string,
    surface: string = 'qr_scan'
  ): Promise<SavedCoupon> {
    const coupon = await CouponService.getInstance().getCouponByCode(tenantId, couponCode);
    this.validateCouponForSaving(coupon);
    return this.saveCoupon(customerId, tenantId, coupon!.id, surface);
  }

  async unsaveCoupon(customerId: string, savedCouponId: string): Promise<void> {
    const [row] = await this.prisma.$queryRaw<SavedCouponRow[]>(Prisma.sql`
      SELECT sc.id, sc.coupon_id, sc.tenant_id, sc.status, c.code, t.name as tenant_name, t.logo_url as tenant_logo,
             c.discount_type, c.discount_value, c.promotional_message, c.terms_summary, c.expires_at as coupon_expires_at,
             sc.saved_at, sc.redeemed_at, sc.expired_at
      FROM customer_saved_coupons sc
      JOIN tenant_coupons c ON c.id = sc.coupon_id
      JOIN tenants t ON t.id = sc.tenant_id
      WHERE sc.id = ${savedCouponId} AND sc.customer_id = ${customerId}
      LIMIT 1
    `);

    if (!row) {
      throw new Error('saved_coupon_not_found');
    }

    await this.prisma.$queryRaw(Prisma.sql`
      DELETE FROM customer_saved_coupons
      WHERE id = ${savedCouponId} AND customer_id = ${customerId}
    `);

    trackCouponEvent({
      tenantId: row.tenant_id,
      couponId: row.coupon_id,
      couponCode: row.code,
      eventType: 'unsave',
      surface: 'wallet',
      source: 'customer_wallet',
    }).catch(() => {});
  }

  // ─── Retrieval ───

  private async getSavedCouponByCoupon(
    customerId: string,
    tenantId: string,
    couponId: string
  ): Promise<SavedCoupon | null> {
    const rows = await this.listWallet(customerId, { tenantId, couponId, limit: 1 });
    return rows[0] ?? null;
  }

  async listWallet(customerId: string, filters: WalletFilters = {}): Promise<SavedCoupon[]> {
    const statusFilter = filters.status ? Prisma.sql` AND sc.status = ${filters.status}` : Prisma.sql``;
    const tenantFilter = filters.tenantId ? Prisma.sql` AND sc.tenant_id = ${filters.tenantId}` : Prisma.sql``;
    const couponFilter = filters.couponId ? Prisma.sql` AND sc.coupon_id = ${filters.couponId}` : Prisma.sql``;
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const rows = await this.prisma.$queryRaw<SavedCouponRow[]>(Prisma.sql`
      SELECT sc.id, sc.coupon_id, sc.tenant_id, t.name as tenant_name, t.logo_url as tenant_logo,
             c.code, c.discount_type, c.discount_value, c.promotional_message, c.terms_summary,
             c.expires_at as coupon_expires_at, sc.status, sc.saved_at, sc.redeemed_at, sc.expired_at
      FROM customer_saved_coupons sc
      JOIN tenant_coupons c ON c.id = sc.coupon_id
      JOIN tenants t ON t.id = sc.tenant_id
      WHERE sc.customer_id = ${customerId} ${statusFilter} ${tenantFilter} ${couponFilter}
      ORDER BY sc.saved_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return rows.map((r: SavedCouponRow) => this.mapSavedCoupon(r));
  }

  async listWalletByTenant(
    customerId: string,
    tenantId: string,
    status: SavedCouponStatus = 'saved'
  ): Promise<SavedCoupon[]> {
    return this.listWallet(customerId, { tenantId, status });
  }

  async getWalletStats(customerId: string): Promise<WalletStats> {
    const [row] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        COUNT(*)::int as total_saved,
        COUNT(*) FILTER (WHERE sc.status = 'saved')::int as active,
        COUNT(*) FILTER (WHERE sc.status = 'saved' AND c.expires_at <= NOW() + INTERVAL '7 days')::int as expiring_soon,
        COUNT(*) FILTER (WHERE sc.status = 'redeemed')::int as redeemed,
        COALESCE(SUM(CASE
          WHEN sc.status = 'redeemed' AND c.discount_type = 'fixed_amount' THEN c.discount_value
          ELSE 0
        END), 0)::int as total_savings_cents
      FROM customer_saved_coupons sc
      JOIN tenant_coupons c ON c.id = sc.coupon_id
      WHERE sc.customer_id = ${customerId}
    `);

    if (!row) {
      return { totalSaved: 0, active: 0, expiringSoon: 0, redeemed: 0, totalSavingsCents: 0 };
    }

    return {
      totalSaved: row.total_saved ?? 0,
      active: row.active ?? 0,
      expiringSoon: row.expiring_soon ?? 0,
      redeemed: row.redeemed ?? 0,
      totalSavingsCents: Number(row.total_savings_cents) ?? 0,
    };
  }

  async getExpiringSoon(customerId: string, daysThreshold: number = 7): Promise<SavedCoupon[]> {
    const rows = await this.prisma.$queryRaw<SavedCouponRow[]>(Prisma.sql`
      SELECT sc.id, sc.coupon_id, sc.tenant_id, t.name as tenant_name, t.logo_url as tenant_logo,
             c.code, c.discount_type, c.discount_value, c.promotional_message, c.terms_summary,
             c.expires_at as coupon_expires_at, sc.status, sc.saved_at, sc.redeemed_at, sc.expired_at
      FROM customer_saved_coupons sc
      JOIN tenant_coupons c ON c.id = sc.coupon_id
      JOIN tenants t ON t.id = sc.tenant_id
      WHERE sc.customer_id = ${customerId}
        AND sc.status = 'saved'
        AND c.expires_at <= NOW() + INTERVAL '1 day' * ${daysThreshold}
      ORDER BY c.expires_at ASC
      LIMIT 100
    `);

    return rows.map((r: SavedCouponRow) => this.mapSavedCoupon(r));
  }

  // ─── Redemption / Status Sync ───

  async markRedeemed(customerId: string, couponId: string, orderId?: string): Promise<void> {
    const now = new Date();
    await this.prisma.$queryRaw(Prisma.sql`
      UPDATE customer_saved_coupons
      SET status = 'redeemed', redeemed_at = ${now}, updated_at = ${now}
      WHERE customer_id = ${customerId}
        AND coupon_id = ${couponId}
        AND status = 'saved'
    `);
  }

  async syncExpiredStatuses(): Promise<{ updated: number }> {
    const result: any = await this.prisma.$queryRaw(Prisma.sql`
      UPDATE customer_saved_coupons sc
      SET status = 'expired', expired_at = NOW(), updated_at = NOW()
      FROM tenant_coupons c
      WHERE sc.coupon_id = c.id
        AND sc.status = 'saved'
        AND (
          c.is_active = false
          OR (c.expires_at IS NOT NULL AND c.expires_at < NOW())
          OR (c.max_redemptions IS NOT NULL AND c.redemption_count >= c.max_redemptions)
        )
      RETURNING sc.id
    `);

    return { updated: Array.isArray(result) ? result.length : 0 };
  }

  // ─── Reminder helpers (used by expiry reminder job) ───

  async getSavedCouponsEligibleForReminder(daysOut: number): Promise<SavedCoupon[]> {
    const rows = await this.prisma.$queryRaw<SavedCouponRow[]>(Prisma.sql`
      SELECT sc.id, sc.coupon_id, sc.tenant_id, t.name as tenant_name, t.logo_url as tenant_logo,
             c.code, c.discount_type, c.discount_value, c.promotional_message, c.terms_summary,
             c.expires_at as coupon_expires_at, sc.status, sc.saved_at, sc.redeemed_at, sc.expired_at
      FROM customer_saved_coupons sc
      JOIN tenant_coupons c ON c.id = sc.coupon_id
      JOIN tenants t ON t.id = sc.tenant_id
      WHERE sc.status = 'saved'
        AND sc.reminder_enabled = true
        AND c.expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 day' * ${daysOut}
        AND NOT EXISTS (
          SELECT 1 FROM customer_coupon_reminders r
          WHERE r.saved_coupon_id = sc.id AND r.reminder_type = ${daysOut + 'd'}
        )
      ORDER BY c.expires_at ASC
      LIMIT 1000
    `);

    return rows.map((r: SavedCouponRow) => this.mapSavedCoupon(r));
  }

  async recordReminder(savedCouponId: string, customerId: string, reminderType: '24h' | '3d' | '7d'): Promise<void> {
    const [sc] = await this.prisma.$queryRaw<{ tenant_id: string }[]>(Prisma.sql`
      SELECT tenant_id FROM customer_saved_coupons WHERE id = ${savedCouponId} LIMIT 1
    `);
    if (!sc) return;

    const id = generateCouponReminderId(sc.tenant_id);
    const now = new Date();
    await this.prisma.$queryRaw(Prisma.sql`
      INSERT INTO customer_coupon_reminders (id, customer_id, saved_coupon_id, reminder_type, sent_at, created_at, updated_at)
      VALUES (${id}, ${customerId}, ${savedCouponId}, ${reminderType}, ${now}, ${now}, ${now})
      ON CONFLICT (saved_coupon_id, reminder_type) DO NOTHING
    `);
  }
}
