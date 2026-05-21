/**
 * Capability Types Management API Routes
 * 
 * Platform admin endpoints for managing capability types and their feature collections.
 * Uses capability_type_list, capability_features_list, and features_list tables.
 * 
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
 * Helper to transform capability type from Prisma format to frontend format
 */
async function transformCapabilityType(capType: any) {
  // Get the feature keys linked to this capability type
  const featureLinks = await prisma.capability_features_list.findMany({
    where: {
      capability_type_id: capType.id,
      is_active: true,
    },
    include: {
      features_list: {
        select: { key: true, name: true },
      },
    },
    orderBy: { sort_order: 'asc' },
  });

  return {
    capability_type_key: capType.key,
    capability_type_name: capType.name,
    description: capType.description || '',
    category: capType.category || '',
    is_active: capType.is_active ?? true,
    sort_order: capType.sort_order ?? 0,
    allowed_features: featureLinks.map(fl => fl.features_list.key),
    created_at: capType.created_at?.toISOString(),
    updated_at: capType.updated_at?.toISOString(),
  };
}

/**
 * GET /api/admin/capability-types
 * List all capability types with their allowed features
 * Access: Platform staff
 */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    const capTypes = await prisma.capability_type_list.findMany({
      where: { is_active: true },
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' },
      ],
      include: {
        capability_features_list: {
          where: { is_active: true },
          include: {
            features_list: {
              select: { key: true, name: true },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    const transformed = capTypes.map(ct => ({
      capability_type_key: ct.key,
      capability_type_name: ct.name,
      description: ct.description || '',
      category: ct.category || '',
      is_active: ct.is_active ?? true,
      sort_order: ct.sort_order ?? 0,
      allowed_features: ct.capability_features_list.map(
        (fl: any) => fl.features_list.key
      ),
      created_at: ct.created_at?.toISOString(),
      updated_at: ct.updated_at?.toISOString(),
    }));

    res.json(transformed);
  } catch (error) {
    console.error('[GET /api/admin/capability-types] Error:', error);
    res.status(500).json({ error: 'failed_to_list_capability_types' });
  }
});

/**
 * POST /api/admin/capability-types
 * Create a new capability type with its feature collection
 * Access: Platform admin only
 */
const createCapabilityTypeSchema = z.object({
  capability_type_key: z.string().min(1).regex(/^[a-z_]+$/, 'Key must be lowercase with underscores'),
  capability_type_name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  allowed_features: z.array(z.string()).default([]),
});

router.post('/', requirePlatformAdmin, async (req, res) => {
  try {
    const parsed = createCapabilityTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { allowed_features, ...capTypeData } = parsed.data;

    // Check if key already exists
    const existing = await prisma.capability_type_list.findUnique({
      where: { key: capTypeData.capability_type_key },
    });

    if (existing) {
      return res.status(409).json({
        error: 'capability_type_key_exists',
        message: `Capability type with key '${capTypeData.capability_type_key}' already exists`,
      });
    }

    // Resolve feature IDs from keys
    const featureRecords = await prisma.features_list.findMany({
      where: {
        key: { in: allowed_features },
        is_active: true,
      },
      select: { id: true, key: true },
    });

    const foundKeys = new Set(featureRecords.map(f => f.key));
    const missingKeys = allowed_features.filter(k => !foundKeys.has(k));
    if (missingKeys.length > 0) {
      return res.status(400).json({
        error: 'invalid_features',
        message: `Features not found in features_list: ${missingKeys.join(', ')}`,
      });
    }

    // Create capability type with feature links
    const capType = await prisma.capability_type_list.create({
      data: {
        key: capTypeData.capability_type_key,
        name: capTypeData.capability_type_name,
        description: capTypeData.description || null,
        category: capTypeData.category || null,
        sort_order: capTypeData.sort_order,
        is_active: capTypeData.is_active ?? true,
        capability_features_list: {
          create: featureRecords.map((fr, idx) => ({
            feature_id: fr.id,
            is_active: true,
            sort_order: idx + 1,
          })),
        },
      },
      include: {
        capability_features_list: {
          where: { is_active: true },
          include: {
            features_list: {
              select: { key: true, name: true },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    const transformed = await transformCapabilityType(capType);
    res.status(201).json(transformed);
  } catch (error) {
    console.error('[POST /api/admin/capability-types] Error:', error);
    res.status(500).json({ error: 'failed_to_create_capability_type' });
  }
});

/**
 * PUT /api/admin/capability-types
 * Update a capability type (identified by capability_type_key in body)
 * Access: Platform admin only
 */
const updateCapabilityTypeSchema = z.object({
  capability_type_key: z.string().min(1),
  capability_type_name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  allowed_features: z.array(z.string()).optional(),
});

router.put('/', requirePlatformAdmin, async (req, res) => {
  try {
    const parsed = updateCapabilityTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { capability_type_key, allowed_features, ...updateData } = parsed.data;

    // Find existing
    const existing = await prisma.capability_type_list.findUnique({
      where: { key: capability_type_key },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'capability_type_not_found',
        message: `Capability type '${capability_type_key}' not found`,
      });
    }

    // Build update data
    const dbUpdateData: any = {};
    if (updateData.capability_type_name !== undefined) dbUpdateData.name = updateData.capability_type_name;
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description || null;
    if (updateData.category !== undefined) dbUpdateData.category = updateData.category || null;
    if (updateData.is_active !== undefined) dbUpdateData.is_active = updateData.is_active;
    if (updateData.sort_order !== undefined) dbUpdateData.sort_order = updateData.sort_order;
    dbUpdateData.updated_at = new Date();

    // Update basic fields
    await prisma.capability_type_list.update({
      where: { key: capability_type_key },
      data: dbUpdateData,
    });

    // If allowed_features provided, replace the feature links
    if (allowed_features !== undefined) {
      // Resolve feature IDs
      const featureRecords = await prisma.features_list.findMany({
        where: {
          key: { in: allowed_features },
          is_active: true,
        },
        select: { id: true, key: true },
      });

      // Delete existing feature links
      await prisma.capability_features_list.deleteMany({
        where: { capability_type_id: existing.id },
      });

      // Create new feature links
      if (featureRecords.length > 0) {
        await prisma.capability_features_list.createMany({
          data: featureRecords.map((fr, idx) => ({
            capability_type_id: existing.id,
            feature_id: fr.id,
            is_active: true,
            sort_order: idx + 1,
          })),
        });
      }
    }

    // Fetch updated record
    const updated = await prisma.capability_type_list.findUnique({
      where: { key: capability_type_key },
      include: {
        capability_features_list: {
          where: { is_active: true },
          include: {
            features_list: {
              select: { key: true, name: true },
            },
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    const transformed = await transformCapabilityType(updated);
    res.json(transformed);
  } catch (error) {
    console.error('[PUT /api/admin/capability-types] Error:', error);
    res.status(500).json({ error: 'failed_to_update_capability_type' });
  }
});

/**
 * DELETE /api/admin/capability-types
 * Delete a capability type (identified by capability_type_key query param)
 * Access: Platform admin only
 */
router.delete('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { capability_type_key } = req.query;

    if (!capability_type_key || typeof capability_type_key !== 'string') {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'capability_type_key query parameter is required',
      });
    }

    // Find existing
    const existing = await prisma.capability_type_list.findUnique({
      where: { key: capability_type_key },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'capability_type_not_found',
        message: `Capability type '${capability_type_key}' not found`,
      });
    }

    // Check if any tier_features_list references this capability type
    const tierFeatureCount = await prisma.tier_features_list.count({
      where: { capability_type_id: existing.id },
    });

    if (tierFeatureCount > 0) {
      // Soft delete — just mark inactive
      await prisma.capability_type_list.update({
        where: { key: capability_type_key },
        data: { is_active: false, updated_at: new Date() },
      });

      return res.json({
        success: true,
        deactivated: true,
        message: `Capability type '${capability_type_key}' deactivated (${tierFeatureCount} tier(s) reference it)`,
      });
    }

    // Hard delete — no references
    await prisma.capability_type_list.delete({
      where: { key: capability_type_key },
    });

    res.json({
      success: true,
      deleted: true,
      message: `Capability type '${capability_type_key}' deleted`,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/capability-types] Error:', error);
    res.status(500).json({ error: 'failed_to_delete_capability_type' });
  }
});

export default router;
