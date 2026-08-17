/**
 * Directory Enrichment Public Routes (Sprint 3)
 *
 * Public, token-gated endpoints for the directory seed enrichment form.
 * No auth required — the enrichment token IS the trust boundary, mirroring
 * the recovery intake portal pattern.
 *
 * Routes:
 *   GET  /api/public/directory/enrich/:token          — resolve token → seed context + intake definition
 *   POST /api/public/directory/enrich/:token/submit   — validate + write-behind + update seed
 *   POST /api/public/directory/enrich/:token/attachments — multipart photo upload (stub for now)
 *   GET  /api/public/directory/enrich/:token/options  — dynamic option sources (stub for now)
 *   POST /api/public/directory/lead-gen               — "Get listed" CTA → prospect queue
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import intakeDefinitionService from '../services/intake/IntakeDefinitionService';
import { executeFieldMappings } from '../services/intake/writeBehindAdapters';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ENRICHMENT_INTAKE_KIND = 'directory_presence_enrichment';

/**
 * GET /api/public/directory/enrich/:token
 * Resolve enrichment token → seed context + intake definition.
 */
router.get('/enrich/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const context = await DirectoryPresenceSeedService.resolveEnrichmentToken(token);
    if (!context) {
      return res.status(404).json({ error: 'token_not_found' });
    }

    if (context.isExpired) {
      return res.json({ success: true, expired: true });
    }

    // Load the intake definition
    const definition = await intakeDefinitionService.getByKind(ENRICHMENT_INTAKE_KIND);

    res.json({
      success: true,
      context: {
        seedId: context.seedId,
        tenantId: context.tenantId,
        slug: context.slug,
        businessName: context.businessName,
        category: context.category,
        city: context.city,
        state: context.state,
      },
      definition,
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/enrich/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /api/public/directory/enrich/:token/submit
 * Submit the enrichment form. Validates against the intake definition's
 * dynamic Zod schema, runs write-behind adapters, and updates the seed.
 */
router.post('/enrich/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const tokenContext = await DirectoryPresenceSeedService.resolveEnrichmentToken(token);
    if (!tokenContext) {
      return res.status(404).json({ error: 'token_not_found' });
    }
    if (tokenContext.isExpired) {
      return res.status(410).json({ error: 'token_expired' });
    }

    const definition = await intakeDefinitionService.getByKind(ENRICHMENT_INTAKE_KIND);
    if (!definition) {
      return res.status(500).json({ error: 'intake_definition_not_found' });
    }

    // Build Zod schema and validate
    const schema = intakeDefinitionService.buildSubmitSchema(definition);
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_failed',
        details: parseResult.error.issues,
      });
    }

    const validated = parseResult.data as any;
    const evidencePayload = validated.evidencePayload || {};

    // Run write-behind adapters
    await executeFieldMappings(
      definition.field_mappings,
      evidencePayload,
      {
        intakeId: ENRICHMENT_INTAKE_KIND,
        campaignId: '',
        tenantId: tokenContext.tenantId,
      },
    );

    // Update seed: outreach_status = 'enriched', owner info if provided
    const ownerName = evidencePayload.owner_name || null;
    const ownerEmail = validated.ownerEmail || null;
    const ownerPhone = validated.ownerPhone || null;

    await DirectoryPresenceSeedService.updateOutreachStatus(
      tokenContext.seedId,
      {
        status: 'enriched',
        ownerName,
        ownerEmail,
        ownerPhone,
      },
    );

    // Mark token consumed (multi-use tokens just record the submission time)
    await prisma.$executeRaw`
      UPDATE directory_enrichment_tokens
      SET consumed_at = now()
      WHERE token = ${token} AND consumed_at IS NULL
    `;

    audit({
      actorType: 'customer',
      action: 'directory_enrichment.submit',
      payload: {
        seedId: tokenContext.seedId,
        tenantId: tokenContext.tenantId,
        fields: Object.keys(evidencePayload),
      },
    });

    logger.info('Directory enrichment submitted', undefined, {
      seedId: tokenContext.seedId,
      tenantId: tokenContext.tenantId,
    });

    res.json({
      success: true,
      seedId: tokenContext.seedId,
      tenantId: tokenContext.tenantId,
      businessName: tokenContext.businessName,
      slug: tokenContext.slug,
    });
  } catch (error) {
    logger.error('[POST /api/public/directory/enrich/:token/submit] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /api/public/directory/enrich/:token/attachments
 * Multipart photo upload. Stub — stores in memory for now; full Supabase
 * upload can be added when photo_assets integration is wired.
 */
router.post('/enrich/:token/attachments', upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const tokenContext = await DirectoryPresenceSeedService.resolveEnrichmentToken(token);
    if (!tokenContext) {
      return res.status(404).json({ error: 'token_not_found' });
    }
    if (tokenContext.isExpired) {
      return res.status(410).json({ error: 'token_expired' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'no_files' });
    }

    // Stub: return file metadata. Full upload to Supabase/photo_assets
    // will be wired when the photo storage integration is connected.
    const attachments = files.map((f) => ({
      filename: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
    }));

    res.json({ success: true, attachments });
  } catch (error) {
    logger.error('[POST /api/public/directory/enrich/:token/attachments] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/public/directory/enrich/:token/options
 * Dynamic option sources for the enrichment form. Stub for now.
 */
router.get('/enrich/:token/options', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const tokenContext = await DirectoryPresenceSeedService.resolveEnrichmentToken(token);
    if (!tokenContext) {
      return res.status(404).json({ error: 'token_not_found' });
    }

    // No dynamic option sources needed for the initial enrichment form
    res.json({ success: true, options: [] });
  } catch (error) {
    logger.error('[GET /api/public/directory/enrich/:token/options] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /api/public/directory/lead-gen
 * "Get listed" CTA from the public directory. Creates a prospect queue entry.
 */
router.post('/lead-gen', async (req: Request, res: Response) => {
  try {
    const { businessName, category, city, state, phone, email, note } = req.body || {};
    if (!businessName || typeof businessName !== 'string') {
      return res.status(400).json({ error: 'business_name_required' });
    }

    // Dynamically import to avoid circular deps
    const { default: MarketingProspectQueueService } = await import('../services/MarketingProspectQueueService');

    const result = await MarketingProspectQueueService.addToQueue({
      title: businessName,
      business_name: businessName,
      category: category || undefined,
      city: city || undefined,
      state: state || undefined,
      source_kind: 'directory_lead_gen' as any,
      scope: 'business',
      business_snapshot: {
        phone,
        email,
        note,
        source: 'directory_lead_gen',
      },
      priority: 'normal',
    });

    audit({
      actorType: 'customer',
      action: 'directory_lead_gen.submit',
      payload: { businessName, category, city, created: 'created' in result ? result.created : false },
    });

    res.json({ success: true, message: 'prospect_queued' });
  } catch (error) {
    logger.error('[POST /api/public/directory/lead-gen] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
