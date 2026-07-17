import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getDirectPool } from '../utils/db-pool';
import { audit } from '../audit';
import { categoryService } from '../services/CategoryService';
import { FeaturedProductsService } from '../services/FeaturedProductsService';
import { generatePhotoId, generateTenantItemId, generateTenantVariantId, generateVariantSkuFromParent, generateSKU, generateTenantKey } from '../lib/id-generator';
import { migrateTempPhotos } from '../photos';
import { StorageBuckets } from '../storage-config';
import { unifiedConfig } from '../config/unifiedConfig';

const DEV = unifiedConfig.isDevelopment;
const UPLOAD_DIR = unifiedConfig.uploadDir || path.resolve(process.cwd(), 'uploads');
const router = Router();

/* ----------------------------- PHOTOS (MOUNTED BEFORE /items) ----------------------------- */
/** Accept JSON { url } (already uploaded), JSON { dataUrl } (dev), or multipart "file" (server uploads to Supabase or dev FS) */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const jsonUrlSchema = z.object({
  tenant_id: z.string().min(1).optional(), // optional—can be derived from item
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().nonnegative().optional(),
  contentType: z.string().optional(),
  exifRemoved: z.boolean().optional(),
});

const dataUrlSchema = z.object({
  tenant_id: z.string().min(1),
  dataUrl: z.string().min(1),
  contentType: z.string().min(1),
});

// Supabase (server-side)
const SUPABASE_URL = unifiedConfig.supabaseUrl;
const SUPABASE_SERVICE_ROLE_KEY = unifiedConfig.supabaseServiceRoleKey;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Re-export for use in extracted code
export { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, supabase };

// Log Supabase configuration status at startup
if (supabase) {
  console.log('✓ Supabase configured for photo storage');
} else {
  console.warn('⚠ Supabase NOT configured - photo uploads will fail in production');
  console.warn('  Missing env vars:', {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY
  });
}

// Helper: enforce MVP 1MB limit for base64 uploads
function rejectIfOver1MB(bytes: number) {
  const LIMIT = 1_000_000;
  if (bytes > LIMIT) {
    const kb = Math.round(bytes / 1024);
    throw Object.assign(new Error("image_too_large"), { code: "IMAGE_TOO_LARGE", bytes: kb });
  }
}

// POST /items/:id/photos and /inventory/:id/photos
// Shared handler for POST /items/:id/photos (and /inventory/:id/photos)
const photoUploadHandler = async (req: any, res: any) => {
  try {
    const itemId = req.params.id;
    console.log(`[Photo Upload] Starting upload for item ${itemId}`, {
      hasFile: !!req.file,
      contentType: req.get('content-type'),
      bodyKeys: req.body ? Object.keys(req.body) : [],
      supabaseConfigured: !!supabase
    });

    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) {
      console.log(`[Photo Upload] Item not found: ${itemId}`);
      return res.status(400).json({ error: "item_not_found" });
    }
    console.log(`[Photo Upload] Item found:`, { id: item.id, tenant_id: item.tenant_id, sku: item.sku });

    // A) JSON { url, ... } → register the asset
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.url === "string") {
      const parsed = jsonUrlSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      const { url, width, height, bytes, contentType, exifRemoved } = parsed.data;

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id, item.id),
          tenantId: item.tenant_id,
          inventoryItemId: item.id,
          url,
          width: width ?? null,
          height: height ?? null,
          bytes: bytes ?? null,
          contentType: contentType ?? null,
          exifRemoved: exifRemoved ?? true,
        },
      });

      // Always update the item's image_url to the latest uploaded photo
      await prisma.inventory_items.update({ where: { id: item.id }, data: { image_url: url } });
      return res.status(201).json(created);
    }

    // B) multipart/form-data "file" → Supabase (if configured) or local FS in dev
    if (req.file) {
      const f = req.file as any;
      let publicUrl: string | null = null;

      if (supabase) {
        const pathKey = `${item.tenant_id}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;
        console.log(`[Photo Upload] Uploading to Supabase:`, { pathKey, size: f.size, mimetype: f.mimetype });

        const { error, data } = await supabase.storage.from(StorageBuckets.PHOTOS.name).upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });

        if (error) {
          logger.error(`[Photo Upload] Supabase upload error:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
          return res.status(500).json({ error: error.message, details: error });
        }

        publicUrl = supabase.storage.from(StorageBuckets.PHOTOS.name).getPublicUrl(data.path).data.publicUrl;
        console.log(`[Photo Upload] Supabase upload successful:`, { publicUrl });
      } else if (DEV) {
        const ext = f.mimetype.includes("png") ? ".png" : f.mimetype.includes("webp") ? ".webp" : ".jpg";
        const filename = `${item.id}-${Date.now()}${ext}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), f.buffer);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        publicUrl = `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
      } else {
        return res.status(500).json({ error: "no_upload_backend_configured" });
      }

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id, item.id),
          tenantId: item.tenant_id,
          inventoryItemId: item.id,
          url: publicUrl!,
          contentType: f.mimetype,
          bytes: f.size,
          exifRemoved: true,
        },
      });

      // Always update the item's image_url to the latest uploaded photo
      await prisma.inventory_items.update({ where: { id: item.id }, data: { image_url: publicUrl! } });
      return res.status(201).json(created);
    }

    // C) JSON { dataUrl, contentType } → Supabase Storage or filesystem fallback (enforce <1MB)
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      console.log(`[Photo Upload] Processing dataUrl upload`);
      const parsed = dataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        logger.error(`[Photo Upload] Invalid dataUrl payload:`, undefined, { error: { name: 'Error', message: String(parsed.error.flatten()) } });
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      }

      const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
      if (!match) return res.status(400).json({ error: "invalid_data_url" });
      const buf = Buffer.from(match[1], "base64");
      rejectIfOver1MB(buf.length); // MVP constraint

      const ext = parsed.data.contentType.includes("png")
        ? ".png"
        : parsed.data.contentType.includes("webp")
          ? ".webp"
          : ".jpg";

      let publicUrl: string;

      // Prefer Supabase Storage if configured
      if (supabase) {
        const pathKey = `${item.tenant_id}/${item.sku || item.id}/${Date.now()}${ext}`;
        console.log(`[Photo Upload] Uploading dataUrl to Supabase:`, { pathKey, size: buf.length, contentType: parsed.data.contentType });

        const { error, data } = await supabase.storage.from(StorageBuckets.PHOTOS.name).upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

        if (error) {
          logger.error("[Photo Upload] Supabase dataUrl upload error:", undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
          return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
        }

        publicUrl = supabase.storage.from(StorageBuckets.PHOTOS.name).getPublicUrl(data.path).data.publicUrl;
        console.log(`[Photo Upload] Supabase dataUrl upload successful:`, { publicUrl });
      } else {
        // Fallback to filesystem
        const filename = `${itemId}-${Date.now()}${ext}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        publicUrl = `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
      }

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id, item.id),
          tenantId: item.tenant_id,
          inventoryItemId: item.id,
          url: publicUrl,
          contentType: parsed.data.contentType,
          bytes: buf.length,
          exifRemoved: true,
        },
      });

      // Always update the item's image_url to the latest uploaded photo
      await prisma.inventory_items.update({ where: { id: item.id }, data: { image_url: publicUrl } });
      return res.status(201).json(created);
    }

    return res.status(400).json({ error: "unsupported_payload" });
  } catch (e: any) {
    if (e?.code === "IMAGE_TOO_LARGE") {
      return res.status(413).json({ error: "image_too_large", bytesKB: e.bytes });
    }
    console.error("[Photo Upload Error] Full error details:", {
      message: (e as any)?.message,
      stack: (e as any)?.stack,
      code: e?.code,
      name: (e as any)?.name,
      itemId: req.params.id,
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.get('content-type')
    });
    return res.status(500).json({
      error: "failed_to_upload_photo",
      details: DEV ? (e as any)?.message : undefined
    });
  }
};

// Mount consolidated directory route BEFORE any other /api/directory routes
import directoryConsolidatedRoutes from './directory-consolidated';
router.use('/api/directory', directoryConsolidatedRoutes);
console.log('✅ Directory consolidated routes mounted at /api/directory');

// Mount random featured products route
import directoryRandomFeaturedRoutes from './directory-random-featured';
router.use('/api/directory', directoryRandomFeaturedRoutes);
console.log('✅ Directory random featured routes mounted at /api/directory');
console.log('✅ Direct random-featured route handler registered');

