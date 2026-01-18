import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Get all security alerts with pagination and stats
router.get('/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    // Get all alerts (simplified query for debugging)
    console.log('[Admin Security] Fetching alerts with limit:', limit, 'offset:', offset);
    const alerts = await prisma.security_alerts.findMany({
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' }
    });
    
    console.log('[Admin Security] Found alerts:', alerts.length);
    console.log('[Admin Security] Sample alert:', alerts[0]);

    // Format for frontend
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert.id,
      userId: alert.user_id,
      userEmail: alert.user_email || (alert.user_id === 'system' ? 'System' : alert.user_id === null ? 'Telemetry Event' : 'Unknown'),
      userFirstName: alert.user_first_name || (alert.user_id === 'system' ? 'System' : alert.user_id === null ? 'Telemetry' : null),
      userLastName: alert.user_last_name || (alert.user_id === 'system' ? 'Alert' : alert.user_id === null ? 'Event' : null),
      type: alert.type,
      severity: alert.severity as 'info' | 'warning' | 'critical',
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      read: alert.read,
      createdAt: alert.created_at.toISOString(),
      readAt: alert.read_at?.toISOString(),
    }));

    // Get total count for pagination
    const totalCount = await prisma.security_alerts.count();

    res.json({
      data: formattedAlerts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Failed to fetch security alerts:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

// Get security alerts stats
router.get('/alerts/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalAlerts, unreadAlerts, alertsLast24h, criticalAlerts, warningAlerts] = await Promise.all([
      prisma.security_alerts.count(),
      prisma.security_alerts.count({ where: { read: false } }),
      prisma.security_alerts.count({ where: { created_at: { gte: last24h } } }),
      prisma.security_alerts.count({ where: { severity: 'critical' } }),
      prisma.security_alerts.count({ where: { severity: 'warning' } }),
    ]);

    // Get type breakdown
    const typeBreakdown = await prisma.security_alerts.groupBy({
      by: ['type'],
      _count: { type: true },
      orderBy: { _count: { type: 'desc' } },
    });

    res.json({
      totalAlerts,
      unreadAlerts,
      alertsLast24h,
      criticalAlerts,
      warningAlerts,
      typeBreakdown: typeBreakdown.map((item: { type: string; _count: { type: number } }) => ({
        type: item.type,
        count: item._count.type,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch alert stats:', error);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

// Mark alert as read
router.patch('/alerts/:id/read', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.security_alerts.update({
      where: { id },
      data: {
        read: true,
        read_at: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark alert as read:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Create a security alert (internal use)
export async function createSecurityAlert(data: {
  userId?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  try {
    // Extract user information from metadata if not provided directly
    const userId = data.userId || data.metadata?.userContext?.id;
    const userEmail = data.userEmail || data.metadata?.userContext?.email;
    const userFirstName = data.userFirstName || data.metadata?.userContext?.firstName;
    const userLastName = data.userLastName || data.metadata?.userContext?.lastName;

    await prisma.security_alerts.create({
      data: {
        user_id: userId,
        user_email: userEmail,
        user_first_name: userFirstName,
        user_last_name: userLastName,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
      },
    });
  } catch (error) {
    console.error('Failed to create security alert:', error);
  }
}
// Get platform stability insights
router.get('/stability-insights', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const timeframeHours = parseInt(req.query.timeframe as string) || 24;

    const insights = await SecurityAnalyticsService.generateStabilityInsights(timeframeHours);

    if (!insights) {
      return res.status(500).json({ error: 'Failed to generate stability insights' });
    }

    res.json(insights);
  } catch (error) {
    console.error('Failed to fetch stability insights:', error);
    res.status(500).json({ error: 'Failed to fetch stability insights' });
  }
});

export default router;

// Analytics service for platform stability insights
export class SecurityAnalyticsService {
  static async generateStabilityInsights(timeframeHours: number = 24) {
    const startTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

    try {
      // Get recent incidents
      const incidents = await prisma.security_alerts.findMany({
        where: {
          created_at: { gte: startTime },
          dismissed: false,
        },
        orderBy: { created_at: 'desc' },
      });

      return this.analyzeIncidents(incidents);
    } catch (error) {
      console.error('Failed to generate stability insights:', error);
      return null;
    }
  }

  static analyzeIncidents(incidents: any[]) {
    const insights = {
      summary: {
        totalIncidents: incidents.length,
        criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
        warningIncidents: incidents.filter(i => i.severity === 'warning').length,
        infoIncidents: incidents.filter(i => i.severity === 'info').length,
      },
      patterns: {
        topEndpoints: this.getTopEndpoints(incidents),
        topIPs: this.getTopIPs(incidents),
        userBehaviorPatterns: this.analyzeUserBehavior(incidents),
        geographicPatterns: this.analyzeGeographicPatterns(incidents),
        temporalPatterns: this.analyzeTemporalPatterns(incidents),
      },
      risks: {
        bruteForceIndicators: this.detectBruteForceRisks(incidents),
        scrapingIndicators: this.detectScrapingRisks(incidents),
        abuseIndicators: this.detectAbusePatterns(incidents),
        platformStabilityScore: this.calculateStabilityScore(incidents),
      },
      recommendations: [] as string[],
    };

    // Generate recommendations based on analysis
    insights.recommendations = this.generateRecommendations(insights);

    return insights;
  }

  private static getTopEndpoints(incidents: any[]) {
    const endpointCounts = incidents.reduce((acc, incident) => {
      const endpoint = incident.metadata?.endpoint || 'unknown';
      acc[endpoint] = (acc[endpoint] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(endpointCounts)
      .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  private static getTopIPs(incidents: any[]) {
    const ipCounts = incidents.reduce((acc, incident) => {
      const ip = incident.metadata?.ipAddress || 'unknown';
      acc[ip] = (acc[ip] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(ipCounts)
      .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }

  private static analyzeUserBehavior(incidents: any[]) {
    const authenticated = incidents.filter(i => i.metadata?.userContext?.isAuthenticated).length;
    const anonymous = incidents.filter(i => !i.metadata?.userContext?.isAuthenticated).length;
    const newUsers = incidents.filter(i => i.metadata?.behaviorPatterns?.isNewUser).length;
    const powerUsers = incidents.filter(i => i.metadata?.behaviorPatterns?.isPowerUser).length;

    return {
      authenticatedVsAnonymous: { authenticated, anonymous },
      userMaturity: { newUsers, establishedUsers: authenticated - newUsers },
      userTypes: { powerUsers, regularUsers: authenticated - powerUsers },
    };
  }

  private static analyzeGeographicPatterns(incidents: any[]) {
    const countries = incidents.reduce((acc, incident) => {
      const country = incident.metadata?.geoData?.country || 'unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    return {
      topCountries: Object.entries(countries)
        .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([country, count]) => ({ country, count })),
      internationalDistribution: Object.keys(countries).length > 1,
    };
  }

  private static analyzeTemporalPatterns(incidents: any[]) {
    const hourlyDistribution = incidents.reduce((acc, incident) => {
      const hour = new Date(incident.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHour = Object.entries(hourlyDistribution)
      .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))[0]?.[0] || 'unknown';

    return {
      hourlyDistribution,
      peakActivityHour: parseInt(peakHour),
      offHoursActivity: this.detectOffHoursActivity(incidents),
    };
  }

  private static detectBruteForceRisks(incidents: any[]) {
    const authIncidents = incidents.filter(i =>
      i.type === 'auth_rate_limit_exceeded' ||
      i.metadata?.riskIndicators?.potentialBruteForce
    );

    const uniqueIPs = new Set(authIncidents.map(i => i.metadata?.ipAddress)).size;
    const uniqueUsers = new Set(authIncidents.map(i => i.metadata?.userContext?.email).filter(Boolean)).size;

    return {
      authRateLimitIncidents: authIncidents.length,
      uniqueIPsAttemptingAuth: uniqueIPs,
      uniqueUsersTargeted: uniqueUsers,
      riskLevel: authIncidents.length > 10 ? 'high' : authIncidents.length > 5 ? 'medium' : 'low',
    };
  }

  private static detectScrapingRisks(incidents: any[]) {
    const searchIncidents = incidents.filter(i =>
      i.type === 'search_rate_limit_exceeded' ||
      i.metadata?.searchContext
    );

    const anonymousSearches = searchIncidents.filter(i =>
      !i.metadata?.userContext?.isAuthenticated
    ).length;

    return {
      searchRateLimitIncidents: searchIncidents.length,
      anonymousSearchActivity: anonymousSearches,
      potentialScraping: anonymousSearches > searchIncidents.length * 0.7,
      riskLevel: searchIncidents.length > 20 ? 'high' : searchIncidents.length > 10 ? 'medium' : 'low',
    };
  }

  private static detectAbusePatterns(incidents: any[]) {
    const uploadIncidents = incidents.filter(i => i.type === 'upload_rate_limit_exceeded').length;
    const apiIncidents = incidents.filter(i => i.type === 'costly_api_rate_limit_exceeded').length;

    return {
      uploadAbuseIncidents: uploadIncidents,
      apiAbuseIncidents: apiIncidents,
      resourceAbuseRisk: (uploadIncidents + apiIncidents) > 15 ? 'high' : (uploadIncidents + apiIncidents) > 7 ? 'medium' : 'low',
    };
  }

  private static calculateStabilityScore(incidents: any[]) {
    const criticalCount = incidents.filter(i => i.severity === 'critical').length;
    const warningCount = incidents.filter(i => i.severity === 'warning').length;
    const infoCount = incidents.filter(i => i.severity === 'info').length;

    // Calculate weighted score (lower is better)
    const score = (criticalCount * 10) + (warningCount * 3) + (infoCount * 1);
    const maxExpectedIncidents = 50; // Baseline for normal operation

    // Convert to 0-100 scale (100 = perfect stability)
    const stabilityScore = Math.max(0, Math.min(100, 100 - (score / maxExpectedIncidents * 100)));

    return {
      score: stabilityScore,
      level: stabilityScore >= 80 ? 'excellent' : stabilityScore >= 60 ? 'good' : stabilityScore >= 40 ? 'fair' : 'poor',
      factors: { criticalCount, warningCount, infoCount },
    };
  }

  private static detectOffHoursActivity(incidents: any[]) {
    return incidents.filter(incident => {
      const hour = new Date(incident.created_at).getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    }).length;
  }

  private static generateRecommendations(insights: any) {
    const recommendations = [];

    // Brute force recommendations
    if (insights.risks.bruteForceIndicators.riskLevel === 'high') {
      recommendations.push('Implement stricter authentication rate limits and CAPTCHA for login attempts');
      recommendations.push('Consider IP-based blocking for repeated authentication failures');
    }

    // Scraping recommendations
    if (insights.risks.scrapingIndicators.potentialScraping) {
      recommendations.push('Implement stricter search rate limits for anonymous users');
      recommendations.push('Consider requiring authentication for high-volume search operations');
    }

    // Resource abuse recommendations
    if (insights.risks.abuseIndicators.resourceAbuseRisk === 'high') {
      recommendations.push('Implement stricter upload and API rate limits');
      recommendations.push('Consider per-user quotas for resource-intensive operations');
    }

    // Geographic recommendations
    if (insights.patterns.geographicPatterns.internationalDistribution) {
      recommendations.push('Monitor international access patterns for unusual activity');
    }

    // Stability recommendations
    if (insights.risks.platformStabilityScore.level === 'poor') {
      recommendations.push('URGENT: Platform stability is compromised - review recent changes and increase monitoring');
      recommendations.push('Consider implementing circuit breakers for critical endpoints');
    }

    return recommendations.length > 0 ? recommendations : ['Platform stability is within normal parameters'];
  }
}
