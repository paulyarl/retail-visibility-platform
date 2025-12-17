/**
 * Tenant API Routes
 *
 * Provides endpoints for tenant management and details
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess, requirePlatformAdmin } from '../middleware/auth';
import { canViewAllTenants } from '../utils/platform-admin';
import { getLocationStatusInfo } from '../utils/location-status';

const router = Router();

/**
 * GET /api/tenants
 * List tenants - platform users see all, regular users see their own
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.userId || user?.user_id || user?.id;
    const isPlatformUser = canViewAllTenants(user);

    let tenants;
    
    if (isPlatformUser) {
      // Platform users see all tenants
      tenants = await prisma.tenants.findMany({
        select: {
          id: true,
          name: true,
          organization_id: true,
          subscription_tier: true,
          subscription_status: true,
          location_status: true,
          created_at: true,
          organizations_list: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              inventory_items: true,
              user_tenants: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      // Regular users see only their own tenants via user_tenants
      const userTenants = await prisma.user_tenants.findMany({
        where: { user_id: userId },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              organization_id: true,
              subscription_tier: true,
              subscription_status: true,
              location_status: true,
              created_at: true,
              organizations_list: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  inventory_items: true,
                  user_tenants: true,
                },
              },
            },
          },
        },
      });
      tenants = userTenants.map(ut => ut.tenants);
    }

    // Transform for frontend compatibility
    const transformedTenants = tenants.map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      organizationId: tenant.organization_id,
      subscriptionTier: tenant.subscription_tier,
      locationStatus: tenant.location_status || 'active',
      createdAt: tenant.created_at,
      organization: tenant.organizations_list ? {
        id: tenant.organizations_list.id,
        name: tenant.organizations_list.name,
      } : null,
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
 * PATCH /api/tenants/:id
 * Update tenant subscription tier and status
 */
router.patch('/:id', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subscriptionTier, subscriptionStatus } = req.body;

    console.log('[PATCH /api/tenants/:id] Starting update for tenant:', id);
    console.log('[PATCH /api/tenants/:id] Request body:', { subscriptionTier, subscriptionStatus });

    // Validate input
    if (!subscriptionTier && !subscriptionStatus) {
      console.log('[PATCH /api/tenants/:id] Validation failed: no fields to update');
      return res.status(400).json({
        success: false,
        error: 'bad_request',
        message: 'Must provide subscriptionTier or subscriptionStatus to update'
      });
    }

    // Build update data
    const updateData: any = {};
    if (subscriptionTier) {
      updateData.subscription_tier = subscriptionTier;
      console.log('[PATCH /api/tenants/:id] Updating subscription_tier to:', subscriptionTier);
    }
    if (subscriptionStatus) {
      updateData.subscription_status = subscriptionStatus;
      console.log('[PATCH /api/tenants/:id] Updating subscription_status to:', subscriptionStatus);
    }

    console.log('[PATCH /api/tenants/:id] Final updateData:', updateData);

    // Update tenant
    console.log('[PATCH /api/tenants/:id] Executing database update...');
    const updatedTenant = await prisma.tenants.update({
      where: { id },
      data: updateData,
    });

    console.log('[PATCH /api/tenants/:id] Database update successful. Updated tenant:', {
      id: updatedTenant.id,
      name: updatedTenant.name,
      subscription_tier: updatedTenant.subscription_tier,
      subscription_status: updatedTenant.subscription_status,
    });

    // Transform response for frontend compatibility
    const transformedTenant = {
      id: updatedTenant.id,
      name: updatedTenant.name,
      organizationId: updatedTenant.organization_id,
      subscriptionTier: updatedTenant.subscription_tier,
      subscriptionStatus: updatedTenant.subscription_status,
      locationStatus: updatedTenant.location_status,
      createdAt: updatedTenant.created_at,
    };

    console.log('[PATCH /api/tenants/:id] Returning transformed response:', transformedTenant);

    res.json(transformedTenant);
  } catch (error: any) {
    console.error('[PATCH /api/tenants/:id] Error updating tenant:', error);
    console.error('[PATCH /api/tenants/:id] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update tenant',
    });
  }
});

/**
 * GET /api/tenants/:id
 * Get details for a specific tenant
 */
router.get('/:id', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
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
        productCount: (tenant as any)._count.inventory_items,
        userCount: (tenant as any)._count.user_tenants,
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
