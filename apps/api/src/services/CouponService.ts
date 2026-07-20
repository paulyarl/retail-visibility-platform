/**
 * CouponService — Merchant coupon CRUD + validation + redemption
 *
 * Handles create, update, deactivate, list, validate, and redeem operations
 * for tenant-scoped coupons. Integrates with the capability resolver for
 * tier-gating discount types and features.
 *
 * Pattern: mirrors DirectoryPromotionService.ts (singleton extends BaseService)
 * Design doc: docs/MERCHANT_COUPON_SPRINT_PLAN.md (Sprint 2)
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateCouponId, generateRedemptionId } from '../lib/id-generator';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { invalidateEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { audit } from '../audit';

// ====================
// TYPES
// ====================

export type CouponDiscountType = 'percent_off' | 'fixed_amount' | 'free_shipping' | 'bogo';
export type CouponTargetType = 'all' | 'products' | 'categories' | 'collections';

export interface CouponInput {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minSpendCents?: number;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
  targetType?: CouponTargetType;
  targetIds?: string[];
  promotionalMessage?: string;
  termsSummary?: string;
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  discountType: string;
  discountValue: number;
  minSpendCents: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  targetType: string | null;
  targetIds: string[];
  promotionalMessage: string | null;
  termsSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  couponId: string | null;
  code: string;
  discountType: string;
  discountValue: number;
  discountCents: number;
  minSpendCents: number;
  message: string;
  reason: string | null;
}

export interface RedemptionResult {
  redemptionId: string;
  couponId: string;
  orderId: string | null;
  discountCents: number;
  redeemedAt: Date;
}

// ====================
// SERVICE
// ====================

export class CouponService extends BaseService {
  private static instance: CouponService;

  private constructor() {
    super();
  }

  static getInstance(): CouponService {
    if (!CouponService.instance) {
      CouponService.instance = new CouponService();
    }
    return CouponService.instance;
  }

  // ====================
  // CREATE
  // ====================

  async createCoupon(tenantId: string, input: CouponInput, actor?: string): Promise<Coupon> {
    // Tier gate: check coupon capability
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.coupon_options?.enabled) {
      throw new Error('coupon_options_not_available');
    }
    if (!caps.effective.coupon_options.can_create_coupons) {
      throw new Error('coupon_create_not_allowed');
    }

    // Validate discount type is allowed by tier
    const allowedTypes = caps.effective.coupon_options.allowed_discount_types;
    if (!allowedTypes.includes(input.discountType as any)) {
      throw new Error(`discount_type_not_allowed:${input.discountType}`);
    }

    // Validate targeting
    if (input.targetType && input.targetType !== 'all') {
      if (!caps.effective.coupon_options.can_target_products) {
        throw new Error('targeting_not_allowed');
      }
    }

    // Validate limits
    if (input.maxRedemptions != null) {
      if (!caps.effective.coupon_options.can_set_limits) {
        throw new Error('limits_not_allowed');
      }
    }

    // Check code uniqueness within tenant
    const existing = await prisma.tenant_coupons.findUnique({
      where: { tenant_id_code: { tenant_id: tenantId, code: input.code } },
    });
    if (existing) {
      throw new Error('coupon_code_exists');
    }

    // Validate discount value
    if (input.discountType === 'percent_off' && (input.discountValue < 1 || input.discountValue > 100)) {
      throw new Error('invalid_percent_value');
    }
    if ((input.discountType === 'fixed_amount') && input.discountValue < 1) {
      throw new Error('invalid_fixed_amount');
    }

    const couponId = generateCouponId(tenantId);
    const coupon = await prisma.tenant_coupons.create({
      data: {
        id: couponId,
        tenant_id: tenantId,
        code: input.code.toUpperCase(),
        discount_type: input.discountType,
        discount_value: input.discountValue,
        min_spend_cents: input.minSpendCents || 0,
        max_redemptions: input.maxRedemptions ?? null,
        expires_at: input.expiresAt ?? null,
        is_active: true,
        target_type: input.targetType || 'all',
        target_ids: input.targetIds || [],
        promotional_message: input.promotionalMessage || null,
        terms_summary: input.termsSummary || null,
      },
    });

    logger.info('[CouponService] Coupon created', undefined, {
      tenantId,
      couponId,
      code: input.code,
      discountType: input.discountType,
    });

    await audit({
      tenantId,
      actor: actor || 'system',
      action: 'create',
      payload: { entity_type: 'other', id: couponId, code: input.code, discount_type: input.discountType },
    });

    return this.mapCoupon(coupon);
  }

  // ====================
  // UPDATE
  // ====================

  async updateCoupon(tenantId: string, couponId: string, updates: Partial<CouponInput>, actor?: string): Promise<Coupon> {
    const existing = await prisma.tenant_coupons.findFirst({
      where: { id: couponId, tenant_id: tenantId },
    });
    if (!existing) {
      throw new Error('coupon_not_found');
    }

    const updateData: any = {};
    if (updates.code !== undefined) {
      // Check uniqueness if code is changing
      if (updates.code.toUpperCase() !== existing.code) {
        const conflict = await prisma.tenant_coupons.findUnique({
          where: { tenant_id_code: { tenant_id: tenantId, code: updates.code.toUpperCase() } },
        });
        if (conflict) {
          throw new Error('coupon_code_exists');
        }
      }
      updateData.code = updates.code.toUpperCase();
    }
    if (updates.discountType !== undefined) {
      const caps = await resolveEffectiveCapabilities(tenantId);
      const allowedTypes = caps?.effective.coupon_options?.allowed_discount_types || [];
      if (!allowedTypes.includes(updates.discountType as any)) {
        throw new Error(`discount_type_not_allowed:${updates.discountType}`);
      }
      updateData.discount_type = updates.discountType;
    }
    if (updates.discountValue !== undefined) {
      if (updates.discountType === 'percent_off' || existing.discount_type === 'percent_off') {
        if (updates.discountValue < 1 || updates.discountValue > 100) {
          throw new Error('invalid_percent_value');
        }
      }
      updateData.discount_value = updates.discountValue;
    }
    if (updates.minSpendCents !== undefined) updateData.min_spend_cents = updates.minSpendCents;
    if (updates.maxRedemptions !== undefined) updateData.max_redemptions = updates.maxRedemptions ?? null;
    if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt ?? null;
    if (updates.targetType !== undefined) updateData.target_type = updates.targetType;
    if (updates.targetIds !== undefined) updateData.target_ids = updates.targetIds;
    if (updates.promotionalMessage !== undefined) updateData.promotional_message = updates.promotionalMessage;
    if (updates.termsSummary !== undefined) updateData.terms_summary = updates.termsSummary;

    const coupon = await prisma.tenant_coupons.update({
      where: { id: couponId },
      data: updateData,
    });

    invalidateEffectiveCapabilities(tenantId);

    logger.info('[CouponService] Coupon updated', undefined, { tenantId, couponId });

    await audit({
      tenantId,
      actor: actor || 'system',
      action: 'update',
      payload: { entity_type: 'other', id: couponId, changes: updateData },
    });

    return this.mapCoupon(coupon);
  }

  // ====================
  // DEACTIVATE
  // ====================

  async deactivateCoupon(tenantId: string, couponId: string, actor?: string): Promise<void> {
    const existing = await prisma.tenant_coupons.findFirst({
      where: { id: couponId, tenant_id: tenantId },
    });
    if (!existing) {
      throw new Error('coupon_not_found');
    }

    await prisma.tenant_coupons.update({
      where: { id: couponId },
      data: { is_active: false },
    });

    logger.info('[CouponService] Coupon deactivated', undefined, { tenantId, couponId });

    await audit({
      tenantId,
      actor: actor || 'system',
      action: 'delete',
      payload: { entity_type: 'other', id: couponId, code: existing.code },
    });
  }

  // ====================
  // LIST / GET
  // ====================

  async listCoupons(tenantId: string, filters: { isActive?: boolean; limit?: number; offset?: number } = {}): Promise<{ coupons: Coupon[]; total: number }> {
    const where: any = { tenant_id: tenantId };
    if (filters.isActive !== undefined) where.is_active = filters.isActive;

    const [coupons, total] = await Promise.all([
      prisma.tenant_coupons.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.tenant_coupons.count({ where }),
    ]);

    return {
      coupons: coupons.map(this.mapCoupon),
      total,
    };
  }

  async getCoupon(tenantId: string, couponId: string): Promise<Coupon | null> {
    const coupon = await prisma.tenant_coupons.findFirst({
      where: { id: couponId, tenant_id: tenantId },
    });
    return coupon ? this.mapCoupon(coupon) : null;
  }

  async getCouponByCode(tenantId: string, code: string): Promise<Coupon | null> {
    const coupon = await prisma.tenant_coupons.findUnique({
      where: { tenant_id_code: { tenant_id: tenantId, code: code.toUpperCase() } },
    });
    return coupon ? this.mapCoupon(coupon) : null;
  }

  // ====================
  // VALIDATE (public — used by checkout)
  // ====================

  async validateCoupon(tenantId: string, code: string, cartData: { subtotalCents: number; items?: Array<{ productId: string; categoryId?: string; collectionId?: string }> }): Promise<ValidationResult> {
    const coupon = await prisma.tenant_coupons.findUnique({
      where: { tenant_id_code: { tenant_id: tenantId, code: code.toUpperCase() } },
    });

    if (!coupon) {
      return { valid: false, couponId: null, code, discountType: 'none', discountValue: 0, discountCents: 0, minSpendCents: 0, message: 'Coupon not found', reason: 'not_found' };
    }

    if (!coupon.is_active) {
      return { valid: false, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountCents: 0, minSpendCents: coupon.min_spend_cents, message: 'Coupon is no longer active', reason: 'inactive' };
    }

    if (coupon.expires_at && coupon.expires_at < new Date()) {
      return { valid: false, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountCents: 0, minSpendCents: coupon.min_spend_cents, message: 'Coupon has expired', reason: 'expired' };
    }

    if (coupon.max_redemptions != null && coupon.redemption_count >= coupon.max_redemptions) {
      return { valid: false, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountCents: 0, minSpendCents: coupon.min_spend_cents, message: 'Coupon usage limit reached', reason: 'exhausted' };
    }

    if (cartData.subtotalCents < coupon.min_spend_cents) {
      return { valid: false, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountCents: 0, minSpendCents: coupon.min_spend_cents, message: `Minimum spend of ${coupon.min_spend_cents} cents required`, reason: 'min_spend_not_met' };
    }

    // Targeting check
    if (coupon.target_type && coupon.target_type !== 'all' && coupon.target_ids.length > 0) {
      const items = cartData.items || [];
      const matches = items.some(item => {
        if (coupon.target_type === 'products') return coupon.target_ids.includes(item.productId);
        if (coupon.target_type === 'categories') return coupon.target_ids.includes(item.categoryId || '');
        if (coupon.target_type === 'collections') return coupon.target_ids.includes(item.collectionId || '');
        return false;
      });
      if (!matches) {
        return { valid: false, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountCents: 0, minSpendCents: coupon.min_spend_cents, message: 'Coupon does not apply to items in cart', reason: 'targeting_mismatch' };
      }
    }

    // Calculate discount
    const discountCents = this.calculateDiscount(coupon.discount_type, coupon.discount_value, cartData.subtotalCents);

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountCents,
      minSpendCents: coupon.min_spend_cents,
      message: 'Coupon applied successfully',
      reason: null,
    };
  }

  // ====================
  // REDEEM (called after successful checkout)
  // ====================

  async redeemCoupon(tenantId: string, couponId: string, data: { orderId?: string; customerEmail?: string; discountCents: number }): Promise<RedemptionResult> {
    const coupon = await prisma.tenant_coupons.findFirst({
      where: { id: couponId, tenant_id: tenantId },
    });
    if (!coupon) {
      throw new Error('coupon_not_found');
    }
    if (!coupon.is_active) {
      throw new Error('coupon_inactive');
    }

    const redemptionId = generateRedemptionId(tenantId);
    const redemption = await prisma.coupon_redemptions.create({
      data: {
        id: redemptionId,
        tenant_id: tenantId,
        coupon_id: couponId,
        order_id: data.orderId || null,
        customer_email: data.customerEmail || null,
        discount_cents: data.discountCents,
      },
    });

    // Increment redemption count
    await prisma.tenant_coupons.update({
      where: { id: couponId },
      data: { redemption_count: { increment: 1 } },
    });

    logger.info('[CouponService] Coupon redeemed', undefined, {
      tenantId,
      couponId,
      redemptionId,
      orderId: data.orderId,
      discountCents: data.discountCents,
    });

    await audit({
      tenantId,
      action: 'create',
      payload: { entity_type: 'other', id: redemptionId, couponId, orderId: data.orderId, discountCents: data.discountCents },
    });

    return {
      redemptionId: redemption.id,
      couponId,
      orderId: data.orderId || null,
      discountCents: data.discountCents,
      redeemedAt: redemption.redeemed_at,
    };
  }

  // ====================
  // SPOTLIGHT (featured coupon for public surfaces)
  // ====================

  async getSpotlightCoupon(tenantId: string): Promise<Coupon | null> {
    const settings = await prisma.tenant_coupon_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!settings || !settings.spotlight_enabled || !settings.featured_coupon_id) {
      return null;
    }

    const coupon = await prisma.tenant_coupons.findFirst({
      where: {
        id: settings.featured_coupon_id,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!coupon) {
      return null;
    }

    // Check expiry
    if (coupon.expires_at && coupon.expires_at < new Date()) {
      return null;
    }

    return this.mapCoupon(coupon);
  }

  // ====================
  // SETTINGS
  // ====================

  async getSettings(tenantId: string): Promise<{
    couponEnabled: boolean;
    spotlightEnabled: boolean;
    featuredCouponId: string | null;
    percentOffEnabled: boolean;
    fixedAmountEnabled: boolean;
    freeShippingEnabled: boolean;
    bogoEnabled: boolean;
    targetProductsEnabled: boolean;
    qrSharingEnabled: boolean;
  }> {
    const settings = await prisma.tenant_coupon_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    return {
      couponEnabled: settings?.coupon_enabled ?? false,
      spotlightEnabled: settings?.spotlight_enabled ?? false,
      featuredCouponId: settings?.featured_coupon_id ?? null,
      percentOffEnabled: settings?.percent_off_enabled ?? true,
      fixedAmountEnabled: settings?.fixed_amount_enabled ?? true,
      freeShippingEnabled: settings?.free_shipping_enabled ?? true,
      bogoEnabled: settings?.bogo_enabled ?? true,
      targetProductsEnabled: settings?.target_products_enabled ?? true,
      qrSharingEnabled: settings?.qr_sharing_enabled ?? true,
    };
  }

  async updateSettings(tenantId: string, updates: {
    couponEnabled?: boolean;
    spotlightEnabled?: boolean;
    featuredCouponId?: string | null;
    percentOffEnabled?: boolean;
    fixedAmountEnabled?: boolean;
    freeShippingEnabled?: boolean;
    bogoEnabled?: boolean;
    targetProductsEnabled?: boolean;
    qrSharingEnabled?: boolean;
  }, actor?: string): Promise<void> {
    const existing = await prisma.tenant_coupon_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (existing) {
      const updateData: any = {};
      if (updates.couponEnabled !== undefined) updateData.coupon_enabled = updates.couponEnabled;
      if (updates.spotlightEnabled !== undefined) updateData.spotlight_enabled = updates.spotlightEnabled;
      if (updates.featuredCouponId !== undefined) updateData.featured_coupon_id = updates.featuredCouponId;
      if (updates.percentOffEnabled !== undefined) updateData.percent_off_enabled = updates.percentOffEnabled;
      if (updates.fixedAmountEnabled !== undefined) updateData.fixed_amount_enabled = updates.fixedAmountEnabled;
      if (updates.freeShippingEnabled !== undefined) updateData.free_shipping_enabled = updates.freeShippingEnabled;
      if (updates.bogoEnabled !== undefined) updateData.bogo_enabled = updates.bogoEnabled;
      if (updates.targetProductsEnabled !== undefined) updateData.target_products_enabled = updates.targetProductsEnabled;
      if (updates.qrSharingEnabled !== undefined) updateData.qr_sharing_enabled = updates.qrSharingEnabled;

      await prisma.tenant_coupon_options_settings.update({
        where: { tenant_id: tenantId },
        data: updateData,
      });
    } else {
      await prisma.tenant_coupon_options_settings.create({
        data: {
          tenant_id: tenantId,
          coupon_enabled: updates.couponEnabled ?? false,
          spotlight_enabled: updates.spotlightEnabled ?? false,
          featured_coupon_id: updates.featuredCouponId ?? null,
          percent_off_enabled: updates.percentOffEnabled ?? true,
          fixed_amount_enabled: updates.fixedAmountEnabled ?? true,
          free_shipping_enabled: updates.freeShippingEnabled ?? true,
          bogo_enabled: updates.bogoEnabled ?? true,
          target_products_enabled: updates.targetProductsEnabled ?? true,
          qr_sharing_enabled: updates.qrSharingEnabled ?? true,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    logger.info('[CouponService] Settings updated', undefined, { tenantId, updates });

    await audit({
      tenantId,
      actor: actor || 'system',
      action: 'update',
      payload: { entity_type: 'other', id: 'coupon_settings', updates },
    });
  }

  // ====================
  // HELPERS
  // ====================

  private calculateDiscount(discountType: string, discountValue: number, subtotalCents: number): number {
    switch (discountType) {
      case 'percent_off':
        return Math.round(subtotalCents * discountValue / 100);
      case 'fixed_amount':
        return Math.min(discountValue, subtotalCents);
      case 'free_shipping':
        return 0; // Shipping discount handled at checkout level
      case 'bogo':
        return 0; // BOGO discount calculated at item level
      default:
        return 0;
    }
  }

  private mapCoupon(c: any): Coupon {
    return {
      id: c.id,
      tenantId: c.tenant_id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minSpendCents: c.min_spend_cents,
      maxRedemptions: c.max_redemptions,
      redemptionCount: c.redemption_count,
      expiresAt: c.expires_at,
      isActive: c.is_active,
      targetType: c.target_type,
      targetIds: c.target_ids || [],
      promotionalMessage: c.promotional_message,
      termsSummary: c.terms_summary,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }
}
