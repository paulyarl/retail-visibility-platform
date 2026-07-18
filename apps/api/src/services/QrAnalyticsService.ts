/**
 * QR Analytics Service
 *
 * Provides:
 * - Event tracking (QR scans) via qr_scan_events table
 * - Aggregate metrics computation per tenant, per surface, per period
 * - Dashboard data for merchant analytics UI
 * - Admin cross-tenant analytics for platform QR consumers (promos, grants, general)
 *
 * The aggregate job runs periodically to compute metrics from
 * qr_scan_events and store them in qr_analytics.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateQrAnalyticsId, generateQrScanEventId } from '../lib/id-generator';

// ====================
// TYPES
// ====================

export type QrSurfaceType = 'storefront' | 'product' | 'directory' | 'qr_landing' | 'promo' | 'private_grant' | 'general';
export type QrConsumerType = 'merchant' | 'admin';
export type PeriodType = 'day' | 'week' | 'month';
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export interface QrScanEventInput {
  tenantId: string;
  surface?: QrSurfaceType;
  consumer?: QrConsumerType;
  productId?: string;
  sessionId?: string;
  source?: string;
  referrer?: string;
  userAgent?: string;
  geoCountry?: string;
  geoCity?: string;
}

export interface QrAnalyticsRow {
  id: string;
  tenantId: string;
  surface: QrSurfaceType;
  consumer: QrConsumerType;
  periodStart: Date;
  periodEnd: Date;
  periodType: PeriodType;
  totalScans: number;
  uniqueVisitors: number;
  conversionCount: number;
  revenueCents: number;
  conversionRate: number;
  avgRevenuePerScan: number;
  topCountry: string | null;
  topCity: string | null;
  mobileScans: number;
  desktopScans: number;
  tabletScans: number;
}

export interface QrAnalyticsSummary {
  surface: QrSurfaceType;
  surfaceLabel: string;
  totalScans: number;
  uniqueVisitors: number;
  conversionCount: number;
  revenueCents: number;
  conversionRate: number;
  avgRevenuePerScan: number;
  topCountry: string | null;
  topCity: string | null;
  mobileScans: number;
  desktopScans: number;
  tabletScans: number;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface QrAnalyticsDashboard {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  surfaces: QrAnalyticsSummary[];
  totals: {
    totalScans: number;
    uniqueVisitors: number;
    conversionCount: number;
    revenueCents: number;
    activeSurfaceCount: number;
  };
}

export interface AdminQrAnalyticsResult {
  filters: {
    consumer?: QrConsumerType;
    surface?: QrSurfaceType;
    tenantId?: string;
    daysBack: number;
  };
  totals: {
    totalScans: number;
    uniqueVisitors: number;
    tenantCount: number;
  };
  byConsumer: Array<{
    consumer: QrConsumerType;
    totalScans: number;
    uniqueVisitors: number;
    tenantCount: number;
  }>;
  bySurface: Array<{
    surface: QrSurfaceType;
    totalScans: number;
    uniqueVisitors: number;
  }>;
  recentScans: Array<{
    id: string;
    tenantId: string;
    surface: string;
    consumer: string;
    source: string | null;
    geoCountry: string | null;
    deviceType: string | null;
    createdAt: Date;
  }>;
}

// ====================
// HELPERS
// ====================

const SURFACE_LABELS: Record<QrSurfaceType, string> = {
  storefront: 'Storefront QR',
  product: 'Product QR',
  directory: 'Directory QR',
  qr_landing: 'QR Landing Page',
  promo: 'Promo QR',
  private_grant: 'Private Grant QR',
  general: 'General Purpose QR',
};

function getSurfaceLabel(surface: string): string {
  return SURFACE_LABELS[surface as QrSurfaceType] || surface;
}

function parseDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

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

// ====================
// EVENT TRACKING
// ====================

/**
 * Record a QR scan event.
 */
