import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import TierService from '../services/TierService';

const router = Router();

/**
 * GET /api/dashboard/consolidated/:tenantId
 * Consolidated endpoint that returns ALL dashboard data in one call:
 * - Tenant info (name, logo, banner, status)
 * - Dashboard stats (items, sync issues, locations)
 * - Tier info (tier, features, limits)
 * - Usage info (SKU usage, location usage)
 * 
 * This reduces 4 separate API calls to 1, preventing connection pool exhaustion
 */
router.get('/dashboard/consolidated/:tenantId', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Fetch all data in parallel
    const [tenant, itemCounts] = await Promise.all([
      // 1. Tenant info with organization (for tier calculation)
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          metadata: true,
          locationStatus: true,
          reopeningDate: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          organizationId: true,
          monthlySkuQuota: true,
          skusAddedThisMonth: true,
          organization: {
            select: {
              id: true,
              name: true,
              subscriptionTier: true,
              _count: {
                select: { Tenant: true }
              }
            }
          }
        },
      }),
      
      // 2. Item counts (all in parallel)
      Promise.all([
        prisma.inventoryItem.count({ where: { tenantId } }),
        prisma.inventoryItem.count({ where: { tenantId, itemStatus: 'active' } }),
        prisma.inventoryItem.count({
          where: {
            tenantId,
            itemStatus: 'active',
            OR: [
              { tenantCategoryId: null },
              { visibility: 'private' },
            ],
          },
        }),
      ]),
    ]);

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    const [totalItems, activeItems, syncIssues] = itemCounts;

    // Calculate tier info (from tenant-tier.ts logic)
    const effectiveTier = tenant.organization?.subscriptionTier || tenant.subscriptionTier || 'starter';
    const isChain = tenant.organization ? tenant.organization._count.Tenant > 1 : false;
    const tenantTierData = tenant.subscriptionTier ? await TierService.getTierByKey(tenant.subscriptionTier) : null;
    const orgTierData = tenant.organization?.subscriptionTier ? await TierService.getTierByKey(tenant.organization.subscriptionTier) : null;

    // Calculate usage info (from tenant-tier.ts usage endpoint logic)
    const skuLimit = tenant.monthlySkuQuota || 500;
    const skuUsage = totalItems;
    const skuPercentage = Math.round((skuUsage / skuLimit) * 100);

    // Count tenant's owned locations for location usage
    const ownedTenants = await prisma.userTenant.count({
      where: {
        userId: (req as any).user?.userId,
        role: 'OWNER',
      },
    });

    // Get location limit based on tier
    const { getTenantLimit } = await import('../config/tenant-limits');
    const locationLimit = getTenantLimit(effectiveTier as any);
    const locationUsage = ownedTenants;
    const locationPercentage = locationLimit === Infinity ? 0 : Math.round((locationUsage / locationLimit) * 100);

    // Add location status info
    const { getLocationStatusInfo } = await import('../utils/location-status');
    const statusInfo = getLocationStatusInfo(tenant.locationStatus as any);

    // Consolidated response
    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: (tenant.metadata as any)?.logo_url,
        bannerUrl: (tenant.metadata as any)?.banner_url,
        locationStatus: tenant.locationStatus,
        reopeningDate: tenant.reopeningDate,
        statusInfo,
      },
      stats: {
        totalItems,
        activeItems,
        syncIssues,
        locations: 1,
      },
      tier: {
        tenant_id: tenant.id,
        tenantName: tenant.name,
        tier: effectiveTier,
        subscription_status: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt,
        subscription_ends_at: tenant.subscriptionEndsAt,
        isChain,
        organizationId: tenant.organizationId,
        organizationName: tenant.organization?.name,
        organizationTier: tenant.organization?.subscriptionTier,
        tenantTier: tenantTierData,
        organizationTierData: orgTierData,
      },
      usage: {
        sku: {
          usage: skuUsage,
          limit: skuLimit,
          percentage: skuPercentage,
        },
        location: {
          usage: locationUsage,
          limit: locationLimit,
          percentage: locationPercentage,
        },
      },
    });
  } catch (e: any) {
    console.error('[GET /api/dashboard/consolidated/:tenantId] Error:', e);
    res.status(500).json({ 
      error: 'failed_to_get_dashboard_data',
      details: e?.message 
    });
  }
});

export default router;
