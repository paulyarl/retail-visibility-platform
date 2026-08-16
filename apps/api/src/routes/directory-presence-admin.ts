/**
 * Admin Directory Presence Seeds Routes
 *
 *   GET    /api/admin/directory/presence-seeds           — list seeds
 *   GET    /api/admin/directory/presence-seeds/:id       — seed detail
 *   POST   /api/admin/directory/presence-seeds           — create seed
 *   POST   /api/admin/directory/presence-seeds/:id/publish — publish listing
 *   POST   /api/admin/directory/presence-seeds/:id/invite — mint claim token
 *   PATCH  /api/admin/directory/presence-seeds/:id/fields — update sourced fields
 *
 * All routes require PLATFORM_ADMIN or PLATFORM_SUPPORT auth.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import { logger } from '../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in routeRegistry
const requirePlatformStaff = (req: Request, res: Response, next: any) => {
  if (!['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes((req as any).user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const requirePlatformAdmin = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const createSeedSchema = z.object({
  businessName: z.string().min(1).max(200),
  address: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  primaryCategory: z.string().min(1).max(100),
  secondaryCategories: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  snapEbtReported: z.boolean().optional(),
  snapEbtAsOf: z.string().datetime().optional(),
  snapEbtSource: z.string().optional(),
  snapEbtSourceName: z.string().optional(),
  seedBatch: z.string().min(1).max(100),
  identityConfidence: z.enum(['high', 'medium']),
  categoryFit: z.enum(['verified', 'probable']),
  notes: z.string().optional(),
  provenance: z.array(z.object({
    fieldKey: z.string(),
    value: z.string().optional(),
    sourceName: z.string().optional(),
    sourceUrl: z.string().optional(),
    accessedAt: z.string().datetime().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    showOnPublic: z.boolean().optional(),
  })).optional(),
});

const updateFieldsSchema = z.object({
  snapEbtReported: z.boolean().optional(),
  snapEbtAsOf: z.string().datetime().nullable().optional(),
  snapEbtSource: z.string().nullable().optional(),
  snapEbtSourceName: z.string().nullable().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  businessHours: z.any().optional(),
  provenanceUpdates: z.array(z.object({
    fieldKey: z.string(),
    value: z.string().optional(),
    sourceName: z.string().optional(),
    sourceUrl: z.string().optional(),
    accessedAt: z.string().datetime().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    showOnPublic: z.boolean().optional(),
  })).optional(),
});

/** GET /api/admin/directory/presence-seeds — list seeds */
router.get('/presence-seeds', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const seedBatch = req.query.seedBatch as string | undefined;
    const status = req.query.status as string | undefined;
    const city = req.query.city as string | undefined;
    const category = req.query.category as string | undefined;

    const seeds = await DirectoryPresenceSeedService.listSeeds({ seedBatch, status, city, category });
    res.json({ success: true, seeds });
  } catch (error) {
    logger.error('[GET /api/admin/directory/presence-seeds] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/presence-seeds/:id — seed detail */
router.get('/presence-seeds/:id', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const detail = await DirectoryPresenceSeedService.getSeed(id);
    if (!detail) return res.status(404).json({ error: 'seed_not_found' });
    res.json({ success: true, ...detail });
  } catch (error) {
    logger.error('[GET /api/admin/directory/presence-seeds/:id] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds — create seed */
router.post('/presence-seeds', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const validation = createSeedSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const input = validation.data;
    const seed = await DirectoryPresenceSeedService.createSeed({
      businessName: input.businessName,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      phone: input.phone,
      website: input.website || undefined,
      primaryCategory: input.primaryCategory,
      secondaryCategories: input.secondaryCategories,
      latitude: input.latitude,
      longitude: input.longitude,
      snapEbtReported: input.snapEbtReported,
      snapEbtAsOf: input.snapEbtAsOf ? new Date(input.snapEbtAsOf) : undefined,
      snapEbtSource: input.snapEbtSource,
      snapEbtSourceName: input.snapEbtSourceName,
      seedBatch: input.seedBatch,
      identityConfidence: input.identityConfidence,
      categoryFit: input.categoryFit,
      notes: input.notes,
      provenance: input.provenance?.map((p) => ({
        fieldKey: p.fieldKey,
        value: p.value,
        sourceName: p.sourceName,
        sourceUrl: p.sourceUrl,
        accessedAt: p.accessedAt ? new Date(p.accessedAt) : undefined,
        confidence: p.confidence,
        showOnPublic: p.showOnPublic,
      })),
    }, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);

    res.status(201).json({ success: true, seed });
  } catch (error) {
    logger.error('[POST /api/admin/directory/presence-seeds] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/publish — publish listing */
router.post('/presence-seeds/:id/publish', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await DirectoryPresenceSeedService.publishSeed(id, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);
    res.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'seed_not_found') return res.status(404).json({ error: 'seed_not_found' });
    if (error?.message === 'seed_already_claimed') return res.status(409).json({ error: 'seed_already_claimed' });
    logger.error('[POST /api/admin/directory/presence-seeds/:id/publish] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/invite — mint claim token */
router.post('/presence-seeds/:id/invite', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expiresInDays = parseInt(req.body?.expiresInDays as string) || 90;
    const result = await DirectoryPresenceSeedService.inviteSeed(id, expiresInDays, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);
    res.status(201).json({ success: true, token: result.token, expiresAt: result.expiresAt });
  } catch (error: any) {
    if (error?.message === 'seed_not_found') return res.status(404).json({ error: 'seed_not_found' });
    if (error?.message === 'seed_already_claimed') return res.status(409).json({ error: 'seed_already_claimed' });
    logger.error('[POST /api/admin/directory/presence-seeds/:id/invite] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** PATCH /api/admin/directory/presence-seeds/:id/fields — update sourced fields */
router.patch('/presence-seeds/:id/fields', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateFieldsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const data = validation.data;
    await DirectoryPresenceSeedService.updateFields(
      id,
      {
        snapEbtReported: data.snapEbtReported,
        snapEbtAsOf: data.snapEbtAsOf ? new Date(data.snapEbtAsOf) : data.snapEbtAsOf === null ? null : undefined,
        snapEbtSource: data.snapEbtSource,
        snapEbtSourceName: data.snapEbtSourceName,
        phone: data.phone,
        website: data.website,
        businessHours: data.businessHours,
      },
      data.provenanceUpdates?.map((p) => ({
        fieldKey: p.fieldKey,
        value: p.value,
        sourceName: p.sourceName,
        sourceUrl: p.sourceUrl,
        accessedAt: p.accessedAt ? new Date(p.accessedAt) : undefined,
        confidence: p.confidence,
        showOnPublic: p.showOnPublic,
      })),
      {
        actorType: 'user',
        actorId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      } as any
    );
    res.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'seed_not_found') return res.status(404).json({ error: 'seed_not_found' });
    logger.error('[PATCH /api/admin/directory/presence-seeds/:id/fields] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
