/**
 * Tier System Management API Routes
 * 
 * Platform admin endpoints for managing tier definitions (CRUD on tiers themselves).
 * Role-based access:
 * - PLATFORM_ADMIN: Full CRUD access
 * - PLATFORM_SUPPORT: Read-only access
 * - PLATFORM_VIEWER: Read-only access
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Middleware to check if user is platform staff (admin, support, or viewer)
 */
const requirePlatformStaff = (req: any, res: any, next: any) => {
  const isPlatformStaff = 
    req.user?.role === 'PLATFORM_ADMIN' ||
    req.user?.role === 'PLATFORM_SUPPORT' ||
    req.user?.role === 'PLATFORM_VIEWER';

  if (!isPlatformStaff) {
    return res.status(403).json({ 
      error: 'forbidden',
      message: 'Platform staff access required'
    });
  }

  next();
};

/**
 * Middleware to check if user is platform admin (full write access)
 */
const requirePlatformAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ 
      error: 'forbidden',
      message: 'Platform admin access required for this operation'
    });
  }

  next();
};

/**
 * Helper to log tier changes
 */
async function logTierChange(params: {
  entityType: 'tier' | 'feature';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changeType: string;
  beforeState?: any;
  afterState?: any;
  changedBy: string;
  changedByEmail?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.tierChangeLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changeType: params.changeType,
        beforeState: params.beforeState || null,
        afterState: params.afterState || null,
        changedBy: params.changedBy,
        changedByEmail: params.changedByEmail || null,
        reason: params.reason || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error('[Tier Change Log] Failed to log change:', error);
  }
}

/**
 * GET /api/admin/tier-system/tiers
 * List all subscription tiers
 * Access: Platform staff (admin, support, viewer)
 */
router.get('/tiers', requirePlatformStaff, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const tiers = await prisma.subscriptionTier.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        features: {
          where: { isEnabled: true },
          orderBy: { featureKey: 'asc' },
        },
      },
    });

    res.json({ tiers });
  } catch (error) {
    console.error('[GET /api/admin/tier-system/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers' });
  }
});

/**
 * GET /api/admin/tier-system/tiers/:tierId
 * Get a specific tier with all details
 * Access: Platform staff
 */
router.get('/tiers/:tierId', requirePlatformStaff, async (req, res) => {
  try {
    const { tierId } = req.params;

    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
      include: {
        features: {
          orderBy: { featureKey: 'asc' },
        },
      },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    res.json({ tier });
  } catch (error) {
    console.error('[GET /api/admin/tier-system/tiers/:tierId] Error:', error);
    res.status(500).json({ error: 'failed_to_get_tier' });
  }
});

/**
 * POST /api/admin/tier-system/tiers
 * Create a new subscription tier
 * Access: Platform admin only
 */
const createTierSchema = z.object({
  tierKey: z.string().min(1).regex(/^[a-z_]+$/, 'Tier key must be lowercase with underscores'),
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  priceMonthly: z.number().int().min(0),
  maxSKUs: z.number().int().positive().nullable().optional(),
  maxLocations: z.number().int().positive().nullable().optional(),
  tierType: z.enum(['individual', 'organization']).default('individual'),
  sortOrder: z.number().int().min(0).default(0),
  metadata: z.any().optional(),
  features: z.array(z.object({
    featureKey: z.string().min(1),
    featureName: z.string().min(1),
    isInherited: z.boolean().default(false),
    metadata: z.any().optional(),
  })).optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/tiers', requirePlatformAdmin, async (req, res) => {
  try {
    const parsed = createTierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, features, ...tierData } = parsed.data;

    // Check if tier key already exists
    const existing = await prisma.subscriptionTier.findUnique({
      where: { tierKey: tierData.tierKey },
    });

    if (existing) {
      return res.status(409).json({
        error: 'tier_key_exists',
        message: `Tier with key '${tierData.tierKey}' already exists`,
      });
    }

    // Create tier with features
    const tier = await prisma.subscriptionTier.create({
      data: {
        ...tierData,
        createdBy: req.user?.userId,
        updatedBy: req.user?.userId,
        features: features ? {
          create: features.map(f => ({
            featureKey: f.featureKey,
            featureName: f.featureName,
            isInherited: f.isInherited || false,
            metadata: f.metadata || null,
          })),
        } : undefined,
      },
      include: {
        features: true,
      },
    });

    // Log the change
    await logTierChange({
      entityType: 'tier',
      entityId: tier.id,
      action: 'create',
      changeType: 'tier_created',
      afterState: tier,
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] Tier created by ${req.user?.email}:`, tier.tierKey);

    res.status(201).json({ tier });
  } catch (error) {
    console.error('[POST /api/admin/tier-system/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_create_tier' });
  }
});

/**
 * PATCH /api/admin/tier-system/tiers/:tierId
 * Update a subscription tier
 * Access: Platform admin only
 */
const updateTierSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  priceMonthly: z.number().int().min(0).optional(),
  maxSKUs: z.number().int().positive().nullable().optional(),
  maxLocations: z.number().int().positive().nullable().optional(),
  tierType: z.enum(['individual', 'organization']).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.any().optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.patch('/tiers/:tierId', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId } = req.params;
    const parsed = updateTierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, ...updateData } = parsed.data;

    // Get current state
    const currentTier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
      include: { features: true },
    });

    if (!currentTier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Update tier
    const updatedTier = await prisma.subscriptionTier.update({
      where: { id: tierId },
      data: {
        ...updateData,
        updatedBy: req.user?.userId,
      },
      include: {
        features: true,
      },
    });

    // Log the change
    await logTierChange({
      entityType: 'tier',
      entityId: tierId,
      action: 'update',
      changeType: 'tier_updated',
      beforeState: currentTier,
      afterState: updatedTier,
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] Tier updated by ${req.user?.email}:`, updatedTier.tierKey);

    res.json({ tier: updatedTier });
  } catch (error) {
    console.error('[PATCH /api/admin/tier-system/tiers/:tierId] Error:', error);
    res.status(500).json({ error: 'failed_to_update_tier' });
  }
});

