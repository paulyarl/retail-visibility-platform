import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

// POST /api/rate-limit-warnings - Store rate limit warning
router.post('/rate-limit-warnings', async (req: Request, res: Response) => {
  try {
    // Allow internal requests from rate limiting middleware without authentication
    const isInternalRequest = req.headers['x-internal-request'] === 'rate-limit-middleware';
    
    if (!isInternalRequest) {
      // For non-internal requests, you could add authentication here if needed
      // For now, we'll allow all POST requests to this endpoint
      console.log('[Rate Limit Warnings] External request detected');
    }

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

    // Also create a security alert for unified tracking
    try {
      const alertSeverity = blocked ? 'warning' : 'info';
      const alertTitle = blocked ? 'Rate Limit Blocked' : 'Rate Limit Warning';
      const alertMessage = blocked 
        ? `Rate limit exceeded and blocked for ${pathname}. ${requestCount}/${maxRequests} requests.`
        : `Rate limit warning for ${pathname}. ${requestCount}/${maxRequests} requests.`;

      await prisma.$executeRaw`
        INSERT INTO security_alerts (
          id, type, severity, title, message, metadata, created_at
        ) VALUES (
          gen_random_uuid(),
          'rate_limit_exceeded',
          ${alertSeverity},
          ${alertTitle},
          ${alertMessage},
          jsonb_build_object(
            'client_id', ${clientId},
            'pathname', ${pathname},
            'request_count', ${requestCount},
            'max_requests', ${maxRequests},
            'window_ms', ${windowMs},
            'ip_address', ${ipAddress},
            'user_agent', ${userAgent},
            'blocked', ${blocked},
            'warning_id', ${warning.id}
          ),
          NOW()
        )
      `;

      console.log('✅ Rate limit warning and security alert created:', warning.id);
    } catch (alertError) {
      console.error('Failed to create security alert for rate limit:', alertError);
      // Don't fail the main request if alert creation fails
    }

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
    const includeAlerts = req.query.includeAlerts === 'true';

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

    const response: any = {
      aggregatedData,
      topPaths,
      totalWarnings: warnings.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };

    // Optionally include security alerts for cross-reference
    if (includeAlerts) {
      try {
        const securityAlerts = await prisma.$queryRaw<any[]>`
          SELECT 
            type,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
            COUNT(*) FILTER (WHERE severity = 'info') as info_count,
            MAX(created_at) as latest_alert
          FROM security_alerts
          WHERE type = 'rate_limit_exceeded'
            AND created_at >= ${startDate}
            AND dismissed = false
          GROUP BY type
        `;

        response.securityAlerts = {
          totalRateLimitAlerts: securityAlerts.reduce((sum: number, alert: any) => sum + Number(alert.count), 0),
          warningAlerts: securityAlerts.reduce((sum: number, alert: any) => sum + Number(alert.warning_count), 0),
          infoAlerts: securityAlerts.reduce((sum: number, alert: any) => sum + Number(alert.info_count), 0),
          latestAlert: securityAlerts[0]?.latest_alert || null
        };

        console.log('📊 Rate limit trends with security alerts cross-reference');
      } catch (alertError) {
        console.error('Failed to fetch security alerts cross-reference:', alertError);
        response.securityAlerts = { error: 'Failed to fetch alerts data' };
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch rate limit trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

export default router;