export async function trackQrScanEvent(input: QrScanEventInput): Promise<void> {
  try {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    const deviceType = parseDeviceType(input.userAgent || null);

    await pool.query(
      `INSERT INTO qr_scan_events
         (id, tenant_id, surface, consumer, product_id, session_id, source, referrer, user_agent, geo_country, geo_city, device_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        generateQrScanEventId(input.tenantId),
        input.tenantId,
        input.surface || 'qr_landing',
        input.consumer || 'merchant',
        input.productId || null,
        input.sessionId || null,
        input.source || 'qr_code',
        input.referrer || null,
        input.userAgent || null,
        input.geoCountry || null,
        input.geoCity || null,
        deviceType,
      ]
    );
  } catch (error) {
    logger.warn('Failed to track QR scan event', undefined, {
      tenantId: input.tenantId,
      surface: input.surface,
      consumer: input.consumer,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Batch track multiple QR scan events.
 */
export async function trackQrScanEvents(inputs: QrScanEventInput[]): Promise<void> {
  if (inputs.length === 0) return;

  try {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const values: string[] = [];
    const params: (string | null)[] = [];
    let paramIdx = 1;

    for (const input of inputs) {
      const deviceType = parseDeviceType(input.userAgent || null);
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11}, NOW())`
      );
      params.push(
        generateQrScanEventId(input.tenantId),
        input.tenantId,
        input.surface || 'qr_landing',
        input.consumer || 'merchant',
        input.productId || null,
        input.sessionId || null,
        input.source || 'qr_code',
        input.referrer || null,
        input.userAgent || null,
        input.geoCountry || null,
        input.geoCity || null,
      );
      params.push(deviceType);
      paramIdx += 12;
    }

    await pool.query(
      `INSERT INTO qr_scan_events
         (id, tenant_id, surface, consumer, product_id, session_id, source, referrer, user_agent, geo_country, geo_city, device_type, created_at)
       VALUES ${values.join(', ')}`,
      params
    );
  } catch (error) {
    logger.warn('Failed to batch track QR scan events', undefined, {
      count: inputs.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ====================
// AGGREGATION
// ====================

/**
 * Run aggregation for a single tenant.
 * Computes qr_analytics rows from qr_scan_events.
 */
export async function aggregateQrAnalyticsForTenant(
  tenantId: string,
  periodType: PeriodType = 'day'
): Promise<{ rowsComputed: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsComputed = 0;

  try {
    const { start, end } = getPeriodRange(periodType, 30);

    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    // Aggregate scan events per surface per consumer per period
    const result = await pool.query(
      `SELECT
         surface,
         consumer,
         DATE_TRUNC($1, created_at)::date AS period_start,
         COUNT(*) AS total_scans,
         COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_visitors,
         COUNT(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL) AS unique_surfaces,
         COUNT(*) FILTER (WHERE session_id IS NOT NULL) AS conversion_count,
         0 AS revenue_cents,
         MODE() WITHIN GROUP (ORDER BY geo_country) FILTER (WHERE geo_country IS NOT NULL) AS top_country,
         MODE() WITHIN GROUP (ORDER BY geo_city) FILTER (WHERE geo_city IS NOT NULL) AS top_city,
         COUNT(*) FILTER (WHERE device_type = 'mobile') AS mobile_scans,
         COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop_scans,
         COUNT(*) FILTER (WHERE device_type = 'tablet') AS tablet_scans
       FROM qr_scan_events
       WHERE tenant_id = $2
         AND created_at >= $3
         AND created_at <= $4
       GROUP BY surface, consumer, period_start`,
      [periodType, tenantId, start, end]
    );

    for (const row of result.rows) {
      const periodStartDate = new Date(row.period_start);
      const periodEndDate = new Date(periodStartDate);
      if (periodType === 'day') periodEndDate.setDate(periodEndDate.getDate() + 1);
      else if (periodType === 'week') periodEndDate.setDate(periodEndDate.getDate() + 7);
      else periodEndDate.setMonth(periodEndDate.getMonth() + 1);

      const totalScans = Number(row.total_scans) || 0;
      const uniqueVisitors = Number(row.unique_visitors) || 0;
      const conversionCount = Number(row.conversion_count) || 0;
      const revenueCents = 0;
      const conversionRate = totalScans > 0 ? conversionCount / totalScans : 0;
      const avgRevenuePerScan = totalScans > 0 ? Math.floor(revenueCents / totalScans) : 0;

      const aggId = generateQrAnalyticsId(tenantId);

      try {
        await pool.query(
          `INSERT INTO qr_analytics
             (id, tenant_id, surface, consumer, period_start, period_end, period_type,
              total_scans, unique_visitors, unique_surfaces, conversion_count, revenue_cents,
              conversion_rate, avg_revenue_per_scan, top_country, top_city,
              mobile_scans, desktop_scans, tablet_scans, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
           ON CONFLICT (tenant_id, surface, consumer, period_start, period_type)
           DO UPDATE SET
             total_scans = EXCLUDED.total_scans,
             unique_visitors = EXCLUDED.unique_visitors,
             unique_surfaces = EXCLUDED.unique_surfaces,
             conversion_count = EXCLUDED.conversion_count,
             revenue_cents = EXCLUDED.revenue_cents,
             conversion_rate = EXCLUDED.conversion_rate,
             avg_revenue_per_scan = EXCLUDED.avg_revenue_per_scan,
             top_country = EXCLUDED.top_country,
             top_city = EXCLUDED.top_city,
             mobile_scans = EXCLUDED.mobile_scans,
             desktop_scans = EXCLUDED.desktop_scans,
             tablet_scans = EXCLUDED.tablet_scans,
             updated_at = NOW()`,
          [
            aggId,
            tenantId,
            row.surface,
            row.consumer,
            periodStartDate,
            periodEndDate,
            periodType,
            totalScans,
            uniqueVisitors,
            Number(row.unique_surfaces) || 0,
            conversionCount,
            revenueCents,
            conversionRate,
            avgRevenuePerScan,
            row.top_country || null,
            row.top_city || null,
            Number(row.mobile_scans) || 0,
            Number(row.desktop_scans) || 0,
            Number(row.tablet_scans) || 0,
          ]
        );
        rowsComputed++;
      } catch (err) {
        errors.push(`Failed to upsert row for surface=${row.surface}, consumer=${row.consumer}, period=${row.period_start}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info('[QrAnalyticsService] Aggregation complete', undefined, {
      tenantId,
      periodType,
      rowsComputed,
      errors: errors.length,
    });
  } catch (error) {
    errors.push(`Aggregation failed: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('[QrAnalyticsService] Aggregation error', undefined, {
      tenantId,
      periodType,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { rowsComputed, errors };
}

// ====================
// DASHBOARD
// ====================

/**
 * Get QR analytics dashboard for a tenant.
 * Returns per-surface summary with totals.
 */
export async function getQrAnalyticsDashboard(
  tenantId: string,
  period: PeriodType = 'day',
  daysBack: number = 30
): Promise<QrAnalyticsDashboard> {
  const { start, end } = getPeriodRange(period, daysBack);

  const { getDirectPool } = await import('../utils/db-pool');
  const pool = getDirectPool();

  // Get aggregated data per surface
  const result = await pool.query(
    `SELECT
       surface,
       COALESCE(SUM(total_scans), 0) AS total_scans,
       COALESCE(SUM(unique_visitors), 0) AS unique_visitors,
       COALESCE(SUM(conversion_count), 0) AS conversion_count,
       COALESCE(SUM(revenue_cents), 0) AS revenue_cents,
       COALESCE(SUM(mobile_scans), 0) AS mobile_scans,
       COALESCE(SUM(desktop_scans), 0) AS desktop_scans,
       COALESCE(SUM(tablet_scans), 0) AS tablet_scans,
       MAX(top_country) AS top_country,
       MAX(top_city) AS top_city
     FROM qr_analytics
     WHERE tenant_id = $1
       AND period_type = $2
       AND period_start >= $3
       AND period_start <= $4
       AND consumer = 'merchant'
     GROUP BY surface
     ORDER BY total_scans DESC`,
    [tenantId, period, start, end]
  );

  // Get trend data (compare current period vs previous period)
  const prevStart = new Date(start);
  if (period === 'day') prevStart.setDate(prevStart.getDate() - daysBack);
  else if (period === 'week') prevStart.setDate(prevStart.getDate() - daysBack * 7);
  else prevStart.setMonth(prevStart.getMonth() - Math.ceil(daysBack / 30));

  const prevResult = await pool.query(
    `SELECT
       surface,
       COALESCE(SUM(total_scans), 0) AS total_scans
     FROM qr_analytics
     WHERE tenant_id = $1
       AND period_type = $2
       AND period_start >= $3
       AND period_start < $4
       AND consumer = 'merchant'
     GROUP BY surface`,
    [tenantId, period, prevStart, start]
  );

  const prevMap = new Map<string, number>();
  for (const row of prevResult.rows) {
    prevMap.set(row.surface, Number(row.total_scans) || 0);
  }

  const surfaces: QrAnalyticsSummary[] = result.rows.map((row: any) => {
    const totalScans = Number(row.total_scans) || 0;
    const uniqueVisitors = Number(row.unique_visitors) || 0;
    const conversionCount = Number(row.conversion_count) || 0;
    const revenueCents = Number(row.revenue_cents) || 0;
    const conversionRate = totalScans > 0 ? conversionCount / totalScans : 0;
    const avgRevenuePerScan = totalScans > 0 ? Math.floor(revenueCents / totalScans) : 0;

    const prevScans = prevMap.get(row.surface) || 0;
    const trendPercent = prevScans > 0 ? ((totalScans - prevScans) / prevScans) * 100 : 0;
    const trend: 'up' | 'down' | 'flat' = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'flat';

    return {
      surface: row.surface as QrSurfaceType,
      surfaceLabel: getSurfaceLabel(row.surface),
      totalScans,
      uniqueVisitors,
      conversionCount,
      revenueCents,
      conversionRate,
      avgRevenuePerScan,
      topCountry: row.top_country || null,
      topCity: row.top_city || null,
      mobileScans: Number(row.mobile_scans) || 0,
      desktopScans: Number(row.desktop_scans) || 0,
      tabletScans: Number(row.tablet_scans) || 0,
      trend,
      trendPercent: Math.round(trendPercent * 100) / 100,
    };
  });

  const totals = {
    totalScans: surfaces.reduce((sum, s) => sum + s.totalScans, 0),
    uniqueVisitors: surfaces.reduce((sum, s) => sum + s.uniqueVisitors, 0),
    conversionCount: surfaces.reduce((sum, s) => sum + s.conversionCount, 0),
    revenueCents: surfaces.reduce((sum, s) => sum + s.revenueCents, 0),
    activeSurfaceCount: surfaces.filter(s => s.totalScans > 0).length,
  };

  return {
    period,
    startDate: start,
    endDate: end,
    surfaces,
    totals,
  };
}

// ====================
// TIME SERIES
// ====================

/**
 * Get time-series data for a specific QR surface.
 */
export async function getQrTimeSeries(
  tenantId: string,
  surface: QrSurfaceType,
  period: PeriodType = 'day',
  daysBack: number = 30
): Promise<Array<{ date: Date; totalScans: number; uniqueVisitors: number; conversionCount: number }>> {
  const { start, end } = getPeriodRange(period, daysBack);

  const { getDirectPool } = await import('../utils/db-pool');
  const pool = getDirectPool();

  const result = await pool.query(
    `SELECT
       period_start AS date,
       total_scans,
       unique_visitors,
       conversion_count
     FROM qr_analytics
     WHERE tenant_id = $1
       AND surface = $2
       AND consumer = 'merchant'
       AND period_type = $3
       AND period_start >= $4
       AND period_start <= $5
     ORDER BY period_start ASC`,
    [tenantId, surface, period, start, end]
  );

  return result.rows.map((row: any) => ({
    date: new Date(row.date),
    totalScans: Number(row.total_scans) || 0,
    uniqueVisitors: Number(row.unique_visitors) || 0,
    conversionCount: Number(row.conversion_count) || 0,
  }));
}

// ====================
// ADMIN ANALYTICS
// ====================

/**
 * Get admin cross-tenant QR analytics.
 * Supports filtering by consumer type, surface, and tenant.
 */
export async function getAdminQrAnalytics(filters: {
  consumer?: QrConsumerType;
  surface?: QrSurfaceType;
  tenantId?: string;
  daysBack?: number;
}): Promise<AdminQrAnalyticsResult> {
  const daysBack = filters.daysBack || 30;
  const { start, end } = getPeriodRange('day', daysBack);

  const { getDirectPool } = await import('../utils/db-pool');
  const pool = getDirectPool();

  const conditions: string[] = ['created_at >= $1', 'created_at <= $2'];
  const params: (string | number)[] = [start.toISOString(), end.toISOString()];
  let paramIdx = 3;

  if (filters.consumer) {
    conditions.push(`consumer = $${paramIdx}`);
    params.push(filters.consumer);
    paramIdx++;
  }
  if (filters.surface) {
    conditions.push(`surface = $${paramIdx}`);
    params.push(filters.surface);
    paramIdx++;
  }
  if (filters.tenantId) {
    conditions.push(`tenant_id = $${paramIdx}`);
    params.push(filters.tenantId);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Totals
  const totalsResult = await pool.query(
    `SELECT
       COUNT(*) AS total_scans,
       COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_visitors,
       COUNT(DISTINCT tenant_id) AS tenant_count
     FROM qr_scan_events
     WHERE ${whereClause}`,
    params
  );

  // By consumer
  const consumerResult = await pool.query(
    `SELECT
       consumer,
       COUNT(*) AS total_scans,
       COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_visitors,
       COUNT(DISTINCT tenant_id) AS tenant_count
     FROM qr_scan_events
     WHERE ${whereClause}
     GROUP BY consumer
     ORDER BY total_scans DESC`,
    params
  );

  // By surface
  const surfaceResult = await pool.query(
    `SELECT
       surface,
       COUNT(*) AS total_scans,
       COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_visitors
     FROM qr_scan_events
     WHERE ${whereClause}
     GROUP BY surface
     ORDER BY total_scans DESC`,
    params
  );

  // Recent scans
  const recentResult = await pool.query(
    `SELECT
       id, tenant_id, surface, consumer, source, geo_country, device_type, created_at
     FROM qr_scan_events
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );

  return {
    filters: {
      consumer: filters.consumer,
      surface: filters.surface,
      tenantId: filters.tenantId,
      daysBack,
    },
    totals: {
      totalScans: Number(totalsResult.rows[0]?.total_scans) || 0,
      uniqueVisitors: Number(totalsResult.rows[0]?.unique_visitors) || 0,
      tenantCount: Number(totalsResult.rows[0]?.tenant_count) || 0,
    },
    byConsumer: consumerResult.rows.map((row: any) => ({
      consumer: row.consumer as QrConsumerType,
      totalScans: Number(row.total_scans) || 0,
      uniqueVisitors: Number(row.unique_visitors) || 0,
      tenantCount: Number(row.tenant_count) || 0,
    })),
    bySurface: surfaceResult.rows.map((row: any) => ({
      surface: row.surface as QrSurfaceType,
      totalScans: Number(row.total_scans) || 0,
      uniqueVisitors: Number(row.unique_visitors) || 0,
    })),
    recentScans: recentResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      surface: row.surface,
      consumer: row.consumer,
      source: row.source,
      geoCountry: row.geo_country,
      deviceType: row.device_type,
      createdAt: new Date(row.created_at),
    })),
  };
}
