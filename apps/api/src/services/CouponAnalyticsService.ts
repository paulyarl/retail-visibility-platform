/**
 * Coupon Analytics Service
 *
 * Provides:
 * - Event tracking (view, copy, click, validate, redeem, fail) via coupon_events table
 * - Aggregate metrics computation per tenant, per coupon, per period
 * - Dashboard data for merchant analytics UI
 * - Funnel report (view → click → validate → redeem)
 * - ROI report (discount given vs revenue influenced)
 * - Admin cross-tenant analytics
 *
 * The aggregate job runs periodically to compute metrics from
 * coupon_events and store them in coupon_analytics.
 *
 * Pattern: mirrors BadgeAnalyticsService.ts
 * Design doc: docs/MERCHANT_COUPON_SPRINT_PLAN.md (Sprint 2)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateCouponEventId, generateCouponAnalyticsId } from '../lib/id-generator';

// ====================
// TYPES
// ====================

export type CouponEventType = 'view' | 'copy' | 'click' | 'validate' | 'redeem' | 'fail';
export type PeriodType = 'day' | 'week' | 'month';
export type CouponSurface = 'storefront' | 'directory' | 'email' | 'social' | 'qr' | 'direct' | 'checkout';
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export interface CouponEventInput {
  tenantId: string;
  couponId?: string;
  couponCode?: string;
  eventType: CouponEventType;
  surface?: CouponSurface;
  sessionId?: string;
  orderId?: string;
  discountCents?: number;
  source?: string;
  referrer?: string;
  userAgent?: string;
  geoCountry?: string;
  geoCity?: string;
  deviceType?: DeviceType;
}

export interface CouponAnalyticsDashboard {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  summary: {
    totalEvents: number;
    totalViews: number;
    totalClicks: number;
    totalValidates: number;
    totalRedemptions: number;
    totalFailures: number;
    uniqueVisitors: number;
    activeCoupons: number;
    totalDiscountCents: number;
    conversionRate: number;
  };
  coupons: CouponAnalyticsSummary[];
}

export interface CouponAnalyticsSummary {
  couponId: string;
  couponCode: string;
  discountType: string;
  discountValue: number;
  totalEvents: number;
  views: number;
  clicks: number;
  copies: number;
  validates: number;
  redemptions: number;
  failures: number;
  uniqueVisitors: number;
  conversionRate: number;
  discountCents: number;
  isActive: boolean;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface CouponFunnelReport {
  views: number;
  clicks: number;
  validates: number;
  redemptions: number;
  failures: number;
  viewToClickRate: number;
  clickToValidateRate: number;
  validateToRedeemRate: number;
  overallConversionRate: number;
}

export interface CouponROIReport {
  totalDiscountCents: number;
  totalRevenueInfluencedCents: number;
  roi: number;
  couponsCount: number;
  avgDiscountPerRedemption: number;
  topCoupons: Array<{
    couponId: string;
    couponCode: string;
    discountCents: number;
    redemptions: number;
    revenueInfluencedCents: number;
    roi: number;
  }>;
}

export interface CouponTimeSeriesPoint {
  date: string;
  views: number;
  clicks: number;
  validates: number;
  redemptions: number;
  failures: number;
}

// ====================
// EVENT TRACKING
// ====================

export async function trackCouponEvent(input: CouponEventInput): Promise<void> {
  try {
    await prisma.coupon_events.create({
      data: {
        id: generateCouponEventId(input.tenantId),
        tenant_id: input.tenantId,
        coupon_id: input.couponId || null,
        coupon_code: input.couponCode || null,
        event_type: input.eventType,
        surface: input.surface || null,
        session_id: input.sessionId || null,
        order_id: input.orderId || null,
        discount_cents: BigInt(input.discountCents || 0),
        source: input.source || 'coupon',
        referrer: input.referrer || null,
        user_agent: input.userAgent || null,
        geo_country: input.geoCountry || null,
        geo_city: input.geoCity || null,
        device_type: input.deviceType || null,
      },
    });
  } catch (error) {
    logger.warn('Failed to track coupon event', undefined, {
      tenantId: input.tenantId,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function trackCouponEvents(inputs: CouponEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.coupon_events.createMany({
      data: inputs.map(input => ({
        id: generateCouponEventId(input.tenantId),
        tenant_id: input.tenantId,
        coupon_id: input.couponId || null,
        coupon_code: input.couponCode || null,
        event_type: input.eventType,
        surface: input.surface || null,
        session_id: input.sessionId || null,
        order_id: input.orderId || null,
        discount_cents: BigInt(input.discountCents || 0),
        source: input.source || 'coupon',
        referrer: input.referrer || null,
        user_agent: input.userAgent || null,
        geo_country: input.geoCountry || null,
        geo_city: input.geoCity || null,
        device_type: input.deviceType || null,
      })),
    });
  } catch (error) {
    logger.warn('Failed to batch track coupon events', undefined, {
      count: inputs.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ====================
// AGGREGATION
// ====================

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

export async function aggregateCouponAnalyticsForTenant(
  tenantId: string,
  periodType: PeriodType = 'day'
): Promise<{ rowsComputed: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsComputed = 0;

  try {
    const { start, end } = getPeriodRange(periodType, 30);

    // Aggregate events per coupon per period
    const eventAgg = await prisma.$queryRaw`
      SELECT
        COALESCE(coupon_id, '') AS coupon_id,
        COALESCE(coupon_code, '') AS coupon_code,
        COALESCE(surface, 'unknown') AS surface,
        DATE_TRUNC(${periodType}, created_at)::date AS period_start,
        COUNT(*) AS total_events,
        COUNT(DISTINCT session_id) AS unique_visitors,
        COUNT(*) FILTER (WHERE event_type = 'view') AS views,
        COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
        COUNT(*) FILTER (WHERE event_type = 'copy') AS copies,
        COUNT(*) FILTER (WHERE event_type = 'validate') AS validates,
        COUNT(*) FILTER (WHERE event_type = 'redeem') AS redemptions,
        COUNT(*) FILTER (WHERE event_type = 'fail') AS failures,
        COALESCE(SUM(discount_cents), 0) AS discount_cents
      FROM coupon_events
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY coupon_id, coupon_code, surface, period_start
    ` as any[];

    for (const row of eventAgg) {
      const periodStart = new Date(row.period_start);
      const periodEnd = new Date(periodStart);
      if (periodType === 'day') periodEnd.setDate(periodEnd.getDate() + 1);
      else if (periodType === 'week') periodEnd.setDate(periodEnd.getDate() + 7);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const totalEvents = Number(row.total_events);
      const redemptions = Number(row.redemptions);
      const conversionCount = redemptions;
      const conversionRate = totalEvents > 0 ? Number((conversionCount / totalEvents * 10000).toFixed(0)) : 0;
      const uniqueCoupons = row.coupon_id ? 1 : 0;

      try {
        await prisma.coupon_analytics.upsert({
          where: {
            tenant_id_coupon_id_event_type_surface_period_start_period_type: {
              tenant_id: tenantId,
              coupon_id: row.coupon_id || null,
              event_type: 'view',
              surface: row.surface,
              period_start: periodStart,
              period_type: periodType,
            },
          },
          create: {
            id: generateCouponAnalyticsId(tenantId),
            tenant_id: tenantId,
            coupon_id: row.coupon_id || null,
            event_type: 'view',
            surface: row.surface,
            period_start: periodStart,
            period_end: periodEnd,
            period_type: periodType,
            total_events: totalEvents,
            unique_visitors: Number(row.unique_visitors),
            unique_coupons: uniqueCoupons,
            conversion_count: conversionCount,
            conversion_rate: conversionRate,
            discount_cents: BigInt(row.discount_cents),
            revenue_cents: BigInt(0),
            avg_discount_per_redeem: redemptions > 0 ? BigInt(Math.floor(Number(row.discount_cents) / redemptions)) : BigInt(0),
          },
          update: {
            total_events: totalEvents,
            unique_visitors: Number(row.unique_visitors),
            unique_coupons: uniqueCoupons,
            conversion_count: conversionCount,
            conversion_rate: conversionRate,
            discount_cents: BigInt(row.discount_cents),
            avg_discount_per_redeem: redemptions > 0 ? BigInt(Math.floor(Number(row.discount_cents) / redemptions)) : BigInt(0),
          },
        });
        rowsComputed++;
      } catch (err) {
        errors.push(`Failed to upsert analytics row: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info('[CouponAnalytics] Aggregation complete', undefined, {
      tenantId,
      periodType,
      rowsComputed,
      errors: errors.length,
    });
  } catch (error) {
    errors.push(`Aggregation failed: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('[CouponAnalytics] Aggregation error', undefined, {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { rowsComputed, errors };
}

// ====================
// DASHBOARD
// ====================

export async function getCouponAnalyticsDashboard(
  tenantId: string,
  opts: { period?: PeriodType; daysBack?: number; couponId?: string } = {}
): Promise<CouponAnalyticsDashboard> {
  const period = opts.period || 'day';
  const daysBack = opts.daysBack || 30;
  const { start, end } = getPeriodRange(period, daysBack);

  // Fetch aggregated event counts
  const events = await prisma.coupon_events.findMany({
    where: {
      tenant_id: tenantId,
      created_at: { gte: start, lte: end },
      ...(opts.couponId ? { coupon_id: opts.couponId } : {}),
    },
    select: {
      event_type: true,
      session_id: true,
      discount_cents: true,
      coupon_id: true,
      coupon_code: true,
    },
  });

  const totalEvents = events.length;
  const totalViews = events.filter(e => e.event_type === 'view').length;
  const totalClicks = events.filter(e => e.event_type === 'click').length;
  const totalValidates = events.filter(e => e.event_type === 'validate').length;
  const totalRedemptions = events.filter(e => e.event_type === 'redeem').length;
  const totalFailures = events.filter(e => e.event_type === 'fail').length;
  const uniqueVisitors = new Set(events.map(e => e.session_id).filter(Boolean)).size;
  const activeCoupons = new Set(events.map(e => e.coupon_id).filter(Boolean)).size;
  const totalDiscountCents = events.reduce((sum, e) => sum + Number(e.discount_cents), 0);
  const conversionRate = totalEvents > 0 ? Number(((totalRedemptions / totalEvents) * 100).toFixed(2)) : 0;

  // Per-coupon breakdown
  const couponMap = new Map<string, {
    couponId: string;
    couponCode: string;
    views: number;
    clicks: number;
    copies: number;
    validates: number;
    redemptions: number;
    failures: number;
    uniqueVisitors: Set<string>;
    discountCents: number;
  }>();

  for (const e of events) {
    const key = e.coupon_id || e.coupon_code || 'unknown';
    if (!couponMap.has(key)) {
      couponMap.set(key, {
        couponId: e.coupon_id || '',
        couponCode: e.coupon_code || '',
        views: 0, clicks: 0, copies: 0, validates: 0, redemptions: 0, failures: 0,
        uniqueVisitors: new Set(),
        discountCents: 0,
      });
    }
    const entry = couponMap.get(key)!;
    if (e.event_type === 'view') entry.views++;
    if (e.event_type === 'click') entry.clicks++;
    if (e.event_type === 'copy') entry.copies++;
    if (e.event_type === 'validate') entry.validates++;
    if (e.event_type === 'redeem') entry.redemptions++;
    if (e.event_type === 'fail') entry.failures++;
    if (e.session_id) entry.uniqueVisitors.add(e.session_id);
    entry.discountCents += Number(e.discount_cents);
  }

  // Fetch coupon details for enrichment
  const couponIds = [...couponMap.keys()].filter(k => k !== 'unknown');
  const couponDetails = couponIds.length > 0
    ? await prisma.tenant_coupons.findMany({
        where: { id: { in: couponIds }, tenant_id: tenantId },
        select: { id: true, code: true, discount_type: true, discount_value: true, is_active: true },
      })
    : [];
  const detailMap = new Map(couponDetails.map(c => [c.id, c]));

  const coupons: CouponAnalyticsSummary[] = [...couponMap.entries()].map(([key, entry]) => {
    const detail = detailMap.get(entry.couponId);
    const totalCouponEvents = entry.views + entry.clicks + entry.copies + entry.validates + entry.redemptions + entry.failures;
    const couponConversionRate = totalCouponEvents > 0 ? Number(((entry.redemptions / totalCouponEvents) * 100).toFixed(2)) : 0;
    return {
      couponId: entry.couponId,
      couponCode: entry.couponCode || detail?.code || '',
      discountType: detail?.discount_type || 'unknown',
      discountValue: detail?.discount_value || 0,
      totalEvents: totalCouponEvents,
      views: entry.views,
      clicks: entry.clicks,
      copies: entry.copies,
      validates: entry.validates,
      redemptions: entry.redemptions,
      failures: entry.failures,
      uniqueVisitors: entry.uniqueVisitors.size,
      conversionRate: couponConversionRate,
      discountCents: entry.discountCents,
      isActive: detail?.is_active ?? false,
      trend: 'flat' as const,
      trendPercent: 0,
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);

  return {
    period,
    startDate: start,
    endDate: end,
    summary: {
      totalEvents,
      totalViews,
      totalClicks,
      totalValidates,
      totalRedemptions,
      totalFailures,
      uniqueVisitors,
      activeCoupons,
      totalDiscountCents,
      conversionRate,
    },
    coupons,
  };
}

// ====================
// TIME SERIES
// ====================

export async function getCouponTimeSeries(
  tenantId: string,
  opts: { period?: PeriodType; daysBack?: number; couponId?: string } = {}
): Promise<CouponTimeSeriesPoint[]> {
  const period = opts.period || 'day';
  const daysBack = opts.daysBack || 30;
  const { start, end } = getPeriodRange(period, daysBack);

  const rows = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC(${period}, created_at)::date AS date,
      COUNT(*) FILTER (WHERE event_type = 'view') AS views,
      COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
      COUNT(*) FILTER (WHERE event_type = 'validate') AS validates,
      COUNT(*) FILTER (WHERE event_type = 'redeem') AS redemptions,
      COUNT(*) FILTER (WHERE event_type = 'fail') AS failures
    FROM coupon_events
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${start}
      AND created_at <= ${end}
      ${opts.couponId ? prisma.$queryRaw`AND coupon_id = ${opts.couponId}` : prisma.$queryRaw``}
    GROUP BY date
    ORDER BY date ASC
  ` as any[];

  return rows.map(r => ({
    date: new Date(r.date).toISOString().split('T')[0],
    views: Number(r.views),
    clicks: Number(r.clicks),
    validates: Number(r.validates),
    redemptions: Number(r.redemptions),
    failures: Number(r.failures),
  }));
}

// ====================
// FUNNEL REPORT
// ====================

export async function getCouponFunnelReport(
  tenantId: string,
  opts: { daysBack?: number; couponId?: string } = {}
): Promise<CouponFunnelReport> {
  const daysBack = opts.daysBack || 30;
  const { start, end } = getPeriodRange('day', daysBack);

  const events = await prisma.coupon_events.findMany({
    where: {
      tenant_id: tenantId,
      created_at: { gte: start, lte: end },
      ...(opts.couponId ? { coupon_id: opts.couponId } : {}),
    },
    select: { event_type: true },
  });

  const views = events.filter(e => e.event_type === 'view').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  const validates = events.filter(e => e.event_type === 'validate').length;
  const redemptions = events.filter(e => e.event_type === 'redeem').length;
  const failures = events.filter(e => e.event_type === 'fail').length;

  return {
    views,
    clicks,
    validates,
    redemptions,
    failures,
    viewToClickRate: views > 0 ? Number(((clicks / views) * 100).toFixed(2)) : 0,
    clickToValidateRate: clicks > 0 ? Number(((validates / clicks) * 100).toFixed(2)) : 0,
    validateToRedeemRate: validates > 0 ? Number(((redemptions / validates) * 100).toFixed(2)) : 0,
    overallConversionRate: views > 0 ? Number(((redemptions / views) * 100).toFixed(2)) : 0,
  };
}

// ====================
// ROI REPORT
// ====================

export async function getCouponROIReport(
  tenantId: string,
  opts: { daysBack?: number } = {}
): Promise<CouponROIReport> {
  const daysBack = opts.daysBack || 30;
  const { start, end } = getPeriodRange('day', daysBack);

  // Get redemption data per coupon
  const redemptions = await prisma.coupon_redemptions.findMany({
    where: {
      tenant_id: tenantId,
      redeemed_at: { gte: start, lte: end },
    },
    select: {
      coupon_id: true,
      discount_cents: true,
      order_id: true,
    },
  });

  // Get coupon details
  const couponIds = [...new Set(redemptions.map(r => r.coupon_id))];
  const couponDetails = couponIds.length > 0
    ? await prisma.tenant_coupons.findMany({
        where: { id: { in: couponIds }, tenant_id: tenantId },
        select: { id: true, code: true },
      })
    : [];
  const detailMap = new Map(couponDetails.map(c => [c.id, c]));

  // Get revenue influenced (order totals for orders with coupon redemptions)
  const orderIds = redemptions.map(r => r.order_id).filter(Boolean) as string[];
  let revenueMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const orders = await prisma.$queryRaw`
      SELECT id, total_cents
      FROM orders
      WHERE id IN (${prisma.$queryRaw`SELECT unnest(${orderIds}::text[])`})
    ` as { id: string; total_cents: number }[];
    revenueMap = new Map(orders.map(o => [o.id, Number(o.total_cents)]));
  }

  // Aggregate per coupon
  const couponAgg = new Map<string, { discountCents: number; redemptions: number; revenueCents: number }>();
  let totalDiscountCents = 0;
  let totalRevenueInfluencedCents = 0;

  for (const r of redemptions) {
    const discount = r.discount_cents;
    const revenue = r.order_id ? (revenueMap.get(r.order_id) || 0) : 0;
    totalDiscountCents += discount;
    totalRevenueInfluencedCents += revenue;

    if (!couponAgg.has(r.coupon_id)) {
      couponAgg.set(r.coupon_id, { discountCents: 0, redemptions: 0, revenueCents: 0 });
    }
    const entry = couponAgg.get(r.coupon_id)!;
    entry.discountCents += discount;
    entry.redemptions++;
    entry.revenueCents += revenue;
  }

  const topCoupons = [...couponAgg.entries()].map(([couponId, data]) => {
    const detail = detailMap.get(couponId);
    return {
      couponId,
      couponCode: detail?.code || '',
      discountCents: data.discountCents,
      redemptions: data.redemptions,
      revenueInfluencedCents: data.revenueCents,
      roi: data.discountCents > 0 ? Number(((data.revenueCents / data.discountCents) * 100).toFixed(2)) : 0,
    };
  }).sort((a, b) => b.revenueInfluencedCents - a.revenueInfluencedCents).slice(0, 10);

  const roi = totalDiscountCents > 0 ? Number(((totalRevenueInfluencedCents / totalDiscountCents) * 100).toFixed(2)) : 0;
  const avgDiscountPerRedemption = redemptions.length > 0 ? Math.floor(totalDiscountCents / redemptions.length) : 0;

  return {
    totalDiscountCents,
    totalRevenueInfluencedCents,
    roi,
    couponsCount: couponAgg.size,
    avgDiscountPerRedemption,
    topCoupons,
  };
}

// ====================
// ADMIN CROSS-TENANT ANALYTICS
// ====================

export async function getAdminCouponAnalytics(): Promise<{
  totalTenants: number;
  totalCoupons: number;
  totalRedemptions: number;
  totalDiscountCents: number;
  totalEvents: number;
  topTenants: Array<{ tenantId: string; couponCount: number; redemptionCount: number; discountCents: number }>;
}> {
  const [couponCount, redemptionAgg, eventCount, tenantCount] = await Promise.all([
    prisma.tenant_coupons.count({ where: { is_active: true } }),
    prisma.coupon_redemptions.aggregate({
      _count: true,
      _sum: { discount_cents: true },
    }),
    prisma.coupon_events.count(),
    prisma.tenant_coupons.groupBy({
      by: ['tenant_id'],
      _count: true,
      orderBy: { _count: { tenant_id: 'desc' } },
      take: 10,
    }),
  ]);

  // Get per-tenant redemption counts
  const tenantRedemptions = await prisma.coupon_redemptions.groupBy({
    by: ['tenant_id'],
    _count: true,
    _sum: { discount_cents: true },
    orderBy: { _sum: { discount_cents: 'desc' } },
    take: 10,
  });

  const topTenants = tenantRedemptions.map(tr => ({
    tenantId: tr.tenant_id,
    couponCount: tenantCount.find(tc => tc.tenant_id === tr.tenant_id)?._count || 0,
    redemptionCount: tr._count,
    discountCents: tr._sum.discount_cents || 0,
  }));

  return {
    totalTenants: tenantCount.length,
    totalCoupons: couponCount,
    totalRedemptions: redemptionAgg._count,
    totalDiscountCents: redemptionAgg._sum.discount_cents || 0,
    totalEvents: eventCount,
    topTenants,
  };
}
