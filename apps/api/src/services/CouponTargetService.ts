/**
 * Coupon Target Service
 *
 * Platform-side targeting layer for BSaaS coupons/promo codes.
 * Stores per-coupon target constraints in coupon_target_rules table.
 * Checkout flow calls validateCouponTargets() before applying the discount.
 *
 * Pattern mirrors BadgeRegistryService: DB-driven + 60s in-memory cache.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { BaseService } from './BaseService';
import { generateCouponTargetId } from '../lib/id-generator';

// ====================
// TYPES
// ====================

export interface CouponTargets {
  target_features?: string[] | null;
  target_tiers?: string[] | null;
  target_capability_types?: string[] | null;
  target_tier_types?: string[] | null;
  target_demo_status?: string[] | null;
  target_subscription_statuses?: string[] | null;
}

export interface CouponTargetContext {
  featureKey: string;
  tenantId: string;
  bundleKey?: string;
  featureKeys?: string[];
}

export interface CouponTargetValidationResult {
  valid: boolean;
  reason: string | null;
}

// ====================
// SERVICE
// ====================

class CouponTargetService extends BaseService {
  private static instance: CouponTargetService;
  private cache: Map<string, { targets: CouponTargets | null; expires: number }> = new Map();
  private readonly CACHE_TTL_MS = 60_000;

  private constructor() {
    super();
  }

  static getInstance(): CouponTargetService {
    if (!CouponTargetService.instance) {
      CouponTargetService.instance = new CouponTargetService();
    }
    return CouponTargetService.instance;
  }

  /**
   * Get target rules for a coupon. Returns null if no rules exist (no constraints).
   * 60s in-memory cache.
   */
  async getTargetsForCoupon(couponId: string): Promise<CouponTargets | null> {
    const cached = this.cache.get(couponId);
    if (cached && cached.expires > Date.now()) {
      return cached.targets;
    }

    try {
      const rules = await prisma.coupon_target_rules.findUnique({
        where: { coupon_id: couponId },
      });

      const targets: CouponTargets | null = rules
        ? {
            target_features: rules.target_features as string[] | null,
            target_tiers: rules.target_tiers as string[] | null,
            target_capability_types: rules.target_capability_types as string[] | null,
            target_tier_types: rules.target_tier_types as string[] | null,
            target_demo_status: rules.target_demo_status as string[] | null,
            target_subscription_statuses: rules.target_subscription_statuses as string[] | null,
          }
        : null;

      this.cache.set(couponId, { targets, expires: Date.now() + this.CACHE_TTL_MS });
      return targets;
    } catch (error) {
      logger.warn('Failed to fetch coupon target rules', undefined, { couponId, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Set/update target rules for a coupon. Upserts the row.
   */
  async setCouponTargets(couponId: string, targets: CouponTargets): Promise<void> {
    const id = generateCouponTargetId();

    await prisma.coupon_target_rules.upsert({
      where: { coupon_id: couponId },
      update: {
        target_features: (targets.target_features ?? null) as any,
        target_tiers: (targets.target_tiers ?? null) as any,
        target_capability_types: (targets.target_capability_types ?? null) as any,
        target_tier_types: (targets.target_tier_types ?? null) as any,
        target_demo_status: (targets.target_demo_status ?? null) as any,
        target_subscription_statuses: (targets.target_subscription_statuses ?? null) as any,
      },
      create: {
        id,
        coupon_id: couponId,
        target_features: (targets.target_features ?? null) as any,
        target_tiers: (targets.target_tiers ?? null) as any,
        target_capability_types: (targets.target_capability_types ?? null) as any,
        target_tier_types: (targets.target_tier_types ?? null) as any,
        target_demo_status: (targets.target_demo_status ?? null) as any,
        target_subscription_statuses: (targets.target_subscription_statuses ?? null) as any,
      },
    });

    this.invalidateCache(couponId);
  }

  /**
   * Validate coupon targets against a purchase context.
   * Returns { valid: true } if no rules exist or all rules pass.
   * Returns { valid: false, reason } if any target field fails.
   */
  async validateCouponTargets(
    couponId: string,
    context: CouponTargetContext
  ): Promise<CouponTargetValidationResult> {
    const targets = await this.getTargetsForCoupon(couponId);
    if (!targets) {
      return { valid: true, reason: null };
    }

    // Fetch tenant data once
    const tenant = await prisma.tenants.findUnique({
      where: { id: context.tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        is_demo: true,
        organization_id: true,
        organizations_list: { select: { subscription_tier: true } },
      },
    });

    if (!tenant) {
      return { valid: false, reason: 'coupon_not_valid_for_tenant' };
    }

    // 1. Feature check
    if (targets.target_features && targets.target_features.length > 0) {
      const allFeatureKeys = context.featureKeys && context.featureKeys.length > 0
        ? context.featureKeys
        : [context.featureKey];
      const hasMatch = allFeatureKeys.some(fk => targets.target_features!.includes(fk));
      if (!hasMatch) {
        return { valid: false, reason: 'coupon_not_valid_for_feature' };
      }
    }

    // 2. Tier check
    if (targets.target_tiers && targets.target_tiers.length > 0) {
      const tenantTiers = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
        .filter((t): t is string => !!t);
      const hasMatch = tenantTiers.some(t => targets.target_tiers!.includes(t));
      if (!hasMatch) {
        return { valid: false, reason: 'coupon_not_valid_for_tier' };
      }
    }

    // 3. Capability type check
    if (targets.target_capability_types && targets.target_capability_types.length > 0) {
      const allFeatureKeys = context.featureKeys && context.featureKeys.length > 0
        ? context.featureKeys
        : [context.featureKey];
      const capTypes = await Promise.all(
        allFeatureKeys.map(async (fk) => {
          const feature = await prisma.features_list.findUnique({
            where: { key: fk },
            select: { id: true },
          });
          if (!feature) return null;
          const capLink = await prisma.capability_features_list.findFirst({
            where: { feature_id: feature.id },
            include: { capability_type_list: { select: { key: true } } },
          });
          return capLink?.capability_type_list?.key ?? null;
        })
      );
      const hasMatch = capTypes.some(ct => ct && targets.target_capability_types!.includes(ct));
      if (!hasMatch) {
        return { valid: false, reason: 'coupon_not_valid_for_capability' };
      }
    }

    // 4. Tier type check (individual vs organization)
    if (targets.target_tier_types && targets.target_tier_types.length > 0) {
      const tenantTiers = [tenant.subscription_tier, tenant.organizations_list?.subscription_tier]
        .filter((t): t is string => !!t);
      if (tenantTiers.length === 0) {
        return { valid: false, reason: 'coupon_not_valid_for_tier_type' };
      }
      const tierRecords = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tenantTiers } },
        select: { tier_type: true },
      });
      const tierTypes = tierRecords.map(t => t.tier_type);
      const hasMatch = tierTypes.some(tt => targets.target_tier_types!.includes(tt));
      if (!hasMatch) {
        return { valid: false, reason: 'coupon_not_valid_for_tier_type' };
      }
    }

    // 5. Demo status check
    if (targets.target_demo_status && targets.target_demo_status.length > 0) {
      const demoStatus = tenant.is_demo ? 'demo' : 'non_demo';
      if (!targets.target_demo_status.includes(demoStatus)) {
        return { valid: false, reason: 'coupon_not_valid_for_demo_status' };
      }
    }

    // 6. Subscription status check
    if (targets.target_subscription_statuses && targets.target_subscription_statuses.length > 0) {
      if (!tenant.subscription_status || !targets.target_subscription_statuses.includes(tenant.subscription_status)) {
        return { valid: false, reason: 'coupon_not_valid_for_subscription_status' };
      }
    }

    return { valid: true, reason: null };
  }

  /**
   * Invalidate cache for a specific coupon.
   */
  invalidateCache(couponId?: string): void {
    if (couponId) {
      this.cache.delete(couponId);
    } else {
      this.cache.clear();
    }
  }
}

export default CouponTargetService;
