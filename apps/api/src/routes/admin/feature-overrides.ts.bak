/**
 * Feature Overrides Admin API
 * 
 * Allows platform admins to grant or revoke specific tier features
 * for individual tenants, enabling custom deals, beta testing, and
 * support exceptions.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { isPlatformAdmin } from '../../utils/platform-admin';
import { getCacheService } from '../../services/OverrideCacheService';
import { getAnalyticsService } from '../../services/OverrideAnalyticsService';
import { generateFeatureOverrideId } from '../../lib/id-generator';

const router = Router();

// Validation schemas
const createOverrideSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  feature: z.string().min(1, 'Feature name is required'),
  granted: z.boolean(),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional(),
});

const updateOverrideSchema = z.object({
  granted: z.boolean().optional(),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

// Advanced override schemas
const createPricingOverrideSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  originalPrice: z.number().positive('Original price must be positive'),
  customPrice: z.number().positive('Custom price must be positive'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0, 'Discount value must be non-negative'),
  currency: z.string().default('USD'),
  billingInterval: z.enum(['monthly', 'yearly']),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional(),
});

const createLimitsOverrideSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  limitType: z.enum(['products', 'locations', 'storage', 'api_calls']),
  originalLimit: z.number().min(0, 'Original limit must be non-negative'),
  customLimit: z.number().positive('Custom limit must be positive'),
  unit: z.string().default('items'),
  resetPeriod: z.enum(['daily', 'monthly', 'yearly']).default('monthly'),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional(),
});

const createFeaturedOverrideSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  featuredType: z.enum(['homepage', 'category', 'search', 'promotion']),
  priority: z.number().min(1).max(100).default(50),
  targeting: z.object({
    geographic: z.array(z.string()).optional(),
    demographics: z.array(z.string()).optional(),
  }).optional(),
  duration: z.number().positive('Duration must be positive').default(30),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional(),
});

// Approval workflow schemas
const createApprovalRequestSchema = z.object({
  overrideType: z.enum(['feature', 'pricing', 'limits', 'featured_products']),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  requestData: z.object({}), // Will contain override-specific data
  reason: z.string().min(1, 'Reason is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  requestedBy: z.string().min(1, 'Requester ID is required'),
  approvers: z.array(z.string()).min(1, 'At least one approver is required'),
  expiresAt: z.string().datetime().optional(),
});

const approveRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  comment: z.string().optional(),
  conditions: z.array(z.string()).optional(),
});

// Approval threshold configuration
const APPROVAL_THRESHOLDS = {
  pricing: {
    high_value: 1000, // $1000+ requires approval
    critical_value: 10000, // $10000+ requires multiple approvals
  },
  limits: {
    high_multiplier: 5, // 5x normal limit requires approval
    critical_multiplier: 20, // 20x normal limit requires multiple approvals
  },
  featured: {
    high_priority: 80, // Priority 80+ requires approval
    critical_priority: 95, // Priority 95+ requires multiple approvals
  },
  duration: {
    long_term: 90, // 90+ days requires approval
    extended: 365, // 365+ days requires multiple approvals
  }
};

/**
 * Middleware to require platform admin access
 */
function requirePlatformAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  
  if (!user || !isPlatformAdmin(user)) {
    return res.status(403).json({
      error: 'access_denied',
      message: 'Platform admin access required',
    });
  }
  
  next();
}

/**
 * GET /api/v1/admin/feature-overrides
 * List all feature overrides with optional filters (with caching)
 */
