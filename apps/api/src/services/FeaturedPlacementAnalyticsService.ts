/**
 * Featured Placement Analytics Service
 *
 * Sprint 6: Analytics & Revenue
 *
 * Provides per-placement metrics and lift calculation:
 * - Views, clicks, CTR, conversion rate during placement period
 * - Revenue attributed to placement (orders with featured badge during placement)
 * - Lift over baseline (compare same product's metrics 7 days before vs during placement)
 * - Platform-level revenue, utilization, renewal rate, top spenders
 *
 * Design doc: docs/FEATURED_VISIBILITY_CHANNELS_DESIGN.md (Sprint 6)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// ====================
// TYPES
// ====================

export interface PlacementMetrics {
  purchaseId: string;
  tenantId: string;
  inventoryItemId: string;
  planKey: string;
  surface: string;
  priceCents: number;
  durationDays: number;
  status: string;
  purchasedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  productName: string;
  // Metrics during placement period
  views: number;
  clicks: number;
  ctr: number;
  addToCartCount: number;
  orderCount: number;
  unitsSold: number;
  revenueCents: number;
  conversionRate: number;
  // Baseline metrics (7 days before placement)
  baselineViews: number;
  baselineClicks: number;
  baselineOrderCount: number;
  baselineRevenueCents: number;
  // Lift calculations
  viewsLift: number;
  clicksLift: number;
  ordersLift: number;
  revenueLift: number;
  // ROI
  roi: number; // (revenueCents - priceCents) / priceCents * 100
}

export interface PlacementAnalyticsResult {
  placements: PlacementMetrics[];
  totals: {
    totalPlacements: number;
    activePlacements: number;
    totalSpendCents: number;
    totalRevenueCents: number;
    totalOrders: number;
    totalViews: number;
    avgRoi: number;
    avgRevenueLift: number;
    renewalRate: number;
  };
}

export interface PlatformRevenueAnalytics {
  totalRevenueCents: number;
  totalPurchases: number;
  activePurchases: number;
  trialPurchases: number;
  trialConversionRate: number;
  churnRate: number;
  renewalRate: number;
  revenueBySurface: Record<string, { revenueCents: number; count: number }>;
  revenueByPlan: Record<string, { revenueCents: number; count: number; label: string }>;
  topSpenders: Array<{ tenantId: string; tenantName: string; totalSpendCents: number; purchaseCount: number }>;
  monthlyRevenue: Array<{ month: string; revenueCents: number; count: number }>;
}

// ====================
// SERVICE
// ====================

class FeaturedPlacementAnalyticsService {
  private static instance: FeaturedPlacementAnalyticsService;

  static getInstance(): FeaturedPlacementAnalyticsService {
    if (!FeaturedPlacementAnalyticsService.instance) {
      FeaturedPlacementAnalyticsService.instance = new FeaturedPlacementAnalyticsService();
    }
    return FeaturedPlacementAnalyticsService.instance;
  }

  /**
   * Get per-placement analytics for a tenant
   */
  async getTenantPlacementAnalytics(
    tenantId: string,
    options?: { status?: string }
  ): Promise<PlacementAnalyticsResult> {
    const where: any = { tenant_id: tenantId };
    if (options?.status) where.status = options.status;
    else where.status = { in: ['active', 'expired'] };

    const purchases = await prisma.featured_placement_purchases.findMany({
      where,
      orderBy: { purchased_at: 'desc' },
    });

    const placements: PlacementMetrics[] = [];
    let totalSpendCents = 0;
    let totalRevenueCents = 0;
    let totalOrders = 0;
    let totalViews = 0;
    let roiSum = 0;
    let revenueLiftSum = 0;
    let renewedCount = 0;
    let expiredCount = 0;

    for (const p of purchases) {
      const metrics = await this.computePlacementMetrics(p);
      placements.push(metrics);

      totalSpendCents += p.price_cents;
      totalRevenueCents += metrics.revenueCents;
      totalOrders += metrics.orderCount;
      totalViews += metrics.views;

      if (metrics.priceCents > 0) {
        roiSum += metrics.roi;
      }
      if (metrics.baselineRevenueCents > 0 || metrics.revenueCents > 0) {
        revenueLiftSum += metrics.revenueLift;
      }

      if (p.renewed_from) renewedCount++;
      if (p.status === 'expired') expiredCount++;
    }

    const activeCount = purchases.filter(p => p.status === 'active').length;
    const eligibleForRenewal = expiredCount + renewedCount;
    const renewalRate = eligibleForRenewal > 0 ? (renewedCount / eligibleForRenewal) * 100 : 0;

    const countWithPrice = placements.filter(p => p.priceCents > 0).length;
    const countWithBaseline = placements.filter(p => p.baselineRevenueCents > 0 || p.revenueCents > 0).length;

    return {
      placements,
      totals: {
        totalPlacements: purchases.length,
        activePlacements: activeCount,
        totalSpendCents,
        totalRevenueCents,
        totalOrders,
        totalViews,
        avgRoi: countWithPrice > 0 ? roiSum / countWithPrice : 0,
        avgRevenueLift: countWithBaseline > 0 ? revenueLiftSum / countWithBaseline : 0,
        renewalRate,
      },
    };
  }

  /**
   * Compute metrics for a single placement, including lift over baseline
   */
  private async computePlacementMetrics(p: any): Promise<PlacementMetrics> {
    const activatedAt = p.activated_at ?? p.purchased_at ?? new Date();
    const expiresAt = p.expires_at ?? new Date();
    const baselineStart = new Date(activatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const baselineEnd = activatedAt;

    // Fetch product name
    const productName = await this.getProductName(p.inventory_item_id);

    // Fetch badge_events during placement period
    const placementEvents = await prisma.badge_events.findMany({
      where: {
        tenant_id: p.tenant_id,
        inventory_item_id: p.inventory_item_id,
        badge_key: 'featured',
        created_at: { gte: activatedAt, lte: expiresAt },
      },
      select: { event_type: true, revenue_cents: true },
    });

    // Fetch badge_events during baseline period (7 days before placement)
    const baselineEvents = await prisma.badge_events.findMany({
      where: {
        tenant_id: p.tenant_id,
        inventory_item_id: p.inventory_item_id,
        badge_key: 'featured',
        created_at: { gte: baselineStart, lt: baselineEnd },
      },
      select: { event_type: true, revenue_cents: true },
    });

    // Aggregate placement metrics
    let views = 0, clicks = 0, addToCartCount = 0, orderCount = 0, unitsSold = 0, revenueCents = 0;
    for (const e of placementEvents) {
      switch (e.event_type) {
        case 'view': views++; break;
        case 'click': clicks++; break;
        case 'add_to_cart': addToCartCount++; break;
        case 'order':
          orderCount++;
          unitsSold++;
          revenueCents += e.revenue_cents || 0;
          break;
      }
    }

    // Aggregate baseline metrics
    let baselineViews = 0, baselineClicks = 0, baselineOrderCount = 0, baselineRevenueCents = 0;
    for (const e of baselineEvents) {
      switch (e.event_type) {
        case 'view': baselineViews++; break;
        case 'click': baselineClicks++; break;
        case 'order':
          baselineOrderCount++;
          baselineRevenueCents += e.revenue_cents || 0;
          break;
      }
    }

    // Also get order_items revenue for the product during placement period
    const placementOrderRevenue = await prisma.order_items.aggregate({
      _sum: { total_cents: true },
      where: {
        inventory_item_id: p.inventory_item_id,
        created_at: { gte: activatedAt, lte: expiresAt },
      },
    });
    const attributedRevenueCents = placementOrderRevenue._sum.total_cents || revenueCents;

    const baselineOrderRevenue = await prisma.order_items.aggregate({
      _sum: { total_cents: true },
      where: {
        inventory_item_id: p.inventory_item_id,
        created_at: { gte: baselineStart, lt: baselineEnd },
      },
    });
    const baselineAttributedRevenueCents = baselineOrderRevenue._sum.total_cents || baselineRevenueCents;

    // Calculate lift percentages
    const viewsLift = baselineViews > 0 ? ((views - baselineViews) / baselineViews) * 100 : (views > 0 ? 100 : 0);
    const clicksLift = baselineClicks > 0 ? ((clicks - baselineClicks) / baselineClicks) * 100 : (clicks > 0 ? 100 : 0);
    const ordersLift = baselineOrderCount > 0 ? ((orderCount - baselineOrderCount) / baselineOrderCount) * 100 : (orderCount > 0 ? 100 : 0);
    const revenueLift = baselineAttributedRevenueCents > 0
      ? ((attributedRevenueCents - baselineAttributedRevenueCents) / baselineAttributedRevenueCents) * 100
      : (attributedRevenueCents > 0 ? 100 : 0);

    const ctr = views > 0 ? (clicks / views) * 100 : 0;
    const conversionRate = clicks > 0 ? (orderCount / clicks) * 100 : 0;
    const roi = p.price_cents > 0 ? ((attributedRevenueCents - p.price_cents) / p.price_cents) * 100 : 0;

    return {
      purchaseId: p.id,
      tenantId: p.tenant_id,
      inventoryItemId: p.inventory_item_id,
      planKey: p.plan_key,
      surface: p.surface,
      priceCents: p.price_cents,
      durationDays: p.duration_days,
      status: p.status || 'pending',
      purchasedAt: p.purchased_at?.toISOString() ?? null,
      activatedAt: p.activated_at?.toISOString() ?? null,
      expiresAt: p.expires_at?.toISOString() ?? null,
      productName,
      views,
      clicks,
      ctr,
      addToCartCount,
      orderCount,
      unitsSold,
      revenueCents: attributedRevenueCents,
      conversionRate,
      baselineViews,
      baselineClicks,
      baselineOrderCount,
      baselineRevenueCents: baselineAttributedRevenueCents,
      viewsLift,
      clicksLift,
      ordersLift,
      revenueLift,
      roi,
    };
  }

  /**
   * Get platform-level revenue analytics (admin)
   */
  async getPlatformRevenueAnalytics(
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<PlatformRevenueAnalytics> {
    const where: any = {};
    if (options?.startDate || options?.endDate) {
      where.activated_at = {};
      if (options?.startDate) where.activated_at.gte = options.startDate;
      if (options?.endDate) where.activated_at.lte = options.endDate;
    }

    const purchases = await prisma.featured_placement_purchases.findMany({
      where,
      select: {
        id: true,
        tenant_id: true,
        plan_key: true,
        surface: true,
        price_cents: true,
        status: true,
        activated_at: true,
        renewed_from: true,
        stripe_payment_intent_id: true,
      },
    });

    let totalRevenueCents = 0;
    let activePurchases = 0;
    let trialPurchases = 0;
    let renewedCount = 0;
    let expiredCount = 0;

    const revenueBySurface: Record<string, { revenueCents: number; count: number }> = {};
    const revenueByPlan: Record<string, { revenueCents: number; count: number; label: string }> = {};
    const tenantSpend: Record<string, { totalSpendCents: number; purchaseCount: number }> = {};
    const monthlyMap: Record<string, { revenueCents: number; count: number }> = {};

    for (const p of purchases) {
      // Only count paid purchases (skip pending/trial without payment)
      if (p.status === 'pending') {
        if (!p.stripe_payment_intent_id) {
          trialPurchases++;
        }
        continue;
      }

      totalRevenueCents += p.price_cents;
      if (p.status === 'active') activePurchases++;
      if (p.status === 'expired') expiredCount++;
      if (p.renewed_from) renewedCount++;

      // By surface
      if (!revenueBySurface[p.surface]) {
        revenueBySurface[p.surface] = { revenueCents: 0, count: 0 };
      }
      revenueBySurface[p.surface].revenueCents += p.price_cents;
      revenueBySurface[p.surface].count++;

      // By plan
      if (!revenueByPlan[p.plan_key]) {
        revenueByPlan[p.plan_key] = { revenueCents: 0, count: 0, label: p.plan_key };
      }
      revenueByPlan[p.plan_key].revenueCents += p.price_cents;
      revenueByPlan[p.plan_key].count++;

      // By tenant
      if (!tenantSpend[p.tenant_id]) {
        tenantSpend[p.tenant_id] = { totalSpendCents: 0, purchaseCount: 0 };
      }
      tenantSpend[p.tenant_id].totalSpendCents += p.price_cents;
      tenantSpend[p.tenant_id].purchaseCount++;

      // Monthly revenue
      if (p.activated_at) {
        const monthKey = p.activated_at.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { revenueCents: 0, count: 0 };
        }
        monthlyMap[monthKey].revenueCents += p.price_cents;
        monthlyMap[monthKey].count++;
      }
    }

    // Get tenant names for top spenders
    const tenantIds = Object.keys(tenantSpend);
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantNameMap = new Map(tenants.map(t => [t.id, t.name]));

    const topSpenders = Object.entries(tenantSpend)
      .map(([tenantId, data]) => ({
        tenantId,
        tenantName: tenantNameMap.get(tenantId) || tenantId,
        totalSpendCents: data.totalSpendCents,
        purchaseCount: data.purchaseCount,
      }))
      .sort((a, b) => b.totalSpendCents - a.totalSpendCents)
      .slice(0, 10);

    const monthlyRevenue = Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, revenueCents: data.revenueCents, count: data.count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalPaidPurchases = purchases.filter(p => p.status !== 'pending' || p.stripe_payment_intent_id).length;
    const trialConversionRate = trialPurchases > 0
      ? ((totalPaidPurchases - renewedCount) / trialPurchases) * 100
      : 0;

    const eligibleForRenewal = expiredCount + renewedCount;
    const churnRate = eligibleForRenewal > 0
      ? (expiredCount / eligibleForRenewal) * 100
      : 0;
    const renewalRate = eligibleForRenewal > 0
      ? (renewedCount / eligibleForRenewal) * 100
      : 0;

    return {
      totalRevenueCents,
      totalPurchases: totalPaidPurchases,
      activePurchases,
      trialPurchases,
      trialConversionRate,
      churnRate,
      renewalRate,
      revenueBySurface,
      revenueByPlan,
      topSpenders,
      monthlyRevenue,
    };
  }

  /**
   * Get store-level analytics for a tenant (purchase history, spend, ROI)
   */
  async getStoreAnalytics(tenantId: string): Promise<{
    purchases: Array<{
      purchaseId: string;
      planKey: string;
      surface: string;
      priceCents: number;
      durationDays: number;
      status: string;
      purchasedAt: string | null;
      activatedAt: string | null;
      expiresAt: string | null;
      renewedFrom: string | null;
      productName: string;
    }>;
    spendSummary: {
      totalSpendCents: number;
      spendBySurface: Record<string, number>;
      spendByMonth: Record<string, number>;
    };
    renewalRate: number;
    activeCount: number;
  }> {
    const purchases = await prisma.featured_placement_purchases.findMany({
      where: { tenant_id: tenantId },
      orderBy: { purchased_at: 'desc' },
    });

    const itemIds = [...new Set(purchases.map(p => p.inventory_item_id))];
    const items = await prisma.inventory_items.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true },
    });
    const itemNameMap = new Map(items.map(i => [i.id, i.name]));

    let totalSpendCents = 0;
    const spendBySurface: Record<string, number> = {};
    const spendByMonth: Record<string, number> = {};
    let renewedCount = 0;
    let expiredCount = 0;
    let activeCount = 0;

    const purchaseRows = purchases.map(p => {
      if (p.status === 'active') activeCount++;
      if (p.status === 'expired') expiredCount++;
      if (p.renewed_from) renewedCount++;

      totalSpendCents += p.price_cents;

      spendBySurface[p.surface] = (spendBySurface[p.surface] || 0) + p.price_cents;

      if (p.activated_at) {
        const monthKey = p.activated_at.toISOString().slice(0, 7);
        spendByMonth[monthKey] = (spendByMonth[monthKey] || 0) + p.price_cents;
      }

      return {
        purchaseId: p.id,
        planKey: p.plan_key,
        surface: p.surface,
        priceCents: p.price_cents,
        durationDays: p.duration_days,
        status: p.status || 'pending',
        purchasedAt: p.purchased_at?.toISOString() ?? null,
        activatedAt: p.activated_at?.toISOString() ?? null,
        expiresAt: p.expires_at?.toISOString() ?? null,
        renewedFrom: p.renewed_from,
        productName: itemNameMap.get(p.inventory_item_id) || 'Unknown product',
      };
    });

    const eligibleForRenewal = expiredCount + renewedCount;
    const renewalRate = eligibleForRenewal > 0 ? (renewedCount / eligibleForRenewal) * 100 : 0;

    return {
      purchases: purchaseRows,
      spendSummary: {
        totalSpendCents,
        spendBySurface,
        spendByMonth,
      },
      renewalRate,
      activeCount,
    };
  }

  private async getProductName(inventoryItemId: string): Promise<string> {
    try {
      const item = await prisma.inventory_items.findUnique({
        where: { id: inventoryItemId },
        select: { name: true },
      });
      return item?.name || 'Unknown product';
    } catch {
      return 'Unknown product';
    }
  }
}

export default FeaturedPlacementAnalyticsService.getInstance();