/**
 * DELETE /api/admin/tier-system/tiers/:tierId
 * Delete a subscription tier (soft delete by setting isActive = false)
 * Access: Platform admin only
 */
const deleteTierSchema = z.object({
  reason: z.string().min(1, 'Reason is required for audit trail'),
  hardDelete: z.boolean().default(false),
});

router.delete('/tiers/:tierId', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId } = req.params;
    const parsed = deleteTierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, hardDelete } = parsed.data;

    // Get current state
    const currentTier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
      include: { features: true },
    });

    if (!currentTier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Check if any tenants are using this tier
    const tenantCount = await prisma.tenant.count({
      where: { subscriptionTier: currentTier.tierKey },
    });

    if (tenantCount > 0 && hardDelete) {
      return res.status(400).json({
        error: 'tier_in_use',
        message: `Cannot hard delete tier: ${tenantCount} tenant(s) are using this tier`,
        tenantCount,
      });
    }

    if (hardDelete) {
      // Hard delete
      await prisma.subscriptionTier.delete({
        where: { id: tierId },
      });

      await logTierChange({
        entityType: 'tier',
        entityId: tierId,
        action: 'delete',
        changeType: 'tier_deleted_hard',
        beforeState: currentTier,
        changedBy: req.user?.userId || 'system',
        changedByEmail: req.user?.email,
        reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      console.log(`[Tier System] Tier hard deleted by ${req.user?.email}:`, currentTier.tierKey);

      res.json({ success: true, deleted: true });
    } else {
      // Soft delete
      const updatedTier = await prisma.subscriptionTier.update({
        where: { id: tierId },
        data: {
          isActive: false,
          updatedBy: req.user?.userId,
        },
      });

      await logTierChange({
        entityType: 'tier',
        entityId: tierId,
        action: 'delete',
        changeType: 'tier_deleted_soft',
        beforeState: currentTier,
        afterState: updatedTier,
        changedBy: req.user?.userId || 'system',
        changedByEmail: req.user?.email,
        reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      console.log(`[Tier System] Tier soft deleted by ${req.user?.email}:`, currentTier.tierKey);

      res.json({ success: true, deactivated: true, tier: updatedTier });
    }
  } catch (error) {
    console.error('[DELETE /api/admin/tier-system/tiers/:tierId] Error:', error);
    res.status(500).json({ error: 'failed_to_delete_tier' });
  }
});

/**
 * POST /api/admin/tier-system/tiers/:tierId/features
 * Add a feature to a tier
 * Access: Platform admin only
 */
const addFeatureSchema = z.object({
  featureKey: z.string().min(1),
  featureName: z.string().min(1),
  isInherited: z.boolean().default(false),
  metadata: z.any().optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/tiers/:tierId/features', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId } = req.params;
    const parsed = addFeatureSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, ...featureData } = parsed.data;

    // Check if tier exists
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Check if feature already exists
    const existing = await prisma.tierFeature.findUnique({
      where: {
        tierId_featureKey: {
          tierId,
          featureKey: featureData.featureKey,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'feature_exists',
        message: `Feature '${featureData.featureKey}' already exists in this tier`,
      });
    }

    // Add feature
    const feature = await prisma.tierFeature.create({
      data: {
        tierId,
        ...featureData,
      },
    });

    // Log the change
    await logTierChange({
      entityType: 'feature',
      entityId: feature.id,
      action: 'create',
      changeType: 'feature_added',
      afterState: feature,
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] Feature added by ${req.user?.email}:`, feature.featureKey, 'to', tier.tierKey);

    res.status(201).json({ feature });
  } catch (error) {
    console.error('[POST /api/admin/tier-system/tiers/:tierId/features] Error:', error);
    res.status(500).json({ error: 'failed_to_add_feature' });
  }
});

/**
 * DELETE /api/admin/tier-system/tiers/:tierId/features/:featureId
 * Remove a feature from a tier
 * Access: Platform admin only
 */
const removeFeatureSchema = z.object({
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.delete('/tiers/:tierId/features/:featureId', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId, featureId } = req.params;
    const parsed = removeFeatureSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason } = parsed.data;

    // Get current state
    const feature = await prisma.tierFeature.findUnique({
      where: { id: featureId },
      include: { tier: true },
    });

    if (!feature || feature.tierId !== tierId) {
      return res.status(404).json({ error: 'feature_not_found' });
    }

    // Delete feature
    await prisma.tierFeature.delete({
      where: { id: featureId },
    });

    // Log the change
    await logTierChange({
      entityType: 'feature',
      entityId: featureId,
      action: 'delete',
      changeType: 'feature_removed',
      beforeState: feature,
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] Feature removed by ${req.user?.email}:`, feature.featureKey, 'from', feature.tier.tierKey);

    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/tier-system/tiers/:tierId/features/:featureId] Error:', error);
    res.status(500).json({ error: 'failed_to_remove_feature' });
  }
});

/**
 * GET /api/admin/tier-system/change-logs
 * Get tier change history
 * Access: Platform staff
 */
router.get('/change-logs', requirePlatformStaff, async (req, res) => {
  try {
    const { entityType, entityId, limit = '50' } = req.query;

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const logs = await prisma.tierChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({ logs });
  } catch (error) {
    console.error('[GET /api/admin/tier-system/change-logs] Error:', error);
    res.status(500).json({ error: 'failed_to_get_logs' });
  }
});

export default router;
