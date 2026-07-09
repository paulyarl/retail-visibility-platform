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
import { z } from 'zod';

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

const router = Router({ mergeParams: true });

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
          subscription_ends_at: true,
          trial_ends_at: true,
          grace_ends_at: true,
          ...(true as any && {
            manual_subscription_control: true,
            manual_subscription_expires_at: true,
            manual_subscription_reason: true,
          }),
          location_status: true,
          created_at: true,
          organizations_list: {
            select: {
              id: true,
              name: true,
            },
          },
          tenant_business_profiles_list: {
            select: {
              logo_url: true,
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
              subscription_ends_at: true,
              trial_ends_at: true,
              grace_ends_at: true,
              ...(true as any && {
                manual_subscription_control: true,
                manual_subscription_expires_at: true,
                manual_subscription_reason: true,
              }),
              location_status: true,
              created_at: true,
              organizations_list: {
                select: {
                  id: true,
                  name: true,
                },
              },
              tenant_business_profiles_list: {
                select: {
                  logo_url: true,
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

    // Transform the data to match the expected format
    const transformedTenants = tenants.map(tenant => {
      // Calculate effective expiration: Manual takes priority over automatic
      const effectiveExpiration = (tenant as any).manual_subscription_control 
        ? {
            expiresAt: (tenant as any).manual_subscription_expires_at,
            type: 'manual' as const,
            source: 'manual_override' as const
          }
        : (tenant as any).subscription_status === 'trial' && (tenant as any).trial_ends_at
          ? {
              expiresAt: (tenant as any).trial_ends_at,
              type: 'trial' as const,
              source: 'automatic_trial' as const
            }
          : (tenant as any).subscription_ends_at
            ? {
                expiresAt: (tenant as any).subscription_ends_at,
                type: 'subscription' as const,
                source: 'automatic_subscription' as const
              }
            : null;

      return {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
        subscriptionTier: tenant.subscription_tier,
        subscriptionStatus: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        subscriptionEndsAt: tenant.subscription_ends_at,
        graceEndsAt: tenant.grace_ends_at,
        createdAt: tenant.created_at,
        locationStatus: (tenant as any).location_status,
        tenantLogo: (tenant as any).tenant_business_profiles_list?.logo_url || null,
        // hasPublishedDirectory: hasPublishedDirectory,
        organization: (tenant as any).organizations_list ? {
          id: (tenant as any).organizations_list.id,
          name: (tenant as any).organizations_list.name,
        } : null,
        _count: {
          items: (tenant as any)._count.inventory_items,
          users: (tenant as any)._count.user_tenants,
        },
        // Manual subscription control fields
        manualSubscriptionControl: (tenant as any).manual_subscription_control,
        manualSubscriptionExpiresAt: (tenant as any).manual_subscription_expires_at,
        manualSubscriptionReason: (tenant as any).manual_subscription_reason,
        // Effective expiration fields
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source
      };
    });

    // Add caching headers for better performance (5 minute cache for tenant lists)
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.setHeader('Vary', 'Authorization'); // Vary on auth header since results differ by user

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
    const { subscriptionTier, subscriptionStatus, organizationId } = req.body;

    console.log('[PATCH /api/tenants/:id] Starting update for tenant:', id);
    console.log('[PATCH /api/tenants/:id] Request body:', { subscriptionTier, subscriptionStatus, organizationId });

    // Validate input
    if (!subscriptionTier && !subscriptionStatus && organizationId === undefined) {
      console.log('[PATCH /api/tenants/:id] Validation failed: no fields to update');
      return res.status(400).json({
        success: false,
        error: 'bad_request',
        message: 'Must provide subscriptionTier, subscriptionStatus, or organizationId to update'
      });
    }

    // Good standing check for organization membership
    if (organizationId !== undefined) {
      const { validateTenantOrganizationMembership } = await import('../utils/tenant-organization-validation');
      const validation = await validateTenantOrganizationMembership(id, organizationId);
      
      if (!validation.valid) {
        console.log('[PATCH /api/tenants/:id] Organization membership validation failed:', validation.reason);
        return res.status(403).json({
          success: false,
          error: 'organization_membership_denied',
          message: validation.message,
          reason: validation.reason,
        });
      }
      
      console.log('[PATCH /api/tenants/:id] Organization membership validation passed');
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
    if (organizationId !== undefined) {
      updateData.organization_id = organizationId;
      console.log('[PATCH /api/tenants/:id] Updating organization_id to:', organizationId);
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
     // Check if tenant has published directory listing
    const tenantResult = await prisma.directory_settings_list.findUnique({
        where: { tenant_id: updatedTenant.id },
        select: {
          is_published: true
        }
      });

      const hasDirectory = tenantResult?.is_published === true;


    // Transform response for frontend compatibility
    const transformedTenant = {
      id: updatedTenant.id,
      name: updatedTenant.name,
      organizationId: updatedTenant.organization_id,
      subscriptionTier: updatedTenant.subscription_tier,
      subscriptionStatus: updatedTenant.subscription_status,
      locationStatus: updatedTenant.location_status,
      createdAt: updatedTenant.created_at,
      hasPublishedDirectory: hasDirectory,
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

// NOTE: GET /api/tenants/:id is handled by index.ts (inline handler registered
// before this router mount, so it takes precedence). All fields from the
// former handler here have been merged into the index.ts handler.

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
 * GET /api/tenants/:id/complete
 * Get complete tenant information including tier, usage, and basic details in one call
 * This consolidates the separate calls to /tenants/:id, /tenants/:id/tier, and /tenants/:id/usage
 */
router.get('/:id/complete', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    console.log(`[TENANTS] Fetching complete tenant data for: ${id}`);

    // Single database query with all necessary joins
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
        tenant_business_profiles_list: {
          select: {
            logo_url: true,
            city: true,
            state: true,
            country_code: true,
            banner_url: true,
          },
        },
        _count: {
          select: {
            inventory_items: true,
            user_tenants: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Get tier information (this is the expensive part that was separate)
    let tierInfo: any = null;
    let organizationTier: any = null;
    let tenantTier: any = null;
    let isChain = false;

    try {
      // Reuse existing tier resolution logic from useTenantTier
      const tierEndpoint = user
        ? `/api/tenants/${id}/tier`
        : `/api/tenants/${id}/tier/public`;

      // This would need to be refactored to avoid the actual HTTP call
      // For now, inline the tier logic here to avoid the separate call
      const tenantTierData = await prisma.tenants.findUnique({
        where: { id },
        select: {
          subscription_tier: true,
          subscription_status: true,
          organization_id: true,
        },
      });

      // This is simplified - you'd need to implement the full tier resolution logic
      tierInfo = {
        tier: tenantTierData?.subscription_tier || 'free',
        status: tenantTierData?.subscription_status || 'inactive',
      };
    } catch (tierError) {
      console.warn(`[TENANTS] Could not fetch tier info for ${id}:`, tierError);
      // Continue without tier data rather than failing the whole request
    }

    // Get usage information (this was the third separate call)
    let usageInfo: any = null;
    try {
      // Calculate usage counts directly from database
      // Use same filtering as /api/items/complete: exclude trashed items
      const [totalItems, activeItems, locationCount, userCount] = await Promise.all([
        prisma.inventory_items.count({ where: { tenant_id: id, item_status: { not: 'trashed' } } }),
        prisma.inventory_items.count({ where: { tenant_id: id, item_status: 'active', visibility: { not: 'private' } } }),
        // Count actual locations for this tenant
        prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM locations WHERE tenant_id = $1`, [id])
          .then((result: any) => Number(result[0]?.count || 1))
          .catch(() => 1), // Fallback to 1 if no locations table or error
        prisma.user_tenants.count({ where: { tenant_id: id } }),
      ]);

      usageInfo = {
        totalItems,
        activeItems,
        products: totalItems,
        locations: locationCount,
        users: userCount,
        apiCalls: 0, // Would need to implement API call tracking
        storageGB: 0, // Would need to implement storage tracking
      };
    } catch (usageError) {
      console.warn(`[TENANTS] Could not fetch usage info for ${id}:`, usageError);
      // Continue without usage data rather than failing the whole request
    }
 // Check if tenant has published directory listing
    const tenantResult = await prisma.directory_settings_list.findUnique({
        where: { tenant_id: id },
        select: {
          is_published: true
        }
      });

      const hasDirectory = tenantResult?.is_published === true;
    // Transform response for frontend compatibility
    const transformedResponse = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
        subscriptionTier: tenant.subscription_tier,
        subscriptionStatus: tenant.subscription_status,
        locationStatus: tenant.location_status,
        subdomain: tenant.subdomain,
        createdAt: tenant.created_at,
        logoUrl: (tenant as any).tenant_business_profiles_list?.logo_url || null,
        hasPublishedDirectory: hasDirectory,
        statusInfo: getLocationStatusInfo(tenant.location_status as any),
        stats: {
          productCount: usageInfo?.totalItems || 0,
          userCount: tenant._count.user_tenants,
        },
        // Location fields from business profile
        city: (tenant as any).tenant_business_profiles_list?.city || null,
        state: (tenant as any).tenant_business_profiles_list?.state || null,
        country_code: (tenant as any).tenant_business_profiles_list?.country_code || null,
        banner_url: (tenant as any).tenant_business_profiles_list?.banner_url || null,
      },
      tier: tierInfo,
      usage: usageInfo,
      // Include any other frequently requested data here
      _timestamp: new Date().toISOString(), // For cache invalidation
    };

    console.log(`[TENANTS] Returning complete tenant data for:`, {
      id: transformedResponse.tenant.id,
      hasTier: !!transformedResponse.tier,
      hasUsage: !!transformedResponse.usage,
    });

    // Cache for 2 minutes (shorter than individual endpoints since this combines them)
    res.setHeader('Cache-Control', 'private, max-age=120');
    res.setHeader('Vary', 'Authorization');

    res.json(transformedResponse);
  } catch (error: any) {
    console.error('[TENANTS] Error fetching complete tenant data:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch complete tenant data',
    });
  }
});

// NOTE: GET /api/tenants/my-subdomains is handled by index.ts (inline handler
// registered before this router mount, so it takes precedence).

// NOTE: POST /api/tenants/:id/logo is handled by index.ts (multer-based file
// upload handler registered before this router mount, so it takes precedence).

// Mount billing routes for tenants
import tenantBillingRoutes from './tenant-billing';
router.use('/:tenantId/billing', tenantBillingRoutes);

/**
 * PATCH /api/tenants/:id/status
 * Update tenant location status with immediate cache invalidation
 */
router.patch('/:id/status', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('[PATCH /api/tenants/:id/status] Starting location status update:', { id, status });

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id_required',
        message: 'Tenant ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status_required',
        message: 'Status is required'
      });
    }

    // Validate status transition using location status utility
    const { validateStatusChange } = await import('../utils/location-status');
    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: { location_status: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found'
      });
    }

    const validation = validateStatusChange(tenant.location_status as any, status);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'invalid_status_transition',
        message: validation.error
      });
    }

    // Update tenant location status
    console.log('[PATCH /api/tenants/:id/status] Updating location status in database...');
    const updatedTenant = await prisma.tenants.update({
      where: { id },
      data: {
        location_status: status,
        status_changed_at: new Date()
      }
    });

    console.log('[PATCH /api/tenants/:id/status] Database update successful:', {
      id: updatedTenant.id,
      oldStatus: tenant.location_status,
      newStatus: status
    });

    // 🔥 CRITICAL: Invalidate all related caches immediately
    await invalidateAllTenantCaches(id);

    // Return updated tenant info
    const transformedTenant = {
      id: updatedTenant.id,
      name: updatedTenant.name,
      locationStatus: updatedTenant.location_status,
      statusChangedAt: updatedTenant.status_changed_at,
      subscriptionTier: updatedTenant.subscription_tier,
      subscriptionStatus: updatedTenant.subscription_status,
      createdAt: updatedTenant.created_at
    };

    console.log('[PATCH /api/tenants/:id/status] Cache invalidation complete, returning response');
    res.json({
      success: true,
      data: transformedTenant,
      message: `Location status updated to ${status} with immediate cache invalidation`
    });

  } catch (error: any) {
    console.error('[PATCH /api/tenants/:id/status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update location status',
      details: error.message
    });
  }
});

/**
 * Invalidate all tenant-related caches when location status changes
 * This ensures immediate propagation across all three cache layers
 */
async function invalidateAllTenantCaches(tenantId: string) {
  try {
    console.log(`[Cache Invalidation] Starting cache invalidation for tenant ${tenantId}`);
    
    const { getCacheService } = await import('../services/OverrideCacheService');
    const cacheService = getCacheService();
    
    // Get tenant info for additional cache keys
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { slug: true }
    });

    // Use the built-in tenant invalidation which handles all cache patterns
    await cacheService.invalidateTenant(tenantId);
    
    // Also invalidate slug-based caches if slug exists
    if (tenant?.slug) {
      await cacheService.invalidateTenant(tenant.slug);
    }
    
    console.log(`[Cache Invalidation] Cleared cache keys for tenant ${tenantId}`);
    console.log(`[Cache Invalidation] Invalidated keys for slug: ${tenant?.slug || 'no-slug'}`);
    
  } catch (error) {
    console.error(`[Cache Invalidation] Error invalidating caches for tenant ${tenantId}:`, error);
    // Don't throw - cache invalidation failure shouldn't break the status update
  }
}

export default router;
