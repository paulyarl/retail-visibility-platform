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

    const tenants = await prisma.tenants.findMany({
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        created_at: true,
        _count: {
          select: {
            inventory_items: true,
            user_tenants: true,
          },
        },
        organizations_list: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    console.log(`[ADMIN TENANTS] Found ${tenants.length} tenants`);

    // Transform for frontend compatibility
    const transformedTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      subscriptionTier: tenant.subscription_tier,
      subscriptionStatus: tenant.subscription_status,
      createdAt: tenant.created_at,
      organization: tenant.organizations_list,
      stats: {
        productCount: tenant._count.inventory_items,
        userCount: tenant._count.user_tenants,
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
