/**
 * Admin Directory Presence Seeds Routes
 *
 *   GET    /api/admin/directory/presence-seeds           — list seeds
 *   GET    /api/admin/directory/presence-seeds/:id       — seed detail
 *   POST   /api/admin/directory/presence-seeds           — create seed
 *   POST   /api/admin/directory/presence-seeds/:id/publish — publish listing
 *   POST   /api/admin/directory/presence-seeds/:id/invite — mint claim token
 *   POST   /api/admin/directory/presence-seeds/:id/approve — publish + mint + email claim token
 *   PATCH  /api/admin/directory/presence-seeds/:id/fields — update sourced fields
 *   PATCH  /api/admin/directory/presence-seeds/:id/status — change seed status
 *   POST   /api/admin/directory/presence-seeds/:id/tokens/:tokenId/revoke — revoke claim token
 *   GET    /api/admin/directory/claim-requests           — list claim requests
 *   POST   /api/admin/directory/claim-requests/:id/approve — approve claim request
 *   POST   /api/admin/directory/claim-requests/:id/reject  — reject claim request
 *
 * All routes require PLATFORM_ADMIN or PLATFORM_SUPPORT auth.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import DirectoryClaimService from '../services/DirectoryClaimService';
import DirectorySuggestionService from '../services/DirectorySuggestionService';
import DirectorySeedCampaignLinkService from '../services/DirectorySeedCampaignLinkService';
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
  slug: z.string().optional(),
  businessHours: z.any().optional(),
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
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  slug: z.string().optional().nullable(),
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
      slug: input.slug || undefined,
      businessHours: input.businessHours,
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

/** POST /api/admin/directory/presence-seeds/:id/approve — publish, mint, and email claim token */
router.post('/presence-seeds/:id/approve', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await DirectoryPresenceSeedService.approveAndInvite(id, {
      actorType: 'user',
      actorId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);
    res.json({ success: true, token: result.token, expiresAt: result.expiresAt, claimUrl: result.claimUrl });
  } catch (error: any) {
    if (error?.message === 'seed_not_found') return res.status(404).json({ error: 'seed_not_found' });
    if (error?.message === 'seed_already_claimed') return res.status(409).json({ error: 'seed_already_claimed' });
    logger.error('[POST /api/admin/directory/presence-seeds/:id/approve] Error:', undefined, {
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
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        latitude: data.latitude,
        longitude: data.longitude,
        slug: data.slug || undefined,
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

// ====================
// Seed ↔ Campaign links (Migration 230)
// ====================

const linkCampaignSchema = z.object({
  campaignId: z.string().min(1).max(255),
  role: z.enum(['primary', 'sibling', 'recovery']).default('primary'),
});

const syncFieldsSchema = z.object({
  fields: z.array(z.enum([
    'phone',
    'website',
    'primaryCategory',
    'secondaryCategories',
    'description',
    'originCountry',
    'originRegion',
    'neighborhood',
    'directoryProfile',
  ])).min(0).max(20),
});

/** GET /api/admin/directory/presence-seeds/:id/campaign-links — list linked campaigns */
router.get('/presence-seeds/:id/campaign-links', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const links = await DirectorySeedCampaignLinkService.listLinks(id);
    res.json({ success: true, links });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/presence-seeds/:id/campaign-links] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/presence-seeds/:id/campaign-candidates — search unlinked campaigns */
router.get('/presence-seeds/:id/campaign-candidates', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const query = req.query.query as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const campaigns = await DirectorySeedCampaignLinkService.findCandidateCampaigns(id, query, limit);
    res.json({ success: true, campaigns });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/presence-seeds/:id/campaign-candidates] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId/diff — per-field diff */
router.get('/presence-seeds/:id/campaign-links/:campaignId/diff', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id, campaignId } = req.params;
    const diff = await DirectorySeedCampaignLinkService.buildDiff(id, campaignId);
    res.json({ success: true, diff });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId/diff] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/campaign-links — link a campaign */
router.post('/presence-seeds/:id/campaign-links', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = linkCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const result = await DirectorySeedCampaignLinkService.linkCampaign(
      id,
      validation.data.campaignId,
      validation.data.role,
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.status(201).json({
      success: true,
      link: result.link,
      autoProjected: result.autoProjected,
      napMatch: result.napMatch,
    });
  } catch (error: any) {
    const statusMap: Record<string, number> = {
      seed_not_found: 404,
      campaign_not_found: 404,
      primary_link_already_exists: 409,
    };
    const status = statusMap[error?.message] || 500;
    if (status === 500) {
      logger.error('[POST /api/admin/directory/presence-seeds/:id/campaign-links] Error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
    }
    res.status(status).json({ error: error?.message || 'internal_error' });
  }
});

/** DELETE /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId — unlink a campaign */
router.delete('/presence-seeds/:id/campaign-links/:campaignId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id, campaignId } = req.params;
    await DirectorySeedCampaignLinkService.unlinkCampaign(id, campaignId, {
      actorType: 'user',
      actorId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.json({ success: true });
  } catch (error: any) {
    const statusMap: Record<string, number> = {
      link_not_found: 404,
    };
    const status = statusMap[error?.message] || 500;
    if (status === 500) {
      logger.error('[DELETE /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId] Error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
    }
    res.status(status).json({ error: error?.message || 'internal_error' });
  }
});

/** POST /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId/sync — project fields */
router.post('/presence-seeds/:id/campaign-links/:campaignId/sync', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id, campaignId } = req.params;
    const validation = syncFieldsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const result = await DirectorySeedCampaignLinkService.syncFromCampaign(
      id,
      campaignId,
      validation.data.fields,
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    const statusMap: Record<string, number> = {
      seed_or_campaign_not_found: 404,
    };
    const status = statusMap[error?.message] || 500;
    if (status === 500) {
      logger.error('[POST /api/admin/directory/presence-seeds/:id/campaign-links/:campaignId/sync] Error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
    }
    res.status(status).json({ error: error?.message || 'internal_error' });
  }
});

// ====================
// Claim Requests (operator approval flow — Migration 246)
// ====================

/** GET /api/admin/directory/claim-requests — list claim requests (default: pending) */
router.get('/claim-requests', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const requests = await DirectoryClaimService.listClaimRequests({ status });
    res.json({ success: true, requests });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/claim-requests] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/claim-requests/:id/approve — approve a pending claim request */
router.post('/claim-requests/:id/approve', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminUserId = (req as any).user?.userId || (req as any).user?.id;
    const result = await DirectoryClaimService.approveClaimRequest(id, adminUserId, {
      actorType: 'user',
      actorId: adminUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        request_not_found: 404,
        request_already_reviewed: 409,
        already_claimed: 409,
        token_expired: 410,
      };
      return res.status(statusMap[result.message] || 400).json({ error: result.message });
    }

    res.json({
      success: true,
      tenantId: result.tenantId,
      seedId: result.seedId,
      message: 'approved',
      platformUserId: result.platformUserId,
    });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/claim-requests/:id/approve] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/claim-requests/:id/reject — reject a pending claim request */
const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

router.post('/claim-requests/:id/reject', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = rejectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const adminUserId = (req as any).user?.userId || (req as any).user?.id;
    const result = await DirectoryClaimService.rejectClaimRequest(id, adminUserId, validation.data.reason || '', {
      actorType: 'user',
      actorId: adminUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        request_not_found: 404,
        request_already_reviewed: 409,
      };
      return res.status(statusMap[result.message] || 400).json({ error: result.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/claim-requests/:id/reject] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/claim-requests/:id/link-customer — retroactively link a customer to an approved claim */
const linkCustomerSchema = z.object({
  customerId: z.string().min(1).max(255),
});

router.post('/claim-requests/:id/link-customer', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = linkCustomerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const adminUserId = (req as any).user?.userId || (req as any).user?.id;
    const result = await DirectoryClaimService.linkCustomerToClaimRequest(id, validation.data.customerId, adminUserId, {
      actorType: 'user',
      actorId: adminUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        request_not_found: 404,
        request_not_approved: 400,
        request_already_linked: 409,
        customer_not_found: 404,
      };
      return res.status(statusMap[result.message] || 400).json({ error: result.message });
    }

    res.json({
      success: true,
      tenantId: result.tenantId,
      seedId: result.seedId,
      message: 'linked',
      platformUserId: result.platformUserId,
    });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/claim-requests/:id/link-customer] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/claim-requests/:id/attachments — list proof attachments */
router.get('/claim-requests/:id/attachments', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const attachments = await DirectoryClaimService.listProofAttachments(id);
    res.json({
      success: true,
      data: attachments.map((a) => ({
        id: a.id,
        fileName: a.file_name,
        fileType: a.file_type,
        fileSize: a.file_size,
        uploadedAt: a.uploaded_at,
      })),
    });
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/claim-requests/:id/attachments] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory/claim-requests/attachments/:attachmentId — download proof attachment */
router.get('/claim-requests/attachments/:attachmentId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const result = await DirectoryClaimService.downloadProofAttachment(attachmentId);
    if (!result) {
      return res.status(404).json({ error: 'attachment_not_found' });
    }

    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpeg: 'image/jpeg',
    };
    const contentType = contentTypeMap[result.fileType] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    return res.send(result.buffer);
  } catch (error: any) {
    logger.error('[GET /api/admin/directory/claim-requests/attachments/:attachmentId] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory/claim-requests/:id/verify — save operator verification worksheet */
const verifySchema = z.object({
  method: z.enum(['phone', 'email', 'website', 'in_person', 'document', 'other']),
  notes: z.string().max(2000).optional(),
});

router.post('/claim-requests/:id/verify', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = verifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const adminUserId = (req as any).user?.userId || (req as any).user?.id;
    const result = await DirectoryClaimService.saveVerification(
      id,
      adminUserId,
      validation.data.method,
      validation.data.notes || '',
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        request_not_found: 404,
      };
      return res.status(statusMap[result.message] || 400).json({ error: result.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[POST /api/admin/directory/claim-requests/:id/verify] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/directory-presence/presence-seeds/from-campaign/:campaignId — create a seed from a campaign audit */
const fromCampaignSchema = z.object({
  publish: z.boolean().optional().default(true),
});

router.post('/presence-seeds/from-campaign/:campaignId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const validation = fromCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.createFromCampaign(
      campaignId,
      { publish: validation.data.publish },
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (error: any) {
    const statusMap: Record<string, number> = {
      campaign_not_found: 404,
      business_analysis_audit_not_found: 400,
      identity_mismatch: 409,
      incomplete_nap: 400,
    };
    const status = statusMap[error?.message] || 500;
    if (status === 500) {
      logger.error('[POST /api/admin/directory-presence/presence-seeds/from-campaign/:campaignId] Error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
    }
    res.status(status).json({ error: error?.message || 'internal_error' });
  }
});

/* ====================
   Suggestions queue (public submissions)
   ==================== */

/** GET /api/admin/directory-presence/suggestions — list public suggestions */
router.get('/suggestions', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { status, city, state, primaryCategory, limit, offset } = req.query;
    const result = await DirectorySuggestionService.listSuggestions({
      status: (status as string) || undefined,
      city: (city as string) || undefined,
      state: (state as string) || undefined,
      primaryCategory: (primaryCategory as string) || undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[GET /api/admin/directory-presence/suggestions] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/directory-presence/suggestions/:id — suggestion detail */
router.get('/suggestions/:id', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const suggestion = await DirectorySuggestionService.getSuggestion(id);
    if (!suggestion) {
      return res.status(404).json({ error: 'suggestion_not_found' });
    }
    res.json({ success: true, suggestion });
  } catch (error) {
    logger.error('[GET /api/admin/directory-presence/suggestions/:id] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

const updateSuggestionStatusSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'duplicate']),
  seedId: z.string().optional(),
});

/** POST /api/admin/directory-presence/suggestions/:id/status — review action */
router.post('/suggestions/:id/status', requirePlatformStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = updateSuggestionStatusSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({
        error: 'invalid_input',
        issues: parse.error.flatten().fieldErrors,
      });
    }

    const actorId = (req as any).user?.id || 'system';

    if (parse.data.status === 'approved') {
      const result = await DirectorySuggestionService.approve(id, actorId);
      if (!result) {
        return res.status(404).json({ error: 'suggestion_not_found' });
      }
      return res.json({
        success: true,
        suggestion: result.suggestion,
        seed: result.seed,
        token: result.token,
        expiresAt: result.expiresAt,
        claimUrl: result.claimUrl,
      });
    }

    const suggestion = await DirectorySuggestionService.updateStatus(
      id,
      parse.data.status,
      actorId,
      parse.data.seedId,
    );
    if (!suggestion) {
      return res.status(404).json({ error: 'suggestion_not_found' });
    }
    res.json({ success: true, suggestion });
  } catch (error) {
    logger.error('[POST /api/admin/directory-presence/suggestions/:id/status] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
