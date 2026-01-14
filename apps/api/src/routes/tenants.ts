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
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { StorageBuckets } from '../storage-config';

// Create service role Supabase client for storage operations (bypasses RLS)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseService = createClient(
  process.env.SUPABASE_URL!,
  serviceRoleKey!
);

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
        tenant_business_profiles_list: {
          select: {
            logo_url: true,
          },
        },
        payment_gateways: {
          where: { is_active: true },
          take: 1,
          select: { id: true },
        },
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

    // Check if tenant has active payment gateway for cart feature
    const hasActivePaymentGateway = (tenant as any).payment_gateways?.length > 0;

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
      logoUrl: (tenant as any).tenant_business_profiles_list?.logo_url || null,
      hasActivePaymentGateway,
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
      const [productCount, locationCount, userCount] = await Promise.all([
        prisma.inventory_items.count({ where: { tenant_id: id } }),
        // For now, assume single location per tenant - adjust based on your location model
        Promise.resolve(1), // Placeholder for location count
        prisma.user_tenants.count({ where: { tenant_id: id } }),
      ]);

      usageInfo = {
        products: productCount,
        locations: locationCount,
        users: userCount,
        apiCalls: 0, // Would need to implement API call tracking
        storageGB: 0, // Would need to implement storage tracking
      };
    } catch (usageError) {
      console.warn(`[TENANTS] Could not fetch usage info for ${id}:`, usageError);
      // Continue without usage data rather than failing the whole request
    }

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
        statusInfo: getLocationStatusInfo(tenant.location_status as any),
        stats: {
          productCount: tenant._count.inventory_items,
          userCount: tenant._count.user_tenants,
        },
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

/**
 * POST /api/tenants/:id/logo
 * Upload a logo for a tenant's business profile
 */
router.post('/:id/logo', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { url: logoUrl } = req.body;

    console.log(`[TENANTS] Logo upload request for tenant: ${id}`);

    // Validate required fields
    if (!logoUrl) {
      return res.status(400).json({
        success: false,
        error: 'missing_url',
        message: 'Logo URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(logoUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'invalid_url',
        message: 'Invalid URL format'
      });
    }

    // Fetch the image from the URL
    console.log(`[TENANTS] Fetching image from URL: ${logoUrl}`);
    const fetchResponse = await fetch(logoUrl, {
      headers: {
        'User-Agent': 'VisibleShelf/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!fetchResponse.ok) {
      return res.status(400).json({
        success: false,
        error: 'fetch_failed',
        message: `Failed to fetch image from URL: ${fetchResponse.status} ${fetchResponse.statusText}`
      });
    }

    // Get content type
    const contentType = fetchResponse.headers.get('content-type') || 'image/jpeg';

    // Validate content type
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'invalid_content_type',
        message: 'URL must point to an image file'
      });
    }

    // Convert response to buffer
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageBuffer.length > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'file_too_large',
        message: 'Logo file must be less than 5MB'
      });
    }

    // Generate unique filename
    const urlPath = new URL(logoUrl).pathname;
    const fileExtension = contentType.split('/')[1] || urlPath.split('.').pop() || 'png';
    const fileName = `tenant-logo-${id}-${Date.now()}.${fileExtension}`;

    // Upload to Supabase TENANTS bucket
    const supabasePath = `logos/${id}/${fileName}`;
    const { error: uploadError, data: uploadData } = await supabaseService.storage
      .from(StorageBuckets.TENANTS.name)
      .upload(supabasePath, imageBuffer, {
        cacheControl: "3600",
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[TENANTS] Supabase upload error:', uploadError.message);
      return res.status(500).json({
        success: false,
        error: 'upload_failed',
        message: 'Failed to upload logo to storage'
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabaseService.storage
      .from(StorageBuckets.TENANTS.name)
      .getPublicUrl(supabasePath);
    
    const uploadedLogoUrl = publicUrlData.publicUrl;

    console.log(`[TENANTS] Logo uploaded to Supabase: ${uploadedLogoUrl}`);

    // Update tenant's business profile with logo URL
    await prisma.tenant_business_profiles_list.upsert({
      where: { tenant_id: id },
      update: { logo_url: uploadedLogoUrl },
      create: {
        tenant_id: id,
        logo_url: uploadedLogoUrl,
        business_name: '', // Will be filled by business profile
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country_code: 'US',
        phone_number: '',
        email: '',
        website: '',
        business_description: '',
        updated_at: new Date(),
      }
    });

    console.log(`[TENANTS] Logo uploaded successfully for tenant ${id}: ${uploadedLogoUrl}`);

    res.json({
      success: true,
      url: uploadedLogoUrl,
      message: 'Logo uploaded successfully'
    });

  } catch (error: any) {
    console.error('[TENANTS] Error uploading logo:', error);
    if (error.name === 'AbortError') {
      return res.status(408).json({
        success: false,
        error: 'timeout',
        message: 'Request timed out while fetching image'
      });
    }
    res.status(500).json({
      success: false,
      error: 'upload_failed',
      message: 'Failed to upload logo'
    });
  }
});

export default router;