// Mount global random featured products route
import directoryRandomFeaturedGlobalRoutes from './directory-random-featured-global';
router.use('/api/directory', directoryRandomFeaturedGlobalRoutes);
console.log('✅ Directory random featured global routes mounted at /api/directory');

// Mount store-types route BEFORE any other /api/directory routes
// VERY SIMPLE TEST - This should definitely work
router.get('/api/directory/simple-test', (req, res) => {
  console.log('[SIMPLE-TEST] Route hit!');
  res.json({ message: 'Simple test working!' });
});

// Test route to verify mounting order
router.get('/api/directory/store-types/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// Direct route handler to bypass any router conflicts
console.log('[STORE-TYPES] Registering direct route handler...');
router.get('/api/directory/store-types', async (req, res) => {
  console.log('[STORE-TYPES] Direct route hit - fetching store types');
  try {
    const { storeTypeDirectoryService } = await import('../services/store-type-directory.service');
    const { lat, lng, radius } = req.query;

    const location = lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : undefined;
    const radiusMiles = radius ? parseFloat(radius as string) : 25;

    const storeTypes = await storeTypeDirectoryService.getStoreTypes(location, radiusMiles);

    res.json({
      success: true,
      data: { storeTypes, totalCount: storeTypes.length }
    });
  } catch (error: any) {
    logger.error('[STORE-TYPES] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch store types' });
  }
});

// Mount featured stores router BEFORE other directory routes to avoid conflicts
import directoryFeaturedStoresRoutes from './directory-featured-stores';
router.use('/api/directory/featured-stores', directoryFeaturedStoresRoutes);
console.log('✅ Directory featured stores routes mounted at /api/directory/featured-stores');

// Mount photos router (handles all photo endpoints with position support)
import directoryPhotosRouter from '../photos';
import { logger } from '../logger';
router.use('/api/directory', directoryPhotosRouter);

// Directory routes are mounted later (line ~5200) after all specific directory paths
// to avoid catch-all :identifier route intercepting specific paths

// Legacy photo upload handler removed - now handled by photos router
// Old routes:
// - POST /items/:id/photos -> now in photos.ts with position logic
// - GET /items/:id/photos -> now in photos.ts ordered by position
// - PUT /items/:id/photos/:photoId -> new endpoint for update
// - DELETE /items/:id/photos/:photoId -> new endpoint for delete
// - PUT /items/:id/photos/reorder -> new endpoint for bulk reorder

// Optional: helps spot stray POSTs under /items that aren't handled by routes
// Only matches POSTs under /items that are NOT .../photos
// TEMPORARILY COMMENTED OUT - might be interfering
// app.all(/^\/items\/(?!.*\/photos$).*$/, (req, _res, next) => {
//   if (req.method === "POST") {
//     console.warn("DEBUG: Unhandled POST under /items ->", req.path);
//   }
//   next();
// });


/* --------------------------- ITEMS / INVENTORY --------------------------- */
const listQuery = z.object({
  tenant_id: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(), // Accept camelCase variant
  count: z.string().optional(), // Return only count for performance
  page: z.string().optional(), // Page number (1-indexed)
  limit: z.string().optional(), // Items per page
  search: z.string().optional(), // Search by SKU or name
  q: z.string().optional(), // Alias for search
  status: z.enum(['all', 'active', 'inactive', 'syncing', 'trashed']).optional(), // Filter by status
  visibility: z.enum(['all', 'public', 'private']).optional(), // Filter by visibility
  category: z.string().optional(), // Filter by category slug (legacy)
  categoryId: z.string().optional(), // Filter by tenant category ID
  categoryFilter: z.enum(['all', 'assigned', 'unassigned']).optional(), // Filter by category assignment status
  sortBy: z.enum(['name', 'sku', 'price', 'stock', 'updated_at', 'created_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).transform((data) => ({
  ...data,
  tenant_id: data.tenant_id || data.tenantId, // Accept both snake_case and camelCase
  search: data.search || data.q, // Accept both search and q
}));

/**
 * GET /api/items/stats - Get aggregated item statistics for a tenant
 * Returns storewide counts regardless of pagination/filters
 */
router.get(["/api/items/stats", "/api/inventory/stats"], authenticateToken, async (req, res) => {
  const tenant_id = (req.query.tenant_id || req.query.tenantId) as string;

  if (!tenant_id) {
    return res.status(400).json({ error: "tenant_id_required" });
  }

  const isAdmin = isPlatformAdmin(req.user);
  const inJwtTenants = req.user?.tenantIds?.includes(tenant_id) ?? false;
  let hasAccess = isAdmin || inJwtTenants;

  console.log('[GET /api/items/stats] Access check:', {
    userId: req.user?.userId,
    tenant_id,
    isAdmin,
    inJwtTenants,
    jwtTenantIds: req.user?.tenantIds,
  });

  if (!hasAccess && req.user?.userId && tenant_id) {
    try {
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user.userId,
            tenant_id,
          },
        },
        select: { id: true },
      });
      hasAccess = !!userTenant;
      console.log('[GET /api/items/stats] DB lookup result:', { userTenant, hasAccess });
    } catch (e) {
      logger.error('[GET /api/items/stats] Error checking tenant membership:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    }
  }

  if (!hasAccess) {
    return res.status(403).json({ error: 'tenant_access_denied' });
  }

  try {
    // Get aggregated counts for all non-trashed items
    const [total, active, inactive, syncing, publicCount, privateCount, lowStock] = await Promise.all([
      prisma.inventory_items.count({ where: { tenant_id, item_status: { not: 'trashed' } } }),
      prisma.inventory_items.count({ where: { tenant_id, item_status: 'active' } }),
      prisma.inventory_items.count({ where: { tenant_id, item_status: 'inactive' } }),
      prisma.inventory_items.count({ where: { tenant_id, item_status: 'active', visibility: 'public' } }), // syncing = active + public
      prisma.inventory_items.count({ where: { tenant_id, item_status: { not: 'trashed' }, visibility: 'public' } }),
      prisma.inventory_items.count({ where: { tenant_id, item_status: { not: 'trashed' }, visibility: 'private' } }),
      prisma.inventory_items.count({ where: { tenant_id, item_status: { not: 'trashed' }, stock: { lt: 10 } } }),
    ]);

    return res.json({
      total,
      active,
      inactive,
      syncing,
      public: publicCount,
      private: privateCount,
      lowStock,
    });
  } catch (error) {
    logger.error('[GET /api/items/stats] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_stats' });
  }
});

