import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

console.log('🔥 [Dashboard FIXED] Loading NEW dashboard-fixed.ts file');

const router = Router();

console.log('📋 Dashboard router created, defining routes...');

/**
 * GET /api/test
 * Test route to verify routing works
 */
router.get('/api/test', async (req: Request, res: Response) => {
  return res.json({ message: 'Routing works!' });
});

/**
 * GET /api/dashboard
 * FIXED VERSION - Correctly uses tenantId from query params
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      console.error('[Dashboard] No userId found in authenticated request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is PLATFORM_ADMIN - they can access any tenant
    const isPlatformAdmin = (req as any).user?.role === 'PLATFORM_ADMIN';

    let userTenants: any[] = [];
    
    if (isPlatformAdmin) {
      // PLATFORM_ADMIN can access all tenants - get all tenants from database
      const allTenants = await prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          organizationId: true,
        }
      });
      userTenants = allTenants.map(tenant => ({
        tenantId: tenant.id,
        tenant: tenant
      }));
    } else {
      // Regular user - get only their memberships (avoid complex relations)
      try {
        const userTenantMemberships = await prisma.userTenant.findMany({
          where: { userId },
          select: {
            tenantId: true,
            role: true,
          }
        });

        if (userTenantMemberships.length === 0) {
          console.warn(`[Dashboard] No tenant memberships found for user: ${userId}`);
          userTenants = [];
        } else {
          // Get tenant details separately
          const tenantIds = userTenantMemberships.map(ut => ut.tenantId);
          const tenants = await prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: {
              id: true,
              name: true,
              organizationId: true,
            }
          });

          // Combine membership and tenant data
          userTenants = userTenantMemberships.map(membership => {
            const tenant = tenants.find(t => t.id === membership.tenantId);
            return {
              tenantId: membership.tenantId,
              role: membership.role,
              tenant: tenant || { id: membership.tenantId, name: 'Unknown', organizationId: null }
            };
          });
        }
      } catch (userError) {
        console.error(`[Dashboard] Error fetching user tenants: ${userError.message}`);
        userTenants = [];
      }
    }

    if (!userTenants.length) {
      console.warn(`[Dashboard] No tenants found for users: ${userId}`);
      return res.json({
        stats: {
          totalItems: 0,
          activeItems: 0,
          syncIssues: 0,
          locations: 0,
        },
        tenant: null,
        isChain: false,
        organizationName: null,
      });
    }

    // Get tenant ID from query param (support both tenantId and tenantId)
    const requestedTenantId = (req.query.tenantId || req.query.tenantId) as string | undefined;
    
    // Find the requested tenant in user's memberships
    let targetMembership = requestedTenantId 
      ? userTenants.find((m: any) => m.tenantId === requestedTenantId || m.tenant.id === requestedTenantId)
      : null;
    
    // Fallback to first tenant if not found
    if (!targetMembership) {
      targetMembership = userTenants[0];
    }
    
    const tenantId = (targetMembership as any).tenantId || (targetMembership as any).tenant.id;
    const organizationId = (targetMembership as any).tenant.organizationId;

    // Fetch data with error handling
    let itemStats, tenant, organization;
    try {
      [itemStats, tenant, organization] = await Promise.all([
        prisma.inventoryItem.aggregate({
          where: { tenantId },
          _count: { id: true },
        }).catch(err => {
          console.log('[Dashboard FIXED] Item stats error:', err.message);
          return { _count: { id: 0 } };
        }),
        
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            organizationId: true,
          }
        }).catch(err => {
          console.log('[Dashboard FIXED] Tenant fetch error:', err.message);
          return null;
        }),

        organizationId ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            name: true,
            _count: {
              select: { Tenant: true }
            }
          }
        }).catch(err => {
          console.log('[Dashboard FIXED] Organization fetch error:', err.message);
          return null;
        }) : Promise.resolve(null),
      ]);
    } catch (err) {
      console.log('[Dashboard FIXED] Data fetch error:', err);
      itemStats = { _count: { id: 0 } };
      tenant = null;
      organization = null;
    }

    let activeItemsCount = 0, syncIssuesCount = 0;
    try {
      [activeItemsCount, syncIssuesCount] = await Promise.all([
        prisma.inventoryItem.count({
          where: {
            tenantId,
            availability: 'in_stock',
          }
        }).catch(err => {
          console.log('[Dashboard FIXED] Active items count error:', err.message);
          return 0;
        }),
        
        prisma.inventoryItem.count({
          where: {
            tenantId,
            OR: [
              { gtin: null },
              { gtin: '' },
            ]
          }
        }).catch(err => {
          console.log('[Dashboard FIXED] Sync issues count error:', err.message);
          return 0;
        }),
      ]);
    } catch (err) {
      console.log('[Dashboard FIXED] Count queries error:', err);
    }

    const isChain = organization ? (organization._count.Tenant > 1) : false;
    const locationCount = organization?._count.Tenant || 1;

    const result = {
      stats: {
        totalItems: itemStats._count.id,
        activeItems: activeItemsCount,
        syncIssues: syncIssuesCount,
        locations: locationCount,
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
      } : null,
      isChain,
      organizationName: organization?.name || null,
    };

    console.log('[Dashboard FIXED] Returning data for tenant:', result.tenant?.name);
    return res.json(result);

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * TEST ROUTE - No authentication required
 */
router.get('/dashboard-test', async (req: Request, res: Response) => {
  console.log('🧪 TEST ROUTE HIT!');
  return res.json({
    test: true,
    message: 'Dashboard test route working!',
    tenantId: req.query.tenantId,
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Dashboard routes defined');

export default router;
