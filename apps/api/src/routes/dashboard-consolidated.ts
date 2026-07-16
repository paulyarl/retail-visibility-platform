import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import TierService from '../services/TierService';
import { logger } from '../logger';

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
router.get('/consolidated/:tenantId', authenticateToken, checkTenantAccess, async (req, res) => {
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
          manual_subscription_control: true,
          manual_subscription_expires_at: true,
          manual_subscription_reason: true,
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

    // Calculate effective expiration for tenant dashboard
    const effectiveExpiration = tenant.manual_subscription_control 
      ? {
          expiresAt: tenant.manual_subscription_expires_at,
          type: 'manual' as const,
          source: 'manual_override' as const
        }
      : tenant.subscription_status === 'trial' && tenant.trial_ends_at
        ? {
            expiresAt: tenant.trial_ends_at,
            type: 'trial' as const,
            source: 'automatic_trial' as const
          }
        : tenant.subscription_ends_at
          ? {
              expiresAt: tenant.subscription_ends_at,
              type: 'subscription' as const,
              source: 'automatic_subscription' as const
            }
          : null;

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

    // Check if tenant has published directory listing
    const directoryResult = await prisma.$queryRaw`
      SELECT is_published FROM "directory_settings_list" WHERE tenant_id = ${tenant.id}
    `;
    const hasPublishedDirectory = (directoryResult as any[])?.[0]?.is_published === true;

    // Consolidated response
    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: (tenant.metadata as any)?.logo_url,
        bannerUrl: (tenant.metadata as any)?.banner_url,
        locationStatus: tenant.location_status,
        reopeningDate: tenant.reopening_date,
        hasPublishedDirectory,
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
        // Manual subscription control fields
        manualSubscriptionControl: tenant.manual_subscription_control,
        manualSubscriptionExpiresAt: tenant.manual_subscription_expires_at,
        manualSubscriptionReason: tenant.manual_subscription_reason,
        // Effective expiration fields
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source
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
    logger.error('[GET /api/dashboard/consolidated/:tenantId] Error:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    res.status(500).json({ 
      error: 'failed_to_get_dashboard_data',
      details: (e as any)?.message 
    });
  }
});

export default router;
