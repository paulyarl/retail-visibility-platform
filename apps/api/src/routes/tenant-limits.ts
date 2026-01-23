/**
 * Tenant Limits API Routes
 * 
 * Endpoints for checking tenant creation limits and upgrade paths
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getTenantLimitConfig, getRemainingTenantSlots, getPlatformSupportLimit, getFeaturedProductsLimits, TENANT_LIMITS, FEATURED_PRODUCTS_LIMITS } from '../config/tenant-limits';
import { user_tenant_role } from '@prisma/client';

const router = Router();

/**
 * GET /api/tenant-limits/status
 * 
 * Get current user's tenant limit status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    // Platform admins have unlimited
    if (isPlatformAdmin(req.user)) {
      // Show actual tenant count for platform admins for better UX
      const totalTenants = await prisma.tenants.count();
      
      return res.json({
        current: totalTenants,
        limit: 'unlimited',
        remaining: 'unlimited',
        tier: 'platform_admin',
        tierDisplayName: 'Platform Admin',
        canCreate: true,
        upgradeMessage: null,
        upgradeToTier: null,
      });
    }

    // Platform support can create tenants but is limited to 3 tenants per owner
    if (req.user.role === 'PLATFORM_SUPPORT') {
      const ownedTenants = await prisma.user_tenants.count({
        where: {
          user_id: req.user.userId,
          role: 'OWNER',
        },
      });
      const supportLimit = getPlatformSupportLimit();
      const remaining = Math.max(0, supportLimit - ownedTenants);

      return res.json({
        current: ownedTenants,
        limit: supportLimit,
        remaining,
        tier: 'platform_support',
        tierDisplayName: `Platform Support (${supportLimit} tenants per owner)`,
        canCreate: remaining > 0,
        upgradeMessage: remaining === 0 ? 'Platform support users can only create 3 tenants per owner. This owner has reached the limit.' : null,
        upgradeToTier: null,
      });
    }

    // Platform viewers cannot create tenants
    if (req.user.role === 'PLATFORM_VIEWER') {
      return res.json({
        current: 0,
        limit: 0,
        remaining: 0,
        tier: 'platform_viewer',
        tierDisplayName: 'Platform Viewer (Read-Only)',
        canCreate: false,
        upgradeMessage: 'Platform viewers have read-only access.',
        upgradeToTier: null,
      });
    }

    // Get user's owned tenants
    const ownedTenants = await prisma.user_tenants.findMany({
      where: {
        user_id: req.user.userId,
        role: user_tenant_role.OWNER,
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    const ownedTenantCount = ownedTenants.length;

    // Determine effective tier (highest tier owned)
    const tierPriority: Record<string, number> = {
      organization: 5,
      enterprise: 4,
      professional: 3,
      starter: 2,
      google_only: 1,
    };

    let effectiveTier = 'starter';
    let effectiveStatus = 'trial';
    let highestPriority = 0;

    for (const ut of ownedTenants) {
      const tier = ut.tenants.subscription_tier || 'starter';
      const status = ut.tenants.subscription_status || 'trial';
      const priority = tierPriority[tier] || 0;
      
      if (priority > highestPriority) {
        highestPriority = priority;
        effectiveTier = tier;
        effectiveStatus = status;
      }
    }

    // Get limit config (trial status overrides tier limits)
    const limitConfig = getTenantLimitConfig(effectiveTier, effectiveStatus);
    const remaining = getRemainingTenantSlots(ownedTenantCount, effectiveTier, effectiveStatus);

    return res.json({
      current: ownedTenantCount,
      limit: limitConfig.limit === Infinity ? 'unlimited' : limitConfig.limit,
      remaining: remaining === Infinity ? 'unlimited' : remaining,
      tier: effectiveTier,
      status: effectiveStatus,
      tierDisplayName: limitConfig.displayName,
      canCreate: remaining > 0 || remaining === Infinity,
      upgradeMessage: limitConfig.upgradeMessage,
      upgradeToTier: limitConfig.upgradeToTier,
      tenant: ownedTenants.map((ut: any) => ({
        id: ut.tenants.id,
        name: ut.tenants.name,
        tier: ut.tenants.subscription_tier,
        status: ut.tenants.subscription_status,
      })),
    });
  } catch (error) {
    console.error('[GET /api/tenant-limits/status] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_limit_status' });
  }
});

/**
 * GET /api/tenant-limits/tiers
 * 
 * Get all available tenant tiers and their limits (public endpoint)
 * This is useful for showing pricing and upgrade options
 */
router.get('/tiers', async (req, res) => {
  try {
    const tiers = Object.entries(TENANT_LIMITS).map(([tier, config]) => ({
      tier,
      displayName: config.displayName,
      description: config.description,
      limit: config.limit,
      upgradeMessage: config.upgradeMessage,
      upgradeToTier: config.upgradeToTier,
    }));

    return res.json({ tiers });
  } catch (error) {
    console.error('[GET /api/tenant-limits/tiers] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_tiers' });
  }
});

/**
 * GET /api/tenant-limits/featured-products
 * 
 * Get featured products limits for a tenant based on their subscription tier
 */
router.get('/featured-products', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    // Get tenant ID from query parameter
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    // Get tenant information
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Get limits based on tenant's actual tier
    const limits = getFeaturedProductsLimits(tenant.subscription_tier as any);

    return res.json({
      limits,
      tier: tenant.subscription_tier,
      status: tenant.subscription_status,
      // Add display names for frontend
      displayNames: {
        store_selection: 'Directory Featured',
        new_arrival: 'New Arrivals',
        seasonal: 'Seasonal Specials',
        sale: 'Sale Items',
        staff_pick: 'Staff Picks',
      }
    });
  } catch (error) {
    console.error('[GET /api/tenant-limits/featured-products] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_featured_limits' });
  }
});

/**
 * GET /api/tenant-limits/featured-products/all
 * 
 * Get featured products limits for all tiers (admin endpoint)
 */
router.get('/featured-products/all', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    // Return all tier limits from the persisted configuration
    return res.json({
      limits: FEATURED_PRODUCTS_LIMITS,
      tiers: Object.keys(FEATURED_PRODUCTS_LIMITS),
    });
  } catch (error) {
    console.error('[GET /api/tenant-limits/featured-products/all] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_all_featured_limits' });
  }
});

export default router;
