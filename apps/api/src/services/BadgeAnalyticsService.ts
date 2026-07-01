/**
 * Badge Analytics Service
 *
 * Phase 4: Badge Analytics
 *
 * Provides:
 * - Event tracking (view, click, add_to_cart, order) via badge_events table
 * - Aggregate metrics computation per tenant, per badge, per period
 * - Badge ROI comparison (badged vs unbadged products)
 * - Dashboard data for merchant analytics UI
 *
 * The aggregate job runs periodically to compute metrics from
 * badge_events + order_items and store them in badge_analytics.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateBadgeAnalyticsId, generateBadgeEventId } from '../lib/id-generator';

// ====================
// TYPES
// ====================

export type BadgeEventType = 'view' | 'click' | 'add_to_cart' | 'order';
export type PeriodType = 'day' | 'week' | 'month';

export interface BadgeEventInput {
  tenantId: string;
  badgeKey: string;
  inventoryItemId: string;
  eventType: BadgeEventType;
  sessionId?: string;
  orderId?: string;
  revenueCents?: number;
}

export interface BadgeAnalyticsRow {
  id: string;
  tenantId: string;
  badgeKey: string;
  periodStart: Date;
  periodEnd: Date;
  periodType: PeriodType;
  productCount: number;
  totalViews: number;
  totalClicks: number;
  addToCartCount: number;
  orderCount: number;
  unitsSold: number;
  revenueCents: number;
  ctr: number;
  conversionRate: number;
  avgOrderValueCents: number;
  unbadgedProductCount: number;
  unbadgedOrderCount: number;
  unbadgedRevenueCents: number;
  unbadgedUnitsSold: number;
  revenueLift: number;
}

export interface BadgeAnalyticsSummary {
  badgeKey: string;
  badgeLabel: string;
  badgeColor: string | null;
  badgeIcon: string | null;
  totalViews: number;
  totalClicks: number;
  addToCartCount: number;
  orderCount: number;
  unitsSold: number;
  revenueCents: number;
  ctr: number;
  conversionRate: number;
  avgOrderValueCents: number;
  revenueLift: number;
  productCount: number;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface BadgeAnalyticsDashboard {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  badges: BadgeAnalyticsSummary[];
  totals: {
    totalViews: number;
    totalClicks: number;
    addToCartCount: number;
    orderCount: number;
    unitsSold: number;
    revenueCents: number;
    activeBadgeCount: number;
  };
}

// ====================
// EVENT TRACKING
// ====================

/**
 * Record a badge event (view, click, add_to_cart, order).
 */
