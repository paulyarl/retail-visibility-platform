/**
 * BSaaS Bundles Admin Routes
 *
 * Platform admin endpoints for managing the bsaas_bundles + bsaas_bundle_items
 * tables — the registry of cross-domain feature bundles available for
 * self-service purchase in the BSaaS store.
 *
 * Mounted at: /api/admin/bsaas-bundles
 *
 * GET    /           — List all bundles (with items)
 * POST   /           — Create a bundle + items
 * PUT    /:id        — Update bundle metadata + items
 * DELETE /:id        — Delete a bundle (cascades items)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { audit } from '../../audit';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

// ====================
// Validation Schemas
// ====================

const createBundleSchema = z.object({
  bundle_key: z.string().min(1),
  marketing_name: z.string().min(1),
  description: z.string().optional(),
  price_cents: z.number().int().positive(),
  billing_cycle: z.enum(['one_time', 'weekly', 'monthly', 'annual']).default('monthly'),
  trial_days: z.number().int().min(0).default(0),
  trial_eligible: z.boolean().default(false),
  demo_eligible: z.boolean().default(true),
  is_private: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  items: z.array(z.object({
    feature_key: z.string().min(1),
    sort_order: z.number().int().default(0),
  })).min(1),
});

const updateBundleSchema = z.object({
  marketing_name: z.string().optional(),
  description: z.string().optional(),
  price_cents: z.number().int().positive().optional(),
  billing_cycle: z.enum(['one_time', 'weekly', 'monthly', 'annual']).optional(),
  trial_days: z.number().int().min(0).optional(),
  trial_eligible: z.boolean().optional(),
  demo_eligible: z.boolean().optional(),
  is_private: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  items: z.array(z.object({
    feature_key: z.string().min(1),
    sort_order: z.number().int().default(0),
  })).optional(),
});

// ====================
// Routes
// ====================

// GET /api/admin/bsaas-bundles
router.get('/', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const where: any = {};
    if (active === 'true') where.is_active = true;
    if (active === 'false') where.is_active = false;

    const bundles = await prisma.bsaas_bundles.findMany({
      where,
      orderBy: { sort_order: 'asc' },
      include: {
        bsaas_bundle_items: { orderBy: { sort_order: 'asc' } },
      },
    });

    res.json({ success: true, data: bundles });
  } catch (error) {
    console.error('[BSaaS Bundles] Error listing:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list bundles' });
  }
});

// POST /api/admin/bsaas-bundles
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createBundleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid bundle entry', details: validation.error.issues });
    }

    const { bundle_key, items, ...rest } = validation.data;

    // Verify all feature keys exist in features_list
    const featureKeys = items.map(i => i.feature_key);
    const features = await prisma.features_list.findMany({
      where: { key: { in: featureKeys } },
      select: { key: true },
    });
    const foundKeys = new Set(features.map(f => f.key));
    const missingKeys = featureKeys.filter(k => !foundKeys.has(k));
    if (missingKeys.length > 0) {
      return res.status(404).json({
        error: 'not_found',
        message: `Feature keys not found in features_list: ${missingKeys.join(', ')}`,
      });
    }

    // Check for existing bundle_key
    const existing = await prisma.bsaas_bundles.findUnique({ where: { bundle_key } });
    if (existing) {
      return res.status(409).json({ error: 'bundle_key_exists', message: `Bundle key '${bundle_key}' already exists` });
    }

    // Create bundle + items in a transaction
    const bundle = await prisma.$transaction(async (tx) => {
      const created = await tx.bsaas_bundles.create({
        data: {
          bundle_key,
          ...rest,
          bsaas_bundle_items: {
            create: items.map((item, idx) => ({
              feature_key: item.feature_key,
              sort_order: item.sort_order ?? idx,
            })),
          },
        },
        include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
      });
      return created;
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_bundle.create',
      payload: { id: bundle.id, entity_type: 'other', bundle_key, feature_keys: featureKeys, ...rest },
    });

    res.status(201).json({ success: true, data: bundle });
  } catch (error: any) {
    console.error('[BSaaS Bundles] Error creating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create bundle' });
  }
});

// PUT /api/admin/bsaas-bundles/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const validation = updateBundleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid update', details: validation.error.issues });
    }

    const { id } = req.params;
    const { items, ...rest } = validation.data;

    const existing = await prisma.bsaas_bundles.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Bundle not found' });
    }

    // If items are provided, validate feature keys and replace
    if (items) {
      const featureKeys = items.map(i => i.feature_key);
      const features = await prisma.features_list.findMany({
        where: { key: { in: featureKeys } },
        select: { key: true },
      });
      const foundKeys = new Set(features.map(f => f.key));
      const missingKeys = featureKeys.filter(k => !foundKeys.has(k));
      if (missingKeys.length > 0) {
        return res.status(404).json({
          error: 'not_found',
          message: `Feature keys not found in features_list: ${missingKeys.join(', ')}`,
        });
      }

      // Replace items in a transaction
      const bundle = await prisma.$transaction(async (tx) => {
        await tx.bsaas_bundle_items.deleteMany({ where: { bundle_id: id } });
        await tx.bsaas_bundle_items.createMany({
          data: items.map((item, idx) => ({
            bundle_id: id,
            feature_key: item.feature_key,
            sort_order: item.sort_order ?? idx,
          })),
        });
        const updated = await tx.bsaas_bundles.update({
          where: { id },
          data: { ...rest, updated_at: new Date() },
          include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
        });
        return updated;
      });

      await audit({
        tenantId: (req as any).user?.tenantId || 'system',
        actor: (req as any).user?.id || null,
        action: 'bsaas_bundle.update',
        payload: { id, entity_type: 'other', changes: validation.data },
      });

      return res.json({ success: true, data: bundle });
    }

    // No items replacement — just update metadata
    const bundle = await prisma.bsaas_bundles.update({
      where: { id },
      data: { ...rest, updated_at: new Date() },
      include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_bundle.update',
      payload: { id, entity_type: 'other', changes: validation.data },
    });

    res.json({ success: true, data: bundle });
  } catch (error: any) {
    console.error('[BSaaS Bundles] Error updating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update bundle' });
  }
});

// DELETE /api/admin/bsaas-bundles/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.bsaas_bundles.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Bundle not found' });
    }

    await prisma.bsaas_bundles.delete({ where: { id } });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_bundle.delete',
      payload: { id, entity_type: 'other', bundle_key: existing.bundle_key },
    });

    res.json({ success: true, message: 'Bundle removed' });
  } catch (error: any) {
    console.error('[BSaaS Bundles] Error deleting:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete bundle' });
  }
});

export default router;
