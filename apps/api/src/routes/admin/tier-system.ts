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
import { generateFeatureId, generateTierChangeId, generateTierId } from '../../lib/id-generator';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper to transform tier data from Prisma format to frontend format
 */
function transformTier(tier: any) {
  return {
    id: tier.id,
    tierKey: tier.tier_key,
    name: tier.name,
    displayName: tier.display_name,
    description: tier.description,
    priceMonthly: tier.price_monthly,
    maxSkus: tier.max_skus,
    maxLocations: tier.max_locations,
    tierType: tier.tier_type,
    isActive: tier.is_active,
    sortOrder: tier.sort_order,
    features: (tier.tier_features_list || []).map((feature: any) => ({
      id: feature.id,
      featureKey: feature.feature_key,
      featureName: feature.feature_name,
      isEnabled: feature.is_enabled,
      isInherited: feature.is_inherited,
    })),
    createdAt: tier.created_at,
    updatedAt: tier.updated_at,
  };
}

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
    await prisma.tier_change_logs_list.create({
      data: {
        //id: crypto.randomUUID(),
        id: generateTierChangeId(),
        entity_type: params.entityType,
        entity_id: params.entityId,
        action: params.action,
        change_type: params.changeType,
        before_state: params.beforeState as any,
        after_state: params.afterState as any,
        changed_by: params.changedBy,
        changed_by_email: params.changedByEmail || null,
        reason: params.reason || null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
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
      where.is_active = true;
    }

    const tiers = await prisma.subscription_tiers_list.findMany({
      where,
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
      include: {
        tier_features_list: {
          where: { is_enabled: true },
          orderBy: { feature_key: 'asc' },
        },
      },
    });

    // Transform the response to match frontend expectations
    const transformedTiers = tiers.map(transformTier);

    res.json({ tiers: transformedTiers });
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
    const features = await prisma.tier_features_list.findMany({
      where: { is_enabled: true },
      select: {
        feature_key: true,
        feature_name: true,
      },
      distinct: ['feature_key'],
      orderBy: { feature_key: 'asc' },
    });

    res.json({
      features: features.map(f => ({
        featureKey: f.feature_key,
        featureName: f.feature_name,
      })),
    });
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

    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
      include: {
        tier_features_list: {
          orderBy: { feature_key: 'asc' },
        },
      },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Transform the response to match frontend expectations
    const transformedTier = transformTier(tier);

    res.json({ tier: transformedTier });
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
    const existing = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierData.tierKey },
    });

    if (existing) {
      return res.status(409).json({
        error: 'tier_key_exists',
        message: `Tier with key '${tierData.tierKey}' already exists`,
      });
    }

    // Create tier with features
    const dbTierData: any = {
      tier_key: tierData.tierKey,
      name: tierData.name,
      display_name: tierData.displayName,
      description: tierData.description,
      price_monthly: tierData.priceMonthly,
      max_skus: tierData.maxSkus ?? null,
      max_locations: tierData.maxLocations ?? null,
      tier_type: tierData.tierType,
      sort_order: tierData.sortOrder,
      metadata: tierData.metadata as any,
      created_by: req.user?.userId,
      updated_by: req.user?.userId,
    };

    const tier = await prisma.subscription_tiers_list.create({
      data: {
        id: generateTierId(),
        ...dbTierData,
        tier_features_list: features
          ? {
              create: features.map(f => ({
                id: generateFeatureId(),
                feature_key: f.featureKey,
                feature_name: f.featureName,
                is_enabled: true,
                is_inherited: f.isInherited || false,
                metadata: f.metadata as any,
              })),
            }
          : undefined,
      },
      include: {
        tier_features_list: true,
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

    console.log(`[Tier System] Tier created by ${req.user?.email}:`, tier.tier_key);

    // Transform the response to match frontend expectations
    const transformedTier = transformTier(tier);

    res.status(201).json({ tier: transformedTier });
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
    const currentTier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
      include: { tier_features_list: true },
    });

    if (!currentTier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Update tier
    const dbUpdateData: any = {};
    if (updateData.name !== undefined) dbUpdateData.name = updateData.name;
    if (updateData.displayName !== undefined) dbUpdateData.display_name = updateData.displayName;
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
    if (updateData.priceMonthly !== undefined) dbUpdateData.price_monthly = updateData.priceMonthly;
    if (updateData.maxSkus !== undefined) dbUpdateData.max_skus = updateData.maxSkus;
    if (updateData.maxLocations !== undefined) dbUpdateData.max_locations = updateData.maxLocations;
    if (updateData.tierType !== undefined) dbUpdateData.tier_type = updateData.tierType;
    if (updateData.isActive !== undefined) dbUpdateData.is_active = updateData.isActive;
    if (updateData.sortOrder !== undefined) dbUpdateData.sort_order = updateData.sortOrder;
    if (updateData.metadata !== undefined) dbUpdateData.metadata = updateData.metadata as any;
    dbUpdateData.updated_by = req.user?.userId;

    const updatedTier = await prisma.subscription_tiers_list.update({
      where: { tier_key: tierId },
      data: dbUpdateData,
      include: {
        tier_features_list: true,
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

    console.log(`[Tier System] Tier updated by ${req.user?.email}:`, updatedTier.tier_key);

    // Transform the response to match frontend expectations
    const transformedTier = transformTier(updatedTier);

    res.json({ tier: transformedTier });
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
    const currentTier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
      include: { tier_features_list: true },
    });

    if (!currentTier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Check if any tenants are using this tier
    const tenantCount = await prisma.tenants.count({
      where: { subscription_tier: currentTier.tier_key },
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
      await prisma.subscription_tiers_list.delete({
        where: { tier_key: tierId },
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

      console.log(`[Tier System] Tier hard deleted by ${req.user?.email}:`, currentTier.tier_key);

      res.json({ success: true, deleted: true });
    } else {
      // Soft delete
      const updatedTier = await prisma.subscription_tiers_list.update({
        where: { tier_key: tierId },
        data: {
          is_active: false,
          updated_by: req.user?.userId,
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

      console.log(`[Tier System] Tier soft deleted by ${req.user?.email}:`, currentTier.tier_key);

    // Transform the response to match frontend expectations
    const transformedTier = transformTier(updatedTier);

    res.json({ success: true, deactivated: true, tier: transformedTier });
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
    const features = await prisma.tier_features_list.groupBy({
      by: ['feature_key', 'feature_name'],
      where: {
        is_enabled: true,
      },
    });

    // Sort by feature name for better UX
    const sortedFeatures = features.sort((a: any, b: any) =>
      a.feature_name.localeCompare(b.feature_name),
    );

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
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Check if feature already exists
    const existing = await prisma.tier_features_list.findUnique({
      where: {
        tier_id_feature_key: {
          tier_id: tier.id, // Use the actual tier ID
          feature_key: featureData.featureKey,
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
    const feature = await prisma.tier_features_list.create({
      data: {
        id: generateFeatureId(),
        tier_id: tier.id, // Use the actual tier ID, not the tier_key
        feature_key: featureData.featureKey,
        feature_name: featureData.featureName,
        is_enabled: true, // Default to enabled for new features
        is_inherited: featureData.isInherited || false,
        metadata: featureData.metadata as any,
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

    console.log(`[Tier System] Feature added by ${req.user?.email}:`, feature.feature_key, 'to', tier.tier_key);

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
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Get current feature state
    const currentFeature = await prisma.tier_features_list.findUnique({
      where: { id: featureId },
      include: { subscription_tiers_list: true },
    });

    if (!currentFeature || currentFeature.tier_id !== tier.id) {
      return res.status(404).json({ error: 'feature_not_found' });
    }

    // Update feature
    const updatedFeature = await prisma.tier_features_list.update({
      where: { id: featureId },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
      include: {
        subscription_tiers_list: true,
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

    console.log(`[Tier System] Feature updated by ${req.user?.email}:`, updatedFeature.feature_key, 'in', tier.tier_key);

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
    const targetTier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
      include: {
        tier_features_list: {
          where: { is_enabled: true },
        },
      },
    });

    if (!targetTier) {
      return res.status(404).json({ error: 'target_tier_not_found' });
    }

    // Check if source tier exists
    const sourceTier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: sourceTierId },
      include: {
        tier_features_list: {
          where: { is_enabled: true },
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
    if (targetTier.sort_order <= sourceTier.sort_order) {
      return res.status(400).json({ 
        error: 'invalid_tier_hierarchy',
        message: `Cannot inherit features from ${sourceTier.display_name}. You can only inherit from tiers with lower sort order (${targetTier.display_name} has sort order ${targetTier.sort_order}, ${sourceTier.display_name} has sort order ${sourceTier.sort_order}).`
      });
    }

    // Get existing features in target tier for comparison
    const existingFeatures = new Map(
      targetTier.tier_features_list.map((f: any) => [f.feature_key, f]),
    );

    // Separate features into new and existing
    const featuresToCreate = sourceTier.tier_features_list.filter(
      (f: any) => !existingFeatures.has(f.feature_key),
    );
    
    const featuresToUpdate = sourceTier.tier_features_list.filter(
      (f: any) => existingFeatures.has(f.feature_key),
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
        const newFeature = await tx.tier_features_list.create({
          data: {
            id: generateFeatureId(),
            tier_id: targetTier.id, // Use the actual tier ID
            feature_key: feature.feature_key,
            feature_name: feature.feature_name,
            is_inherited: true,
            is_enabled: true,
            metadata: feature.metadata as any,
          },
        });
        createdFeatures.push(newFeature);
      }

      // Mark existing matching features as inherited
      for (const sourceFeature of featuresToUpdate) {
        const existingFeature = existingFeatures.get(sourceFeature.feature_key);
        if (existingFeature && !existingFeature.is_inherited) {
          const updatedFeature = await tx.tier_features_list.update({
            where: { id: existingFeature.id },
            data: { is_inherited: true },
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
        tierKey: targetTier.tier_key,
        featureCount: targetTier.tier_features_list.length,
      },
      afterState: { 
        tierKey: targetTier.tier_key,
        featureCount:
          targetTier.tier_features_list.length + result.createdFeatures.length,
        createdFeatures: result.createdFeatures.length,
        updatedFeatures: result.updatedFeatures.length,
        totalProcessed: result.totalProcessed,
        sourceTier: sourceTier.tier_key
      },
      changedBy: req.user?.userId || 'system',
      changedByEmail: req.user?.email,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log(`[Tier System] ${result.totalProcessed} features processed by ${req.user?.email}:`, 
      `${result.createdFeatures.length} created, ${result.updatedFeatures.length} marked as inherited from ${sourceTier.tier_key} to ${targetTier.tier_key}`);

    res.json({ 
      message: 'Features inherited successfully',
      createdFeatures: result.createdFeatures,
      updatedFeatures: result.updatedFeatures,
      totalProcessed: result.totalProcessed,
      summary: {
        created: result.createdFeatures.length,
        updated: result.updatedFeatures.length,
        from: sourceTier.tier_key,
        to: targetTier.tier_key
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

    // Check if tier exists
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierId },
    });

    if (!tier) {
      return res.status(404).json({ error: 'tier_not_found' });
    }

    // Get current state
    const feature = await prisma.tier_features_list.findUnique({
      where: { id: featureId },
      include: { subscription_tiers_list: true },
    });

    if (!feature || feature.tier_id !== tier.id) {
      return res.status(404).json({ error: 'feature_not_found' });
    }

    // Delete feature
    await prisma.tier_features_list.delete({
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

    console.log(`[Tier System] Feature removed by ${req.user?.email}:`, feature.feature_key, 'from', feature.subscription_tiers_list.tier_key);

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

    const logs = await prisma.tier_change_logs_list.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({ logs });
  } catch (error) {
    console.error('[GET /api/admin/tier-system/change-logs] Error:', error);
    res.status(500).json({ error: 'failed_to_get_logs' });
  }
});

export default router;
