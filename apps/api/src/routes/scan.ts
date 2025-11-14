import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireTierFeature } from '../middleware/tier-access';
import { prisma } from '../prisma';
// import { Flags } from '../config';
import { audit } from '../audit';
import { z } from 'zod';
import { UserRole, Prisma } from '@prisma/client';
// import { barcodeEnrichmentService } from '../services/BarcodeEnrichmentService';
// import { imageEnrichmentService } from '../services/ImageEnrichmentService';
import { isPlatformAdmin, canViewAllTenants } from '../utils/platform-admin';
import {
  scanSessionStarted,
  scanSessionCompleted,
  scanSessionCancelled,
  scanBarcodeSuccess,
  scanBarcodeFail,
  scanBarcodeDuplicate,
  scanCommitSuccess,
  scanCommitFail,
  scanCommitDurationMs,
  scanValidationError,
} from '../metrics';

// Helper to check tenant access
function hasAccessToTenant(req: Request, tenantId: string): boolean {
  if (!req.user) return false;
  if (isPlatformAdmin(req.user as any)) return true;
  return (req.user as any).tenantIds?.includes(tenantId) || false;
}

const router = Router();

// Validation schemas
const startSessionSchema = z.object({
  tenantId: z.string(),
  templateId: z.string().optional(),
  deviceType: z.enum(['camera', 'usb', 'manual']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const lookupBarcodeSchema = z.object({
  barcode: z.string().min(1),
  sku: z.string().optional(),
});

const precheckSchema = z.object({
  enforceCategories: z.boolean().optional(),
  checkDuplicates: z.boolean().optional(),
});

const commitSessionSchema = z.object({
  skipValidation: z.boolean().optional().default(false),
});

// POST /scan/start - Start new scan session
router.post('/scan/start', authenticateToken, requireTierFeature('barcode_scan'), async (req: Request, res: Response) => {
  try {
    // if (!Flags.SKU_SCANNING) {
    //   return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SKU_SCANNING' });
    // }

    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.issues });
    }

    const { tenantId, templateId, deviceType, metadata } = parsed.data;
    const userId = (req.user as any)?.userId;

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Check device type permissions
    // if (deviceType === 'camera' && !Flags.SCAN_CAMERA) {
    //   return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SCAN_CAMERA' });
    // }
    // if (deviceType === 'usb' && !Flags.SCAN_USB) {
    //   return res.status(409).json({ success: false, error: 'feature_disabled', flag: 'FF_SCAN_USB' });
    // }

    // Check rate limit: max 50 active sessions per tenant
    const activeSessions = await prisma.scanSession.count({
      where: { tenantId, status: 'active' },
    });
    if (activeSessions >= 50) {
      return res.status(429).json({ success: false, error: 'rate_limit_exceeded', limit: 50 });
    }

    // Create session
    const session = await prisma.scanSession.create({
      data: {
        tenantId,
        userId,
        templateId,
        deviceType: deviceType || 'manual',
        status: 'active',
        metadata: metadata as any || {},
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

    // Emit metric
    scanSessionStarted.inc({ tenant: tenantId, deviceType: deviceType || 'manual' });

    return res.status(201).json({ success: true, session });
  } catch (error: any) {
    console.error('[scan/start] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// GET /scan/:sessionId - Get session details
router.get('/scan/:sessionId', authenticateToken, async (req: Request, res: Response) => {
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
    if (!hasAccessToTenant(req, session.tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    return res.json({ success: true, session });
  } catch (error: any) {
    console.error('[scan/:sessionId] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// POST /scan/:sessionId/lookup-barcode - Lookup and add barcode to session
router.post('/scan/:sessionId/lookup-barcode', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const parsed = lookupBarcodeSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.issues });
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
    if (!hasAccessToTenant(req, session.tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Check if barcode already scanned in this session
    const existing = await prisma.scanResult.findFirst({
      where: { sessionId, barcode },
    });

    if (existing) {
      scanBarcodeDuplicate.inc({ tenant: session.tenantId });
      return res.status(409).json({ success: false, error: 'duplicate_barcode', result: existing });
    }

    // Check for duplicates in inventory
    const duplicateItem = await prisma.inventoryItem.findFirst({
      where: {
        tenantId: session.tenantId,
        sku: sku || barcode,
      },
      select: { id: true, name: true, sku: true },
    });

    // Perform barcode lookup/enrichment using the service
    // const enrichment = Flags.SCAN_ENRICHMENT 
    //   ? await barcodeEnrichmentService.enrich(barcode, session.tenantId)
    //   : null;

    // Create scan result
    const result = await prisma.scanResult.create({
      data: {
        tenantId: session.tenantId,
        sessionId,
        barcode,
        sku: sku || barcode,
        status: duplicateItem ? 'duplicate' : 'new',
        enrichment: {} as any, // enrichment as any || {},
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

    // Emit metrics
    scanBarcodeSuccess.inc({ tenant: session.tenantId, hasDuplicate: String(!!duplicateItem) });
    if (duplicateItem) {
      scanBarcodeDuplicate.inc({ tenant: session.tenantId });
    }

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

// GET /scan/:sessionId/results - Get all scan results for session
router.get('/scan/:sessionId/results', authenticateToken, async (req: Request, res: Response) => {
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
    if (!hasAccessToTenant(req, session.tenantId)) {
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

// DELETE /scan/:sessionId/results/:resultId - Remove a scan result
router.delete('/scan/:sessionId/results/:resultId', authenticateToken, async (req: Request, res: Response) => {
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
    if (!hasAccessToTenant(req, result.tenantId)) {
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

// POST /scan/:sessionId/commit - Commit scanned items to inventory
router.post('/scan/:sessionId/commit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const { sessionId } = req.params;
    const parsed = commitSessionSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_input', details: parsed.error.issues });
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
    if (!hasAccessToTenant(req, session.tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    if (session.results.length === 0) {
      return res.status(400).json({ success: false, error: 'no_items_to_commit' });
    }

    // Validate items (unless skipped)
    if (!skipValidation) {
      const validation = await validateScanResults(session.results, session.template);
      if (!validation.valid) {
        // Emit validation error metrics
        validation.errors.forEach(() => {
          scanValidationError.inc({ tenant: session.tenantId });
        });
        return res.status(422).json({ success: false, error: 'validation_failed', validation });
      }
    }

    // Commit items to inventory
    const committed = [];
    for (const result of session.results) {
      try {
        const enrichment = result.enrichment as any || {};
        console.log(`[commit] Processing ${result.barcode}:`, {
          hasCategoryPath: !!enrichment.categoryPath,
          categoryPathLength: enrichment.categoryPath?.length,
          categoryPath: enrichment.categoryPath,
          templateDefault: session.template?.defaultCategory
        });
        const stock = enrichment.stock || 0;
        const item = await prisma.inventoryItem.create({
          data: {
            tenantId: session.tenantId,
            name: enrichment.name || `Product ${result.barcode}`,
            title: enrichment.name || `Product ${result.barcode}`,
            brand: enrichment.brand || 'Unknown',
            description: enrichment.description || null,
            sku: result.sku || result.barcode,
            price: (enrichment.priceCents || session.template?.defaultPriceCents || 0) / 100,
            priceCents: enrichment.priceCents || session.template?.defaultPriceCents || 0,
            stock: stock,
            currency: session.template?.defaultCurrency || 'USD',
            visibility: (session.template?.defaultVisibility as any) || 'private',
            availability: stock > 0 ? 'in_stock' : 'out_of_stock',
            categoryPath: (enrichment.categoryPath && enrichment.categoryPath.length > 0) 
              ? enrichment.categoryPath 
              : (session.template?.defaultCategory ? [session.template.defaultCategory] : []),
            metadata: { ...enrichment.metadata, scannedFrom: sessionId },
          },
        });
        console.log(`[commit] Created item ${item.id} with categoryPath:`, item.categoryPath);
        committed.push(item.id);

        // Process product images if available
        // if (Flags.SCAN_ENRICHMENT && enrichment) {
        //   try {
        //     const imageUrls = imageEnrichmentService.extractImageUrls(enrichment);
        //     if (imageUrls.length > 0) {
        //       const imageCount = await imageEnrichmentService.processProductImages(
        //         session.tenantId,
        //         item.id,
        //         item.sku,
        //         imageUrls,
        //         item.name
        //       );
        //       console.log(`[commit] Processed ${imageCount}/${imageUrls.length} images for ${item.sku}`);
        //     }
        //   } catch (imageError) {
        //     // Don't fail commit if image processing fails
        //     console.error(`[commit] Failed to process images for ${item.sku}:`, imageError);
        //   }
        // }
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

    // Emit metrics
    const duration = Date.now() - startTime;
    scanCommitSuccess.inc({ tenant: session.tenantId, itemCount: String(committed.length) });
    scanCommitDurationMs.observe(duration, { tenant: session.tenantId });
    scanSessionCompleted.inc({ tenant: session.tenantId });

    return res.json({ success: true, committed: committed.length, itemIds: committed });
  } catch (error: any) {
    console.error('[scan/:sessionId/commit] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// DELETE /scan/:sessionId - Cancel session
router.delete('/scan/:sessionId', authenticateToken, async (req: Request, res: Response) => {
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
    if (!hasAccessToTenant(req, session.tenantId)) {
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

    // Emit metric
    scanSessionCancelled.inc({ tenant: session.tenantId });

    return res.json({ success: true, cancelled: sessionId });
  } catch (error: any) {
    console.error('[scan/:sessionId DELETE] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// GET /scan/my-sessions - Get user's scan sessions for a tenant
router.get('/scan/my-sessions', authenticateToken, async (req: Request, res: Response) => {
  console.log('[GET /scan/my-sessions] Called with query:', (req as any).query);
  try {
    const { tenantId } = (req as any).query;
    const userId = ((req as any).user)?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'tenant_id_required' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Get user's sessions for this tenant, ordered by most recent first
    const sessions = await prisma.scanSession.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 20, // Limit to 20 most recent
    });

    return res.json({ success: true, sessions });
  } catch (error: any) {
    console.error('[scan/my-sessions GET] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// POST /scan/cleanup-my-sessions - User cleanup their own active sessions
router.post('/scan/cleanup-my-sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'tenant_id_required' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Close all active sessions for this user in this tenant
    const result = await prisma.scanSession.updateMany({
      where: {
        tenantId,
        userId,
        status: 'active',
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    // Audit
    try {
      await audit({
        tenantId,
        actor: userId,
        action: 'scan.sessions.cleanup_my',
        payload: { tenantId, cleaned: result.count },
      });
    } catch {}

    return res.json({ 
      success: true, 
      cleaned: result.count,
      message: `Cleaned up ${result.count} active sessions` 
    });
  } catch (error: any) {
    console.error('[scan/cleanup-my-sessions POST] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// POST /scan/cleanup-idle-sessions - Cleanup idle sessions (can be called by cron)
router.post('/scan/cleanup-idle-sessions', async (req: Request, res: Response) => {
  try {
    // Close sessions that have been active for more than 1 hour AND have no recent activity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // First, find sessions that have recent results (active in last hour)
    const activeSessionIds = await prisma.scanResult.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });

    const activeIds = activeSessionIds.map(r => r.sessionId);

    // Cancel sessions that are active, started more than 1 hour ago, AND have no recent results
    const result = await prisma.scanSession.updateMany({
      where: {
        status: 'active',
        startedAt: { lt: oneHourAgo },
        id: { notIn: activeIds }, // Exclude sessions with recent activity
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    console.log(`[Idle Cleanup] Closed ${result.count} idle sessions (excluded ${activeIds.length} with recent activity)`);

    return res.json({
      success: true,
      cleaned: result.count,
      excluded: activeIds.length,
      message: `Cleaned up ${result.count} idle sessions`
    });
  } catch (error: any) {
    console.error('[scan/cleanup-idle-sessions POST] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Admin endpoints for enrichment stats
// router.get('/admin/enrichment/cache-stats', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!canViewAllTenants(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_access_required' });
//     }

//     const stats = barcodeEnrichmentService.getCacheStats();
//     return res.json({ success: true, stats });
//   } catch (error: any) {
//     console.error('[enrichment/cache-stats] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// router.get('/admin/enrichment/rate-limits', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!canViewAllTenants(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_access_required' });
//     }

//     const stats = barcodeEnrichmentService.getRateLimitStats();
//     return res.json({ success: true, stats });
//   } catch (error: any) {
//     console.error('[enrichment/rate-limits] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// router.post('/admin/enrichment/clear-cache', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!isPlatformAdmin(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_admin_required' });
//     }

//     const { barcode } = req.body;
//     barcodeEnrichmentService.clearCache(barcode);
    
//     return res.json({ 
//       success: true, 
//       message: barcode ? `Cache cleared for ${barcode}` : 'All cache cleared' 
//     });
//   } catch (error: any) {
//     console.error('[enrichment/clear-cache] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// Comprehensive enrichment analytics
// router.get('/admin/enrichment/analytics', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!canViewAllTenants(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_access_required' });
//     }

//     // Get total cached products
//     const totalCached = await prisma.barcodeEnrichment.count();
    
//     // Get most popular products (top 10 by fetch count)
//     const popularProducts = await prisma.barcodeEnrichment.findMany({
//       orderBy: { fetchCount: 'desc' },
//       take: 10,
//       select: {
//         barcode: true,
//         name: true,
//         brand: true,
//         fetchCount: true,
//         source: true,
//         lastFetchedAt: true,
//       },
//     });

//     // Get data quality metrics
//     const withNutrition = await prisma.barcodeEnrichment.count({
//       where: {
//         metadata: {
//           path: ['nutrition', 'per_100g'],
//           not: Prisma.JsonNull,
//         },
//       },
//     });

//     const withImages = await prisma.barcodeEnrichment.count({
//       where: {
//         OR: [
//           { imageUrl: { not: null } },
//           { imageThumbnailUrl: { not: null } },
//         ],
//       },
//     });

//     const withEnvironmental = await prisma.barcodeEnrichment.count({
//       where: {
//         metadata: {
//           path: ['environmental'],
//           not: Prisma.JsonNull,
//         },
//       },
//     });

//     // Get source breakdown
//     const sourceBreakdown = await prisma.barcodeEnrichment.groupBy({
//       by: ['source'],
//       _count: true,
//     });

//     // Get recent additions (last 24 hours)
//     const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//     const recentAdditions = await prisma.barcodeEnrichment.count({
//       where: {
//         createdAt: { gte: oneDayAgo },
//       },
//     });

//     // Calculate total API calls saved (sum of fetchCount - 1 for each product)
//     const totalFetchCount = await prisma.barcodeEnrichment.aggregate({
//       _sum: { fetchCount: true },
//     });
//     const apiCallsSaved = (totalFetchCount._sum.fetchCount || 0) - totalCached;

//     return res.json({
//       success: true,
//       analytics: {
//         totalCached,
//         popularProducts,
//         dataQuality: {
//           withNutrition,
//           withImages,
//           withEnvironmental,
//           nutritionPercentage: totalCached > 0 ? ((withNutrition / totalCached) * 100).toFixed(1) : '0',
//           imagesPercentage: totalCached > 0 ? ((withImages / totalCached) * 100).toFixed(1) : '0',
//           environmentalPercentage: totalCached > 0 ? ((withEnvironmental / totalCached) * 100).toFixed(1) : '0',
//         },
//         sourceBreakdown,
//         recentAdditions,
//         apiCallsSaved,
//         estimatedCostSavings: (apiCallsSaved * 0.01).toFixed(2), // $0.01 per call
//       },
//     });
//   } catch (error: any) {
//     console.error('[enrichment/analytics] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// Search and browse cached products
// router.get('/admin/enrichment/search', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!canViewAllTenants(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_access_required' });
//     }

//     const { query, source, page = '1', limit = '20' } = req.query;
//     const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

//     const where: any = {};
    
//     if (query) {
//       where.OR = [
//         { barcode: { contains: query as string } },
//         { name: { contains: query as string, mode: 'insensitive' } },
//         { brand: { contains: query as string, mode: 'insensitive' } },
//       ];
//     }

//     if (source) {
//       where.source = source;
//     }

//     const [products, total] = await Promise.all([
//       prisma.barcodeEnrichment.findMany({
//         where,
//         orderBy: { fetchCount: 'desc' },
//         skip,
//         take: parseInt(limit as string),
//         select: {
//           id: true,
//           barcode: true,
//           name: true,
//           brand: true,
//           description: true,
//           imageUrl: true,
//           imageThumbnailUrl: true,
//           source: true,
//           fetchCount: true,
//           lastFetchedAt: true,
//           createdAt: true,
//         },
//       }),
//       prisma.barcodeEnrichment.count({ where }),
//     ]);

//     return res.json({
//       success: true,
//       products,
//       pagination: {
//         total,
//         page: parseInt(page as string),
//         limit: parseInt(limit as string),
//         totalPages: Math.ceil(total / parseInt(limit as string)),
//       },
//     });
//   } catch (error: any) {
//     console.error('[enrichment/search] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// Get detailed product enrichment data
// router.get('/admin/enrichment/:barcode', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     if (!canViewAllTenants(req.user as any)) {
//       return res.status(403).json({ success: false, error: 'platform_access_required' });
//     }

//     const { barcode } = req.params;

//     const product = await prisma.barcodeEnrichment.findUnique({
//       where: { barcode },
//     });

//     if (!product) {
//       return res.status(404).json({ success: false, error: 'not_found' });
//     }

//     return res.json({ success: true, product });
//   } catch (error: any) {
//     console.error('[enrichment/detail] Error:', error);
//     return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
//   }
// });

// Tenant-specific enrichment analytics
router.get('/scan/tenant/:tenantId/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;

    // Check tenant access
    if (!isPlatformAdmin(user) && user.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Get all inventory items for this tenant that were created via scanning
    const scannedItems = await prisma.inventoryItem.findMany({
      where: {
        tenantId,
        sku: { not: '' }, // Items with SKU were likely scanned
      },
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        metadata: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    // Calculate data quality metrics
    const totalScanned = scannedItems.length;
    let withNutrition = 0;
    let withImages = 0;
    let withEnvironmental = 0;
    let withAllergens = 0;

    scannedItems.forEach(item => {
      const metadata = item.metadata as any;
      if (metadata?.nutrition?.per_100g) withNutrition++;
      if (item.imageUrl || metadata?.images) withImages++;
      if (metadata?.environmental) withEnvironmental++;
      if (metadata?.allergens || metadata?.allergens_tags) withAllergens++;
    });

    // Get scanning activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentScans = await prisma.inventoryItem.count({
      where: {
        tenantId,
        sku: { not: '' },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekScans = await prisma.inventoryItem.count({
      where: {
        tenantId,
        sku: { not: '' },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Get most scanned products (by SKU frequency)
    const skuCounts = scannedItems.reduce((acc: any, item) => {
      if (item.sku) {
        acc[item.sku] = (acc[item.sku] || 0) + 1;
      }
      return acc;
    }, {});

    const topProducts = Object.entries(skuCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([sku, count]) => {
        const item = scannedItems.find(i => i.sku === sku);
        return {
          sku,
          name: item?.name,
          brand: item?.brand,
          scanCount: count,
        };
      });

    // Calculate cache benefit (estimate)
    const cacheHits = scannedItems.filter(item => {
      const metadata = item.metadata as any;
      return metadata?.source === 'open_food_facts' || metadata?.source === 'upc_database';
    }).length;

    const apiCallsSaved = cacheHits > 0 ? cacheHits - 1 : 0; // First scan per product hits API
    const estimatedSavings = (apiCallsSaved * 0.01).toFixed(2);

    return res.json({
      success: true,
      analytics: {
        totalScanned,
        recentScans: {
          last7Days: weekScans,
          last30Days: recentScans,
        },
        dataQuality: {
          withNutrition,
          withImages,
          withEnvironmental,
          withAllergens,
          nutritionPercentage: totalScanned > 0 ? ((withNutrition / totalScanned) * 100).toFixed(1) : '0',
          imagesPercentage: totalScanned > 0 ? ((withImages / totalScanned) * 100).toFixed(1) : '0',
          environmentalPercentage: totalScanned > 0 ? ((withEnvironmental / totalScanned) * 100).toFixed(1) : '0',
          allergensPercentage: totalScanned > 0 ? ((withAllergens / totalScanned) * 100).toFixed(1) : '0',
        },
        topProducts,
        cacheBenefit: {
          cacheHits,
          apiCallsSaved,
          estimatedSavings,
        },
      },
    });
  } catch (error: any) {
    console.error('[tenant/analytics] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Enrichment preview tool - check what data is available for a barcode
router.get('/scan/preview/:barcode', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    // Check universal cache first
    const cached = await prisma.barcodeEnrichment.findUnique({
      where: { barcode },
      select: {
        barcode: true,
        name: true,
        brand: true,
        description: true,
        imageUrl: true,
        imageThumbnailUrl: true,
        metadata: true,
        source: true,
        fetchCount: true,
      },
    });

    if (cached) {
      const metadata = cached.metadata as any;
      return res.json({
        success: true,
        found: true,
        product: {
          barcode: cached.barcode,
          name: cached.name,
          brand: cached.brand,
          description: cached.description,
          imageUrl: cached.imageUrl,
          source: cached.source,
          popularity: cached.fetchCount,
          dataAvailable: {
            nutrition: !!metadata?.nutrition?.per_100g,
            images: !!(cached.imageUrl || metadata?.images),
            allergens: !!(metadata?.allergens || metadata?.allergens_tags),
            environmental: !!metadata?.environmental,
            specifications: !!metadata?.specifications,
            ingredients: !!metadata?.ingredients,
          },
        },
      });
    }

    // Not in cache - would require API call
    return res.json({
      success: true,
      found: false,
      message: 'Product not in cache. Will fetch from external APIs when scanned.',
    });
  } catch (error: any) {
    console.error('[preview] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

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

// PATCH /scan/:sessionId/results/:resultId/enrichment - Update enrichment data
router.patch('/scan/:sessionId/results/:resultId/enrichment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, resultId } = req.params;
    const updates = req.body;

    // Validate updates (only allow specific fields)
    const allowedFields = ['name', 'brand', 'description', 'categoryPath'];
    const filteredUpdates: any = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ success: false, error: 'no_valid_updates' });
    }

    // Get result with session
    const result = await prisma.scanResult.findUnique({
      where: { id: resultId },
      include: { session: true },
    });

    if (!result || result.sessionId !== sessionId) {
      return res.status(404).json({ success: false, error: 'result_not_found' });
    }

    if (result.session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, result.tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Update enrichment data
    const currentEnrichment = result.enrichment as any || {};
    const updatedEnrichment = { ...currentEnrichment, ...filteredUpdates };

    await prisma.scanResult.update({
      where: { id: resultId },
      data: { enrichment: updatedEnrichment },
    });

    return res.json({ success: true, enrichment: updatedEnrichment });
  } catch (error: any) {
    console.error('[scan/:sessionId/results/:resultId/enrichment PATCH] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

export default router;
