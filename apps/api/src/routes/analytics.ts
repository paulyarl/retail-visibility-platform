import { Request, Response, Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

/**
 * POST /api/analytics/subdomain-usage
 * Track subdomain usage analytics
 */
router.post('/subdomain-usage', async (req: Request, res: Response) => {
  try {
    const {
      subdomain,
      tenantId,
      domain,
      pathname,
      userAgent,
      ip,
      lookupTime,
      timestamp
    } = req.body;

    // Store analytics data (could be in a separate analytics table or log)
    // For now, we'll log to console and could extend to database storage
    console.log('[Analytics] Subdomain usage:', {
      subdomain,
      tenantId,
      domain,
      pathname,
      userAgent: userAgent.substring(0, 100), // Truncate for privacy
      ip: ip.replace(/\.\d+$/, '.***'), // Anonymize IP
      lookupTime,
      timestamp
    });

    // TODO: Store in analytics database table for detailed reporting
    // This could include:
    // - Daily/hourly usage stats
    // - Popular subdomains
    // - Performance metrics (lookup times)
    // - Geographic distribution
    // - Traffic patterns

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[Analytics] Error logging subdomain usage:', error);
    res.status(500).json({ success: false, error: 'Failed to log analytics' });
  }
});

/**
 * GET /api/analytics/subdomain-stats
 * Get subdomain usage statistics
 */
router.get('/subdomain-stats', async (req: Request, res: Response) => {
  try {
    // Get basic subdomain adoption stats
    const subdomainStats = await prisma.tenants.findMany({
      where: {
        subdomain: { not: null }
      },
      select: {
        id: true,
        subdomain: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Calculate adoption metrics
    const totalTenants = await prisma.tenants.count();
    const tenantsWithSubdomains = subdomainStats.length;
    const adoptionRate = totalTenants > 0 ? (tenantsWithSubdomains / totalTenants) * 100 : 0;

    // Recent subdomain adoptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAdoptions = subdomainStats.filter((tenant: { created_at: Date }) =>
      tenant.created_at >= thirtyDaysAgo
    ).length;

    res.json({
      success: true,
      data: {
        totalTenants,
        tenantsWithSubdomains,
        adoptionRate: Math.round(adoptionRate * 100) / 100,
        recentAdoptions,
        subdomainList: subdomainStats.map((tenant: { subdomain: string | null; id: string; created_at: Date }) => ({
          subdomain: tenant.subdomain,
          tenantId: tenant.id,
          createdAt: tenant.created_at
        }))
      }
    });
  } catch (error: any) {
    console.error('[Analytics] Error getting subdomain stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
