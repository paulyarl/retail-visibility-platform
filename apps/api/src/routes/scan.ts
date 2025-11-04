import { Router, Request, Response } from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { prisma } from '../prisma';
import { Flags } from '../config';
import { audit } from '../audit';
import { z } from 'zod';

const router = Router();

// Validation schemas
const startSessionSchema = z.object({
  tenantId: z.string(),
  templateId: z.string().optional(),
  deviceType: z.enum(['camera', 'usb', 'manual']).optional(),
  metadata: z.record(z.any()).optional(),
});

const lookupBarcodeSchema = z.object({
  barcode: z.string().min(1),
  sku: z.string().optional(),
});

const commitSessionSchema = z.object({
  skipValidation: z.boolean().optional().default(false),
});

// POST /api/scan/start - Start new scan session
router.post('/api/scan/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!Flags.SKU_SCANNING) {
      return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SKU_SCANNING' });
    }

    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.errors });
    }

    const { tenantId, templateId, deviceType, metadata } = parsed.data;
    const userId = (req.user as any)?.userId;

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Check device type permissions
    if (deviceType === 'camera' && !Flags.SCAN_CAMERA) {
      return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SCAN_CAMERA' });
    }
    if (deviceType === 'usb' && !Flags.SCAN_USB) {
      return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SCAN_USB' });
    }

    // Check rate limit: max 10 active sessions per tenant
    const activeSessions = await prisma.scanSession.count({
      where: { tenantId, status: 'active' },
    });
    if (activeSessions >= 10) {
      return res.status(429).json({ success: false, error: 'rate_limit_exceeded', limit: 10 });
    }

    // Create session
    const session = await prisma.scanSession.create({
      data: {
        tenantId,
        userId,
        templateId,
        deviceType: deviceType || 'manual',
        status: 'active',
        metadata: metadata || {},
      },
      include: {
        template: true,
      },
    });

    // Audit
    try {
      await audit({
        tenantId,
        actor: userId,
        action: 'scan.session.start',
        payload: { sessionId: session.id, deviceType, templateId },
      });
    } catch {}

    return res.status(201).json({ success: true, session });
  } catch (error: any) {
    console.error('[scan/start] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// GET /api/scan/:sessionId - Get session details
router.get('/api/scan/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
      include: {
        template: true,
        results: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, session.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    return res.json({ success: true, session });
  } catch (error: any) {
    console.error('[scan/:sessionId] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// POST /api/scan/:sessionId/lookup-barcode - Lookup and add barcode to session
router.post('/api/scan/:sessionId/lookup-barcode', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const parsed = lookupBarcodeSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.errors });
    }

    const { barcode, sku } = parsed.data;

    // Get session
    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
      include: { template: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, session.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Check if barcode already scanned in this session
    const existing = await prisma.scanResult.findFirst({
      where: { sessionId, barcode },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: 'duplicate_barcode', result: existing });
    }

    // Check for duplicates in inventory
    const duplicateItem = await prisma.inventoryItem.findFirst({
      where: {
        tenantId: session.tenantId,
        OR: [
          { barcode },
          { sku: sku || barcode },
        ],
      },
      select: { id: true, name: true, barcode: true, sku: true },
    });

    // Perform barcode lookup/enrichment (stubbed for now)
    const enrichment = await performBarcodeEnrichment(barcode, session.tenantId);

    // Create scan result
    const result = await prisma.scanResult.create({
      data: {
        tenantId: session.tenantId,
        sessionId,
        barcode,
        sku: sku || barcode,
        status: duplicateItem ? 'duplicate' : 'new',
        enrichment: enrichment || {},
        duplicateOf: duplicateItem?.id,
        rawPayload: { barcode, sku, timestamp: new Date().toISOString() },
      },
    });

    // Update session counts
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        scannedCount: { increment: 1 },
        duplicateCount: duplicateItem ? { increment: 1 } : undefined,
      },
    });

    return res.status(201).json({
      success: true,
      result,
      duplicate: duplicateItem ? { item: duplicateItem, warning: 'Item already exists in inventory' } : null,
    });
  } catch (error: any) {
    console.error('[scan/:sessionId/lookup-barcode] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// GET /api/scan/:sessionId/results - Get all scan results for session
router.get('/api/scan/:sessionId/results', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
      select: { tenantId: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, session.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const results = await prisma.scanResult.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, results, count: results.length });
  } catch (error: any) {
    console.error('[scan/:sessionId/results] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// DELETE /api/scan/:sessionId/results/:resultId - Remove a scan result
router.delete('/api/scan/:sessionId/results/:resultId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, resultId } = req.params;

    const result = await prisma.scanResult.findUnique({
      where: { id: resultId },
      include: { session: true },
    });

    if (!result || result.sessionId !== sessionId) {
      return res.status(404).json({ success: false, error: 'result_not_found' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, result.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    if (result.session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Delete result
    await prisma.scanResult.delete({ where: { id: resultId } });

    // Update session counts
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        scannedCount: { decrement: 1 },
        duplicateCount: result.status === 'duplicate' ? { decrement: 1 } : undefined,
      },
    });

    return res.json({ success: true, deleted: resultId });
  } catch (error: any) {
    console.error('[scan/:sessionId/results/:resultId] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// POST /api/scan/:sessionId/commit - Commit scanned items to inventory
router.post('/api/scan/:sessionId/commit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const parsed = commitSessionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.errors });
    }

    const { skipValidation } = parsed.data;
    const userId = (req.user as any)?.userId;

    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
      include: {
        results: {
          where: { status: { not: 'duplicate' } },
        },
        template: true,
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, session.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    if (session.results.length === 0) {
      return res.status(400).json({ success: false, error: 'no_items_to_commit' });
    }

    // Validate items (unless skipped)
    if (!skipValidation) {
      const validation = await validateScanResults(session.results, session.template);
      if (!validation.valid) {
        return res.status(422).json({ success: false, error: 'validation_failed', validation });
      }
    }

    // Commit items to inventory
    const committed = [];
    for (const result of session.results) {
      try {
        const enrichment = result.enrichment as any || {};
        const item = await prisma.inventoryItem.create({
          data: {
            tenantId: session.tenantId,
            name: enrichment.name || `Product ${result.barcode}`,
            description: enrichment.description || null,
            barcode: result.barcode,
            sku: result.sku || result.barcode,
            priceCents: enrichment.priceCents || session.template?.defaultPriceCents || 0,
            currency: session.template?.defaultCurrency || 'USD',
            visibility: session.template?.defaultVisibility || 'private',
            categoryPath: enrichment.categoryPath || (session.template?.defaultCategory ? [session.template.defaultCategory] : []),
            metadata: { ...enrichment.metadata, scannedFrom: sessionId },
          },
        });
        committed.push(item.id);
      } catch (error) {
        console.error(`[commit] Failed to create item for barcode ${result.barcode}:`, error);
      }
    }

    // Update session
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        committedCount: committed.length,
        completedAt: new Date(),
      },
    });

    // Audit
    try {
      await audit({
        tenantId: session.tenantId,
        actor: userId,
        action: 'scan.session.commit',
        payload: { sessionId, committedCount: committed.length, itemIds: committed },
      });
    } catch {}

    return res.json({ success: true, committed: committed.length, itemIds: committed });
  } catch (error: any) {
    console.error('[scan/:sessionId/commit] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// DELETE /api/scan/:sessionId - Cancel session
router.delete('/api/scan/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = (req.user as any)?.userId;

    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    // Check tenant access
    const hasAccess = await checkTenantAccess(req, session.tenantId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Update status to cancelled
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    // Audit
    try {
      await audit({
        tenantId: session.tenantId,
        actor: userId,
        action: 'scan.session.cancel',
        payload: { sessionId },
      });
    } catch {}

    return res.json({ success: true, cancelled: sessionId });
  } catch (error: any) {
    console.error('[scan/:sessionId DELETE] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Helper: Perform barcode enrichment (stubbed)
async function performBarcodeEnrichment(barcode: string, tenantId: string): Promise<any> {
  // Log the lookup
  const startTime = Date.now();
  
  try {
    // TODO: Call external barcode API (UPC Database, Open Food Facts, etc.)
    // For now, return stubbed data
    const enrichment = {
      name: `Product ${barcode}`,
      description: 'Enrichment data will be added in future implementation',
      categoryPath: [],
      metadata: {
        source: 'stub',
        barcode,
      },
    };

    // Log successful lookup
    await prisma.barcodeLookupLog.create({
      data: {
        tenantId,
        barcode,
        provider: 'stub',
        status: 'success',
        response: enrichment,
        latencyMs: Date.now() - startTime,
      },
    });

    return enrichment;
  } catch (error: any) {
    // Log failed lookup
    await prisma.barcodeLookupLog.create({
      data: {
        tenantId,
        barcode,
        provider: 'stub',
        status: 'error',
        error: error.message,
        latencyMs: Date.now() - startTime,
      },
    });

    return null;
  }
}

// Helper: Validate scan results
async function validateScanResults(results: any[], template: any): Promise<{ valid: boolean; errors: any[] }> {
  const errors = [];

  for (const result of results) {
    const enrichment = result.enrichment as any || {};
    
    // Check required fields
    if (!enrichment.name && !template?.defaultCategory) {
      errors.push({
        resultId: result.id,
        barcode: result.barcode,
        field: 'name',
        message: 'Product name is required',
      });
    }

    // Check category
    if (!enrichment.categoryPath?.length && !template?.defaultCategory) {
      errors.push({
        resultId: result.id,
        barcode: result.barcode,
        field: 'category',
        message: 'Category is required',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default router;
