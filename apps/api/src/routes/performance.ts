import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

// GET /performance/dashboard - Get performance dashboard for tenant
router.get('/dashboard', async (req, res) => {
  try {
    const { tenantId, days = '30' } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get summary stats
    const summary = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT "itemId") as "totalProducts",
        SUM(CASE WHEN "approvalStatus" = 'approved' THEN 1 ELSE 0 END) as "approvedProducts",
        SUM(CASE WHEN "approvalStatus" = 'pending' THEN 1 ELSE 0 END) as "pendingProducts",
        SUM(CASE WHEN "approvalStatus" = 'rejected' THEN 1 ELSE 0 END) as "rejectedProducts",
        SUM("impressions") as "totalImpressions",
        SUM("clicks") as "totalClicks",
        CASE 
          WHEN SUM("impressions") > 0 THEN ROUND((SUM("clicks")::DECIMAL / SUM("impressions")::DECIMAL * 100), 2)
          ELSE 0 
        END as "avgCtr",
        SUM("conversions") as "totalConversions",
        SUM("revenue") as "totalRevenue",
        AVG("visibilityScore") as "avgVisibilityScore"
      FROM "ProductPerformance"
      WHERE "tenantId" = ${tenantId as string}
        AND "date" >= ${startDate}
    `;

    // Get daily trends
    const trends = await prisma.$queryRaw<any[]>`
      SELECT 
        "date",
        SUM("impressions") as "impressions",
        SUM("clicks") as "clicks",
        SUM("conversions") as "conversions",
        SUM("revenue") as "revenue"
      FROM "ProductPerformance"
      WHERE "tenantId" = ${tenantId as string}
        AND "date" >= ${startDate}
      GROUP BY "date"
      ORDER BY "date" ASC
    `;

    // Get top performing products
    const topProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        p."itemId",
        i."sku",
        i."name",
        i."imageUrl",
        SUM(p."impressions") as "impressions",
        SUM(p."clicks") as "clicks",
        SUM(p."conversions") as "conversions",
        SUM(p."revenue") as "revenue",
        AVG(p."ctr") as "avgCtr"
      FROM "ProductPerformance" p
      JOIN "InventoryItem" i ON p."itemId" = i."id"
      WHERE p."tenantId" = ${tenantId as string}
        AND p."date" >= ${startDate}
      GROUP BY p."itemId", i."sku", i."name", i."imageUrl"
      ORDER BY SUM(p."impressions") DESC
      LIMIT 10
    `;

    res.json({
      summary: summary[0] || {},
      trends,
      topProducts,
      period: {
        days: daysNum,
        startDate,
        endDate: new Date(),
      },
    });
  } catch (error: any) {
    console.error('[Performance Dashboard] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_dashboard' });
  }
});

// GET /performance/product/:itemId - Get performance for specific product
router.get('/product/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { days = '30' } = req.query;

    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const performance = await prisma.product_performance.findMany({
      where: {
        itemId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate totals
    const totals = performance.reduce(
      (acc, day) => ({
        impressions: acc.impressions + day.impressions,
        clicks: acc.clicks + day.clicks,
        conversions: acc.conversions + day.conversions,
        revenue: acc.revenue.add(day.revenue),
      }),
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: new (require('decimal.js'))(0),
      }
    );

    const avgCtr =
      totals.impressions > 0
        ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
        : '0.00';

    res.json({
      itemId,
      period: {
        days: daysNum,
        startDate,
        endDate: new Date(),
      },
      totals: {
        ...totals,
        revenue: totals.revenue.toString(),
        avgCtr,
      },
      daily: performance,
    });
  } catch (error: any) {
    console.error('[Product Performance] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_performance' });
  }
});

// POST /performance/update - Update performance metrics (internal/cron)
router.post('/update', async (req, res) => {
  try {
    const schema = z.object({
      item_id: z.string(),
      tenantId: z.string(),
      date: z.string().datetime(),
      approvalStatus: z.string().optional(),
      rejectionReason: z.string().optional(),
      impressions: z.number().int().nonnegative().optional(),
      clicks: z.number().int().nonnegative().optional(),
      conversions: z.number().int().nonnegative().optional(),
      revenue: z.number().nonnegative().optional(),
      visibilityScore: z.number().int().min(0).max(100).optional(),
      searchRank: z.number().int().positive().optional(),
    });

    const data = schema.parse(req.body);
    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0); // Normalize to start of day

    // Calculate CTR if both impressions and clicks provided
    const ctr =
      data.impressions && data.clicks
        ? (data.clicks / data.impressions) * 100
        : undefined;

    const performance = await prisma.product_performance.upsert({
      where: {
        itemId_date: {
          item_id: data.item_id,
          date,
        },
      },
      update: {
        approvalStatus: data.approvalStatus,
        rejectionReason: data.rejectionReason,
        impressions: data.impressions,
        clicks: data.clicks,
        ctr: ctr !== undefined ? ctr : undefined,
        conversions: data.conversions,
        revenue: data.revenue,
        visibilityScore: data.visibilityScore,
        searchRank: data.searchRank,
        lastUpdated: new Date(),
      },
      create: {
        item_id: data.item_id,
        tenantId: data.tenantId,
        date,
        approvalStatus: data.approvalStatus || 'not_synced',
        rejectionReason: data.rejectionReason,
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        ctr: ctr || 0,
        conversions: data.conversions || 0,
        revenue: data.revenue || 0,
        visibilityScore: data.visibilityScore || 0,
        searchRank: data.searchRank,
      },
    });

    res.json(performance);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'invalid_payload', details: error.flatten() });
    }
    console.error('[Performance Update] Error:', error);
    res.status(500).json({ error: 'failed_to_update_performance' });
  }
});

// GET /performance/approval-status - Get approval status summary
router.get('/approval-status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    // Get latest approval status for each product
    const statuses = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON (p."itemId")
        p."itemId",
        i."sku",
        i."name",
        i."imageUrl",
        p."approvalStatus",
        p."rejectionReason",
        p."date",
        p."lastUpdated"
      FROM "ProductPerformance" p
      JOIN "InventoryItem" i ON p."itemId" = i."id"
      WHERE p."tenantId" = ${tenantId as string}
      ORDER BY p."itemId", p."date" DESC
    `;

    // Group by status
    const summary = statuses.reduce(
      (acc: any, item: any) => {
        const status = item.approvalStatus || 'not_synced';
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(item);
        return acc;
      },
      {}
    );

    res.json({
      summary,
      counts: {
        approved: summary.approved?.length || 0,
        pending: summary.pending?.length || 0,
        rejected: summary.rejected?.length || 0,
        not_synced: summary.not_synced?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[Approval Status] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_approval_status' });
  }
});

export default router;