// Tenant-scoped route alias for items (supports /api/tenants/:tenantId/items)
router.get("/api/tenants/:tenantId/items", authenticateToken, async (req, res) => {
  // Extract tenant_id from path and merge with query params
  const queryWithTenant = { ...req.query, tenant_id: req.params.tenantId };
  const parsed = listQuery.safeParse(queryWithTenant);
  if (!parsed.success) return res.status(400).json({ error: "invalid_query_params", details: parsed.error.flatten() });

  const tenant_id = parsed.data.tenant_id;
  if (!tenant_id) {
    return res.status(400).json({ error: "tenant_id_required" });
  }

  const isAdmin = isPlatformAdmin(req.user);
  let hasAccess = isAdmin || (req.user?.tenantIds?.includes(tenant_id) ?? false);

  if (!hasAccess && req.user?.userId && tenant_id) {
    try {
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user.userId,
            tenant_id,
          },
        },
        select: { id: true },
      });
      hasAccess = !!userTenant;
    } catch (e) {
      logger.error('[GET /api/tenants/:tenantId/items] Error checking tenant membership:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    }
  }

  if (!hasAccess) {
    return res.status(403).json({ error: 'tenant_access_denied', message: 'You do not have access to this tenant' });
  }

  try {
    const where: any = { tenant_id };
    if (parsed.data.status !== 'trashed') {
      where.item_status = { not: 'trashed' };
    }
    if (parsed.data.search) {
      const searchTerm = parsed.data.search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { brand: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    if (parsed.data.category) {
      where.category = parsed.data.category;
    }
    if (parsed.data.status && parsed.data.status !== 'all') {
      where.item_status = parsed.data.status;
    }
    if (parsed.data.visibility && parsed.data.visibility !== 'all') {
      where.visibility = parsed.data.visibility;
    }

    // Parse pagination params (page-based, not offset-based)
    const page = parseInt(parsed.data.page || '1', 10);
    const limit = parseInt(parsed.data.limit || '25', 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: skip,
        include: {
          // Include any related data if needed
        }
      }),
      prisma.inventory_items.count({ where }),
    ]);

    // Transform the results to match the materialized view structure
    const transformedItems = items.map((item: any) => ({
      ...item,
      // Add featured types array for multiple support (currently single from base table)
      featured_types: item.featured_type ? [item.featured_type] : [],
      // Add additional fields that would be in the materialized view
      featured_expires_at: item.featured_until,
      is_featured_active: item.is_featured && (!item.featured_until || new Date(item.featured_until) > new Date()),
      days_until_expiration: item.featured_until ? Math.ceil((new Date(item.featured_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      is_expired: item.featured_until ? new Date(item.featured_until) <= new Date() : false,
      is_expiring_soon: item.featured_until ?
        Math.ceil((new Date(item.featured_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 7 : false,
      // Default product type since it's not in base table
      product_type: 'physical',
    }));

    const totalCount = total;

    res.json({
      items: transformedItems,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    });
  } catch (e: any) {
    logger.error('[GET /api/tenants/:tenantId/items] Error listing items:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    res.status(500).json({ error: "failed_to_list_items", message: (e as any)?.message });
  }
});

router.get(["/api/items", "/api/inventory", "/items", "/inventory"], authenticateToken, async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_query_params", details: parsed.error.flatten() });

  // Check tenant access
  const tenant_id = parsed.data.tenant_id;


  if (!tenant_id) {
    return res.status(400).json({ error: "tenant_id_required" });
  }

  const isAdmin = isPlatformAdmin(req.user);
  let hasAccess = isAdmin || (req.user?.tenantIds?.includes(tenant_id) ?? false);

  // Fallback: if JWT tenantIds are empty, verify membership via userTenant table
  if (!hasAccess && req.user?.userId && tenant_id) {
    try {
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: req.user.userId,
            tenant_id,
          },
        },
        select: { id: true },
      });
      hasAccess = !!userTenant;
    } catch (e) {
      logger.error('[GET /api/items] Error checking tenant membership:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    }
  }

  if (!hasAccess) {
    return res.status(403).json({ error: 'tenant_access_denied', message: 'You do not have access to this tenant' });
  }

  try {
    // Build where clause
    const where: any = { tenant_id };

    // Exclude trashed items by default (unless explicitly requested)
    if (parsed.data.status !== 'trashed') {
      where.item_status = { not: 'trashed' };
    }

    // Apply search filter
    if (parsed.data.search) {
      const searchTerm = parsed.data.search.toLowerCase();
      where.OR = [
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Apply status filter
    if (parsed.data.status && parsed.data.status !== 'all') {
      if (parsed.data.status === 'active') {
        where.item_status = 'active';
      } else if (parsed.data.status === 'inactive') {
        where.item_status = 'inactive';
      } else if (parsed.data.status === 'trashed') {
        where.item_status = 'trashed';
      } else if (parsed.data.status === 'syncing') {
        where.AND = [
          { OR: [{ item_status: 'active' }, { item_status: null }] },
          { OR: [{ visibility: 'public' }, { visibility: null }] },
        ];
      }
    }

    // Apply category filter (legacy - by directory category slug)
    if (parsed.data.category) {
      where.directoryCategory = {
        slug: parsed.data.category,
      };
    }

    // Apply tenant category filter (by specific category ID)
    if (parsed.data.categoryId) {
      where.directory_category_id = parsed.data.categoryId;
    }

    // Apply category assignment filter (assigned/unassigned)
    if (parsed.data.categoryFilter && parsed.data.categoryFilter !== 'all') {
      if (parsed.data.categoryFilter === 'assigned') {
        // Has category assigned
        where.directory_category_id = { not: null };
      } else if (parsed.data.categoryFilter === 'unassigned') {
        // No category assigned
        where.directory_category_id = null;
      }
    }

    // Apply visibility filter
    if (parsed.data.visibility && parsed.data.visibility !== 'all') {
      if (parsed.data.visibility === 'public') {
        where.visibility = 'public';
      } else if (parsed.data.visibility === 'private') {
        where.visibility = 'private';
      }
    }

    // If count=true, return only the count
    if (req.query.count === 'true') {
      // Check if Prisma client is properly initialized
      if (!prisma || !prisma.inventory_items) {
        console.warn('[GET /items] Prisma client not properly initialized');
        return res.status(500).json({
          error: 'database_unavailable',
        });
      }

      const count = await prisma.inventory_items.count({ where });
      return res.json({ count });
    }

    // Parse pagination params
    const page = parseInt(parsed.data.page || '1', 10);
    const limit = parseInt(parsed.data.limit || '25', 10);
    const skip = (page - 1) * limit;

    // Build orderBy clause
    const sortBy = parsed.data.sortBy || 'updated_at';
    const sortOrder = parsed.data.sortOrder || 'desc';
    const orderBy: any = {};

    if (sortBy === 'price') {
      orderBy.price_cents = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Fetch items with pagination
    const [items, totalCount] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.inventory_items.count({ where }),
    ]);

    // Fetch featured types for all items in batch
    const itemIds = items.map(item => item.id);
    const featuredTypesMap = new Map();

    if (itemIds.length > 0) {
      // Get featured types for all items at once
      const featuredTypesForAllItems = await Promise.all(
        itemIds.map(async (itemId) => {
          const featuredTypes = await FeaturedProductsService.getFeaturedTypesForItem(itemId);
          return { itemId, featuredTypes };
        })
      );

      // Create lookup map
      featuredTypesForAllItems.forEach(({ itemId, featuredTypes }) => {
        featuredTypesMap.set(itemId, featuredTypes);
      });
    }

    // Fetch all unique category slugs from items' category_path arrays
    const categorySlugs = [...new Set(items.flatMap(item => item.category_path || []).filter(Boolean))];
    const categories = categorySlugs.length > 0
      ? await prisma.directory_category.findMany({
        where: {
          slug: { in: categorySlugs },
          tenantId: tenant_id
        },
        select: { id: true, name: true, slug: true, googleCategoryId: true }
      })
      : [];

    // Create a category lookup map
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat]));

    // Return paginated response
    // Hide price_cents from frontend since price is the authoritative field
    // Map directory_category_id to tenantCategoryId and include category object
    // Map image_url to imageUrl for frontend compatibility

    // Also fetch categories by directory_category_id for items that have it set
    const directCategoryIds = [...new Set(items.map(item => item.directory_category_id).filter((id): id is string => !!id))];
    const directCategories = directCategoryIds.length > 0
      ? await prisma.directory_category.findMany({
        where: {
          id: { in: directCategoryIds },
          tenantId: tenant_id
        },
        select: { id: true, name: true, slug: true, googleCategoryId: true }
      })
      : [];

    // Create a category lookup map by ID
    const categoryByIdMap = new Map(directCategories.map(cat => [cat.id, cat]));

    const itemsWithoutPriceCents = items.map((item: any) => {
      const { price_cents, directory_category_id, image_url, id, metadata, ...itemWithoutPriceCents } = item;

      // Get featured types for this item
      const featuredTypes = featuredTypesMap.get(id) || [];

      // Find tenant category - prefer directory_category_id, fallback to category_path
      let tenantCategory = null;
      if (directory_category_id) {
        // Direct category ID lookup (from Quick Start or manual assignment)
        tenantCategory = categoryByIdMap.get(directory_category_id) || null;
      }
      if (!tenantCategory && item.category_path && item.category_path.length > 0) {
        // Fallback to category_path lookup (legacy method)
        tenantCategory = categoryMap.get(item.category_path[0]) || null;
      }

      // Extract metadata fields if they exist (fallback for any custom fields)
      const metadataObj = (typeof metadata === 'object' && metadata !== null) ? metadata as Record<string, any> : {};

      // Extract featured types array and maintain backward compatibility
      const featuredTypesArray = featuredTypes.map((ft: any) => ft.featured_type);
      const primaryFeaturedType = featuredTypesArray.length > 0 ? featuredTypesArray[0] : null;

      return {
        ...itemWithoutPriceCents,
        price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
        tenantCategoryId: tenantCategory ? tenantCategory.id : null,
        tenantCategory: tenantCategory || null,
        imageUrl: image_url || null, // Map image_url to imageUrl for frontend
        categoryPath: item.category_path || [], // Also include category_path for completeness
        // Use real database columns first, fallback to metadata for backward compatibility
        has_variants: item.has_variants || metadataObj.has_variants || false,
        default_variant_id: item.default_variant_id || metadataObj.default_variant_id || null,
        product_type: item.product_type || metadataObj.product_type || 'physical',
        digital_delivery_method: item.digital_delivery_method || metadataObj.digital_delivery_method,
        digital_assets: item.digital_assets || metadataObj.digital_assets,
        license_type: item.license_type || metadataObj.license_type,
        access_duration_days: item.access_duration_days || metadataObj.access_duration_days,
        download_limit: item.download_limit || metadataObj.download_limit,
        payment_gateway_type: item.payment_gateway_type || metadataObj.payment_gateway_type,
        payment_gateway_id: item.payment_gateway_id || metadataObj.payment_gateway_id,
        // Multi-type featured products support
        featuredTypes: featuredTypesArray, // Array of featured types
        featuredProducts: featuredTypes, // Full featured product details with expirations
        // Backward compatibility
        featuredType: primaryFeaturedType, // Primary featured type (first one)
        is_featured: featuredTypesArray.length > 0, // Boolean for backward compatibility
        featured_at: featuredTypes.length > 0 ? featuredTypes[0].featured_at : null,
        featured_priority: featuredTypes.length > 0 ? featuredTypes[0].featured_priority : null,
        featured_until: featuredTypes.length > 0 ? featuredTypes[0].featured_expires_at : null,
      };
    });

    res.json({
      items: itemsWithoutPriceCents,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + items.length < totalCount,
      },
    });

  } catch (e: any) {
    logger.error('[GET /items] Error listing items:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    res.status(500).json({ error: "failed_to_list_items", message: (e as any)?.message });
  }
});

