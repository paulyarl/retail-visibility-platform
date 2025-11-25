/**
 * Admin Tenant Management API Routes
 * 
 * Provides endpoints for platform admins to list and manage tenants.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { requirePlatformAdmin } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/admin/tenants
 * List all tenants for platform admin management
 * Permission: Platform admin only
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN TENANTS] Request received from platform admin');

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
        _count: {
          select: {
            inventoryItems: true,
            userTenants: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[ADMIN TENANTS] Found ${tenants.length} tenants`);

    // Transform for frontend compatibility
    const transformedTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      subscriptionTier: tenant.subscriptionTier,
      subscriptionStatus: tenant.subscriptionStatus,
      createdAt: tenant.createdAt,
      organization: tenant.organization,
      stats: {
        productCount: tenant._count.inventoryItems,
        userCount: tenant._count.userTenants,
      },
    }));

    res.json(transformedTenants);
  } catch (error: any) {
    console.error('[ADMIN TENANTS] Error fetching tenants:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch tenants',
    });
  }
});

export default router;
