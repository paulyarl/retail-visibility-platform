import { Request, Response, Router } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { readSubdomainAssignedAt, wasSubdomainAssignedSince } from '../lib/subdomain';

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
    logger.error('[Analytics] Error logging subdomain usage:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
        name: true,
        subdomain: true,
        created_at: true,
        metadata: true,
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Calculate adoption metrics
    const totalTenants = await prisma.tenants.count();
    const tenantsWithSubdomains = subdomainStats.length;
    const adoptionRate = totalTenants > 0 ? (tenantsWithSubdomains / totalTenants) * 100 : 0;

    // Recent subdomain adoptions (last 30 days) — measured from the assignment
    // stamp, not `tenants.created_at`: filtering on creation date only ever
    // counted new tenants that happened to have a subdomain, so an established
    // tenant adopting one today was invisible.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAdoptions = subdomainStats.filter((tenant) =>
      wasSubdomainAssignedSince(tenant.metadata, thirtyDaysAgo)
    ).length;

    res.json({
      success: true,
      data: {
        totalTenants,
        tenantsWithSubdomains,
        adoptionRate: Math.round(adoptionRate * 100) / 100,
        recentAdoptions,
        subdomainList: subdomainStats.map((tenant) => ({
          subdomain: tenant.subdomain,
          tenantId: tenant.id,
          tenantName: tenant.name,
          createdAt: tenant.created_at,
          assignedAt: readSubdomainAssignedAt(tenant.metadata)
        }))
      }
    });
  } catch (error: any) {
    logger.error('[Analytics] Error getting subdomain stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

/** Domain states where a custom domain actually serves the storefront. */
const LIVE_CUSTOM_DOMAIN_STATUSES = ['active', 'verified'];

/**
 * GET /api/analytics/custom-domain-stats
 * Custom-domain adoption for the admin dashboard header — the sibling of
 * /subdomain-stats, which only ever counted `tenants.subdomain`.
 *
 * Recency comes straight from `custom_domains.created_at` (the row is inserted
 * when the domain is attached), so unlike the subdomain side this needs no extra
 * stamp. `updated_at` is deliberately unused: a `BEFORE UPDATE` trigger does
 * maintain it (see AGENTS.md — the trigger is not in the migrations), but it
 * tracks the LAST modification — verification checks, certificate refreshes,
 * status changes — not the attach.
 */
router.get('/custom-domain-stats', async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalTenants, totalCustomDomains, liveRows, recentAttachments] = await Promise.all([
      prisma.tenants.count(),
      prisma.custom_domains.count(),
      // Distinct tenants with a domain that resolves — pending/error/disabled
      // rows are attachments, not adoptions.
      prisma.custom_domains.findMany({
        where: { status: { in: LIVE_CUSTOM_DOMAIN_STATUSES } },
        select: { tenant_id: true },
        distinct: ['tenant_id'],
      }),
      prisma.custom_domains.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
    ]);

    const tenantsWithCustomDomains = liveRows.length;
    const adoptionRate = totalTenants > 0 ? (tenantsWithCustomDomains / totalTenants) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalTenants,
        totalCustomDomains,
        tenantsWithCustomDomains,
        adoptionRate: Math.round(adoptionRate * 100) / 100,
        recentAttachments
      }
    });
  } catch (error: any) {
    logger.error('[Analytics] Error getting custom domain stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
