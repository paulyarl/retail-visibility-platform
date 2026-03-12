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

    // Get limits from database based on tenant's actual tier
    const tierLimits = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tenant.subscription_tier },
      select: {
        featured_store_selection: true,
        featured_new_arrival: true,
        featured_seasonal: true,
        featured_sale: true,
        featured_staff_pick: true,
        featured_bestseller: true,
        featured_clearance: true,
        featured_trending: true,
        featured_featured: true,
        featured_recommended: true
      }
    });

    if (!tierLimits) {
      return res.status(404).json({ error: 'tier_limits_not_found' });
    }

    // Convert database columns to expected format
    const limits = {
      store_selection: tierLimits.featured_store_selection || 0,
      new_arrival: tierLimits.featured_new_arrival || 0,
      seasonal: tierLimits.featured_seasonal || 0,
      sale: tierLimits.featured_sale || 0,
      staff_pick: tierLimits.featured_staff_pick || 0,
      random_featured: 0, // Legacy field - not used in new schema
      bestseller: tierLimits.featured_bestseller || 0,
      clearance: tierLimits.featured_clearance || 0,
      trending: tierLimits.featured_trending || 0,
      featured: tierLimits.featured_featured || 0,
      recommended: tierLimits.featured_recommended || 0
    };

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
        bestseller: 'Bestsellers',
        clearance: 'Clearance',
        trending: 'Trending',
        featured: 'Featured',
        recommended: 'Recommended'
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
 * Get all featured products limits for all tiers from database
 */
router.get('/featured-products/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is platform admin
    const user = (req as any).user;
    if (!isPlatformAdmin(user)) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    // Query subscription tiers from database
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: {
        is_active: true
      },
      select: {
        tier_key: true,
        display_name: true,
        featured_store_selection: true,
        featured_new_arrival: true,
        featured_seasonal: true,
        featured_sale: true,
        featured_staff_pick: true,
        featured_bestseller: true,
        featured_clearance: true,
        featured_trending: true,
        featured_featured: true,
        featured_recommended: true
      },
      orderBy: {
        sort_order: 'asc'
      }
    });

    // Convert database rows to the expected format
    const limits: Record<string, any> = {};
    tiers.forEach(tier => {
      limits[tier.tier_key] = {
        store_selection: tier.featured_store_selection || 0,
        new_arrival: tier.featured_new_arrival || 0,
        seasonal: tier.featured_seasonal || 0,
        sale: tier.featured_sale || 0,
        staff_pick: tier.featured_staff_pick || 0,
        random_featured: 0, // Legacy field - not used in new schema
        bestseller: tier.featured_bestseller || 0,
        clearance: tier.featured_clearance || 0,
        trending: tier.featured_trending || 0,
        featured: tier.featured_featured || 0,
        recommended: tier.featured_recommended || 0
      };
    });

    // Return all tier limits from the database
    return res.json({
      limits,
      tiers: Object.keys(limits),
    });
  } catch (error) {
    console.error('[GET /api/tenant-limits/featured-products/all] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_featured_products_limits' });
  }
});

/**
 * PUT /api/tenant-limits/featured-products
 * 
 * Update featured products limits for a tier (admin endpoint)
 */
router.put('/featured-products', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    // Check if user is platform admin
    const user = (req as any).user;
    if (!isPlatformAdmin(user)) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    const { tier, limits } = req.body;

    if (!tier || !limits) {
      return res.status(400).json({ error: 'tier and limits are required' });
    }

    // Update the database record
    const updatedTier = await prisma.subscription_tiers_list.update({
      where: {
        tier_key: tier
      },
      data: {
        featured_store_selection: limits.store_selection || 0,
        featured_new_arrival: limits.new_arrival || 0,
        featured_seasonal: limits.seasonal || 0,
        featured_sale: limits.sale || 0,
        featured_staff_pick: limits.staff_pick || 0,
        featured_bestseller: limits.bestseller || 0,
        featured_clearance: limits.clearance || 0,
        featured_trending: limits.trending || 0,
        featured_featured: limits.featured || 0,
        featured_recommended: limits.recommended || 0,
        updated_at: new Date(),
        updated_by: user.email || user.id
      }
    });

    // Invalidate any relevant caches
    // TODO: Add cache invalidation if needed

    return res.json({
      success: true,
      tier,
      limits: {
        store_selection: updatedTier.featured_store_selection,
        new_arrival: updatedTier.featured_new_arrival,
        seasonal: updatedTier.featured_seasonal,
        sale: updatedTier.featured_sale,
        staff_pick: updatedTier.featured_staff_pick,
        random_featured: 0, // Legacy field
        bestseller: updatedTier.featured_bestseller,
        clearance: updatedTier.featured_clearance,
        trending: updatedTier.featured_trending,
        featured: updatedTier.featured_featured,
        recommended: updatedTier.featured_recommended
      },
      message: 'Featured products limits updated successfully'
    });
  } catch (error) {
    console.error('[PUT /api/tenant-limits/featured-products] Error:', error);
    return res.status(500).json({ error: 'failed_to_update_featured_products_limits' });
  }
});

export default router;
