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

// Rate limiting store (simple in-memory for now, could be Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMITS = {
  subdomainCheck: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 checks per minute
  subdomainCreate: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 creations per hour per tenant
  subdomainResolve: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 resolutions per minute (for middleware)
};

/**
 * Check rate limit for a given key and operation
 */
function checkRateLimit(key: string, operation: keyof typeof RATE_LIMITS): { allowed: boolean; remaining: number; resetTime: number } {
  const config = RATE_LIMITS[operation];
  const now = Date.now();
  const storeKey = `${operation}:${key}`;

  const record = rateLimitStore.get(storeKey);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(storeKey, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }

  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: config.maxRequests - record.count, resetTime: record.resetTime };
}

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
      subscriptionStatus: tenant.subscription_status,
      trialEndsAt: tenant.trial_ends_at,
      subscriptionEndsAt: tenant.subscription_ends_at,
      createdAt: tenant.created_at,
      organization: tenant.organizations_list ? {
        id: tenant.organizations_list.id,
        name: tenant.organizations_list.name,
      } : null,
      _count: {
        items: tenant._count.inventory_items,
      },
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
        subdomain: true,
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

/**
 * PUT /api/tenants/:id/subdomain
 * Set or update subdomain for a tenant
 */
router.put('/:id/subdomain', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subdomain } = req.body;

    // Rate limiting: 3 subdomain creations per hour per tenant
    const rateLimitResult = checkRateLimit(id, 'subdomainCreate');
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit_exceeded',
        message: `Too many subdomain creations. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000 / 60)} minutes.`,
        retryAfter: rateLimitResult.resetTime
      });
    }

    // Validate subdomain format
    if (!subdomain || typeof subdomain !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'bad_request',
        message: 'Subdomain is required and must be a string'
      });
    }

    // Basic subdomain validation (lowercase, alphanumeric, hyphens only, 3-30 chars)
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_subdomain',
        message: 'Subdomain must be 2-30 characters, contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen'
      });
    }

    // Check if subdomain is already taken by another tenant
    const existingTenant = await prisma.tenants.findFirst({
      where: {
        subdomain,
        id: { not: id } // Exclude current tenant
      }
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: 'subdomain_taken',
        message: 'This subdomain is already taken by another tenant'
      });
    }

    // Update tenant with new subdomain
    const updatedTenant = await prisma.tenants.update({
      where: { id },
      data: { subdomain },
      select: {
        id: true,
        name: true,
        subdomain: true,
        created_at: true
      }
    });

    console.log(`[TENANTS] Updated subdomain for tenant ${id}: ${subdomain}`);

    res.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
        createdAt: updatedTenant.created_at
      }
    });
  } catch (error: any) {
    console.error('[TENANTS] Error updating subdomain:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update subdomain'
    });
  }
});

/**
 * DELETE /api/tenants/:id/subdomain
 * Remove subdomain from a tenant
 */
router.delete('/:id/subdomain', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Remove subdomain by setting it to null
    const updatedTenant = await prisma.tenants.update({
      where: { id },
      data: { subdomain: null },
      select: {
        id: true,
        name: true,
        subdomain: true,
        created_at: true
      }
    });

    console.log(`[TENANTS] Removed subdomain for tenant ${id}`);

    res.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
        createdAt: updatedTenant.created_at
      }
    });
  } catch (error: any) {
    console.error('[TENANTS] Error removing subdomain:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to remove subdomain'
    });
  }
});

/**
 * GET /api/tenants/check-subdomain/:subdomain
 * Check if a subdomain is available
 */
router.get('/check-subdomain/:subdomain', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;
    const user = req.user as any;
    const userId = user?.userId || user?.user_id || user?.id;

    // Get the user's tenants to check if they own this subdomain
    const userTenants = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      select: { tenant_id: true }
    });
    const tenantIds = userTenants.map(ut => ut.tenant_id);

    // Rate limiting: 10 subdomain checks per minute per user
    const rateLimitResult = checkRateLimit(userId || req.ip || 'anonymous', 'subdomainCheck');
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        available: false,
        valid: false,
        message: `Too many requests. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
        rateLimitExceeded: true
      });
    }

    // Basic validation
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]$/;
    const isValid = subdomainRegex.test(subdomain);

    if (!isValid) {
      return res.json({
        available: false,
        valid: false,
        message: 'Invalid subdomain format'
      });
    }

    // Check if subdomain exists
    const existingTenant = await prisma.tenants.findFirst({
      where: { subdomain },
      select: { id: true, name: true }
    });

    // If no tenant has this subdomain, it's available
    if (!existingTenant) {
      return res.json({
        available: true,
        valid: true,
        subdomain,
        message: 'Subdomain is available',
        ownedByCurrentUser: false
      });
    }

    // If the existing tenant is owned by the current user, they can reuse it
    const ownedByCurrentUser = tenantIds.includes(existingTenant.id);

    if (ownedByCurrentUser) {
      return res.json({
        available: true,
        valid: true,
        subdomain,
        message: 'This is your current subdomain',
        ownedByCurrentUser: true,
        tenantName: existingTenant.name
      });
    }

    // Subdomain is taken by another tenant
    res.json({
      available: false,
      valid: true,
      subdomain,
      message: 'Subdomain is already taken by another tenant',
      ownedByCurrentUser: false
    });
  } catch (error: any) {
    console.error('[TENANTS] Error checking subdomain availability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to check subdomain availability'
    });
  }
});

/**
 * GET /api/tenants/resolve-subdomain/:subdomain
 * Resolve subdomain to tenant ID for storefront routing
 */
router.get('/resolve-subdomain/:subdomain', async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;

    // Find tenant by subdomain
    const tenant = await prisma.tenants.findFirst({
      where: { subdomain },
      select: { id: true, name: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'subdomain_not_found',
        message: 'No tenant found for this subdomain'
      });
    }

    res.json({
      success: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      subdomain
    });
  } catch (error: any) {
    console.error('[TENANTS] Error resolving subdomain:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve subdomain'
    });
  }
});

/**
 * GET /api/tenants/my-subdomains
 * Get all subdomains for the current user's tenants
 */
router.get('/my-subdomains', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.userId || user?.user_id || user?.id;

    // Get all tenants for this user
    const userTenants = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            created_at: true
          }
        }
      }
    });

    // Filter tenants that have subdomains and format the response
    const subdomains = userTenants
      .filter(ut => ut.tenants.subdomain)
      .map(ut => {
        // Detect platform domain (similar to frontend logic)
        let platformDomain = 'visibleshelf.com';
        if (req.headers.host) {
          const hostname = req.headers.host.split(':')[0]; // Remove port if present
          if (hostname.endsWith('.visibleshelf.com')) {
            platformDomain = 'visibleshelf.com';
          } else if (hostname.endsWith('.visibleshelf.store')) {
            platformDomain = 'visibleshelf.store';
          } else if (hostname.endsWith('.localhost') || hostname === 'localhost') {
            platformDomain = 'localhost';
          }
        }

        return {
          tenantId: ut.tenants.id,
          tenantName: ut.tenants.name,
          subdomain: ut.tenants.subdomain,
          createdAt: ut.tenants.created_at,
          url: `https://${ut.tenants.subdomain}.${platformDomain}`,
          platformDomain
        };
      });

    res.json({
      success: true,
      subdomains,
      total: subdomains.length
    });
  } catch (error: any) {
    console.error('[TENANTS] Error fetching user subdomains:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch subdomains'
    });
  }
});

export default router;
