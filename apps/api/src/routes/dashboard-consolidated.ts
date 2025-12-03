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
      prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          metadata: true,
          location_status: true,
          reopening_date: true,
          subscription_tier: true,
          subscription_status: true,
          trial_ends_at: true,
          subscription_ends_at: true,
          organization_id: true,
          monthly_sku_quota: true,
          skus_added_this_month: true,
          organizations_list: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              _count: {
                select: { tenants: true }
              }
            }
          }
        },
      }),
      
      // 2. Item counts (all in parallel)
      Promise.all([
        prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
        prisma.inventory_items.count({ where: { tenant_id: tenantId, item_status: 'active' } }),
        prisma.inventory_items.count({
          where: {
            tenant_id: tenantId,
            item_status: 'active',
            OR: [
              { directory_category_id: null },
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
    const effectiveTier = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';
    const isChain = tenant.organizations_list ? tenant.organizations_list._count.tenants > 1 : false;
    const tenantTierData = tenant.subscription_tier ? await TierService.getTierByKey(tenant.subscription_tier) : null;
    const orgTierData = tenant.organizations_list?.subscription_tier ? await TierService.getTierByKey(tenant.organizations_list.subscription_tier) : null;

    // Calculate usage info (from tenant-tier.ts usage endpoint logic)
    const skuLimit = tenant.monthly_sku_quota || 500;
    const skuUsage = totalItems;
    const skuPercentage = Math.round((skuUsage / skuLimit) * 100);

    // Count tenant's owned locations for location usage
    const ownedTenants = await prisma.user_tenants.count({
      where: {
        user_id: (req as any).user?.userId,
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
    const statusInfo = getLocationStatusInfo(tenant.location_status as any);

    // Consolidated response
    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: (tenant.metadata as any)?.logo_url,
        bannerUrl: (tenant.metadata as any)?.banner_url,
        locationStatus: tenant.location_status,
        reopeningDate: tenant.reopening_date,
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
        subscription_status: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        subscription_ends_at: tenant.subscription_ends_at,
        isChain,
        organizationId: tenant.organization_id,
        organizationName: tenant.organizations_list?.name,
        organizationTier: tenant.organizations_list?.subscription_tier,
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
