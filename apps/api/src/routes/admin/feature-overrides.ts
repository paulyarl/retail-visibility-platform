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

const router = Router();

// Validation schemas
const createOverrideSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  feature: z.string().min(1, 'Feature name is required'),
  granted: z.boolean(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateOverrideSchema = z.object({
  granted: z.boolean().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

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
 * List all feature overrides with optional filters
 */
router.get('/', authenticateToken, requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, feature, active, granted } = req.query;

    const where: any = {};
    
    if (tenantId) {
      where.tenantId = String(tenantId);
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
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ];
    }

    const overrides = await prisma.tenantFeatureOverride.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add computed fields
    const enrichedOverrides = overrides.map(override => ({
      ...override,
      isExpired: override.expiresAt ? override.expiresAt < new Date() : false,
      isActive: override.granted && (!override.expiresAt || override.expiresAt > new Date()),
    }));

    res.json({ 
      overrides: enrichedOverrides,
      count: enrichedOverrides.length,
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

    const override = await prisma.tenantFeatureOverride.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
          }
        }
      },
    });

    if (!override) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    const enriched = {
      ...override,
      isExpired: override.expiresAt ? override.expiresAt < new Date() : false,
      isActive: override.granted && (!override.expiresAt || override.expiresAt > new Date()),
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
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { 
        id: true, 
        name: true, 
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Check if override already exists
    const existing = await prisma.tenantFeatureOverride.findUnique({
      where: {
        tenantId_feature: {
          tenantId: body.tenantId,
          feature: body.feature,
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'override_exists',
        message: 'An override for this feature already exists. Use PUT to update it.',
        existingOverride: existing,
      });
    }

    // Create override
    const override = await prisma.tenantFeatureOverride.create({
      data: {
        tenantId: body.tenantId,
        feature: body.feature,
        granted: body.granted,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        grantedBy: userId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
          }
        }
      }
    });

    console.log(`[Feature Override] Created: ${body.feature} for tenant ${tenant.name} (${body.granted ? 'granted' : 'revoked'}) by ${userId}`);

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
    const existing = await prisma.tenantFeatureOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    // Update override
    const updateData: any = {
      grantedBy: userId, // Track who made the update
      updatedAt: new Date(),
    };

    if (body.granted !== undefined) {
      updateData.granted = body.granted;
    }

    if (body.reason !== undefined) {
      updateData.reason = body.reason;
    }

    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    const override = await prisma.tenantFeatureOverride.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
          }
        }
      }
    });

    console.log(`[Feature Override] Updated: ${override.feature} for tenant ${override.tenant.name} by ${userId}`);

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
    const override = await prisma.tenantFeatureOverride.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { name: true }
        }
      }
    });

    if (!override) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Feature override not found',
      });
    }

    // Delete override
    await prisma.tenantFeatureOverride.delete({
      where: { id },
    });

    console.log(`[Feature Override] Deleted: ${override.feature} for tenant ${override.tenant.name} by ${userId}`);

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
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ];
    }

    const overrides = await prisma.tenantFeatureOverride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const enrichedOverrides = overrides.map(override => ({
      ...override,
      isExpired: override.expiresAt ? override.expiresAt < new Date() : false,
      isActive: override.granted && (!override.expiresAt || override.expiresAt > new Date()),
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
    const result = await prisma.tenantFeatureOverride.deleteMany({
      where: {
        expiresAt: {
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

export default router;
