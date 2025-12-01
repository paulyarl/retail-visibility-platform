/**
 * Tenant Limits API Routes
 * 
 * Endpoints for checking tenant creation limits and upgrade paths
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getTenantLimitConfig, getRemainingTenantSlots, getPlatformSupportLimit } from '../config/tenant-limits';
import { UserTenantRole } from '@prisma/client';

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
      const totalTenants = await prisma.tenant.count();
      
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
      const ownedTenants = await prisma.userTenant.count({
        where: {
          userId: req.user.userId,
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
    const ownedTenants = await prisma.userTenant.findMany({
      where: {
        userId: req.user.userId,
        role: UserTenantRole.OWNER,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
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
      const tier = ut.tenant.subscriptionTier || 'starter';
      const status = ut.tenant.subscriptionStatus || 'trial';
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
        id: ut.tenant.id,
        name: ut.tenant.name,
        tier: ut.tenant.subscriptionTier,
        status: ut.tenant.subscriptionStatus,
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
 * Get all available tiers with their location limits
 */
router.get('/tiers', async (_req, res) => {
  try {
    const { TENANT_LIMITS } = await import('../config/tenant-limits');
    
    const tiers = Object.entries(TENANT_LIMITS).map(([key, config]) => ({
      tier: key,
      limit: config.limit === Infinity ? 'unlimited' : config.limit,
      displayName: config.displayName,
      description: config.description,
      upgradeMessage: config.upgradeMessage,
      upgradeToTier: config.upgradeToTier,
    }));

    return res.json({ tiers });
  } catch (error) {
    console.error('[GET /api/tenant-limits/tiers] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_tiers' });
  }
});

export default router;
