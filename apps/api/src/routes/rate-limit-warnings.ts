import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

// POST /api/rate-limit-warnings - Store rate limit warning
router.post('/rate-limit-warnings', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      pathname,
      requestCount,
      maxRequests,
      windowMs,
      ipAddress,
      userAgent,
      blocked = false
    } = req.body;

    // Store the warning in database
    const warning = await prisma.rate_limit_warnings.create({
      data: {
        client_id: clientId,
        pathname,
        request_count: requestCount,
        max_requests: maxRequests,
        window_ms: windowMs,
        ip_address: ipAddress,
        user_agent: userAgent,
        blocked
      }
    });

    res.json({ success: true, id: warning.id });
  } catch (error) {
    console.error('Failed to store rate limit warning:', error);
    res.status(500).json({ error: 'Failed to store warning' });
  }
});

// GET /api/rate-limit-warnings - Get rate limit trends
router.get('/rate-limit-warnings', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string || '7');
    const pathname = req.query.pathname as string;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const where: any = {
      occurred_at: {
        gte: startDate,
        lte: endDate
      }
    };

    if (pathname) {
      where.pathname = pathname;
    }

    // Get warning data grouped by date and pathname
    const warnings = await prisma.rate_limit_warnings.findMany({
      where,
      orderBy: {
        occurred_at: 'desc'
      },
      take: 1000 // Limit results
    });

    // Aggregate data for charts
    const dailyStats = warnings.reduce((acc: Record<string, any>, warning: any) => {
      const date = warning.occurred_at.toISOString().split('T')[0];
      const key = `${date}:${warning.pathname}`;

      if (!acc[key]) {
        acc[key] = {
          date,
          pathname: warning.pathname,
          totalWarnings: 0,
          blockedWarnings: 0,
          uniqueClients: new Set()
        };
      }

      acc[key].totalWarnings++;
      acc[key].uniqueClients.add(warning.client_id);

      if (warning.blocked) {
        acc[key].blockedWarnings++;
      }

      return acc;
    }, {} as Record<string, any>);

    // Convert to array and calculate unique client counts
    const aggregatedData = Object.values(dailyStats).map((item: any) => ({
      ...item,
      uniqueClients: item.uniqueClients.size
    }));

    // Get top offending paths
    const pathStats = warnings.reduce((acc: Record<string, any>, warning: any) => {
      if (!acc[warning.pathname]) {
        acc[warning.pathname] = {
          pathname: warning.pathname,
          totalWarnings: 0,
          blockedWarnings: 0,
          uniqueClients: new Set()
        };
      }

      acc[warning.pathname].totalWarnings++;
      acc[warning.pathname].uniqueClients.add(warning.client_id);

      if (warning.blocked) {
        acc[warning.pathname].blockedWarnings++;
      }

      return acc;
    }, {} as Record<string, any>);

    const topPaths = Object.values(pathStats)
      .map((item: any) => ({
        ...item,
        uniqueClients: item.uniqueClients.size
      }))
      .sort((a: any, b: any) => b.totalWarnings - a.totalWarnings)
      .slice(0, 10);

    res.json({
      aggregatedData,
      topPaths,
      totalWarnings: warnings.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to fetch rate limit trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

export default router;