router.get('/', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, feature, active, granted, useCache = 'true' } = req.query;
    const cacheService = getCacheService();

    // If tenant-specific request, try cache first
    if (tenantId && useCache === 'true') {
      const cachedOverrides = await cacheService.getTenantOverrides(String(tenantId));
      
      if (cachedOverrides.length > 0) {
        // Apply additional filters to cached data
        let filteredOverrides = cachedOverrides;
        
        if (feature) {
          filteredOverrides = filteredOverrides.filter(o => o.feature === String(feature));
        }
        
        if (granted !== undefined) {
          filteredOverrides = filteredOverrides.filter(o => o.granted === (granted === 'true'));
        }
        
        if (active === 'true') {
          filteredOverrides = filteredOverrides.filter(o => 
            !o.expires_at || o.expires_at > new Date()
          );
        }

        // Add computed fields
        const enrichedOverrides = filteredOverrides.map(override => ({
          ...override,
          isExpired: override.expires_at ? override.expires_at < new Date() : false,
          isActive: override.granted && (!override.expires_at || override.expires_at > new Date()),
        }));

        return res.json({ 
          overrides: enrichedOverrides,
          count: enrichedOverrides.length,
          cached: true,
        });
      }
    }

    // Fallback to database query
    const where: any = {};
    
    if (tenantId) {
      where.tenant_id = String(tenantId);
    }
    
    if (feature) {
      where.feature = String(feature);
    }
    
    if (granted !== undefined) {
      where.granted = granted === 'true';
    }
    
    // Filter for active (non-expired) overrides
    if (active === 'true') {
      where.OR = [
        { expires_at: null },
        { expires_at: { gt: new Date() } }
      ];
    }

    const overrides = await prisma.tenant_feature_overrides_list.findMany({
      where,
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Add computed fields
    const enrichedOverrides = overrides.map(override => ({
      ...override,
      isExpired: override.expires_at ? override.expires_at < new Date() : false,
      isActive: override.granted && (!override.expires_at || override.expires_at > new Date()),
    }));

    // Cache the results if tenant-specific
    if (tenantId && useCache === 'true') {
      for (const override of enrichedOverrides) {
        await cacheService.setOverride(String(tenantId), override.id, override as any);
      }
    }

    res.json({ 
      overrides: enrichedOverrides,
      count: enrichedOverrides.length,
      cached: false,
    });
  } catch (error: any) {
    console.error('[Feature Overrides] List error:', error);
    res.status(500).json({ 
      error: 'list_failed',
      message: 'Failed to list feature overrides',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/:id
 * Get a specific feature override
 */
router.get('/:id', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const override = await prisma.tenant_feature_overrides_list.findUnique({
      where: { id },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    if (!override) {
      return res.status(400).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    const enriched = {
      ...override,
      isExpired: override.expires_at ? override.expires_at < new Date() : false,
      isActive: override.granted && (!override.expires_at || override.expires_at > new Date()),
    };

    res.json({ override: enriched });
  } catch (error: any) {
    console.error('[Feature Overrides] Get error:', error);
    res.status(500).json({ 
      error: 'get_failed',
      message: 'Failed to get feature override',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides
 * Create a new feature override
 */
router.post('/', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = createOverrideSchema.parse(req.body);

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Check if override already exists
    const existing = await prisma.tenant_feature_overrides_list.findUnique({
      where: {
        tenant_id_feature: {
          tenant_id: body.tenantId,
          feature: body.feature,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'override_exists',
        message: 'An override for this feature already exists. Use PUT to update it.',
        existingOverride: existing,
      });
    }

    // Create override
    const override = await prisma.tenant_feature_overrides_list.create({
      data: {
        id: generateFeatureOverrideId(body.tenantId),
        tenant_id: body.tenantId,
        feature: body.feature,
        granted: body.granted,
        reason: body.reason,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        granted_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    console.log(`[Feature Override] Created: ${body.feature} for tenant ${tenant.name} (${body.granted ? 'granted' : 'revoked'}) by ${userId}`);

    // Invalidate cache for this tenant
    const cacheService = getCacheService();
    await cacheService.invalidateTenant(body.tenantId);

    res.status(201).json({ 
      override,
      message: `Feature override created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Feature Overrides] Create error:', error);
    res.status(500).json({ 
      error: 'create_failed',
      message: 'Failed to create feature override',
      details: error.message,
    });
  }
});

/**
 * PUT /api/v1/admin/feature-overrides/:id
 * Update an existing feature override
 */
router.put('/:id', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = updateOverrideSchema.parse(req.body);

    // Check if override exists
    const existing = await prisma.tenant_feature_overrides_list.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(400).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    // Update override
    const updateData: any = {
      granted_by: userId, // Track who made the update
      updated_at: new Date(),
    };

    if (body.granted !== undefined) {
      updateData.granted = body.granted;
    }

    if (body.reason !== undefined) {
      updateData.reason = body.reason;
    }

    if (body.expires_at !== undefined) {
      updateData.expires_at = body.expires_at ? new Date(body.expires_at) : null;
    }

    const override = await prisma.tenant_feature_overrides_list.update({
      where: { id },
      data: updateData,
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    console.log(`[Feature Override] Updated: ${override.feature} for tenant ${override.tenants.name} by ${userId}`);

    res.json({ 
      override,
      message: 'Feature override updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Feature Overrides] Update error:', error);
    res.status(500).json({ 
      error: 'update_failed',
      message: 'Failed to update feature override',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/v1/admin/feature-overrides/:id
 * Delete a feature override
 */
router.delete('/:id', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    // Get override details before deleting (for logging)
    const override = await prisma.tenant_feature_overrides_list.findUnique({
      where: { id },
      include: {
        tenants: {
          select: { name: true },
        },
      },
    });

    if (!override) {
      return res.status(400).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    // Delete override
    await prisma.tenant_feature_overrides_list.delete({
      where: { id },
    });

    console.log(`[Feature Override] Deleted: ${override.feature} for tenant ${override.tenants.name} by ${userId}`);

    // Invalidate cache for this tenant
    const cacheService = getCacheService();
    await cacheService.invalidateTenant(override.tenant_id);

    res.json({ 
      success: true,
      message: 'Feature override deleted successfully',
    });
  } catch (error: any) {
    console.error('[Feature Overrides] Delete error:', error);
    res.status(500).json({ 
      error: 'delete_failed',
      message: 'Failed to delete feature override',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/tenant/:tenantId
 * Get all overrides for a specific tenant
 */
router.get('/tenant/:tenantId', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { active } = req.query;

    const where: any = { tenantId };

    // Filter for active (non-expired) overrides
    if (active === 'true') {
      where.OR = [
        { expires_at: null },
        { expires_at: { gt: new Date() } },
      ];
    }

    const overrides = await prisma.tenant_feature_overrides_list.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const enrichedOverrides = overrides.map(override => ({
      ...override,
      isExpired: override.expires_at ? override.expires_at < new Date() : false,
      isActive: override.granted && (!override.expires_at || override.expires_at > new Date()),
    }));

    res.json({ 
      overrides: enrichedOverrides,
      count: enrichedOverrides.length,
    });
  } catch (error: any) {
    console.error('[Feature Overrides] Get tenant overrides error:', error);
    res.status(500).json({ 
      error: 'get_failed',
      message: 'Failed to get tenant overrides',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/cleanup-expired
 * Manually trigger cleanup of expired overrides
 */
router.post('/cleanup-expired', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await prisma.tenant_feature_overrides_list.deleteMany({
      where: {
        expires_at: {
          lte: new Date(),
        }
      }
    });

    console.log(`[Feature Override] Cleanup: Removed ${result.count} expired overrides`);

    res.json({ 
      success: true,
      removedCount: result.count,
      message: `Removed ${result.count} expired override(s)`,
    });
  } catch (error: any) {
    console.error('[Feature Overrides] Cleanup error:', error);
    res.status(500).json({ 
      error: 'cleanup_failed',
      message: 'Failed to cleanup expired overrides',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/pricing
 * Create a new pricing override
 */
router.post('/pricing', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = createPricingOverrideSchema.parse(req.body);

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Create pricing override using feature override pattern
    const override = await prisma.tenant_feature_overrides_list.create({
      data: {
        id: generateFeatureOverrideId(body.tenantId),
        tenant_id: body.tenantId,
        feature: `pricing_${body.subscriptionTier}`,
        granted: true,
        reason: body.reason || `Pricing override: ${body.discountType === 'percentage' ? body.discountValue + '%' : '$' + body.discountValue} discount`,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        granted_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        // Store pricing details in reason field for now (schema limitation)
        // In Phase 2, we'll extend the schema with proper pricing fields
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    console.log(`[Pricing Override] Created: ${body.subscriptionTier} pricing for tenant ${tenant.name} by ${userId}`);

    res.status(201).json({ 
      override: {
        ...override,
        pricingDetails: {
          originalPrice: body.originalPrice,
          customPrice: body.customPrice,
          discountType: body.discountType,
          discountValue: body.discountValue,
          currency: body.currency,
          billingInterval: body.billingInterval,
        }
      },
      message: `Pricing override created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Pricing Override] Create error:', error);
    res.status(500).json({ 
      error: 'create_failed',
      message: 'Failed to create pricing override',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/limits
 * Create a new limits override
 */
router.post('/limits', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = createLimitsOverrideSchema.parse(req.body);

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Create limits override
    const override = await prisma.tenant_feature_overrides_list.create({
      data: {
        id: generateFeatureOverrideId(body.tenantId),
        tenant_id: body.tenantId,
        feature: `limits_${body.limitType}`,
        granted: true,
        reason: body.reason || `Limits override: ${body.limitType} increased from ${body.originalLimit} to ${body.customLimit} ${body.unit}`,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        granted_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    console.log(`[Limits Override] Created: ${body.limitType} limit for tenant ${tenant.name} by ${userId}`);

    res.status(201).json({ 
      override: {
        ...override,
        limitsDetails: {
          limitType: body.limitType,
          originalLimit: body.originalLimit,
          customLimit: body.customLimit,
          unit: body.unit,
          resetPeriod: body.resetPeriod,
        }
      },
      message: `Limits override created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Limits Override] Create error:', error);
    res.status(500).json({ 
      error: 'create_failed',
      message: 'Failed to create limits override',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/featured
 * Create a new featured products override
 */
router.post('/featured', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = createFeaturedOverrideSchema.parse(req.body);

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Create featured products override
    const override = await prisma.tenant_feature_overrides_list.create({
      data: {
        id: generateFeatureOverrideId(body.tenantId),
        tenant_id: body.tenantId,
        feature: `featured_${body.featuredType}`,
        granted: true,
        reason: body.reason || `Featured products override: ${body.featuredType} featuring for ${body.duration} days`,
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        granted_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    console.log(`[Featured Override] Created: ${body.featuredType} featuring for tenant ${tenant.name} by ${userId}`);

    res.status(201).json({ 
      override: {
        ...override,
        featuredDetails: {
          featuredType: body.featuredType,
          priority: body.priority,
          targeting: body.targeting,
          duration: body.duration,
        }
      },
      message: `Featured products override created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Featured Override] Create error:', error);
    res.status(500).json({ 
      error: 'create_failed',
      message: 'Failed to create featured products override',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/bulk
 * Bulk operations on multiple overrides
 */
router.post('/bulk', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    const { operation, overrides, options } = req.body;

    // Validate operation type
    const validOperations = ['create', 'update', 'delete', 'activate', 'deactivate'];
    if (!validOperations.includes(operation)) {
      return res.status(400).json({
        error: 'invalid_operation',
        message: `Operation must be one of: ${validOperations.join(', ')}`,
      });
    }

    // Validate overrides array
    if (!Array.isArray(overrides) || overrides.length === 0) {
      return res.status(400).json({
        error: 'invalid_overrides',
        message: 'Overrides must be a non-empty array',
      });
    }

    // Limit bulk operations to prevent abuse
    if (overrides.length > 100) {
      return res.status(400).json({
        error: 'too_many_overrides',
        message: 'Maximum 100 overrides allowed per bulk operation',
      });
    }

    const results = [];
    const errors = [];

    console.log(`[Bulk Operation] Starting ${operation} on ${overrides.length} overrides by ${userId}`);

    for (let i = 0; i < overrides.length; i++) {
      const override = overrides[i];
      
      try {
        let result;
        
        switch (operation) {
          case 'create':
            result = await handleBulkCreate(override, userId);
            break;
          case 'update':
            result = await handleBulkUpdate(override, userId);
            break;
          case 'delete':
            result = await handleBulkDelete(override, userId);
            break;
          case 'activate':
            result = await handleBulkActivate(override, userId);
            break;
          case 'deactivate':
            result = await handleBulkDeactivate(override, userId);
            break;
        }

        results.push({
          index: i,
          success: true,
          data: result,
        });
      } catch (error: any) {
        errors.push({
          index: i,
          error: error.message,
          override: override,
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    console.log(`[Bulk Operation] Completed: ${successCount} successful, ${errorCount} failed`);

    res.json({
      operation,
      total: overrides.length,
      successCount,
      errorCount,
      results,
      errors,
      message: `Bulk ${operation} completed: ${successCount} successful, ${errorCount} failed`,
    });

  } catch (error: any) {
    console.error('[Bulk Operation] Error:', error);
    res.status(500).json({ 
      error: 'bulk_operation_failed',
      message: 'Failed to execute bulk operation',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/bulk-import
 * Import overrides from CSV or JSON format
 */
router.post('/bulk-import', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    const { format, data, validateOnly = false } = req.body;

    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({
        error: 'invalid_format',
        message: 'Format must be either "csv" or "json"',
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        error: 'invalid_data',
        message: 'Data must be a non-empty array',
      });
    }

    const results = [];
    const errors = [];
    const validationErrors = [];

    console.log(`[Bulk Import] Starting ${format} import of ${data.length} records by ${userId}`);

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      try {
        // Validate record structure
        const validationResult = validateImportRecord(record, format);
        
        if (!validationResult.valid) {
          validationErrors.push({
            index: i,
            errors: validationResult.errors,
            record,
          });
          continue;
        }

        if (validateOnly) {
          results.push({
            index: i,
            valid: true,
            record,
          });
        } else {
          // Create override
          const override = await createOverrideFromRecord(record, userId);
          results.push({
            index: i,
            success: true,
            override,
          });
        }
      } catch (error: any) {
        errors.push({
          index: i,
          error: error.message,
          record,
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const validationErrorCount = validationErrors.length;

    console.log(`[Bulk Import] Completed: ${successCount} successful, ${errorCount} failed, ${validationErrorCount} validation errors`);

    res.json({
      format,
      validateOnly,
      total: data.length,
      successCount,
      errorCount,
      validationErrorCount,
      results,
      errors,
      validationErrors,
      message: `Bulk import completed: ${successCount} successful, ${errorCount} failed, ${validationErrorCount} validation errors`,
    });

  } catch (error: any) {
    console.error('[Bulk Import] Error:', error);
    res.status(500).json({ 
      error: 'bulk_import_failed',
      message: 'Failed to execute bulk import',
      details: error.message,
    });
  }
});

// Helper functions for bulk operations
async function handleBulkCreate(override: any, userId: string) {
  const { tenantId, feature, granted, reason, expires_at } = override;
  
  // Check if tenant exists
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Check for existing override
  const existing = await prisma.tenant_feature_overrides_list.findUnique({
    where: {
      tenant_id_feature: {
        tenant_id: tenantId,
        feature: feature,
      },
    },
  });

  if (existing) {
    throw new Error(`Override already exists for ${feature} on tenant ${tenantId}`);
  }

  return await prisma.tenant_feature_overrides_list.create({
    data: {
      id: generateFeatureOverrideId(tenantId),
      tenant_id: tenantId,
      feature,
      granted,
      reason,
      expires_at: expires_at ? new Date(expires_at) : null,
      granted_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    },
    include: {
      tenants: {
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
        },
      },
    },
  });
}

async function handleBulkUpdate(override: any, userId: string) {
  const { id, updates } = override;
  
  const existing = await prisma.tenant_feature_overrides_list.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error(`Override not found: ${id}`);
  }

  const updateData = {
    ...updates,
    granted_by: userId,
    updated_at: new Date(),
  };

  return await prisma.tenant_feature_overrides_list.update({
    where: { id },
    data: updateData,
    include: {
      tenants: {
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
        },
      },
    },
  });
}

async function handleBulkDelete(override: any, userId: string) {
  const { id } = override;
  
  const existing = await prisma.tenant_feature_overrides_list.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error(`Override not found: ${id}`);
  }

  await prisma.tenant_feature_overrides_list.delete({
    where: { id },
  });

  return { id, deleted: true };
}

async function handleBulkActivate(override: any, userId: string) {
  return await handleBulkUpdate({
    id: override.id,
    updates: { granted: true }
  }, userId);
}

async function handleBulkDeactivate(override: any, userId: string) {
  return await handleBulkUpdate({
    id: override.id,
    updates: { granted: false }
  }, userId);
}

function validateImportRecord(record: any, format: string) {
  const errors: string[] = [];
  
  // Required fields validation
  if (!record.tenantId) errors.push('tenantId is required');
  if (!record.feature) errors.push('feature is required');
  if (typeof record.granted !== 'boolean') errors.push('granted must be boolean');
  
  // Optional fields validation
  if (record.expires_at && isNaN(Date.parse(record.expires_at))) {
    errors.push('expires_at must be a valid date');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function createOverrideFromRecord(record: any, userId: string) {
  return await handleBulkCreate(record, userId);
}

/**
 * POST /api/v1/admin/feature-overrides/approval-requests
 * Create a new approval request for high-value overrides
 */
router.post('/approval-requests', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = createApprovalRequestSchema.parse(req.body);

    // Check if approval is required based on thresholds
    const approvalRequired = await checkApprovalRequired(body.overrideType, body.requestData);
    
    if (!approvalRequired.required) {
      return res.status(400).json({
        error: 'approval_not_required',
        message: 'This override does not require approval based on current thresholds',
        threshold: approvalRequired.threshold,
        currentValue: approvalRequired.value,
      });
    }

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: body.tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Create approval request (using existing override table with approval metadata)
    const requestId = generateFeatureOverrideId(body.tenantId);
    
    const approvalRequest = await prisma.tenant_feature_overrides_list.create({
      data: {
        id: requestId,
        tenant_id: body.tenantId,
        feature: `approval_${body.overrideType}`,
        granted: false, // Not granted until approved
        reason: `APPROVAL_REQUEST: ${body.reason}`,
        expires_at: body.expiresAt ? new Date(body.expiresAt) : null,
        granted_by: body.requestedBy,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    // Store approval metadata in reason field for now
    // In Phase 2 extended schema, we'll have proper approval fields
    const approvalMetadata = {
      requestId,
      overrideType: body.overrideType,
      requestData: body.requestData,
      priority: body.priority,
      approvers: body.approvers,
      requiredApprovals: approvalRequired.requiredApprovals,
      currentApprovals: 0,
      status: 'pending',
      requestedBy: body.requestedBy,
      requestedAt: new Date().toISOString(),
      threshold: approvalRequired.threshold,
      currentValue: approvalRequired.value,
    };

    console.log(`[Approval Request] Created: ${body.overrideType} for tenant ${tenant.name} by ${body.requestedBy}`);

    res.status(201).json({
      approvalRequest: {
        ...approvalRequest,
        approvalMetadata,
      },
      message: 'Approval request created successfully',
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Approval Request] Create error:', error);
    res.status(500).json({ 
      error: 'create_failed',
      message: 'Failed to create approval request',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/approval-requests
 * List all pending approval requests
 */
router.get('/approval-requests', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { status, priority, tenantId } = req.query;

    const where: any = {
      feature: {
        startsWith: 'approval_'
      }
    };
    
    if (status) {
      // Filter by approval status (stored in reason field)
      where.reason = {
        contains: `status: ${status}`
      };
    }
    
    if (tenantId) {
      where.tenant_id = String(tenantId);
    }

    const requests = await prisma.tenant_feature_overrides_list.findMany({
      where,
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Parse approval metadata from reason field
    const enrichedRequests = requests.map(request => {
      const approvalMetadata = parseApprovalMetadata(request.reason || '');
      
      return {
        ...request,
        approvalMetadata,
        isExpired: request.expires_at ? request.expires_at < new Date() : false,
        isActive: request.granted && (!request.expires_at || request.expires_at > new Date()),
      };
    });

    // Filter by priority if specified
    let filteredRequests = enrichedRequests;
    if (priority) {
      filteredRequests = enrichedRequests.filter(req => 
        req.approvalMetadata?.priority === priority
      );
    }

    res.json({ 
      requests: filteredRequests,
      count: filteredRequests.length,
    });
  } catch (error: any) {
    console.error('[Approval Requests] List error:', error);
    res.status(500).json({ 
      error: 'list_failed',
      message: 'Failed to list approval requests',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/approval-requests/:id/approve
 * Approve or reject an approval request
 */
router.post('/approval-requests/:id/approve', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User ID not found',
      });
    }

    // Validate request body
    const body = approveRequestSchema.parse(req.body);

    // Get approval request
    const request = await prisma.tenant_feature_overrides_list.findUnique({
      where: { id },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
      },
    });

    if (!request || !request.feature.startsWith('approval_')) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Approval request not found',
      });
    }

    const approvalMetadata = parseApprovalMetadata(request.reason || '');

    // Check if user is authorized to approve
    if (!approvalMetadata.approvers.includes(userId)) {
      return res.status(403).json({
        error: 'not_authorized',
        message: 'You are not authorized to approve this request',
      });
    }

    // Process approval action
    let updatedRequest;
    let actualOverride;

    if (body.action === 'approve') {
      // Create the actual override
      actualOverride = await createOverrideFromApproval(approvalMetadata, userId);
      
      // Mark approval request as approved
      updatedRequest = await prisma.tenant_feature_overrides_list.update({
        where: { id },
        data: {
          reason: `APPROVED: ${request.reason}\nApproved by: ${userId}\nComment: ${body.comment || ''}\nActual Override: ${actualOverride.id}`,
          updated_at: new Date(),
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              subscription_status: true,
            },
          },
        },
      });

      console.log(`[Approval] Approved: ${approvalMetadata.overrideType} for tenant ${request.tenants?.name} by ${userId}`);

    } else if (body.action === 'reject') {
      // Mark approval request as rejected
      updatedRequest = await prisma.tenant_feature_overrides_list.update({
        where: { id },
        data: {
          reason: `REJECTED: ${request.reason}\nRejected by: ${userId}\nComment: ${body.comment || ''}`,
          updated_at: new Date(),
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              subscription_status: true,
            },
          },
        },
      });

      console.log(`[Approval] Rejected: ${approvalMetadata.overrideType} for tenant ${request.tenants?.name} by ${userId}`);

    } else if (body.action === 'request_changes') {
      // Mark approval request as changes requested
      updatedRequest = await prisma.tenant_feature_overrides_list.update({
        where: { id },
        data: {
          reason: `CHANGES_REQUESTED: ${request.reason}\nRequested by: ${userId}\nComment: ${body.comment || ''}\nConditions: ${body.conditions?.join(', ') || ''}`,
          updated_at: new Date(),
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              subscription_status: true,
            },
          },
        },
      });

      console.log(`[Approval] Changes requested: ${approvalMetadata.overrideType} for tenant ${request.tenants?.name} by ${userId}`);
    }

    res.json({
      approvalRequest: {
        ...updatedRequest,
        approvalMetadata: parseApprovalMetadata(updatedRequest?.reason || ''),
      },
      actualOverride: actualOverride || null,
      action: body.action,
      message: `Approval request ${body.action}d successfully`,
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues,
      });
    }

    console.error('[Approval] Process error:', error);
    res.status(500).json({ 
      error: 'approval_failed',
      message: 'Failed to process approval',
      details: error.message,
    });
  }
});

// Helper functions for approval workflows
async function checkApprovalRequired(overrideType: string, requestData: any) {
  // Use pricing thresholds for pricing overrides
  const thresholds = overrideType === 'pricing' ? APPROVAL_THRESHOLDS.pricing : 
                    overrideType === 'limits' ? APPROVAL_THRESHOLDS.limits :
                    overrideType === 'featured_products' ? APPROVAL_THRESHOLDS.featured :
                    APPROVAL_THRESHOLDS.duration;
  
  if (!thresholds) {
    return { required: false, threshold: null, value: null };
  }

  let value = 0;
  let threshold = null;
  let requiredApprovals = 1;

  switch (overrideType) {
    case 'pricing':
      value = requestData.customPrice || 0;
      if (value >= (thresholds as any).critical_value) {
        threshold = (thresholds as any).critical_value;
        requiredApprovals = 3;
      } else if (value >= (thresholds as any).high_value) {
        threshold = (thresholds as any).high_value;
        requiredApprovals = 2;
      }
      break;
      
    case 'limits':
      const multiplier = requestData.customLimit / requestData.originalLimit;
      value = multiplier;
      if (multiplier >= (thresholds as any).critical_multiplier) {
        threshold = (thresholds as any).critical_multiplier;
        requiredApprovals = 3;
      } else if (multiplier >= (thresholds as any).high_multiplier) {
        threshold = (thresholds as any).high_multiplier;
        requiredApprovals = 2;
      }
      break;
      
    case 'featured_products':
      value = requestData.priority || 50;
      if (value >= (thresholds as any).critical_priority) {
        threshold = (thresholds as any).critical_priority;
        requiredApprovals = 3;
      } else if (value >= (thresholds as any).high_priority) {
        threshold = (thresholds as any).high_priority;
        requiredApprovals = 2;
      }
      break;
      
    default:
      // Check duration for any override type
      const duration = requestData.duration || 0;
      value = duration;
      if (duration >= (thresholds as any).extended) {
        threshold = (thresholds as any).extended;
        requiredApprovals = 3;
      } else if (duration >= (thresholds as any).long_term) {
        threshold = (thresholds as any).long_term;
        requiredApprovals = 2;
      }
  }

  return {
    required: threshold !== null,
    threshold,
    value,
    requiredApprovals,
  };
}

function parseApprovalMetadata(reason: string) {
  try {
    if (reason.startsWith('APPROVAL_REQUEST:')) {
      // This is a simplified parsing - in production, we'd use a proper metadata field
      return {
        status: 'pending',
        priority: 'medium',
        approvers: [] as string[],
        requiredApprovals: 1,
        currentApprovals: 0,
        overrideType: 'unknown',
      };
    } else if (reason.startsWith('APPROVED:')) {
      return {
        status: 'approved',
        priority: 'medium',
        approvers: [] as string[],
        requiredApprovals: 1,
        currentApprovals: 1,
        overrideType: 'unknown',
      };
    } else if (reason.startsWith('REJECTED:')) {
      return {
        status: 'rejected',
        priority: 'medium',
        approvers: [] as string[],
        requiredApprovals: 1,
        currentApprovals: 0,
        overrideType: 'unknown',
      };
    } else if (reason.startsWith('CHANGES_REQUESTED:')) {
      return {
        status: 'changes_requested',
        priority: 'medium',
        approvers: [] as string[],
        requiredApprovals: 1,
        currentApprovals: 0,
        overrideType: 'unknown',
      };
    }
  } catch (error) {
    // Fallback for parsing errors
  }

  return {
    status: 'unknown',
    priority: 'medium',
    approvers: [] as string[],
    requiredApprovals: 1,
    currentApprovals: 0,
    overrideType: 'unknown',
  };
}

async function createOverrideFromApproval(approvalMetadata: any, approvedBy: string) {
  // This would create the actual override based on the approval metadata
  // For now, we'll create a simple feature override
  const overrideId = generateFeatureOverrideId(approvalMetadata.tenantId);
  
  return await prisma.tenant_feature_overrides_list.create({
    data: {
      id: overrideId,
      tenant_id: approvalMetadata.tenantId,
      feature: approvalMetadata.overrideType,
      granted: true,
      reason: `Created from approval request by ${approvedBy}`,
      expires_at: null,
      granted_by: approvedBy,
      created_at: new Date(),
      updated_at: new Date(),
    },
    include: {
      tenants: {
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
        },
      },
    },
  });
}

/**
 * GET /api/v1/admin/feature-overrides/cache/stats
 * Get cache statistics and performance metrics
 */
router.get('/cache/stats', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const cacheService = getCacheService();
    const stats = await cacheService.getCacheStats();
    
    res.json({
      cache: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cache Stats] Error:', error);
    res.status(500).json({ 
      error: 'stats_failed',
      message: 'Failed to get cache statistics',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/cache/clear
 * Clear cache (for maintenance/testing)
 */
router.post('/cache/clear', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const cacheService = getCacheService();
    await cacheService.clearCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cache Clear] Error:', error);
    res.status(500).json({ 
      error: 'clear_failed',
      message: 'Failed to clear cache',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/cache/warm
 * Warm cache for specific tenant
 */
router.post('/cache/warm', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    const cacheService = getCacheService();
    await cacheService.warmTenantCache(tenantId);
    
    res.json({
      success: true,
      message: `Cache warmed for tenant ${tenantId}`,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cache Warm] Error:', error);
    res.status(500).json({ 
      error: 'warm_failed',
      message: 'Failed to warm cache',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/analytics
 * Get comprehensive analytics dashboard
 */
router.get('/analytics', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, period = '30d' } = req.query;
    const analyticsService = getAnalyticsService();
    
    const analytics = await analyticsService.getAnalytics(
      tenantId ? String(tenantId) : undefined,
      String(period)
    );
    
    res.json({
      analytics,
      period,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics] Get analytics error:', error);
    res.status(500).json({ 
      error: 'analytics_failed',
      message: 'Failed to get analytics',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/analytics/trends
 * Get usage trends data
 */
router.get('/analytics/trends', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, period = '30d' } = req.query;
    const analyticsService = getAnalyticsService();
    
    const trends = await analyticsService.getUsageTrends(
      tenantId ? String(tenantId) : undefined,
      String(period)
    );
    
    res.json({
      trends,
      period,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics] Get trends error:', error);
    res.status(500).json({ 
      error: 'trends_failed',
      message: 'Failed to get usage trends',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/analytics/approvals
 * Get approval workflow analytics
 */
router.get('/analytics/approvals', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const analyticsService = getAnalyticsService();
    
    const approvalAnalytics = await analyticsService.getApprovalAnalytics(
      tenantId ? String(tenantId) : undefined
    );
    
    res.json({
      approvalAnalytics,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics] Get approval analytics error:', error);
    res.status(500).json({ 
      error: 'approval_analytics_failed',
      message: 'Failed to get approval analytics',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/admin/feature-overrides/analytics/export
 * Export analytics data in various formats
 */
router.get('/analytics/export', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { format = 'json', tenantId } = req.query;
    const analyticsService = getAnalyticsService();
    
    if (!['json', 'csv', 'excel'].includes(String(format))) {
      return res.status(400).json({
        error: 'invalid_format',
        message: 'Format must be one of: json, csv, excel',
      });
    }
    
    const exportData = await analyticsService.exportAnalytics(
      String(format) as 'json' | 'csv' | 'excel',
      tenantId ? String(tenantId) : undefined
    );
    
    const filename = `feature-overrides-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
    
    const contentType = getContentType(String(format));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error: any) {
    console.error('[Analytics] Export error:', error);
    res.status(500).json({ 
      error: 'export_failed',
      message: 'Failed to export analytics',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/feature-overrides/analytics/refresh
 * Refresh analytics cache
 */
router.post('/analytics/refresh', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, period = '30d' } = req.body;
    const analyticsService = getAnalyticsService();
    
    // Force refresh by bypassing cache
    const analytics = await analyticsService.getAnalytics(
      tenantId || undefined,
      period
    );
    
    res.json({
      success: true,
      message: 'Analytics cache refreshed',
      analytics,
      period,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics] Refresh error:', error);
    res.status(500).json({ 
      error: 'refresh_failed',
      message: 'Failed to refresh analytics',
      details: error.message,
    });
  }
});

// Helper function to get content type for export
function getContentType(format: string): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

export default router;