router.get(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], async (req, res) => {
  const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const it = await prisma.inventory_items.findUnique({
    where: { id: itemId },
    include: {
      product_variants: {
        select: {
          id: true,
          parent_item_id: true,
          tenant_id: true,
          variant_name: true,
          sku: true,
          price_cents: true,
          sale_price_cents: true,
          stock: true,
          image_url: true,
          attributes: true,
          sort_order: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });
  if (!it) return res.status(400).json({ error: "not_found" });

  // Security: Only allow public access to items that are active AND public
  // Draft, archived, and private items should not be accessible via public URLs
  const isAuthenticated = req.headers.authorization; // Check if request has auth token
  if (!isAuthenticated) {
    // For unauthenticated requests, only show active + public items
    if (it.item_status !== 'active' || it.visibility !== 'public') {
      return res.status(400).json({ error: "not_found" });
    }
  }

  // Check payment gateway status from MV (fast, pre-computed)
  let hasActivePaymentGateway = false;
  let defaultGatewayType: string | null = null;
  try {
    const mvData = await getDirectPool().query(
      'SELECT has_active_payment_gateway, default_gateway_type FROM storefront_products WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    if (mvData.rows.length > 0) {
      hasActivePaymentGateway = mvData.rows[0].has_active_payment_gateway || false;
      defaultGatewayType = mvData.rows[0].default_gateway_type || null;
    }
    console.log(`[GET /items/${req.params.id}] MV payment gateway:`, hasActivePaymentGateway, 'type:', defaultGatewayType, 'tenant:', it.tenant_id);
  } catch (e) {
    console.log(`[GET /items/${req.params.id}] MV query failed, using fallback for tenant:`, it.tenant_id);
    // Fallback: query payment gateway table directly if MV fails
    const gateway = await prisma.tenant_payment_gateways.findFirst({
      where: {
        tenant_id: it.tenant_id,
        is_active: true,
      },
      select: { id: true, gateway_type: true },
    });
    hasActivePaymentGateway = !!gateway;
    defaultGatewayType = gateway?.gateway_type || null;
    console.log(`[GET /items/${req.params.id}] Fallback payment gateway:`, hasActivePaymentGateway, 'type:', defaultGatewayType);
  }

  // Fetch tenant category - prioritize directory_category_id, fallback to category_path slug lookup
  let tenantCategory = null;
  if (it.directory_category_id) {
    // Primary lookup: by directory_category_id (most reliable)
    const category = await prisma.directory_category.findFirst({
      where: {
        id: it.directory_category_id,
        tenantId: it.tenant_id
      },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true,
      },
    });
    if (category) {
      tenantCategory = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        googleCategoryId: category.googleCategoryId,
      };
    }
  } else if (it.category_path && it.category_path.length > 0) {
    // Fallback: try to find by slug from category_path
    const category = await prisma.directory_category.findFirst({
      where: {
        slug: it.category_path[0],
        tenantId: it.tenant_id
      },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true,
      },
    });
    if (category) {
      tenantCategory = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        googleCategoryId: category.googleCategoryId,
      };
    }
  }

  // Get featured types for this item
  const featuredTypes = await FeaturedProductsService.getFeaturedTypesForItem(itemId);
  const featuredTypesArray = featuredTypes.map(ft => ft.featured_type);
  const primaryFeaturedType = featuredTypesArray.length > 0 ? featuredTypesArray[0] : null;

  // Fetch photo gallery data from photo_assets table
  let imageGallery: Array<{
    id: string;
    url: string;
    position: number;
    alt: string | null;
    caption: string | null;
    variant_id: string | null;
    createdAt: string;
  }> = [];
  try {
    const photos = await prisma.photo_assets.findMany({
      where: {
        inventoryItemId: itemId,
        variant_id: null // Only item-level photos, not variant photos
      },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        inventoryItemId: true,
        variant_id: true,
        url: true,
        publicUrl: true,
        position: true,
        alt: true,
        caption: true,
        createdAt: true
      }
    });

    imageGallery = photos.map(photo => ({
      id: photo.id,
      url: photo.url,
      position: photo.position,
      alt: photo.alt,
      caption: photo.caption,
      variant_id: photo.variant_id,
      createdAt: photo.createdAt.toISOString()
    }));
  } catch (error) {
    logger.error(`[GET /items/${itemId}] Error fetching photo gallery:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    // Continue without photos if there's an error
  }

  // Convert Decimal price to number for frontend compatibility
  // Hide price_cents from frontend since price is the authoritative field
  // Map image_url to imageUrl for frontend compatibility
  const { price_cents, image_url, sale_price_cents, metadata, product_variants, ...itemWithoutPriceCents } = it;

  // Extract metadata fields if they exist (fallback for any custom fields)
  const metadataObj = (typeof metadata === 'object' && metadata !== null) ? metadata as Record<string, any> : {};

  const transformed = {
    ...itemWithoutPriceCents,
    price: it.price !== null && it.price !== undefined ? Number(it.price) : null,
    priceCents: price_cents !== null && price_cents !== undefined ? Number(price_cents) : null,
    salePriceCents: metadataObj.sale_price_cents ?? (sale_price_cents !== null && sale_price_cents !== undefined ? Number(sale_price_cents) : null),
    imageUrl: image_url || null,
    imageGallery: imageGallery, // Add actual photo gallery data
    tenantCategory,
    tenantCategoryId: it.directory_category_id,
    hasActivePaymentGateway: hasActivePaymentGateway || false,
    defaultGatewayType: defaultGatewayType || null,
    // Include variants array with sorting
    variants: product_variants ?
      [...product_variants].sort((a, b) => {
        const aSortOrder = a.sort_order || 0;
        const bSortOrder = b.sort_order || 0;
        if (aSortOrder !== bSortOrder) {
          return aSortOrder - bSortOrder;
        }
        const aCreatedAt = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreatedAt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aCreatedAt - bCreatedAt;
      }) : [],
    // Use real database columns first, fallback to metadata for backward compatibility
    has_variants: it.has_variants || metadataObj.has_variants || false,
    product_type: it.product_type || metadataObj.product_type || 'physical',
    digital_delivery_method: it.digital_delivery_method || metadataObj.digital_delivery_method,
    digital_assets: it.digital_assets || metadataObj.digital_assets,
    license_type: it.license_type || metadataObj.license_type,
    access_duration_days: it.access_duration_days || metadataObj.access_duration_days,
    download_limit: it.download_limit || metadataObj.download_limit,
    payment_gateway_type: metadataObj.payment_gateway_type || it.payment_gateway_type,
    payment_gateway_id: metadataObj.payment_gateway_id || it.payment_gateway_id,
    // Use direct columns first, fallback to metadata for backward compatibility
    features: it.features || metadataObj.features || [],
    specifications: it.specifications || metadataObj.specifications || {},
    tags: it.tags || metadataObj.tags || [],
    seo_title: it.seo_title || metadataObj.seo_title || null,
    seo_description: it.seo_description || metadataObj.seo_description || null,
    enhanced_description: it.enhanced_description || metadataObj.enhancedDescription || null,
    track_inventory: it.track_inventory ?? metadataObj.track_inventory ?? true,
    allow_backorder: it.allow_backorder ?? metadataObj.allow_backorder ?? false,
    low_stock_threshold: it.low_stock_threshold || metadataObj.low_stock_threshold || 5,
    video_url: it.video_url || metadataObj.videoUrl || null,
    videoUrl: it.video_url || metadataObj.videoUrl || null, // Keep videoUrl for backward compatibility
    // Multi-type featured products support
    featuredTypes: featuredTypesArray, // Array of featured types
    featuredProducts: featuredTypes, // Full featured product details with expirations
    // Backward compatibility
    featuredType: primaryFeaturedType, // Primary featured type (first one)
    is_featured: featuredTypesArray.length > 0, // Boolean for backward compatibility
    featured_at: featuredTypes.length > 0 ? featuredTypes[0].featured_at : null,
    featured_priority: featuredTypes.length > 0 ? featuredTypes[0].featured_priority : null,
    featured_until: featuredTypes.length > 0 ? featuredTypes[0].featured_expires_at : null,
  };

  res.json(transformed);
});

// GET /api/items/:id/photos - Fetch all photos for an item ordered by position (PUBLIC)
router.get("/api/items/:id/photos", async (req, res) => {
  try {
    const itemId = req.params.id;

    // Verify item exists
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { id: true, tenant_id: true }
    });

    if (!item) {
      return res.status(400).json({ error: "item_not_found" });
    }

    // Fetch photos ordered by position
    const photos = await prisma.photo_assets.findMany({
      where: {
        inventoryItemId: itemId,
        variant_id: null // Only item-level photos, not variant photos
      },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        inventoryItemId: true,
        variant_id: true,
        url: true,
        publicUrl: true,
        position: true,
        alt: true,
        caption: true,
        createdAt: true
      }
    });

    // Transform to match frontend Photo interface
    const transformedPhotos = photos.map(photo => ({
      id: photo.id,
      itemId: photo.inventoryItemId,
      variantId: photo.variant_id,
      url: photo.url || photo.publicUrl,
      position: photo.position,
      alt: photo.alt,
      caption: photo.caption,
      createdAt: photo.createdAt.toISOString()
    }));

    res.json({ photos: transformedPhotos });
  } catch (error) {
    logger.error('[GET /api/items/:id/photos] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_fetch_photos" });
  }
});

const conditionSchema = z.enum(['new', 'brand_new', 'refurbished', 'used']).transform((v) => (v === 'new' ? 'brand_new' : v));

const baseItemSchema = z.object({
  tenant_id: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(), // Accept camelCase from frontend
  sku: z.string().min(1).optional(), // Optional - API will auto-generate if not provided
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int(), // Allow negative values for items with variants
  image_url: z.string().nullable().optional(),
  image_gallery: z.array(z.string()).optional(), // Array of image URLs
  metadata: z.any().optional(),
  description: z.string().optional(),
  marketing_description: z.string().nullable().optional(),
  // v3.4 SWIS fields (required by schema)
  title: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  manufacturer: z.string().nullable().optional(),
  price: z.union([z.number(), z.string().transform(Number)]).pipe(z.number().nonnegative()).optional(),
  currency: z.string().length(3).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
  condition: conditionSchema.optional(),
  // Product identifiers for Google Merchant
  gtin: z.string().nullable().optional(),
  mpn: z.string().nullable().optional(),
  // Item status and visibility
  item_status: z.enum(['active', 'inactive', 'archived', 'trashed']).optional(),
  itemStatus: z.enum(['active', 'inactive', 'archived', 'trashed']).optional(), // Accept camelCase from frontend
  status: z.string().optional(), // Legacy field, ignore
  visibility: z.enum(['public', 'private']).optional(),
  // Category path for Google Shopping
  category_path: z.array(z.string()).optional(),
  // Tenant category assignment
  directory_category_id: z.string().nullable().optional(),
  tenantCategoryId: z.string().nullable().optional(), // Accept camelCase from frontend
  // Variant support
  has_variants: z.boolean().optional(),
  variants: z.array(z.object({
    variant_name: z.string().min(1).optional(),
    name: z.string().min(1).optional(), // Accept both 'name' and 'variant_name'
    sku: z.string().optional(), // Allow empty SKUs - API will generate them
    price_cents: z.number().int().nonnegative(),
    sale_price_cents: z.number().int().nonnegative().nullable().optional(),
    stock: z.number().int().nonnegative(),
    attributes: z.record(z.string(), z.string()),
  }).refine((data) => data.variant_name || data.name, {
    message: "Either 'name' or 'variant_name' must be provided"
  })).optional(),
  // Digital product fields
  product_type: z.enum(['physical', 'digital', 'hybrid', 'service']).optional(),
  digital_delivery_method: z.string().nullable().optional(),
  digital_assets: z.array(z.any()).nullable().optional(),
  license_type: z.string().nullable().optional(),
  access_duration_days: z.number().int().nullable().optional(),
  download_limit: z.number().int().nullable().optional(),
  // Payment gateway fields
  payment_gateway_type: z.string().nullable().optional(),
  payment_gateway_id: z.string().nullable().optional(),
  // Sale price
  sale_price_cents: z.number().int().nonnegative().nullable().optional(),
  // Tags and SEO
  tags: z.array(z.string()).optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  enhanced_description: z.string().nullable().optional(),
  // Media fields
  video_url: z.string().nullable().optional(),
  video_thumbnail: z.string().nullable().optional(),
  // Product details
  features: z.array(z.string()).optional(),
  specifications: z.any().optional(),
  // Inventory settings
  track_inventory: z.boolean().optional(),
  allow_backorder: z.boolean().optional(),
  low_stock_threshold: z.number().int().optional(),
  // Featuring
  is_featured: z.boolean().optional(),
  featured_priority: z.number().int().optional(),
  featured_type: z.string().nullable().optional(),
});

const createItemSchema = baseItemSchema.extend({
  // Apply defaults only for creation
  price_cents: z.number().int().nonnegative().default(0),
  stock: z.number().int().default(0), // Allow negative values for items with variants
}).transform((data) => {
  const { tenant_id, tenantId, itemStatus, item_status, tenantCategoryId, directory_category_id, status, ...rest } = data;
  return {
    ...rest,
    tenant_id: tenant_id || tenantId, // Prefer snake_case, fallback to camelCase
    item_status: item_status || itemStatus || 'active', // Prefer snake_case, fallback to camelCase, default to active
    directory_category_id: directory_category_id || tenantCategoryId || null, // Prefer snake_case, fallback to camelCase
  };
});

const updateItemSchema = baseItemSchema.partial();

router.post(["/api/items", "/api/inventory", "/items", "/inventory"], requireWritableSubscription, async (req, res) => {
  console.log('[POST /items] Raw request body:', JSON.stringify(req.body, null, 2));

  const parsed = createItemSchema.safeParse(req.body ?? {});
  console.log('[POST /items] Zod validation result:', parsed.success);
  if (!parsed.success) {
    console.log('[POST /items] Validation errors:', JSON.stringify(parsed.error.flatten(), null, 2));
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  console.log('[POST /items] Parsed data:', parsed.data);
  try {
    // Extract variants and other special fields before creating item
    const {
      variants,
      has_variants,
      product_type,
      digital_delivery_method,
      digital_assets,
      license_type,
      access_duration_days,
      download_limit,
      payment_gateway_type,
      payment_gateway_id,
      image_gallery,
      sale_price_cents,
      tags,
      seo_title,
      seo_description,
      is_featured,
      featured_priority,
      featured_type,
      marketing_description,
      track_inventory,
      allow_backorder,
      low_stock_threshold,
      ...itemData
    } = parsed.data;

    // If category is assigned, look up the slug for category_path
    let categoryPath: string[] = itemData.category_path || [];
    if (itemData.directory_category_id && categoryPath.length === 0) {
      const category = await prisma.directory_category.findFirst({
        where: {
          id: itemData.directory_category_id,
          tenantId: itemData.tenant_id
        },
        select: { slug: true }
      });
      if (category) {
        categoryPath = [category.slug];
        console.log('[POST /items] Auto-populated category_path:', categoryPath);
      }
    }

    const data = {
      ...itemData,
      title: itemData.title || itemData.name,
      brand: itemData.brand || 'Unknown',
      // Auto-generate SKU if not provided
      sku: itemData.sku || generateSKU({
        tenantKey: generateTenantKey(itemData.tenant_id || ''),
        productType: (product_type || 'physical') as 'physical' | 'digital' | 'hybrid' | 'service',
      }),
      // Price logic: prioritize price (dollars) over price_cents (cents)
      // Ensure price is never undefined since it's required in the schema
      price: itemData.price ?? (itemData.price_cents ? itemData.price_cents / 100 : 0),
      price_cents: itemData.price_cents ?? (itemData.price ? Math.round(itemData.price * 100) : 0),
      currency: itemData.currency || 'USD',
      // Auto-set availability based on stock if not explicitly provided
      availability: itemData.availability || (itemData.stock > 0 ? 'in_stock' : 'out_of_stock'),
      tenant_id: itemData.tenant_id || '', // Ensure tenant_id is always a string
      // Category assignment - keep both directory_category_id and category_path for storefront compatibility
      directory_category_id: itemData.directory_category_id || null,
      category_path: categoryPath,
      // Media
      image_url: itemData.image_url || null,
      image_gallery: image_gallery || [],
      // Content
      marketing_description: marketing_description || null,
      // Sale price is a DIRECT COLUMN (not metadata)
      sale_price_cents: sale_price_cents || null,
      // Payment gateway fields are DIRECT COLUMNS
      payment_gateway_type: payment_gateway_type || null,
      payment_gateway_id: payment_gateway_id || null,
      // Featuring
      is_featured: is_featured || false,
      featured_priority: featured_priority || 0,
      featured_type: featured_type || 'store_selection',
      // Include new fields as direct columns
      has_variants: has_variants || false,
      product_type: product_type || 'physical',
      digital_delivery_method: digital_delivery_method as any,
      digital_assets: digital_assets as any,
      license_type: license_type as any,
      access_duration_days: access_duration_days,
      download_limit: download_limit,
      // Keep metadata for any other custom fields
      metadata: {
        ...(typeof itemData.metadata === 'object' && itemData.metadata !== null ? itemData.metadata : {}),
        tags: tags || [],
        // SEO settings (not direct columns, store in metadata)
        seo_title: seo_title || null,
        seo_description: seo_description || null,
        // Inventory settings (not direct columns, store in metadata)
        track_inventory: track_inventory ?? true,
        allow_backorder: allow_backorder ?? false,
        low_stock_threshold: low_stock_threshold || 5,
        // Media settings (store in metadata)
        videoUrl: (itemData.metadata as any)?.videoUrl || null,
        videoThumbnail: (itemData.metadata as any)?.videoThumbnail || null,
        // Remove fields that are now in dedicated columns to avoid duplication
        ...(typeof itemData.metadata === 'object' && itemData.metadata !== null ? {
          has_variants: undefined,
          default_variant_id: undefined,
          product_type: undefined,
          digital_delivery_method: undefined,
          digital_assets: undefined,
          license_type: undefined,
          access_duration_days: undefined,
          download_limit: undefined,
        } : {}),
      } as any,
    };

    // Create item and variants in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the main item
      const created = await tx.inventory_items.create({
        data: {
          id: generateTenantItemId(itemData.tenant_id || ''),
          ...data,
          updated_at: new Date(),
        }
      });

      // Create variants if provided
      if (has_variants && variants && variants.length > 0) {
        console.log(`[POST /items] Creating ${variants.length} variants for item ${created.id}`);

        for (const variant of variants) {
          // Generate SKU if not provided
          let sku = variant.sku;
          if (!sku || sku.trim() === '') {
            sku = generateVariantSkuFromParent(created.sku, variants.indexOf(variant), created.product_type as any);
          }

          // Handle both 'name' and 'variant_name' fields
          const variantName = variant.variant_name || variant.name;

          await tx.product_variants.create({
            data: {
              id: generateTenantVariantId(created.id, created.tenant_id),
              parent_item_id: created.id,
              tenant_id: created.tenant_id,
              variant_name: variantName || `Variant ${variants.indexOf(variant) + 1}`, // Ensure string value
              sku: sku, // Now guaranteed to be a string
              price_cents: variant.price_cents,
              sale_price_cents: variant.sale_price_cents || null,
              stock: variant.stock,
              attributes: variant.attributes as any,
              is_active: true,
              sort_order: 0,
              created_at: new Date(),
              updated_at: new Date(),
            }
          });
        }

        // Update the item to mark it as having variants
        await tx.inventory_items.update({
          where: { id: created.id },
          data: {
            has_variants: true,
          }
        });
      }

      return created;
    });

    // Migrate temp photos to permanent URLs
    const tenantId = itemData.tenant_id || '';
    const allPhotoUrls = [
      result.image_url,
      ...(result.image_gallery || [])
    ].filter((url): url is string => Boolean(url));

    let finalPhotoUrls = allPhotoUrls;

    if (allPhotoUrls.some(url => url.includes('/temp/'))) {
      console.log('[POST /items] Migrating temp photos to permanent URLs...');

      const permanentUrls = await migrateTempPhotos(allPhotoUrls, tenantId, result.id);

      // Update the item with permanent URLs
      const [permanentPrimaryUrl, ...permanentGalleryUrls] = permanentUrls;

      await prisma.inventory_items.update({
        where: { id: result.id },
        data: {
          image_url: permanentPrimaryUrl || result.image_url,
          image_gallery: permanentGalleryUrls.length > 0 ? permanentGalleryUrls : result.image_gallery,
        }
      });

      // Update result for response
      result.image_url = permanentPrimaryUrl || result.image_url;
      result.image_gallery = permanentGalleryUrls.length > 0 ? permanentGalleryUrls : result.image_gallery;
      finalPhotoUrls = permanentUrls;
    }

    // Create photo_assets records for all photos
    if (finalPhotoUrls.length > 0) {
      console.log(`[POST /items] Creating ${finalPhotoUrls.length} photo_assets records for item ${result.id}`);

      for (let i = 0; i < finalPhotoUrls.length; i++) {
        const photoUrl = finalPhotoUrls[i];
        const isPrimary = i === 0;

        try {
          await prisma.photo_assets.create({
            data: {
              id: generatePhotoId(tenantId, result.id),
              tenantId: tenantId,
              inventoryItemId: result.id,
              url: photoUrl,
              position: i,
              alt: isPrimary ? `${result.name} - Primary Image` : `${result.name} - Gallery Image ${i}`,
              caption: null,
              variant_id: null,
              width: null,
              height: null,
              bytes: null,
              contentType: 'image/jpeg',
              exifRemoved: true,
            }
          });
        } catch (photoError) {
          logger.error(`[POST /items] Failed to create photo_assets record for ${photoUrl}:`, undefined, { error: { name: (photoError as any)?.name || 'Error', message: (photoError as any)?.message || String(photoError), stack: (photoError as any)?.stack } });
          // Continue with other photos even if one fails
        }
      }
    }

    // await audit({ tenant_id: created.tenant_id, actor: null, action: "inventory.create", payload: { id: created.id, sku: created.sku } });

    // Convert Decimal price to number and hide price_cents for frontend compatibility
    const { price_cents, ...itemWithoutPriceCents } = result;
    const transformed = {
      ...itemWithoutPriceCents,
      price: result.price !== null && result.price !== undefined ? Number(result.price) : null,
      has_variants: result.has_variants,
    };

    res.status(201).json(transformed);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "duplicate_sku" });
    logger.error('[POST /items] Error creating item:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    res.status(500).json({ error: "failed_to_create_item", message: (e as any)?.message });
  }
});

router.put(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], requireWritableSubscription, async (req, res) => {
  console.log('[PUT /items/:id] Received body:', JSON.stringify(req.body));
  const parsed = updateItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    logger.error('[PUT /items/:id] Validation failed:', undefined, { error: { name: 'Error', message: String(JSON.stringify(parsed.error.flatten(), null, 2)) } });
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  console.log('[PUT /items/:id] Validation passed, parsed data:', JSON.stringify(parsed.data));
  try {
    // Extract fields that go into metadata (not direct columns)
    const {
      tenant_id: _,
      tenantId: __,
      itemStatus,
      item_status,
      tenantCategoryId,
      directory_category_id,
      status,
      // Fields to store in direct columns (extracted from metadata)
      tags,
      seo_title,
      seo_description,
      enhanced_description,
      features,
      specifications,
      video_url,
      video_thumbnail,
      track_inventory,
      allow_backorder,
      low_stock_threshold,
      // NOTE: sale_price_cents, payment_gateway_type, payment_gateway_id are DIRECT COLUMNS
      // Do NOT destructure them - let them pass through to rest for direct storage
      // Metadata object itself
      metadata: incomingMetadata,
      ...rest
    } = parsed.data;

    // Build update data with proper field mappings
    const updateData: any = { ...rest };

    // Map camelCase to snake_case for item_status
    if (itemStatus !== undefined || item_status !== undefined) {
      updateData.item_status = item_status || itemStatus;
    }

    // Map camelCase to snake_case for directory_category_id
    // CRITICAL: Must explicitly set this field as it was destructured out of rest
    if (tenantCategoryId !== undefined && tenantCategoryId !== null) {
      updateData.directory_category_id = tenantCategoryId;
      console.log('[PUT /items/:id] Setting directory_category_id from tenantCategoryId:', tenantCategoryId);

      // When assigning a tenant category, we need to get the category slug and update category_path
      try {
        const category = await prisma.directory_category.findFirst({
          where: {
            id: tenantCategoryId,
            isActive: true
          },
          select: { slug: true }
        });

        if (category) {
          updateData.category_path = [category.slug];
          console.log('[PUT /items/:id] Setting category_path from category slug:', category.slug);
        } else {
          console.warn('[PUT /items/:id] Category not found for tenantCategoryId:', tenantCategoryId);
        }
      } catch (error) {
        logger.error('[PUT /items/:id] Error fetching category for tenantCategoryId:', undefined, { error: { name: 'Error', message: String(tenantCategoryId) +  + String({ error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } }) } });
      }
    } else if (directory_category_id !== undefined && directory_category_id !== null) {
      updateData.directory_category_id = directory_category_id;
      console.log('[PUT /items/:id] Setting directory_category_id from directory_category_id:', directory_category_id);

      // Also update category_path for storefront compatibility
      try {
        const category = await prisma.directory_category.findFirst({
          where: {
            id: directory_category_id,
            isActive: true
          },
          select: { slug: true }
        });

        if (category) {
          updateData.category_path = [category.slug];
          console.log('[PUT /items/:id] Setting category_path from category slug:', category.slug);
        }
      } catch (error) {
        logger.error('[PUT /items/:id] Error fetching category for directory_category_id:', undefined, { error: { name: 'Error', message: String(directory_category_id) +  + String({ error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } }) } });
      }
    }

    // Handle variants separately - they go to the product_variants table
    let variantsData;
    if (updateData.variants) {
      variantsData = updateData.variants;
      delete updateData.variants; // Remove from main item update
    }

    // Handle stock updates
    if (updateData.stock !== undefined) {
      const stockValue = typeof updateData.stock === 'string' ? parseInt(updateData.stock, 10) : updateData.stock;
      if (!isNaN(stockValue)) {
        updateData.stock = stockValue;
        // Auto-sync availability based on stock
        updateData.availability = stockValue > 0 ? 'in_stock' : 'out_of_stock';
      } else {
        delete updateData.stock; // Remove invalid stock value
      }
    }

    // Add migrated fields to direct columns
    if (tags !== undefined) updateData.tags = tags;
    if (seo_title !== undefined) updateData.seo_title = seo_title;
    if (seo_description !== undefined) updateData.seo_description = seo_description;
    if (enhanced_description !== undefined) updateData.enhanced_description = enhanced_description;
    if (features !== undefined) updateData.features = features;
    if (specifications !== undefined) updateData.specifications = specifications;
    if (video_url !== undefined) updateData.video_url = video_url;
    if (video_thumbnail !== undefined) updateData.video_thumbnail = video_thumbnail;
    if (track_inventory !== undefined) updateData.track_inventory = track_inventory;
    if (allow_backorder !== undefined) updateData.allow_backorder = allow_backorder;
    if (low_stock_threshold !== undefined) updateData.low_stock_threshold = low_stock_threshold;

    // Sync price and price_cents fields
    if (updateData.price !== undefined) {
      updateData.price_cents = Math.round(updateData.price * 100);
    } else if (updateData.price_cents !== undefined) {
      updateData.price = updateData.price_cents / 100;
    }

    // Build metadata object with fields that are not direct columns
    const metadataFields: any = {};
    // NOTE: migrated fields are now stored as direct columns, not in metadata
    // NOTE: sale_price_cents, payment_gateway_type, payment_gateway_id are stored as direct columns
    // They are NOT stored in metadata

    // Merge with existing metadata and incoming metadata
    if (Object.keys(metadataFields).length > 0 || incomingMetadata) {
      // Get existing item to merge metadata
      const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const existingItem = await prisma.inventory_items.findUnique({
        where: { id: itemId },
        select: { metadata: true }
      });

      const existingMetadata = (existingItem?.metadata as any) || {};
      const mergedMetadata = {
        ...existingMetadata,
        ...(incomingMetadata || {}),
        ...metadataFields,
      };

      updateData.metadata = mergedMetadata;
      console.log('[PUT /items/:id] Merged metadata:', JSON.stringify(mergedMetadata));
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    console.log('[PUT /items/:id] Final update data:', JSON.stringify(updateData));

    const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await prisma.inventory_items.update({
      where: { id: itemId },
      data: updateData,
    });

    if (!updated) {
      return res.status(400).json({ error: 'item_not_found' });
    }

    // Sync variants with parent item status
    if (updateData.item_status) {
      const newStatus = updateData.item_status;
      let variantStatus = true; // Default to active

      // Determine variant status based on item status
      if (newStatus === 'trashed' || newStatus === 'archived' || newStatus === 'inactive') {
        variantStatus = false;
      } else if (newStatus === 'active') {
        variantStatus = true;
      }

      // Update all variants to match parent status
      await prisma.product_variants.updateMany({
        where: {
          parent_item_id: itemId,
          tenant_id: updated.tenant_id
        },
        data: { is_active: variantStatus }
      });

      console.log(`[PUT /items/:id] Synced variants status for item ${itemId}: ${newStatus} -> variants ${variantStatus ? 'active' : 'inactive'}`);
    }

    // Process variants if they exist
    if (variantsData && Array.isArray(variantsData)) {
      const { generateVariantId, generateTenantVariantId, generateVariantSkuFromParent } = await import('../lib/id-generator');

      // Delete existing variants for this item
      await prisma.product_variants.deleteMany({
        where: { parent_item_id: itemId }
      });

      // Create new variants with auto-generated SKUs based on parent SKU pattern
      const variantPromises = variantsData.map(async (variant: any, index: number) => {
        // Generate SKU if not provided or empty, using parent item's SKU pattern
        let sku = variant.sku;
        if (!sku || sku.trim() === '') {
          sku = generateVariantSkuFromParent(updated.sku, index, updated.product_type as any);
        }

        return prisma.product_variants.create({
          data: {
            id: generateTenantVariantId(itemId, updated.tenant_id), // Unique variant ID
            parent_item_id: itemId,
            tenant_id: updated.tenant_id,
            sku: sku, // Variant SKU following parent SKU pattern
            variant_name: variant.variant_name || variant.name || `Variant ${index + 1}`, // Handle both field names
            price_cents: variant.price_cents || 0,
            sale_price_cents: variant.sale_price_cents || null,
            stock: variant.stock || 0,
            image_url: variant.image_url || null,
            attributes: variant.attributes || {},
            sort_order: variant.sort_order || index,
            is_active: variant.is_active !== false, // default to true
          }
        });
      });

      await Promise.all(variantPromises);
      console.log(`[PUT /items/:id] Created ${variantsData.length} variants for item ${itemId} with intelligent SKU generation`);
    }

    console.log('[PUT /items/:id] Database returned directory_category_id:', updated.directory_category_id);

    await audit({ tenantId: updated.tenant_id, actor: null, action: "inventory.update", payload: { id: updated.id } });

    // Convert Decimal price to number and hide price_cents for frontend compatibility
    const { price_cents, ...itemWithoutPriceCents } = updated;
    const metadataObj = (updated.metadata as any) || {};
    const transformed = {
      ...itemWithoutPriceCents,
      price: updated.price !== null && updated.price !== undefined ? Number(updated.price) : null,
      // sale_price_cents, payment_gateway_type, payment_gateway_id are direct columns
      sale_price_cents: updated.sale_price_cents || null,
      salePriceCents: updated.sale_price_cents || null,
      payment_gateway_type: updated.payment_gateway_type || null,
      payment_gateway_id: updated.payment_gateway_id || null,
      // Use direct columns first, fallback to metadata for backward compatibility
      tags: updated.tags || metadataObj.tags || [],
      seo_title: updated.seo_title || metadataObj.seo_title || null,
      seo_description: updated.seo_description || metadataObj.seo_description || null,
      enhanced_description: updated.enhanced_description || metadataObj.enhancedDescription || null,
      track_inventory: updated.track_inventory ?? metadataObj.track_inventory ?? true,
      allow_backorder: updated.allow_backorder ?? metadataObj.allow_backorder ?? false,
      low_stock_threshold: updated.low_stock_threshold || metadataObj.low_stock_threshold || 5,
      video_url: updated.video_url || metadataObj.videoUrl || null,
      videoUrl: updated.video_url || metadataObj.videoUrl || null, // Keep videoUrl for backward compatibility
    };

    console.log('[PUT /items/:id] Sending to frontend directory_category_id:', transformed.directory_category_id);

    res.json(transformed);
  } catch (error) {
    logger.error('[PUT /items/:id] Error updating item:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_item", details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Soft delete - move item to trash (with capacity check)
router.delete(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    // Get item to find tenant
    const item = await prisma.inventory_items.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(400).json({ error: "item_not_found" });
    }

    // Get tenant to check tier
    const tenant = await prisma.tenants.findUnique({ where: { id: item.tenant_id } });
    if (!tenant) {
      return res.status(400).json({ error: "tenant_not_found" });
    }

    // Check trash capacity
    const { isTrashFull, getTrashCapacity } = await import('../utils/trash-capacity');
    const trashCount = await prisma.inventory_items.count({
      where: { tenant_id: item.tenant_id, item_status: 'trashed' }
    });

    if (isTrashFull(trashCount, tenant.subscription_tier || 'starter')) {
      const capacity = getTrashCapacity(tenant.subscription_tier || 'starter');
      return res.status(400).json({
        error: "trash_capacity_exceeded",
        message: `Trash bin is full (${trashCount}/${capacity} items). Please purge some items before deleting more.`,
        current: trashCount,
        capacity,
      });
    }

    // Move to trash
    const updated = await prisma.inventory_items.update({
      where: { id: req.params.id },
      data: { item_status: 'trashed' }
    });

    // Fire-and-forget: delete from GMC if item was previously synced
    if (item.sync_status === 'success' || item.sync_status === 'error') {
      import('../services/GMCProductSync').then(({ deleteProduct }) => {
        deleteProduct(item.tenant_id, req.params.id)
          .then((result: any) => {
            console.log(`[Delete Item] GMC deletion for ${req.params.id}: ${result.success ? 'success' : 'failed - ' + result.error}`);
          })
          .catch((err: any) => console.error(`[Delete Item] GMC deletion error for ${req.params.id}:`, err));
      }).catch((err: any) => console.error('[Delete Item] Failed to load GMCProductSync:', err));
    }

    // Sync variants with parent item status
    if (updated.item_status === 'trashed') {
      // Deactivate all variants when item is trashed
      await prisma.product_variants.updateMany({
        where: {
          parent_item_id: req.params.id,
          tenant_id: item.tenant_id
        },
        data: { is_active: false }
      });

      console.log(`[Delete Item] Deactivated ${updated.item_status ? updated.item_status : 'trashed'} item variants:`, req.params.id);
    }

    res.json(updated);
  } catch (error) {
    logger.error('[Delete Item] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_trash_item" });
  }
});

// Get trash capacity info
router.get(["/api/trash/capacity", "/trash/capacity"], authenticateToken, async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;

    console.log('2322 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    // Get tenant to check tier
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(400).json({ error: "tenant_not_found" });
    }

    // Get trash count and capacity info
    const { getTrashCapacityInfo } = await import('../utils/trash-capacity');
    const trashCount = await prisma.inventory_items.count({
      where: { tenant_id: tenant_id, item_status: 'trashed' }
    });

    const capacityInfo = getTrashCapacityInfo(trashCount, tenant.subscription_tier || 'starter');
    res.json(capacityInfo);
  } catch (error) {
    logger.error('[Trash Capacity] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_trash_capacity" });
  }
});

// Restore from trash
router.patch(["/api/items/:id/restore", "/items/:id/restore"], authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const item = await prisma.inventory_items.update({
      where: { id: req.params.id },
      data: { item_status: 'active' }
    });

    // Reactivate variants when item is restored
    if (item.item_status === 'active') {
      // Reactivate all variants when item is restored
      await prisma.product_variants.updateMany({
        where: {
          parent_item_id: req.params.id,
          tenant_id: item.tenant_id
        },
        data: { is_active: true }
      });

      console.log(`[Restore Item] Reactivated ${item.item_status} item variants:`, req.params.id);
    }

    res.json(item);
  } catch {
    res.status(500).json({ error: "failed_to_restore_item" });
  }
});

// Permanent delete (purge) - only works on trashed items
router.delete(["/api/items/:id/purge", "/items/:id/purge"], authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    // First check if item is trashed
    const item = await prisma.inventory_items.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(400).json({ error: "item_not_found" });
    }
    if (item.item_status !== 'trashed') {
      return res.status(400).json({ error: "item_not_in_trash", message: "Item must be in trash before it can be permanently deleted" });
    }

    // Permanently delete
    await prisma.inventory_items.delete({ where: { id: req.params.id } });

    // Fire-and-forget: delete from GMC if item was previously synced
    if (item.sync_status === 'success' || item.sync_status === 'error' || (item.sync_status as string) === 'permanent_error') {
      import('../services/GMCProductSync').then(({ deleteProduct }) => {
        deleteProduct(item.tenant_id, req.params.id)
          .then((result: any) => {
            console.log(`[Purge Item] GMC deletion for ${req.params.id}: ${result.success ? 'success' : 'failed - ' + result.error}`);
          })
          .catch((err: any) => console.error(`[Purge Item] GMC deletion error for ${req.params.id}:`, err));
      }).catch((err: any) => console.error('[Purge Item] Failed to load GMCProductSync:', err));
    }

    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_purge_item" });
  }
});

// Category assignment endpoint
const categoryAssignmentSchema = z.object({
  categorySlug: z.string().min(1),
});
router.patch("/api/v1/tenants/:tenant_id/items/:itemId/category", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenant_id, itemId } = req.params;
    const parsed = categoryAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const updated = await categoryService.assignItemCategory(tenant_id, itemId, {
      categorySlug: parsed.data.categorySlug,
    });

    // Convert Decimal price to number and hide price_cents for frontend compatibility
    if (!updated) {
      return res.status(400).json({ error: 'item_not_found' });
    }

    const { price_cents, ...itemWithoutPriceCents } = updated;
    const transformed = {
      ...itemWithoutPriceCents,
      price: updated.price !== null && updated.price !== undefined ? Number(updated.price) : null,
    };

    res.json(transformed);
  } catch (error: any) {
    logger.error('[PATCH /api/v1/tenants/:tenant_id/items/:itemId/category] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(error.statusCode || 500).json({ error: error.message || "failed_to_assign_category" });
  }
});

// Update item status (for Google sync control)
router.patch(["/items/:id", "/inventory/:id"], authenticateToken, async (req, res) => {
  try {
    const { item_status, visibility, availability } = req.body;
    const updateData: any = {};

    if (item_status) updateData.item_status = item_status;
    if (visibility) updateData.visibility = visibility;
    if (availability) updateData.availability = availability;

    const updated = await prisma.inventory_items.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Convert Decimal price to number and hide price_cents for frontend compatibility
    const { price_cents, ...itemWithoutPriceCents } = updated;
    const transformed = {
      ...itemWithoutPriceCents,
      price: updated.price !== null && updated.price !== undefined ? Number(updated.price) : null,
    };

    res.json(transformed);
  } catch (error) {
    logger.error('[PATCH Item] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_item" });
  }
});

// Sync availability status for all items (fix out-of-sync items)
router.post("/items/sync-availability", authenticateToken, async (req, res) => {
  try {
    const tenant_id = req.body.tenant_id as string;
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_required" });
    }

    // Get all items for the tenant
    const items = await prisma.inventory_items.findMany({
      where: { tenant_id },
      select: { id: true, stock: true, availability: true },
    });

    // Find items that are out of sync
    const outOfSync = items.filter(item => {
      const expectedAvailability = item.stock > 0 ? 'in_stock' : 'out_of_stock';
      return item.availability !== expectedAvailability;
    });

    // Update out-of-sync items
    const updates = await Promise.all(
      outOfSync.map(item =>
        prisma.inventory_items.update({
          where: { id: item.id },
          data: { availability: item.stock > 0 ? 'in_stock' : 'out_of_stock' },
        })
      )
    );

    res.json({
      success: true,
      total: items.length,
      synced: updates.length,
      message: `Synced ${updates.length} out of ${items.length} items`,
    });
  } catch (error) {
    logger.error('[Sync Availability] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_sync_availability" });
  }
});

export default router;