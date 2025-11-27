/**
 * Tenant API Routes
 *
 * Provides endpoints for tenant management and details
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { canViewAllTenants } from '../utils/platform-admin';

const router = Router();

/**
 * GET /api/tenants
 * List all tenants (for quick-start and admin purposes)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        organizationId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
        _count: {
          select: {
            inventoryItems: true,
            userTenants: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform for frontend compatibility
    const transformedTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      organizationId: tenant.organizationId,
    }));

    res.json(transformedTenants);
  } catch (error: any) {
    console.error('[TENANTS] Error fetching tenants list:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tenants list',
    });
  }
});

/**
 * GET /api/tenants/:id
 * Get details for a specific tenant
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
        _count: {
          select: {
            inventoryItems: true,
            userTenants: true,
          },
        },
      },
    });

    console.log(`[TENANTS] Tenant lookup result:`, tenant ? 'FOUND' : 'NOT FOUND');

    if (!tenant) {
      console.log(`[TENANTS] No tenant found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Transform for frontend compatibility
    const transformedTenant = {
      id: tenant.id,
      name: tenant.name,
      organizationId: tenant.organizationId,
      subscriptionTier: tenant.subscriptionTier,
      subscriptionStatus: tenant.subscriptionStatus,
      createdAt: tenant.createdAt,
      stats: {
        productCount: tenant._count.inventoryItems,
        userCount: tenant._count.userTenants,
      },
    };

    res.json(transformedTenant);
  } catch (error: any) {
    console.error('[TENANTS] Error fetching tenant details:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch tenant details',
    });
  }
});

export default router;
