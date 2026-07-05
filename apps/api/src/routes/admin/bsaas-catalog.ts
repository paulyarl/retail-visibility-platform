/**
 * BSaaS Catalog Admin Routes
 *
 * Platform admin endpoints for managing the bsaas_catalog table —
 * the registry of features available for self-service à la carte purchase.
 *
 * Mounted at: /api/admin/bsaas-catalog
 *
 * GET    /           — List all catalog entries
 * POST   /           — Create a catalog entry (mark a feature as purchasable)
 * PUT    /:id        — Update a catalog entry (pricing, description, active)
 * DELETE /:id        — Remove a feature from the catalog
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { audit } from '../../audit';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// ====================
// Validation Schemas
// ====================

const createCatalogSchema = z.object({
  feature_key: z.string().min(1),
  marketing_name: z.string().optional(),
  description: z.string().optional(),
  price_cents: z.number().int().positive(),
  billing_cycle: z.enum(['one_time', 'weekly', 'monthly', 'annual']).default('monthly'),
  trial_days: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

const updateCatalogSchema = z.object({
  marketing_name: z.string().optional(),
  description: z.string().optional(),
  price_cents: z.number().int().positive().optional(),
  billing_cycle: z.enum(['one_time', 'weekly', 'monthly', 'annual']).optional(),
  trial_days: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ====================
// Routes
// ====================

// GET /api/admin/bsaas-catalog
router.get('/', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const where: any = {};
    if (active === 'true') where.is_active = true;
    if (active === 'false') where.is_active = false;

    const entries = await prisma.bsaas_catalog.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });

    // Enrich with capability type info via features_list -> capability_features_list -> capability_type_list
    const featureKeys = entries.map(e => e.feature_key);
    let capabilityMap: Record<string, string[]> = {};
    if (featureKeys.length > 0) {
      const features = await prisma.features_list.findMany({
        where: { key: { in: featureKeys } },
        select: {
          key: true,
          capability_features_list: {
            include: {
              capability_type_list: { select: { key: true, name: true } },
            },
          },
        },
      });
      for (const f of features) {
        capabilityMap[f.key] = f.capability_features_list.map(
          cfl => cfl.capability_type_list?.key
        ).filter(Boolean) as string[];
      }
    }

    const enriched = entries.map(e => ({
      ...e,
      capability_types: capabilityMap[e.feature_key] || [],
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[BSaaS Catalog] Error listing:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list catalog' });
  }
});

// POST /api/admin/bsaas-catalog
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createCatalogSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid catalog entry', details: validation.error.issues });
    }

    const { feature_key, ...rest } = validation.data;

    // Verify the feature key exists in features_list
    const feature = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!feature) {
      return res.status(404).json({ error: 'not_found', message: `Feature key '${feature_key}' does not exist in features_list` });
    }

    const entry = await prisma.bsaas_catalog.upsert({
      where: { feature_key },
      update: { ...rest, updated_at: new Date() },
      create: { feature_key, ...rest },
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_catalog.create',
      payload: { id: entry.id, entity_type: 'other', feature_key, ...rest },
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error: any) {
    console.error('[BSaaS Catalog] Error creating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create catalog entry' });
  }
});

// PUT /api/admin/bsaas-catalog/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const validation = updateCatalogSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid update', details: validation.error.issues });
    }

    const { id } = req.params;
    const existing = await prisma.bsaas_catalog.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Catalog entry not found' });
    }

    const entry = await prisma.bsaas_catalog.update({
      where: { id },
      data: { ...validation.data, updated_at: new Date() },
    });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_catalog.update',
      payload: { id, entity_type: 'other', changes: validation.data },
    });

    res.json({ success: true, data: entry });
  } catch (error: any) {
    console.error('[BSaaS Catalog] Error updating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update catalog entry' });
  }
});

// DELETE /api/admin/bsaas-catalog/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.bsaas_catalog.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Catalog entry not found' });
    }

    await prisma.bsaas_catalog.delete({ where: { id } });

    await audit({
      tenantId: (req as any).user?.tenantId || 'system',
      actor: (req as any).user?.id || null,
      action: 'bsaas_catalog.delete',
      payload: { id, entity_type: 'other', feature_key: existing.feature_key },
    });

    res.json({ success: true, message: 'Catalog entry removed' });
  } catch (error: any) {
    console.error('[BSaaS Catalog] Error deleting:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete catalog entry' });
  }
});

export default router;
