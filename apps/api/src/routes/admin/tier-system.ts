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
    await prisma.tierChangeLogs.create({
      data: {
        id: crypto.randomUUID(), // Generate unique ID for the log entry
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changeType: params.changeType,
        beforeState: params.beforeState as any,
        afterState: params.afterState as any,
        changedBy: params.changedBy,
        changedByEmail: params.changedByEmail || null,
        reason: params.reason || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      } as any,
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
 * GET /api/admin/tier-system/features
 * List all available features from the tier system
 * Access: Platform staff
 */
router.get('/features', requirePlatformStaff, async (req, res) => {
  try {
    // Get all unique features from all tiers
    const features = await prisma.tierFeatures.findMany({
      where: { isEnabled: true },
      select: {
        featureKey: true,
        featureName: true,
      },
      distinct: ['featureKey'],
      orderBy: { featureKey: 'asc' },
    });

    res.json({ features });
  } catch (error) {
    console.error('[GET /api/admin/tier-system/features] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_features' });
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
      where: { tierKey: tierId },
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
  maxSkus: z.number().int().positive().nullable().optional(),
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
        id: crypto.randomUUID(), // Generate unique ID
        ...tierData,
        displayName: tierData.displayName, // Map snake_case to camelCase
        createdBy: req.user?.userId,
        updatedBy: req.user?.userId,
        features: features ? {
          create: features.map(f => ({
            id: crypto.randomUUID(), // Generate unique ID
            featureKey: f.featureKey,
            featureName: f.featureName,
            isEnabled: true, // Default to enabled for new features
            isInherited: f.isInherited || false,
            metadata: f.metadata as any,
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
  maxSkus: z.number().int().positive().nullable().optional(),
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
      where: { tierKey: tierId },
      include: { features: true },
    });

    if (!currentTier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Update tier
    const updatedTier = await prisma.subscriptionTier.update({
      where: { tierKey: tierId },
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
      where: { tierKey: tierId },
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
        where: { tierKey: tierId },
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
        where: { tierKey: tierId },
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
 * GET /api/admin/tier-system/features
 * Get all existing features across all tiers
 * Access: Platform staff only
 */
router.get('/features', requirePlatformStaff, async (req, res) => {
  try {
    // Get all unique features from all tiers
    const features = await prisma.tierFeatures.groupBy({
      by: ['featureKey', 'featureName'],
      where: {
        isEnabled: true,
      },
    });

    // Sort by feature name for better UX
    const sortedFeatures = features.sort((a, b) => a.featureName.localeCompare(b.featureName));

    res.json(sortedFeatures);
  } catch (error) {
    console.error('[GET /api/admin/tier-system/features] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_features' });
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
      where: { tierKey: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Check if feature already exists
    const existing = await prisma.tierFeatures.findUnique({
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
    const feature = await prisma.tierFeatures.create({
      data: {
        id: crypto.randomUUID(),
        tierId,
        featureKey: featureData.featureKey,
        featureName: featureData.featureName,
        isEnabled: true, // Default to enabled for new features
        isInherited: featureData.isInherited || false,
        metadata: featureData.metadata as any,
      } as any,
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
 * PATCH /api/admin/tier-system/tiers/:tierId/features/:featureId
 * Update a feature in a tier
 * Access: Platform admin only
 */
const updateFeatureSchema = z.object({
  featureKey: z.string().min(1).optional(),
  featureName: z.string().min(1).optional(),
  isInherited: z.boolean().optional(),
  metadata: z.any().optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.patch('/tiers/:tierId/features/:featureId', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId, featureId } = req.params;
    const parsed = updateFeatureSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, ...updateData } = parsed.data;

    // Check if tier exists
    const tier = await prisma.subscriptionTier.findUnique({
      where: { tierKey: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Get current feature state
    const currentFeature = await prisma.tierFeatures.findUnique({
      where: { id: featureId },
      include: { tier: true },
    });

    if (!currentFeature || currentFeature.tierId !== tierId) {
      return res.status(404).json({ error: 'feature_not_found' });
    }

    // Update feature
    const updatedFeature = await prisma.tierFeatures.update({
      where: { id: featureId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        tier: true,
      },
    });

    // Log the change
    await logTierChange({
      entityType: 'feature',
      entityId: featureId,
      action: 'update',
      changeType: 'feature_updated',
      beforeState: currentFeature,
      afterState: updatedFeature,
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] Feature updated by ${req.user?.email}:`, updatedFeature.featureKey, 'in', tier.tierKey);

    res.json({ feature: updatedFeature });
  } catch (error) {
    console.error('[PATCH /api/admin/tier-system/tiers/:tierId/features/:featureId] Error:', error);
    res.status(500).json({ error: 'failed_to_update_feature' });
  }
});

/**
 * POST /api/admin/tier-system/tiers/:tierId/inherit-features
 * Inherit all features from another tier
 * Access: Platform admin only
 */
const inheritFeaturesSchema = z.object({
  sourceTierId: z.string().min(1, 'Source tier ID is required'),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/tiers/:tierId/inherit-features', requirePlatformAdmin, async (req, res) => {
  try {
    const { tierId } = req.params;
    const parsed = inheritFeaturesSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { sourceTierId, reason } = parsed.data;

    // Check if target tier exists
    const targetTier = await prisma.subscriptionTier.findUnique({
      where: { tierKey: tierId },
      include: {
        features: {
          where: { isEnabled: true },
        },
      },
    });

    if (!targetTier) {
      return res.status(404).json({ error: 'target_tier_not_found' });
    }

    // Check if source tier exists
    const sourceTier = await prisma.subscriptionTier.findUnique({
      where: { tierKey: sourceTierId },
      include: {
        features: {
          where: { isEnabled: true },
        },
      },
    });

    if (!sourceTier) {
      return res.status(404).json({ error: 'source_tier_not_found' });
    }

    // Prevent self-inheritance
    if (tierId === sourceTierId) {
      return res.status(400).json({ error: 'cannot_inherit_from_self' });
    }

    // Enforce tier hierarchy: can only inherit from lower tiers (lower sort order)
    if (targetTier.sortOrder <= sourceTier.sortOrder) {
      return res.status(400).json({ 
        error: 'invalid_tier_hierarchy',
        message: `Cannot inherit features from ${sourceTier.displayName}. You can only inherit from tiers with lower sort order (${targetTier.displayName} has sort order ${targetTier.sortOrder}, ${sourceTier.displayName} has sort order ${sourceTier.sortOrder}).`
      });
    }

    // Get existing features in target tier for comparison
    const existingFeatures = new Map(
      targetTier.features.map((f: any) => [f.featureKey, f])
    );

    // Separate features into new and existing
    const featuresToCreate = sourceTier.features.filter(
      (f: any) => !existingFeatures.has(f.featureKey)
    );
    
    const featuresToUpdate = sourceTier.features.filter(
      (f: any) => existingFeatures.has(f.featureKey)
    );

    // Check if there's anything to do
    if (featuresToCreate.length === 0 && featuresToUpdate.length === 0) {
      return res.status(400).json({ 
        error: 'no_features_to_process',
        message: 'No features available to inherit'
      });
    }

    // Process inheritance: create new features and mark existing as inherited
    const result = await prisma.$transaction(async (tx) => {
      const createdFeatures = [];
      const updatedFeatures = [];
      
      // Create new features that don't exist
      for (const feature of featuresToCreate) {
        const newFeature = await tx.tierFeatures.create({
          data: {
            id: crypto.randomUUID(),
            tierId,
            featureKey: feature.featureKey,
            featureName: feature.featureName,
            isInherited: true,
            isEnabled: true,
            metadata: feature.metadata as any,
          },
        });
        createdFeatures.push(newFeature);
      }

      // Mark existing matching features as inherited
      for (const sourceFeature of featuresToUpdate) {
        const existingFeature = existingFeatures.get(sourceFeature.featureKey);
        if (existingFeature && !existingFeature.isInherited) {
          const updatedFeature = await tx.tierFeatures.update({
            where: { id: existingFeature.id },
            data: { isInherited: true },
          });
          updatedFeatures.push(updatedFeature);
        }
      }

      return {
        createdFeatures,
        updatedFeatures,
        totalProcessed: createdFeatures.length + updatedFeatures.length
      };
    });

    // Log the change
    await logTierChange({
      entityType: 'tier',
      entityId: tierId,
      action: 'update',
      changeType: 'features_inherited',
      beforeState: { 
        tierKey: targetTier.tierKey,
        featureCount: targetTier.features.length 
      },
      afterState: { 
        tierKey: targetTier.tierKey,
        featureCount: targetTier.features.length + result.createdFeatures.length,
        createdFeatures: result.createdFeatures.length,
        updatedFeatures: result.updatedFeatures.length,
        totalProcessed: result.totalProcessed,
        sourceTier: sourceTier.tierKey
      },
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] ${result.totalProcessed} features processed by ${req.user?.email}:`, 
      `${result.createdFeatures.length} created, ${result.updatedFeatures.length} marked as inherited from ${sourceTier.tierKey} to ${targetTier.tierKey}`);

    res.json({ 
      message: 'Features inherited successfully',
      createdFeatures: result.createdFeatures,
      updatedFeatures: result.updatedFeatures,
      totalProcessed: result.totalProcessed,
      summary: {
        created: result.createdFeatures.length,
        updated: result.updatedFeatures.length,
        from: sourceTier.tierKey,
        to: targetTier.tierKey
      }
    });
  } catch (error) {
    console.error('[POST /api/admin/tier-system/tiers/:tierId/inherit-features] Error:', error);
    res.status(500).json({ error: 'failed_to_inherit_features' });
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
    const feature = await prisma.tierFeatures.findUnique({
      where: { id: featureId },
      include: { tier: true },
    });

    if (!feature || feature.tierId !== tierId) {
      return res.status(404).json({ error: 'feature_not_found' });
    }

    // Delete feature
    await prisma.tierFeatures.delete({
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

    const logs = await prisma.tierChangeLogs.findMany({
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
