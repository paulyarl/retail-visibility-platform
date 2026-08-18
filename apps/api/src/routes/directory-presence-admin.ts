/**
 * Admin Directory Presence Seeds Routes
 *
 *   GET    /api/admin/directory/presence-seeds           — list seeds
 *   GET    /api/admin/directory/presence-seeds/:id       — seed detail
 *   POST   /api/admin/directory/presence-seeds           — create seed
 *   POST   /api/admin/directory/presence-seeds/:id/publish — publish listing
 *   POST   /api/admin/directory/presence-seeds/:id/invite — mint claim token
 *   PATCH  /api/admin/directory/presence-seeds/:id/fields — update sourced fields
 *   PATCH  /api/admin/directory/presence-seeds/:id/status — change seed status
 *   POST   /api/admin/directory/presence-seeds/:id/tokens/:tokenId/revoke — revoke claim token
 *
 * All routes require PLATFORM_ADMIN or PLATFORM_SUPPORT auth.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import BatchSeekService from '../services/BatchSeekService';
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
  primaryCategory: z.string().nullable().optional(),
  secondaryCategories: z.array(z.string()).optional(),
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

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'invited', 'claimed', 'suppressed']),
});

/** GET /api/admin/directory/presence-seeds — list seeds */
router.get('/presence-seeds', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const seedBatch = req.query.seedBatch as string | undefined;
    const status = req.query.status as string | undefined;
    const city = req.query.city as string | undefined;
    const state = req.query.state as string | undefined;
    const category = req.query.category as string | undefined;
    const identityConfidence = req.query.identityConfidence as string | undefined;
    const categoryFit = req.query.categoryFit as string | undefined;
    const hasClaimToken = req.query.hasClaimToken as string | undefined;

    const seeds = await DirectoryPresenceSeedService.listSeeds({
      seedBatch,
      status,
      city,
      state,
      category,
      identityConfidence,
      categoryFit,
      hasClaimToken,
    });
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
        primaryCategory: data.primaryCategory,
        secondaryCategories: data.secondaryCategories,
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

/** PATCH /api/admin/directory/presence-seeds/:id/status — change seed status */
router.patch('/presence-seeds/:id/status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    await DirectoryPresenceSeedService.updateStatus(id, validation.data.status, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);
    res.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'seed_not_found') return res.status(404).json({ error: 'seed_not_found' });
    if (error?.message === 'invalid_status') return res.status(400).json({ error: 'invalid_status' });
    logger.error('[PATCH /api/admin/directory/presence-seeds/:id/status] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/tokens/:tokenId/revoke — revoke a claim token */
router.post('/presence-seeds/:id/tokens/:tokenId/revoke', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id, tokenId } = req.params;
    await DirectoryPresenceSeedService.revokeToken(id, tokenId, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);
    res.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'token_not_found') return res.status(404).json({ error: 'token_not_found' });
    if (error?.message === 'token_already_consumed') return res.status(409).json({ error: 'token_already_consumed' });
    logger.error('[POST /api/admin/directory/presence-seeds/:id/tokens/:tokenId/revoke] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** PATCH /api/admin/directory/presence-seeds/:id/outreach — update outreach status + owner info */
const outreachSchema = z.object({
  status: z.enum(['unverified', 'outreach_attempted', 'verified_by_call', 'verified_by_email', 'enrichment_sent', 'enrichment_pending_review', 'enriched']),
  notes: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  ownerEmail: z.string().nullable().optional(),
  ownerPhone: z.string().nullable().optional(),
});

router.patch('/presence-seeds/:id/outreach', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = outreachSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.updateOutreachStatus(id, validation.data, {
      actorType: 'user',
      actorId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        seed_not_found: 404,
        invalid_status: 400,
      };
      return res.status(statusMap[result.error || ''] || 400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[PATCH /api/admin/directory/presence-seeds/:id/outreach] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/enrichment-token — generate enrichment token */
router.post('/presence-seeds/:id/enrichment-token', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await DirectoryPresenceSeedService.generateEnrichmentToken(id, {
      actorType: 'user',
      actorId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if ('error' in result) {
      const statusMap: Record<string, number> = {
        seed_not_found: 404,
      };
      return res.status(statusMap[result.error] || 400).json({ error: result.error });
    }

    res.json({ success: true, token: result.token, tokenId: result.tokenId, expiresAt: result.expiresAt });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/presence-seeds/:id/enrichment-token] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

// ====================
// Batch operations (Sprint 4)
// ====================

/** POST /api/admin/directory/presence-seeds/batch-create — create seeds from multiple queue entries */
const batchCreateSchema = z.object({
  queueEntryIds: z.array(z.string()).min(1).max(200),
  seedBatch: z.string().min(1).max(100),
});

router.post('/presence-seeds/batch-create', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const validation = batchCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.createSeedsFromBatch(
      validation.data.queueEntryIds,
      validation.data.seedBatch,
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/presence-seeds/batch-create] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/batch-publish — publish multiple seeds */
const batchPublishSchema = z.object({
  seedIds: z.array(z.string()).min(1).max(200),
});

router.post('/presence-seeds/batch-publish', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const validation = batchPublishSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.publishBatch(
      validation.data.seedIds,
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/presence-seeds/batch-publish] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/batch-invite — invite (mint claim tokens) for multiple seeds */
const batchInviteSchema = z.object({
  seedIds: z.array(z.string()).min(1).max(200),
  expiresInDays: z.number().min(1).max(365).optional(),
});

router.post('/presence-seeds/batch-invite', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const validation = batchInviteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.inviteBatch(
      validation.data.seedIds,
      validation.data.expiresInDays || 90,
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/presence-seeds/batch-invite] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/seed-batches — list seed batches with metrics */
router.get('/seed-batches', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const seedBatch = req.query.seedBatch as string | undefined;
    const result = await BatchSeekService.listSeedBatches({ seedBatch });
    res.json({ success: true, batches: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/seed-batches] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/seek-batches — list seek batches with metrics */
router.get('/seek-batches', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const result = await BatchSeekService.listBatches({ status });
    res.json({ success: true, batches: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/seek-batches] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/seek-batches/:id — seek batch detail with per-city breakdown */
router.get('/seek-batches/:id', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await BatchSeekService.getBatchStatus(id);
    if (!result) {
      return res.status(404).json({ error: 'batch_not_found' });
    }
    res.json({ success: true, batch: result });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/seek-batches/:id] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/seek-batches — create a seek batch */
const createBatchEntrySchema = z.object({
  profileId: z.string(),
  profileVersion: z.number().optional(),
  nicheCategory: z.string(),
  city: z.string(),
  state: z.string().optional(),
  intelligenceFocus: z.enum(['emerging', 'competitive']).optional(),
});

const createBatchSchema = z.object({
  profileId: z.string(),
  profileVersion: z.number().optional(),
  nicheCategory: z.string(),
  intelligenceFocus: z.enum(['emerging', 'competitive']).optional(),
  cities: z.array(z.string()).min(1).max(10),
  state: z.string().optional(),
  entries: z.array(createBatchEntrySchema).max(20).optional(),
}).refine(
  (data) => data.entries || (data.profileId && data.nicheCategory && data.cities.length > 0),
  { message: 'Either entries[] or (profileId + nicheCategory + cities) must be provided' },
);

router.post('/seek-batches', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const validation = createBatchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const result = await BatchSeekService.createBatch(validation.data, {
      actorType: 'user',
      actorId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, batch: result });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/seek-batches] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/seek-batches/:id/launch — launch a seek batch (creates campaigns) */
router.post('/seek-batches/:id/launch', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await BatchSeekService.launchBatch(id, {
      actorType: 'user',
      actorId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        batch_not_found: 404,
        batch_already_launched: 409,
      };
      return res.status(statusMap[result.error || ''] || 400).json({ error: result.error });
    }

    res.json({ success: true, campaignIds: result.campaignIds });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/seek-batches/:id/launch] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
