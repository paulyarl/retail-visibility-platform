import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireTierFeature, requireWritableSubscription } from '../middleware/tier-access';
import { prisma } from '../prisma';
import { Flags } from '../config';
import { imageEnrichmentService } from '../services/ImageEnrichmentService';
import { audit } from '../audit';
import { z } from 'zod';
import { user_role, Prisma } from '@prisma/client';
import { BarcodeEnrichmentService } from '../services/BarcodeEnrichmentService';
import { isPlatformAdmin, canViewAllTenants } from '../utils/platform-admin';
import { generateItemId, generateSessionId, generatePhotoId } from '../lib/id-generator';

// Initialize enrichment service
const barcodeEnrichmentService = new BarcodeEnrichmentService();
// import {
//   scanSessionStarted,
//   scanSessionCompleted,
//   scanSessionCancelled,
//   scanBarcodeSuccess,
//   scanBarcodeFail,
//   scanBarcodeDuplicate,
//   scanCommitSuccess,
//   scanCommitFail,
//   scanCommitDurationMs,
//   scanValidationError,
// } from '../metrics';

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
router.post('/scan/start', authenticateToken, requireWritableSubscription, /* requireTierFeature('barcode_scan'), */ async (req: Request, res: Response) => {
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

    // Check rate limit: max 50 active sessions per tenant
    const activeSessions = await prisma.scan_sessions_list.count({
      where: { tenant_id:tenantId, status: 'active' },
    });
    if (activeSessions >= 50) {
      return res.status(429).json({ success: false, error: 'rate_limit_exceeded', limit: 50 });
    }

    // Create session
    const session = await prisma.scan_sessions_list.create({
      data: {
        id: generateSessionId(),
        tenant_id:tenantId,
        user_id:userId,
        template_id:templateId,
        device_type: deviceType || 'manual',
        status: 'active',
        metadata: metadata as any || {},
      },
      include: {
        scan_templates_list: true,
      },
    });

    // Audit
    try {
      await audit({
        tenantId,
        actor: userId,
        action: 'scan.scan_sessions_list.start',
        payload: { sessionId: session.id, deviceType, templateId },
      });
    } catch {}

    // Emit metric
    // scanSessionStarted.inc({ tenant: tenantId, deviceType: deviceType || 'manual' });

    return res.status(201).json({ success: true, session });
  } catch (error: any) {
    console.error('[scan/start] Error:', error);
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
      return res.status(400).json({ success: false, error: 'tenantId_required' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Get user's sessions for this tenant, ordered by most recent first
    const sessions = await prisma.scan_sessions_list.findMany({
      where: {
        tenant_id:tenantId,
        user_id:userId,
      },
      orderBy: {
        started_at: 'desc',
      },
      take: 20, // Limit to 20 most recent
    });

    // Transform the response to include camelCase fields and a "committed" date field
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      status: session.status,
      deviceType: session.device_type,
      scannedCount: session.scanned_count,
      committedCount: session.committed_count,
      duplicateCount: session.duplicate_count,
      startedAt: session.started_at?.toISOString(),
      completedAt: session.completed_at?.toISOString(),
      // Add "committed" field for backward compatibility - maps to completed_at
      committed: session.completed_at?.toISOString(),
    }));

    return res.json({ success: true, sessions: transformedSessions });
  } catch (error: any) {
    console.error('[scan/my-sessions GET] Error:', error);
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
    const session = await prisma.scan_sessions_list.findUnique({
      where: { id: sessionId },
      include: { scan_templates_list: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, session.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Block commit for read-only or inactive subscriptions
    const tenant = await prisma.tenants.findUnique({
      where: { id: session.tenant_id },
      select: { subscription_tier: true, subscription_status: true },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'tenant_not_found' });
    }

    const tier = tenant.subscription_tier || 'starter';
    const status = tenant.subscription_status || 'active';
    const isInactive = status === 'canceled' || status === 'expired';
    const isReadOnlyTier = tier === 'google_only';

    if (isInactive || isReadOnlyTier) {
      return res.status(403).json({
        success: false,
        error: 'subscription_read_only',
        message: 'Your account is in read-only visibility mode. Upgrade to add or update products or sync new changes.',
        subscriptionTier: tier,
        subscriptionStatus: status,
      });
    }

    // Check if barcode already scanned in this session
    const existing = await prisma.scan_results_list.findFirst({
      where: { session_id:sessionId, barcode:barcode },
    });

    if (existing) {
      // scanBarcodeDuplicate.inc({ tenant: session.tenantId });
      return res.status(409).json({ success: false, error: 'duplicate_barcode', result: existing });
    }

    // Check for duplicates in inventory (exclude soft-deleted items)
    const duplicateItem = await prisma.inventory_items.findFirst({
      where: {
        tenant_id: session.tenant_id,
        sku: sku || barcode,
        item_status: { not: 'trashed' }, // Exclude soft-deleted items
      },
      select: { id: true, name: true, sku: true },
    });

    // Perform barcode lookup/enrichment using the service with category suggestions
    let enrichment = null;
    let categorySuggestion = null;
    
    try {
      enrichment = await barcodeEnrichmentService.enrichWithCategorySuggestion(barcode, session.tenant_id);
      categorySuggestion = enrichment.categorySuggestion;
    } catch (error) {
      console.warn('[scan/lookup] Enrichment failed:', error);
      // Continue without enrichment
    }

    // Create scan result
    const result = await prisma.scan_results_list.create({
      data: {
        id: generateSessionId(),
        tenant_id: session.tenant_id,
        session_id:sessionId,
        barcode,
        sku: sku || barcode,
        status: duplicateItem ? 'duplicate' : 'new',
        enrichment: enrichment as any || {},
        duplicate_of: duplicateItem?.id,
        raw_payload: { barcode, sku, timestamp: new Date().toISOString() },
      },
    });

    // Update session counts
    await prisma.scan_sessions_list.update({
      where: { id: sessionId },
      data: {
        scanned_count: { increment: 1 },
        duplicate_count: duplicateItem ? { increment: 1 } : undefined,
      },
    });

    // Emit metrics
    // scanBarcodeSuccess.inc({ tenant: session.tenantId, hasDuplicate: String(!!duplicateItem) });
    // if (duplicateItem) {
    //   scanBarcodeDuplicate.inc({ tenant: session.tenantId });
    // }

    return res.status(201).json({
      success: true,
      result,
      enrichment,
      categorySuggestion, // Include category suggestion for frontend modal
      duplicate: duplicateItem ? { item: duplicateItem, warning: 'Item already exists in inventory' } : null,
    });
  } catch (error: any) {
    console.error('[scan/:sessionId/lookup-barcode] Error:', error);
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

    const session = await prisma.scan_sessions_list.findUnique({
      where: { id: sessionId },
      include: {
        scan_results_list: {
          where: { status: { not: 'duplicate' } },
        },
        scan_templates_list: true,
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, session.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Block commit for read-only or inactive subscriptions
    const tenant = await prisma.tenants.findUnique({
      where: { id: session.tenant_id },
      select: { subscription_tier: true, subscription_status: true },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'tenant_not_found' });
    }

    const tier = tenant.subscription_tier || 'starter';
    const status = tenant.subscription_status || 'active';
    const isInactive = status === 'canceled' || status === 'expired';
    const isReadOnlyTier = tier === 'google_only';

    if (isInactive || isReadOnlyTier) {
      return res.status(403).json({
        success: false,
        error: 'subscription_read_only',
        message: 'Your account is in read-only visibility mode. Upgrade to add or update products or sync new changes.',
        subscriptionTier: tier,
        subscriptionStatus: status,
      });
    }

    if (session.scan_results_list.length === 0) {
      return res.status(400).json({ success: false, error: 'no_items_to_commit' });
    }

    // Validate items (unless skipped)
    if (!skipValidation) {
      const validation = await validateScanResults(session.scan_results_list, session.scan_templates_list);
      if (!validation.valid) {
        // Emit validation error metrics
        // validation.errors.forEach(() => {
        //   scanValidationError.inc({ tenant: session.tenantId });
        // });
        return res.status(422).json({ success: false, error: 'validation_failed', validation });
      }
    }

    // Commit items to inventory
    const committed = [];
    for (const result of session.scan_results_list) {
      try {
        const enrichment = result.enrichment as any || {};
        console.log(`[commit] Processing ${result.barcode}:`, {
          hasCategoryPath: !!enrichment.categoryPath,
          categoryPathLength: enrichment.categoryPath?.length,
          categoryPath: enrichment.categoryPath,
          tenantCategoryId: enrichment.tenantCategoryId,
          templateDefault: session.scan_templates_list?.default_category 
        });

        // Extract rich metadata from enrichment
        const enrichmentMetadata = enrichment.metadata || {};
        
        // Extract multiple images from enrichment images object/array
        const imageGallery: string[] = [];
        if (enrichmentMetadata.images) {
          // Add main image first if available
          if (enrichment.imageUrl) {
            imageGallery.push(enrichment.imageUrl);
          }

          const images = enrichmentMetadata.images;
          
          // Handle array format (UPC Database)
          if (Array.isArray(images)) {
            images.forEach((imageUrl: string) => {
              if (imageUrl && typeof imageUrl === 'string') {
                imageGallery.push(imageUrl);
              }
            });
          } 
          // Handle object format (Open Food Facts)
          else if (typeof images === 'object') {
            if (images.front) imageGallery.push(images.front);
            if (images.ingredients) imageGallery.push(images.ingredients);
            if (images.nutrition) imageGallery.push(images.nutrition);
            if (images.packaging) imageGallery.push(images.packaging);
            if (images.other) imageGallery.push(images.other);
            // Also include small/thumbnail versions if available
            if (images.small_front) imageGallery.push(images.small_front);
            if (images.thumb_front) imageGallery.push(images.thumb_front);
          }
          
          // Deduplicate images
          const uniqueImages = Array.from(new Set(imageGallery));
          imageGallery.length = 0;
          imageGallery.push(...uniqueImages);
        } else if (enrichment.imageUrl) {
          // Fallback to single image
          imageGallery.push(enrichment.imageUrl);
        }

        // Merge enrichment metadata with scanned session info
        const itemMetadata = {
          ...extractStructuredMetadata(enrichmentMetadata),
          scannedFrom: sessionId,
          enrichmentSource: enrichment.source,
          enrichedAt: new Date().toISOString(),
        };

        // Check if there's a trashed item with the same SKU that we should restore
        const sku = result.sku || result.barcode;
        const existingTrashedItem = await prisma.inventory_items.findFirst({
          where: {
            tenant_id: session.tenant_id,
            sku: sku,
            item_status: 'trashed',
          },
        });

        let item;
        if (existingTrashedItem) {
          // Restore the trashed item with updated data
          console.log(`[commit] Restoring trashed item ${existingTrashedItem.id} for SKU ${sku}`);
          item = await prisma.inventory_items.update({
            where: { id: existingTrashedItem.id },
            data: {
              name: enrichment.name || `Product ${result.barcode}`,
              title: enrichment.name || `Product ${result.barcode}`,
              brand: enrichment.brand || 'Unknown',
              description: enrichment.description || null,
              price: (enrichment.priceCents || session.scan_templates_list?.default_price_cents || 0) / 100,
              price_cents: enrichment.priceCents || session.scan_templates_list?.default_price_cents || 0,
              stock: enrichment.stock || 0,
              currency: session.scan_templates_list?.default_currency || 'USD',
              visibility: (session.scan_templates_list?.default_visibility as any) || 'private',
              availability: (enrichment.stock || 0) > 0 ? 'in_stock' : 'out_of_stock',
              category_path: (enrichment.categoryPath && enrichment.categoryPath.length > 0)
                ? enrichment.categoryPath
                : (session.scan_templates_list?.default_category ? [session.scan_templates_list.default_category] : []),
              directory_category_id: enrichment.tenantCategoryId || null,
              metadata: itemMetadata,
              image_url: null, // Will be set after photo assets are created
              // image_gallery: imageGallery, // Removed - using photo_assets table instead
              item_status: 'active', // Restore to active
              updated_at: new Date(),
            },
          });
          console.log(`[commit] Saved category data for restored item ${item!.id}:`, {
            category_path: item!.category_path,
            directory_category_id: item!.directory_category_id,
            tenantCategoryId: enrichment.tenantCategoryId
          });
        } else {
          // Create new item
          const stock = enrichment.stock || 0;
          item = await prisma.inventory_items.create({
            data: {
              id: generateItemId(),
              tenant_id: session.tenant_id,
              name: enrichment.name || `Product ${result.barcode}`,
              title: enrichment.name || `Product ${result.barcode}`,
              brand: enrichment.brand || 'Unknown',
              description: enrichment.description || null,
              sku: sku,
              price: (enrichment.priceCents || session.scan_templates_list?.default_price_cents || 0) / 100,
              price_cents: enrichment.priceCents || session.scan_templates_list?.default_price_cents || 0,
              stock: stock,
              currency: session.scan_templates_list?.default_currency || 'USD',
              visibility: (session.scan_templates_list?.default_visibility as any) || 'private',
              availability: stock > 0 ? 'in_stock' : 'out_of_stock',
              category_path: (enrichment.categoryPath && enrichment.categoryPath.length > 0)
                ? enrichment.categoryPath
                : (session.scan_templates_list?.default_category ? [session.scan_templates_list.default_category] : []),
              directory_category_id: enrichment.tenantCategoryId || null,
              metadata: itemMetadata,
              image_url: null, // Will be set after photo assets are created
              // image_gallery: imageGallery, // Removed - using photo_assets table instead
              updated_at: new Date(),
            },
          });
          console.log(`[commit] Saved category data for new item ${item!.id}:`, {
            category_path: item!.category_path,
            directory_category_id: item!.directory_category_id,
            tenantCategoryId: enrichment.tenantCategoryId
          });
        }
        console.log(`[commit] ${existingTrashedItem ? 'Restored' : 'Created'} item ${item!.id} with rich metadata`);
        committed.push(item!.id);

        // Create photo assets for each image in the gallery
        // First delete any existing photo assets for this item
        const deletedCount = await prisma.photo_assets.deleteMany({
          where: { inventory_item_id: item!.id },
        });
        if (deletedCount.count > 0) {
          console.log(`[commit] Deleted ${deletedCount.count} existing photo assets for restored item ${item!.id}`);
        }
        
        const photoAssets = [];
        for (let i = 0; i < imageGallery.length && i < 11; i++) { // Limit to 11 photos max
          const imageUrl = imageGallery[i];
          try {
            const photoAsset = await prisma.photo_assets.create({
              data: {
                id: generatePhotoId(), // Generate unique photo ID
                tenant_id: session.tenant_id,
                inventory_item_id: item!.id,
                url: imageUrl,
                position: i,
                alt: item!.name,
                caption: null,
                content_type: 'image/jpeg', // Assume JPEG for scanned images
                exif_removed: true,
              },
            });
            photoAssets.push(photoAsset);
          } catch (photoError) {
            console.error(`[commit] Failed to create photo asset for ${imageUrl}:`, photoError);
            // Continue with other photos even if one fails
          }
        }

        console.log(`[commit] Created ${photoAssets.length} photo assets for item ${item!.id}`);

        // Update item image_url if photo assets were created
        if (photoAssets.length > 0) {
          await prisma.inventory_items.update({
            where: { id: item!.id },
            data: { image_url: photoAssets[0].url },
          });
          console.log(`[commit] Updated item ${item!.id} image_url to ${photoAssets[0].url}`);
        }

        // Process product images if available
        if (Flags.SCAN_ENRICHMENT && enrichment) {
          try {
            const imageUrls = imageEnrichmentService.extractImageUrls(enrichment);
            if (imageUrls.length > 0) {
              const imageCount = await imageEnrichmentService.processProductImages(
                session.tenant_id,
                item!.id,
                item!.sku,
                imageUrls,
                item!.name
              );
              console.log(`[commit] Processed ${imageCount}/${imageUrls.length} images for ${item!.sku}`);
            }
          } catch (imageError) {
            // Don't fail commit if image processing fails
            console.error(`[commit] Failed to process images for ${item!.sku}:`, imageError);
          }
        }
      } catch (error) {
        console.error(`[commit] Failed to create item for barcode ${result.barcode}:`, error);
      }
    }

    // Update session
    await prisma.scan_sessions_list.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        committed_count: committed.length,
        completed_at: new Date(),
      },
    });

    // Audit
    try {
      await audit({
        tenantId: session.tenant_id,
        actor: userId,
        action: 'scan.session.commit',
        payload: { sessionId, committedCount: committed.length, itemIds: committed },
      });
    } catch {}

    // Emit metrics
    // const duration = Date.now() - startTime;
    // scanCommitSuccess.inc({ tenant: session.tenantId, itemCount: String(committed.length) });
    // scanCommitDurationMs.observe(duration, { tenant: session.tenantId });
    // scanSessionCompleted.inc({ tenant: session.tenantId });

    return res.json({ success: true, committed: committed.length, itemIds: committed });
  } catch (error: any) {
    console.error('[scan/:sessionId/commit] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// PUT /scan/:sessionId/results/:resultId/enrichment - Update enrichment data for a scan result
router.put('/scan/:sessionId/results/:resultId/enrichment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, resultId } = req.params;
    const { enrichment } = req.body;

    // Validate input
    if (!enrichment || typeof enrichment !== 'object') {
      return res.status(400).json({ success: false, error: 'invalid_enrichment_data' });
    }

    // Find the scan result
    const result = await prisma.scan_results_list.findUnique({
      where: { id: resultId },
      include: { scan_sessions_list: true },
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'result_not_found' });
    }

    // Check session ownership
    if (result.session_id !== sessionId) {
      return res.status(400).json({ success: false, error: 'result_not_in_session' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, result.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Merge the new enrichment data with existing data
    const updatedEnrichment = {
      ...(result.enrichment as object || {}),
      ...enrichment,
    };

    // Update the scan result
    await prisma.scan_results_list.update({
      where: { id: resultId },
      data: { enrichment: updatedEnrichment as any },
    });

    console.log(`[scan/update-enrichment] Updated enrichment for result ${resultId}:`, enrichment);

    return res.json({ success: true, enrichment: updatedEnrichment });
  } catch (error: any) {
    console.error('[scan/update-enrichment] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});
router.get('/scan/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.scan_sessions_list.findUnique({
      where: { id: sessionId },
      include: {
        scan_templates_list: true,
        scan_results_list: {
          orderBy: { created_at: 'desc' },
          take: 100,
        },
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, session.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Transform the response to use camelCase
    const transformedSession = {
      id: session.id,
      status: session.status,
      deviceType: session.device_type,
      scannedCount: session.scanned_count,
      committedCount: session.committed_count,
      duplicateCount: session.duplicate_count,
      startedAt: session.started_at?.toISOString(),
      completedAt: session.completed_at?.toISOString(),
      template: session.scan_templates_list,
      results: session.scan_results_list.map(result => ({
        id: result.id,
        barcode: result.barcode,
        sku: result.sku,
        status: result.status,
        enrichment: result.enrichment,
        duplicateOf: result.duplicate_of,
        createdAt: result.created_at?.toISOString(),
      })),
    };

    return res.json({ success: true, session: transformedSession });
  } catch (error: any) {
    console.error('[scan/:sessionId] Error:', error);
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
      return res.status(400).json({ success: false, error: 'tenantId_required' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Close all active sessions for this user in this tenant
    const result = await prisma.scan_sessions_list.updateMany({
      where: {
        tenant_id:tenantId,
        user_id:userId,
        status: 'active',
      },
      data: {
        status: 'cancelled',
        completed_at: new Date(),
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
    const activeSessionIds = await prisma.scan_results_list.findMany({
      where: {
        created_at: { gte: oneHourAgo },
      },
      select: { session_id: true },
      distinct: ['session_id'],
    });

    const activeIds = activeSessionIds.map(r => r.session_id);

    // Cancel sessions that are active, started more than 1 hour ago, AND have no recent results
    const result = await prisma.scan_sessions_list.updateMany({
      where: {
        status: 'active',
        started_at: { lt: oneHourAgo },
        id: { notIn: activeIds }, // Exclude sessions with recent activity
      },
      data: {
        status: 'cancelled',
        completed_at: new Date(),
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
router.get('/admin/enrichment/cache-stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const stats = barcodeEnrichmentService.getCacheStats();
    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[enrichment/cache-stats] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

router.get('/admin/enrichment/rate-limits', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const stats = barcodeEnrichmentService.getRateLimitStats();
    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[enrichment/rate-limits] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

router.post('/admin/enrichment/clear-cache', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!isPlatformAdmin(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_admin_required' });
    }

    const { barcode } = req.body;
    barcodeEnrichmentService.clearCache(barcode);
    
    return res.json({ 
      success: true, 
      message: barcode ? `Cache cleared for ${barcode}` : 'All cache cleared' 
    });
  } catch (error: any) {
    console.error('[enrichment/clear-cache] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Comprehensive enrichment analytics
router.get('/admin/enrichment/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    // Get total cached products
    const totalCached = await prisma.barcode_enrichment.count();
    
    // Get most popular products (top 10 by fetch count)
    const popularProducts = await prisma.barcode_enrichment.findMany({
      orderBy: { fetch_count: 'desc' },
      take: 10,
      select: {
        barcode: true,
        name: true,
        brand: true,
        fetch_count: true,
        source: true,
        last_fetched_at: true,
      },
    });

    // Get data quality metrics
    const withNutrition = await prisma.barcode_enrichment.count({
      where: {
        metadata: {
          path: ['nutrition', 'per_100g'],
          not: Prisma.JsonNull,
        },
      },
    });

    const withImages = await prisma.barcode_enrichment.count({
      where: {
        OR: [
          { image_url: { not: null } },
          { image_thumbnail_url: { not: null } },
        ],
      },
    });

    const withEnvironmental = await prisma.barcode_enrichment.count({
      where: {
        metadata: {
          path: ['environmental'],
          not: Prisma.JsonNull,
        },
      },
    });

    // Get source breakdown
    const sourceBreakdown = await prisma.barcode_enrichment.groupBy({
      by: ['source'],
      _count: true,
    });

    // Get recent additions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAdditions = await prisma.barcode_enrichment.count({
      where: {
        created_at: { gte: oneDayAgo },
      },
    });

    // Calculate total API calls saved (sum of fetchCount - 1 for each product)
    const totalFetchCount = await prisma.barcode_enrichment.aggregate({
      _sum: { fetch_count: true },
    });
    const apiCallsSaved = (totalFetchCount._sum.fetch_count || 0) - totalCached;

    return res.json({
      success: true,
      analytics: {
        totalCached,
        popularProducts,
        dataQuality: {
          withNutrition,
          withImages,
          withEnvironmental,
          nutritionPercentage: totalCached > 0 ? ((withNutrition / totalCached) * 100).toFixed(1) : '0',
          imagesPercentage: totalCached > 0 ? ((withImages / totalCached) * 100).toFixed(1) : '0',
          environmentalPercentage: totalCached > 0 ? ((withEnvironmental / totalCached) * 100).toFixed(1) : '0',
        },
        sourceBreakdown,
        recentAdditions,
        apiCallsSaved,
        estimatedCostSavings: (apiCallsSaved * 0.01).toFixed(2), // $0.01 per call
      },
    });
  } catch (error: any) {
    console.error('[enrichment/analytics] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Search and browse cached products
router.get('/admin/enrichment/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { query, source, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    
    if (query) {
      where.OR = [
        { barcode: { contains: query as string } },
        { name: { contains: query as string, mode: 'insensitive' } },
        { brand: { contains: query as string, mode: 'insensitive' } },
      ];
    }

    if (source) {
      where.source = source;
    }

    const [products, total] = await Promise.all([
      prisma.barcode_enrichment.findMany({
        where,
        orderBy: { fetch_count: 'desc' },
        skip,
        take: parseInt(limit as string),
        select: {
          id: true,
          barcode: true,
          name: true,
          brand: true,
          description: true,
          image_url: true,
          image_thumbnail_url: true,
          source: true,
          fetch_count: true,
          last_fetched_at: true,
          created_at: true,
        },
      }),
      prisma.barcode_enrichment.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error('[enrichment/search] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// Get detailed product enrichment data
router.get('/admin/enrichment/:barcode', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { barcode } = req.params;

    const product = await prisma.barcode_enrichment.findUnique({
      where: { barcode },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    return res.json({ success: true, product });
  } catch (error: any) {
    console.error('[enrichment/detail] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

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
    const scannedItems = await prisma.inventory_items.findMany({
      where: {
        tenant_id:tenantId,
        sku: { not: '' }, // Items with SKU were likely scanned
      },
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        metadata: true,
        image_url: true,
        created_at: true,
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
      if (item.image_url || metadata?.images) withImages++;
      if (metadata?.environmental) withEnvironmental++;
      if (metadata?.allergens || metadata?.allergens_tags) withAllergens++;
    });

    // Get scanning activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentScans = await prisma.inventory_items.count({
      where: {
        tenant_id:tenantId,
        sku: { not: '' },
        created_at: { gte: thirtyDaysAgo },
      },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekScans = await prisma.inventory_items.count({
      where: {
        tenant_id:tenantId,
        sku: { not: '' },
        created_at: { gte: sevenDaysAgo },
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
    const cached = await prisma.barcode_enrichment.findFirst({
      where: { barcode },
      select: {
        barcode: true,
        name: true,
        brand: true,
        description: true,
        image_url: true,
        image_thumbnail_url: true,
        metadata: true,
        source: true,
        fetch_count: true,
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
          imageUrl: cached.image_url,
          source: cached.source,
          popularity: cached.fetch_count,
          dataAvailable: {
            nutrition: !!metadata?.nutrition?.per_100g,
            images: !!(cached.image_url || metadata?.images),
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

// Helper: Extract and structure enrichment metadata
function extractStructuredMetadata(enrichmentMetadata: any): any {
  if (!enrichmentMetadata) return {};

  const structured = { ...enrichmentMetadata };

  // Extract nutrition data
  if (structured.nutrition) {
    // If nutrition is already an object, keep it as is
    if (typeof structured.nutrition === 'object' && !Array.isArray(structured.nutrition)) {
      // Ensure it's properly structured
      structured.nutrition = {
        per_100g: structured.nutrition.per_100g || structured.nutrition['100g'] || {},
        per_serving: structured.nutrition.per_serving || structured.nutrition.serving || {},
        ...structured.nutrition
      };
    }
  }

  // Extract environmental data
  if (structured.environmental) {
    if (typeof structured.environmental === 'object' && !Array.isArray(structured.environmental)) {
      // Ensure it's properly structured
      structured.environmental = {
        ecoscore_grade: structured.environmental.ecoscore_grade || structured.environmental.grade,
        ecoscore_score: structured.environmental.ecoscore_score || structured.environmental.score,
        ...structured.environmental
      };
    }
  }

  // Extract ingredients data
  if (structured.ingredients) {
    if (typeof structured.ingredients === 'string') {
      // If it's a string, keep it as is
      structured.ingredients = structured.ingredients;
    } else if (Array.isArray(structured.ingredients)) {
      // If it's an array, extract text
      structured.ingredients = structured.ingredients.map((ing: any) =>
        typeof ing === 'string' ? ing : ing.text || ing.name || JSON.stringify(ing)
      ).join(', ');
    } else if (typeof structured.ingredients === 'object') {
      // If it's an object, try to extract text field
      structured.ingredients = structured.ingredients.text || structured.ingredients.name || JSON.stringify(structured.ingredients);
    }
  }

  // Extract ingredients analysis
  if (structured.ingredients_analysis) {
    if (typeof structured.ingredients_analysis === 'object') {
      // Keep the analysis object as is
      structured.ingredients_analysis = structured.ingredients_analysis;
    }
  }

  // Extract allergens
  if (structured.allergens) {
    if (typeof structured.allergens === 'string') {
      structured.allergens = structured.allergens;
    } else if (Array.isArray(structured.allergens)) {
      structured.allergens = structured.allergens.join(', ');
    }
  }

  // Extract allergens tags
  if (structured.allergens_tags) {
    if (Array.isArray(structured.allergens_tags)) {
      structured.allergens_tags = structured.allergens_tags;
    }
  }

  // Extract additives
  if (structured.additives_tags) {
    if (Array.isArray(structured.additives_tags)) {
      structured.additives_tags = structured.additives_tags;
    }
  }

  // Extract nova group
  if (structured.nova_group || structured['nova-group']) {
    structured.nova_group = structured.nova_group || structured['nova-group'];
  }

  // Extract completeness score
  if (structured.completeness !== undefined) {
    structured.completeness = structured.completeness;
  }

  return structured;
}

// Helper: Validate scan results
async function validateScanResults(scan_results_list: any[], template: any): Promise<{ valid: boolean; errors: any[] }> {
  const errors = [];

  for (const result of scan_results_list) {
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
    if (!enrichment.tenantCategoryId && !template?.defaultCategory) {
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
    const allowedFields = ['name', 'brand', 'description', 'tenantCategoryId'];
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
    const result = await prisma.scan_results_list.findUnique({
      where: { id: resultId },
      include: { scan_sessions_list: true },
    });

    if (!result || result.session_id !== sessionId) {
      return res.status(404).json({ success: false, error: 'result_not_found' });
    }

    if (result.scan_sessions_list.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, result.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Update enrichment data
    const currentEnrichment = result.enrichment as any || {};
    const updatedEnrichment = { ...currentEnrichment, ...filteredUpdates };

    await prisma.scan_results_list.update({
      where: { id: resultId },
      data: { enrichment: updatedEnrichment },
    });

    return res.json({ success: true, enrichment: updatedEnrichment });
  } catch (error: any) {
    console.error('[scan/:sessionId/results/:resultId/enrichment PATCH] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

//
// DELETE /scan/:sessionId/results/:resultId - Remove a result from a scan session
//
router.delete('/scan/:sessionId/results/:resultId', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const resultId = req.params.resultId;

    // Find the result with session relation
    const result = await prisma.scan_results_list.findUnique({
      where: { id: resultId },
      include: { scan_sessions_list: true },
    });

    if (!result || result.session_id !== sessionId) {
      return res.status(404).json({ success: false, error: 'result_not_found' });
    }

    if (result.scan_sessions_list.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, result.scan_sessions_list.tenant_id)) { 
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Delete the result
    await prisma.scan_results_list.delete({
      where: { id: resultId },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[scan/:sessionId/results/:resultId DELETE] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

//
// DELETE /scan/:sessionId - Cancel a scan session
//
router.delete('/scan/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    // Find the session
    const session = await prisma.scan_sessions_list.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'session_not_found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, error: 'session_not_active' });
    }

    // Check tenant access
    if (!hasAccessToTenant(req, session.tenant_id)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    // Delete the session (this will cascade delete all results due to Prisma relations)
    await prisma.scan_sessions_list.delete({
      where: { id: sessionId },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[scan/:sessionId DELETE] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

export default router;