export async function trackBadgeEvent(input: BadgeEventInput): Promise<void> {
  try {
    await prisma.badge_events.create({
      data: {
        id: generateBadgeEventId(input.tenantId),
        tenant_id: input.tenantId,
        badge_key: input.badgeKey,
        inventory_item_id: input.inventoryItemId,
        event_type: input.eventType,
        session_id: input.sessionId || null,
        order_id: input.orderId || null,
        revenue_cents: input.revenueCents || 0,
      },
    });
  } catch (error) {
    logger.warn('Failed to track badge event', undefined, {
      tenantId: input.tenantId,
      badgeKey: input.badgeKey,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Batch track multiple badge events.
 */
export async function trackBadgeEvents(inputs: BadgeEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.badge_events.createMany({
      data: inputs.map(input => ({
        id: generateBadgeEventId(input.tenantId),
        tenant_id: input.tenantId,
        badge_key: input.badgeKey,
        inventory_item_id: input.inventoryItemId,
        event_type: input.eventType,
        session_id: input.sessionId || null,
        order_id: input.orderId || null,
        revenue_cents: input.revenueCents || 0,
      })),
    });
  } catch (error) {
    logger.warn('Failed to batch track badge events', undefined, {
      count: inputs.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ====================
// AGGREGATION
// ====================

/**
 * Compute date range for a period type.
 */
function getPeriodRange(periodType: PeriodType, daysBack: number = 30): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  if (periodType === 'day') {
    start.setDate(start.getDate() - daysBack);
  } else if (periodType === 'week') {
    start.setDate(start.getDate() - daysBack * 7);
  } else {
    start.setMonth(start.getMonth() - Math.ceil(daysBack / 30));
  }
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * Run aggregation for a single tenant.
 * Computes badge_analytics rows from badge_events + order_items.
 */
export async function aggregateBadgeAnalyticsForTenant(
  tenantId: string,
  periodType: PeriodType = 'day'
): Promise<{ rowsComputed: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsComputed = 0;

  try {
    const { start, end } = getPeriodRange(periodType, 30);

    // Get all active badges for this tenant
    const badges = await prisma.$queryRaw`
      SELECT DISTINCT fp.featured_type AS badge_key
      FROM featured_products fp
      WHERE fp.tenant_id = ${tenantId}
        AND fp.is_active = true
        AND fp.featured_at IS NOT NULL
        AND fp.featured_at >= ${start}
    ` as { badge_key: string }[];

    if (badges.length === 0) {
      return { rowsComputed: 0, errors };
    }

    // Aggregate events per badge per day
    const eventAgg = await prisma.$queryRaw`
      SELECT
        badge_key,
        DATE_TRUNC(${periodType}, created_at)::date AS period_start,
        COUNT(*) FILTER (WHERE event_type = 'view') AS total_views,
        COUNT(*) FILTER (WHERE event_type = 'click') AS total_clicks,
        COUNT(*) FILTER (WHERE event_type = 'add_to_cart') AS add_to_cart_count,
        COUNT(*) FILTER (WHERE event_type = 'order') AS order_count,
        COALESCE(SUM(revenue_cents), 0) AS revenue_cents
      FROM badge_events
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY badge_key, period_start
    ` as any[];

    // Get order data from order_items joined with featured_products
    const orderAgg = await prisma.$queryRaw`
      SELECT
        fp.featured_type AS badge_key,
        DATE_TRUNC(${periodType}, oi.created_at)::date AS period_start,
        COUNT(DISTINCT oi.order_id) AS order_count,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.total_cents) AS revenue_cents
      FROM order_items oi
      INNER JOIN featured_products fp
        ON fp.inventory_item_id = oi.inventory_item_id
        AND fp.tenant_id = ${tenantId}
        AND fp.is_active = true
      WHERE oi.created_at >= ${start}
        AND oi.created_at <= ${end}
      GROUP BY fp.featured_type, period_start
    ` as any[];

    // Get unbadged product metrics for comparison
    const unbadgedAgg = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC(${periodType}, oi.created_at)::date AS period_start,
        COUNT(DISTINCT oi.order_id) AS order_count,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.total_cents) AS revenue_cents
      FROM order_items oi
      WHERE oi.order_id IN (
        SELECT o.id FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.created_at >= ${start}
          AND o.created_at <= ${end}
      )
      AND oi.inventory_item_id NOT IN (
        SELECT inventory_item_id FROM featured_products
        WHERE tenant_id = ${tenantId} AND is_active = true
      )
      GROUP BY period_start
    ` as any[];

    // Get product counts per badge per period
    const productCounts = await prisma.$queryRaw`
      SELECT
        featured_type AS badge_key,
        DATE_TRUNC(${periodType}, featured_at)::date AS period_start,
        COUNT(DISTINCT inventory_item_id) AS product_count
      FROM featured_products
      WHERE tenant_id = ${tenantId}
        AND is_active = true
        AND featured_at >= ${start}
        AND featured_at <= ${end}
      GROUP BY featured_type, period_start
    ` as any[];

    // Build unbadged lookup
    const unbadgedMap = new Map<string, { orderCount: number; unitsSold: number; revenueCents: number }>();
    for (const u of unbadgedAgg) {
      const key = String(u.period_start);
      unbadgedMap.set(key, {
        orderCount: Number(u.order_count) || 0,
        unitsSold: Number(u.units_sold) || 0,
        revenueCents: Number(u.revenue_cents) || 0,
      });
    }

    // Build product count lookup
    const productCountMap = new Map<string, number>();
    for (const pc of productCounts) {
      productCountMap.set(`${pc.badge_key}:${pc.period_start}`, Number(pc.product_count) || 0);
    }

    // Build order aggregation lookup
    const orderAggMap = new Map<string, { orderCount: number; unitsSold: number; revenueCents: number }>();
    for (const oa of orderAgg) {
      const key = `${oa.badge_key}:${oa.period_start}`;
      orderAggMap.set(key, {
        orderCount: Number(oa.order_count) || 0,
        unitsSold: Number(oa.units_sold) || 0,
        revenueCents: Number(oa.revenue_cents) || 0,
      });
    }

    // Merge event + order data and upsert
    for (const ev of eventAgg) {
      const badgeKey = ev.badge_key;
      const periodStart = ev.period_start;
      const periodStartDate = new Date(periodStart);

      const periodEndDate = new Date(periodStartDate);
      if (periodType === 'day') periodEndDate.setDate(periodEndDate.getDate() + 1);
      else if (periodType === 'week') periodEndDate.setDate(periodEndDate.getDate() + 7);
      else periodEndDate.setMonth(periodEndDate.getMonth() + 1);

      const totalViews = Number(ev.total_views) || 0;
      const totalClicks = Number(ev.total_clicks) || 0;
      const addToCartCount = Number(ev.add_to_cart_count) || 0;

      const orderData = orderAggMap.get(`${badgeKey}:${periodStart}`) || {
        orderCount: 0,
        unitsSold: 0,
        revenueCents: 0,
      };

      const orderCount = Math.max(Number(ev.order_count) || 0, orderData.orderCount);
      const unitsSold = orderData.unitsSold;
      const revenueCents = Math.max(Number(ev.revenue_cents) || 0, orderData.revenueCents);

      const ctr = totalViews > 0 ? totalClicks / totalViews : 0;
      const conversionRate = totalClicks > 0 ? orderCount / totalClicks : 0;
      const avgOrderValue = orderCount > 0 ? Math.floor(revenueCents / orderCount) : 0;

      const productCount = productCountMap.get(`${badgeKey}:${periodStart}`) || 0;

      // Unbadged comparison
      const unbadged = unbadgedMap.get(String(periodStart)) || {
        orderCount: 0,
        unitsSold: 0,
        revenueCents: 0,
      };

      // Revenue lift: (badged_revenue_per_product - unbadged_revenue_per_product) / unbadged_revenue_per_product
      const badgedRevPerProduct = productCount > 0 ? revenueCents / productCount : 0;
      const unbadgedProductCount = await getUnbadgedProductCount(tenantId);
      const unbadgedRevPerProduct = unbadgedProductCount > 0 ? unbadged.revenueCents / unbadgedProductCount : 0;
      const revenueLift = unbadgedRevPerProduct > 0
        ? (badgedRevPerProduct - unbadgedRevPerProduct) / unbadgedRevPerProduct
        : 0;

      try {
        await prisma.badge_analytics.upsert({
          where: {
            tenant_id_badge_key_period_start_period_type: {
              tenant_id: tenantId,
              badge_key: badgeKey,
              period_start: periodStartDate,
              period_type: periodType,
            },
          },
          create: {
            id: generateBadgeAnalyticsId(tenantId),
            tenant_id: tenantId,
            badge_key: badgeKey,
            period_start: periodStartDate,
            period_end: periodEndDate,
            period_type: periodType,
            product_count: productCount,
            total_views: totalViews,
            total_clicks: totalClicks,
            add_to_cart_count: addToCartCount,
            order_count: orderCount,
            units_sold: unitsSold,
            revenue_cents: BigInt(revenueCents),
            ctr: ctr,
            conversion_rate: conversionRate,
            avg_order_value_cents: BigInt(avgOrderValue),
            unbadged_product_count: unbadgedProductCount,
            unbadged_order_count: unbadged.orderCount,
            unbadged_revenue_cents: BigInt(unbadged.revenueCents),
            unbadged_units_sold: unbadged.unitsSold,
            revenue_lift: revenueLift,
          },
          update: {
            product_count: productCount,
            total_views: totalViews,
            total_clicks: totalClicks,
            add_to_cart_count: addToCartCount,
            order_count: orderCount,
            units_sold: unitsSold,
            revenue_cents: BigInt(revenueCents),
            ctr: ctr,
            conversion_rate: conversionRate,
            avg_order_value_cents: BigInt(avgOrderValue),
            unbadged_product_count: unbadgedProductCount,
            unbadged_order_count: unbadged.orderCount,
            unbadged_revenue_cents: BigInt(unbadged.revenueCents),
            unbadged_units_sold: unbadged.unitsSold,
            revenue_lift: revenueLift,
          },
        });
        rowsComputed++;
      } catch (err: any) {
        errors.push(`Upsert ${badgeKey}/${periodStart}: ${err.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Fatal: ${error.message}`);
    logger.error('Badge analytics aggregation failed', undefined, {
      tenantId,
      error: error.message,
    });
  }

  return { rowsComputed, errors };
}

/**
 * Get count of unbadged active products for a tenant.
 */
async function getUnbadgedProductCount(tenantId: string): Promise<number> {
  try {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*) AS cnt
      FROM inventory_items ii
      WHERE ii.tenant_id = ${tenantId}
        AND ii.item_status = 'active'
        AND ii.id NOT IN (
          SELECT inventory_item_id FROM featured_products
          WHERE tenant_id = ${tenantId} AND is_active = true
        )
    ` as { cnt: bigint }[];
    return Number(result[0]?.cnt) || 0;
  } catch {
    return 0;
  }
}

// ====================
// DASHBOARD QUERIES
// ====================

/**
 * Get badge analytics dashboard for a tenant.
 * Returns aggregated metrics per badge for the given period.
 */
export async function getBadgeAnalyticsDashboard(
  tenantId: string,
  periodType: PeriodType = 'day',
  daysBack: number = 30
): Promise<BadgeAnalyticsDashboard> {
  const { start, end } = getPeriodRange(periodType, daysBack);

  // Fetch aggregated rows
  const rows = await prisma.badge_analytics.findMany({
    where: {
      tenant_id: tenantId,
      period_type: periodType,
      period_start: { gte: start, lte: end },
    },
    orderBy: { period_start: 'desc' },
  });

  // Fetch badge metadata from registry
  const badgeMeta = await prisma.$queryRaw`
    SELECT key, label, color, icon
    FROM featured_type_registry
    WHERE (tenant_id = ${tenantId} OR tenant_id IS NULL)
      AND is_active = true
      AND key IN (
        SELECT DISTINCT badge_key FROM badge_analytics
        WHERE tenant_id = ${tenantId}
          AND period_type = ${periodType}
          AND period_start >= ${start}
      )
  ` as { key: string; label: string; color: string | null; icon: string | null }[];

  const badgeMetaMap = new Map<string, { label: string; color: string | null; icon: string | null }>();
  for (const bm of badgeMeta) {
    badgeMetaMap.set(bm.key, { label: bm.label, color: bm.color, icon: bm.icon });
  }

  // Aggregate per badge across the period
  const badgeMap = new Map<string, {
    totalViews: number;
    totalClicks: number;
    addToCartCount: number;
    orderCount: number;
    unitsSold: number;
    revenueCents: number;
    productCount: number;
    revenueLift: number;
    periodCount: number;
    recentRevenue: number;
    olderRevenue: number;
  }>();

  const sortedRows = [...rows].sort((a, b) => a.period_start.getTime() - b.period_start.getTime());
  const midpointIdx = Math.floor(sortedRows.length / 2);

  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const existing = badgeMap.get(row.badge_key) || {
      totalViews: 0,
      totalClicks: 0,
      addToCartCount: 0,
      orderCount: 0,
      unitsSold: 0,
      revenueCents: 0,
      productCount: 0,
      revenueLift: 0,
      periodCount: 0,
      recentRevenue: 0,
      olderRevenue: 0,
    };

    const revenue = Number(row.revenue_cents);
    existing.totalViews += row.total_views;
    existing.totalClicks += row.total_clicks;
    existing.addToCartCount += row.add_to_cart_count;
    existing.orderCount += row.order_count;
    existing.unitsSold += row.units_sold;
    existing.revenueCents += revenue;
    existing.productCount = Math.max(existing.productCount, row.product_count);
    existing.revenueLift = Number(row.revenue_lift);
    existing.periodCount++;

    if (i >= midpointIdx) {
      existing.recentRevenue += revenue;
    } else {
      existing.olderRevenue += revenue;
    }

    badgeMap.set(row.badge_key, existing);
  }

  // Build summary per badge
  const badges: BadgeAnalyticsSummary[] = [];
  for (const [badgeKey, agg] of badgeMap) {
    const meta = badgeMetaMap.get(badgeKey);
    const ctr = agg.totalViews > 0 ? agg.totalClicks / agg.totalViews : 0;
    const conversionRate = agg.totalClicks > 0 ? agg.orderCount / agg.totalClicks : 0;
    const avgOrderValue = agg.orderCount > 0 ? Math.floor(agg.revenueCents / agg.orderCount) : 0;

    // Trend: compare recent vs older revenue
    let trend: 'up' | 'down' | 'flat' = 'flat';
    let trendPercent = 0;
    if (agg.olderRevenue > 0) {
      trendPercent = ((agg.recentRevenue - agg.olderRevenue) / agg.olderRevenue) * 100;
      if (trendPercent > 5) trend = 'up';
      else if (trendPercent < -5) trend = 'down';
    } else if (agg.recentRevenue > 0) {
      trend = 'up';
      trendPercent = 100;
    }

    badges.push({
      badgeKey,
      badgeLabel: meta?.label || badgeKey,
      badgeColor: meta?.color || null,
      badgeIcon: meta?.icon || null,
      totalViews: agg.totalViews,
      totalClicks: agg.totalClicks,
      addToCartCount: agg.addToCartCount,
      orderCount: agg.orderCount,
      unitsSold: agg.unitsSold,
      revenueCents: agg.revenueCents,
      ctr,
      conversionRate,
      avgOrderValueCents: avgOrderValue,
      revenueLift: agg.revenueLift,
      productCount: agg.productCount,
      trend,
      trendPercent,
    });
  }

  // Sort by revenue descending
  badges.sort((a, b) => b.revenueCents - a.revenueCents);

  // Compute totals
  const totals = {
    totalViews: badges.reduce((s, b) => s + b.totalViews, 0),
    totalClicks: badges.reduce((s, b) => s + b.totalClicks, 0),
    addToCartCount: badges.reduce((s, b) => s + b.addToCartCount, 0),
    orderCount: badges.reduce((s, b) => s + b.orderCount, 0),
    unitsSold: badges.reduce((s, b) => s + b.unitsSold, 0),
    revenueCents: badges.reduce((s, b) => s + b.revenueCents, 0),
    activeBadgeCount: badges.length,
  };

  return {
    period: periodType,
    startDate: start,
    endDate: end,
    badges,
    totals,
  };
}

/**
 * Get time-series data for a specific badge (for charting).
 */
export async function getBadgeTimeSeries(
  tenantId: string,
  badgeKey: string,
  periodType: PeriodType = 'day',
  daysBack: number = 30
): Promise<Array<{
  periodStart: Date;
  views: number;
  clicks: number;
  orders: number;
  revenueCents: number;
  ctr: number;
}>> {
  const { start, end } = getPeriodRange(periodType, daysBack);

  const rows = await prisma.badge_analytics.findMany({
    where: {
      tenant_id: tenantId,
      badge_key: badgeKey,
      period_type: periodType,
      period_start: { gte: start, lte: end },
    },
    orderBy: { period_start: 'asc' },
  });

  return rows.map(row => ({
    periodStart: row.period_start,
    views: row.total_views,
    clicks: row.total_clicks,
    orders: row.order_count,
    revenueCents: Number(row.revenue_cents),
    ctr: Number(row.ctr),
  }));
}

/**
 * Get badge ROI comparison report.
 * Returns per-badge incremental revenue vs unbadged products.
 */
export async function getBadgeROIReport(
  tenantId: string,
  periodType: PeriodType = 'day',
  daysBack: number = 30
): Promise<Array<{
  badgeKey: string;
  badgeLabel: string;
  badgedRevenueCents: number;
  unbadgedRevenueCents: number;
  revenueLift: number;
  incrementalRevenueCents: number;
}>> {
  const dashboard = await getBadgeAnalyticsDashboard(tenantId, periodType, daysBack);

  return dashboard.badges.map(b => {
    const incrementalRevenue = Math.floor(b.revenueCents * b.revenueLift);
    return {
      badgeKey: b.badgeKey,
      badgeLabel: b.badgeLabel,
      badgedRevenueCents: b.revenueCents,
      unbadgedRevenueCents: Math.floor(b.revenueCents / (1 + b.revenueLift)),
      revenueLift: b.revenueLift,
      incrementalRevenueCents: incrementalRevenue,
    };
  });
}
