/**
 * Tenant API Routes
 *
 * Provides endpoints for tenant management and details
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { canViewAllTenants } from '../utils/platform-admin';
import { getLocationStatusInfo } from '../utils/location-status';

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

    const tenants = await prisma.tenants.findMany({
      select: {
        id: true,
        name: true,
        organization_id: true,
        subscription_tier: true,
        subscription_status: true,
        created_at: true,
        _count: {
          select: {
            inventory_items: true,
            user_tenants: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Transform for frontend compatibility
    const transformedTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      organizationId: tenant.organization_id,
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

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organization_id: true,
        subscription_tier: true,
        subscription_status: true,
        location_status: true,
        created_at: true,
        _count: {
          select: {
            inventory_items: true,
            user_tenants: true,
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
      organizationId: tenant.organization_id,
      subscriptionTier: tenant.subscription_tier,
      subscriptionStatus: tenant.subscription_status,
      createdAt: tenant.created_at,
      locationStatus: tenant.location_status,
      statusInfo: getLocationStatusInfo(tenant.location_status as any),
      stats: {
        productCount: tenant._count.inventory_items,
        userCount: tenant._count.user_tenants,
      },
    };

    console.log(`[TENANTS] Returning tenant data:`, {
      id: transformedTenant.id,
      locationStatus: transformedTenant.locationStatus,
      statusInfo: transformedTenant.statusInfo
    });

    // Prevent caching to ensure fresh status data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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
