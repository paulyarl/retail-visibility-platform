import express from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./prisma";
import { z } from "zod";

// Debug: Log DATABASE_URL to verify it's correct
// Migration fix applied: 20251024093000_add_photo_asset_fields marked as rolled back
console.log('[DEBUG] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
import fs from "fs";
import path from "path";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { setRequestContext } from "./context";
import { audit } from "./audit";
import { dailyRatesJob } from "./jobs/rates";
import {
  getAuthorizationUrl,
  decodeState,
  exchangeCodeForTokens,
  getUserInfo,
  encryptToken,
  decryptToken,
  refreshAccessToken,
  revokeToken,
  GOOGLE_SCOPES,
} from "./lib/google/oauth";
import {
  listMerchantAccounts,
  getMerchantAccount,
  listProducts,
  getProduct,
  syncMerchantAccount,
  getProductStats,
} from "./lib/google/gmc";
import {
  listBusinessAccounts,
  listLocations,
  getLocation,
  syncLocation,
  getLocationInsights,
  getAggregatedInsights,
} from "./lib/google/gbp";

// v3.5 imports
import auditRoutes from './routes/audit';
import policyRoutes from './routes/policy';
import billingRoutes from './routes/billing';
import subscriptionRoutes from './routes/subscriptions';
import categoryRoutes from './routes/categories';

// Authentication
import authRoutes from './auth/auth.routes';
import performanceRoutes from './routes/performance';
import platformSettingsRoutes from './routes/platform-settings';
import organizationRoutes from './routes/organizations';
import upgradeRequestsRoutes from './routes/upgrade-requests';
import { auditLogger } from './middleware/audit-logger';
import { requireActiveSubscription, checkSubscriptionLimits } from './middleware/subscription';
import { enforcePolicyCompliance } from './middleware/policy-enforcement';

const app = express();

/* ------------------------- middleware ------------------------- */
app.use(cors({ origin: [/localhost:\d+$/, /\.vercel\.app$/], credentials: false }));
app.use(express.json({ limit: "50mb" })); // keep large to support base64 in dev
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(setRequestContext);

console.log("✓ Express configured with 50mb body limit");

/* -------------------- static uploads (filesystem for MVP) -------------------- */
const DEV = process.env.NODE_ENV !== "production";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
// Create upload directory in both dev and production for MVP
if (!fs.existsSync(UPLOAD_DIR)) {
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
}
// Serve uploads statically in both dev and production for MVP
app.use("/uploads", express.static(UPLOAD_DIR));

/* ----------------------------- health ----------------------------- */
app.get("/health", (_req, res) => res.json({ status: "ok" }));

/* ------------------------------ TENANTS ------------------------------ */
app.get("/tenants", async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ 
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    res.json(tenants);
  } catch (_e) {
    res.status(500).json({ error: "failed_to_list_tenants" });
  }
});

app.get("/tenants/:id", async (req, res) => {
  try {
    let tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });
    
    // Check if trial has expired and auto-convert to starter
    const now = new Date();
    if (
      tenant.subscriptionStatus === "trial" &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < now
    ) {
      console.log(`[GET /tenants/:id] Trial expired for tenant ${tenant.id}. Auto-converting to starter plan.`);
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionTier: "starter",
          subscriptionStatus: "active",
          subscriptionEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`[GET /tenants/:id] Tenant ${tenant.id} successfully converted to starter plan.`);
    }
    
    res.json(tenant);
  } catch (_e) {
    res.status(500).json({ error: "failed_to_get_tenant" });
  }
});

const createTenantSchema = z.object({ name: z.string().min(1) });
app.post("/tenants", async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const tenant = await prisma.tenant.create({ data: { name: parsed.data.name } });
    await audit({ tenantId: tenant.id, actor: null, action: "tenant.create", payload: { name: parsed.data.name } });
    res.status(201).json(tenant);
  } catch {
    res.status(500).json({ error: "failed_to_create_tenant" });
  }
});

const updateTenantSchema = z.object({ name: z.string().min(1) });
app.put("/tenants/:id", async (req, res) => {
  const parsed = updateTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
    res.json(tenant);
  } catch {
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

// PATCH /tenants/:id - Update tenant subscription tier (admin only)
const patchTenantSchema = z.object({
  subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled']).optional(),
});
app.patch("/tenants/:id", async (req, res) => {
  const parsed = patchTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const tenant = await prisma.tenant.update({ 
      where: { id: req.params.id }, 
      data: parsed.data 
    });
    res.json(tenant);
  } catch (e: any) {
    console.error('[PATCH /tenants/:id] Error:', e);
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

app.delete("/tenants/:id", async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_delete_tenant" });
  }
});

// Tenant profile (business information)
const tenantProfileSchema = z.object({
  tenant_id: z.string().min(1),
  business_name: z.string().min(1).optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  contact_person: z.string().optional(),
});

app.post("/tenant/profile", async (req, res) => {
  const parsed = tenantProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  
  try {
    const { tenant_id, ...profileData } = parsed.data;
    
    // Update tenant with business profile data
    const tenant = await prisma.tenant.update({
      where: { id: tenant_id },
      data: {
        name: profileData.business_name || undefined,
        // Store additional profile data in metadata JSON field
        metadata: profileData as any,
      },
    });
    
    res.json(tenant);
  } catch (e: any) {
    console.error("Failed to save tenant profile:", e);
    res.status(500).json({ error: "failed_to_save_profile" });
  }
});

// Tenant logo upload endpoint (must be defined before multer middleware below)
const logoUploadMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit for logos

const logoDataUrlSchema = z.object({
  tenant_id: z.string().min(1),
  dataUrl: z.string().min(1),
  contentType: z.string().min(1),
});

app.post("/tenant/:id/logo", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenantId = req.params.id;
    console.log(`[Logo Upload] Starting upload for tenant ${tenantId}`, {
      hasFile: !!req.file,
      contentType: req.get('content-type'),
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.log(`[Logo Upload] Tenant not found: ${tenantId}`);
      return res.status(404).json({ error: "tenant_not_found" });
    }

    // Initialize Supabase client (will be initialized below in photos section)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseLogo = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    if (!supabaseLogo) {
      return res.status(500).json({ error: "supabase_not_configured" });
    }

    let publicUrl: string;
    const TENANT_BUCKET_NAME = process.env.TENANT_BUCKET_NAME || "photos"; // Default to photos bucket if not specified

    // A) multipart/form-data "file" upload
    if (req.file) {
      const f = req.file as Express.Multer.File;
      const ext = f.mimetype.includes("png") ? ".png" : f.mimetype.includes("webp") ? ".webp" : ".jpg";
      const pathKey = `tenants/${tenantId}/logo-${Date.now()}${ext}`;
      
      console.log(`[Logo Upload] Uploading to Supabase:`, { 
        bucket: TENANT_BUCKET_NAME,
        pathKey, 
        size: f.size, 
        mimetype: f.mimetype 
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET_NAME)
        .upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });

      if (error) {
        console.error(`[Logo Upload] Supabase upload error:`, error);
        return res.status(500).json({ error: error.message, details: error });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET_NAME).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Logo Upload] Supabase upload successful:`, { publicUrl });
    }
    // B) JSON { dataUrl } upload
    else if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      console.log(`[Logo Upload] Processing dataUrl upload`);
      const parsed = logoDataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        console.error(`[Logo Upload] Invalid dataUrl payload:`, parsed.error.flatten());
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      }

      const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
      if (!match) return res.status(400).json({ error: "invalid_data_url" });
      
      const buf = Buffer.from(match[1], "base64");
      
      // Enforce 5MB limit for logos
      if (buf.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: "logo_too_large", maxSizeMB: 5 });
      }

      const ext = parsed.data.contentType.includes("png")
        ? ".png"
        : parsed.data.contentType.includes("webp")
        ? ".webp"
        : ".jpg";
      
      const pathKey = `tenants/${tenantId}/logo-${Date.now()}${ext}`;
      console.log(`[Logo Upload] Uploading dataUrl to Supabase:`, { 
        bucket: TENANT_BUCKET_NAME,
        pathKey, 
        size: buf.length, 
        contentType: parsed.data.contentType 
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET_NAME)
        .upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

      if (error) {
        console.error("[Logo Upload] Supabase dataUrl upload error:", error);
        return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET_NAME).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Logo Upload] Supabase dataUrl upload successful:`, { publicUrl });
    } else {
      return res.status(400).json({ error: "unsupported_payload" });
    }

    // Update tenant metadata with logo URL
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...(tenant.metadata as any || {}),
          logo_url: publicUrl,
        },
      },
    });

    return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
  } catch (e: any) {
    console.error("[Logo Upload Error] Full error details:", {
      message: e?.message,
      stack: e?.stack,
      tenantId: req.params.id,
    });
    return res.status(500).json({ 
      error: "failed_to_upload_logo",
      details: DEV ? e?.message : undefined 
    });
  }
});

/* ----------------------------- PHOTOS (MOUNTED BEFORE /items) ----------------------------- */
/** Accept JSON { url } (already uploaded), JSON { dataUrl } (dev), or multipart "file" (server uploads to Supabase or dev FS) */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const jsonUrlSchema = z.object({
  tenantId: z.string().min(1).optional(), // optional—can be derived from item
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().nonnegative().optional(),
  contentType: z.string().optional(),
  exifRemoved: z.boolean().optional(),
});

const dataUrlSchema = z.object({
  tenantId: z.string().min(1),
  dataUrl: z.string().min(1),
  contentType: z.string().min(1),
});

// Supabase (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

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
    
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) {
      console.log(`[Photo Upload] Item not found: ${itemId}`);
      return res.status(404).json({ error: "item_not_found" });
    }
    console.log(`[Photo Upload] Item found:`, { id: item.id, tenantId: item.tenantId, sku: item.sku });

    // A) JSON { url, ... } → register the asset
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.url === "string") {
      const parsed = jsonUrlSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      const { url, width, height, bytes, contentType, exifRemoved } = parsed.data;

      const created = await prisma.photoAsset.create({
        data: {
          tenantId: item.tenantId,
          inventoryItemId: item.id,
          url,
          width: width ?? null,
          height: height ?? null,
          bytes: bytes ?? null,
          contentType: contentType ?? null,
          exifRemoved: exifRemoved ?? true,
        },
      });

      // Always update the item's imageUrl to the latest uploaded photo
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: url } });
      return res.status(201).json(created);
    }

    // B) multipart/form-data "file" → Supabase (if configured) or local FS in dev
    if (req.file) {
      const f = req.file as Express.Multer.File;
      let publicUrl: string | null = null;

      if (supabase) {
        const pathKey = `${item.tenantId}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;
        console.log(`[Photo Upload] Uploading to Supabase:`, { pathKey, size: f.size, mimetype: f.mimetype });
        
        const { error, data } = await supabase.storage.from("photos").upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });
        
        if (error) {
          console.error(`[Photo Upload] Supabase upload error:`, error);
          return res.status(500).json({ error: error.message, details: error });
        }
        
        publicUrl = supabase.storage.from("photos").getPublicUrl(data.path).data.publicUrl;
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

      const created = await prisma.photoAsset.create({
        data: {
          tenantId: item.tenantId,
          inventoryItemId: item.id,
          url: publicUrl!,
          contentType: f.mimetype,
          bytes: f.size,
          exifRemoved: true,
        },
      });

      // Always update the item's imageUrl to the latest uploaded photo
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: publicUrl! } });
      return res.status(201).json(created);
    }

    // C) JSON { dataUrl, contentType } → Supabase Storage or filesystem fallback (enforce <1MB)
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      console.log(`[Photo Upload] Processing dataUrl upload`);
      const parsed = dataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        console.error(`[Photo Upload] Invalid dataUrl payload:`, parsed.error.flatten());
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
        const pathKey = `${item.tenantId}/${item.sku || item.id}/${Date.now()}${ext}`;
        console.log(`[Photo Upload] Uploading dataUrl to Supabase:`, { pathKey, size: buf.length, contentType: parsed.data.contentType });
        
        const { error, data } = await supabase.storage.from("photos").upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });
        
        if (error) {
          console.error("[Photo Upload] Supabase dataUrl upload error:", error);
          return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
        }
        
        publicUrl = supabase.storage.from("photos").getPublicUrl(data.path).data.publicUrl;
        console.log(`[Photo Upload] Supabase dataUrl upload successful:`, { publicUrl });
      } else {
        // Fallback to filesystem
        const filename = `${itemId}-${Date.now()}${ext}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        publicUrl = `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
      }

      const created = await prisma.photoAsset.create({
        data: {
          tenantId: item.tenantId,
          inventoryItemId: item.id,
          url: publicUrl,
          contentType: parsed.data.contentType,
          bytes: buf.length,
          exifRemoved: true,
        },
      });

      // Always update the item's imageUrl to the latest uploaded photo
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: publicUrl } });
      return res.status(201).json(created);
    }

    return res.status(400).json({ error: "unsupported_payload" });
  } catch (e: any) {
    if (e?.code === "IMAGE_TOO_LARGE") {
      return res.status(413).json({ error: "image_too_large", bytesKB: e.bytes });
    }
    console.error("[Photo Upload Error] Full error details:", {
      message: e?.message,
      stack: e?.stack,
      code: e?.code,
      name: e?.name,
      itemId: req.params.id,
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.get('content-type')
    });
    return res.status(500).json({ 
      error: "failed_to_upload_photo",
      details: DEV ? e?.message : undefined 
    });
  }
};

// Mount explicitly (no array form)
console.log("🔧 Registering photo upload routes...");
app.post("/items/:id/photos", upload.single("file"), photoUploadHandler);
app.post("/inventory/:id/photos", upload.single("file"), photoUploadHandler);
console.log("✓ Photo upload routes registered");



// List photos for an item
app.get(["/items/:id/photos", "/inventory/:id/photos"], async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "item_not_found" });
  const photos = await prisma.photoAsset.findMany({
    where: { inventoryItemId: item.id },
    orderBy: { capturedAt: "desc" },
  });
  res.json(photos);
});

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
  tenantId: z.string().min(1),
  count: z.string().optional() // Add count parameter for optimization
});

app.get(["/items", "/inventory"], async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "tenant_required" });
  try {
    // If count=true, return only the count for performance
    if (req.query.count === 'true') {
      const count = await prisma.inventoryItem.count({
        where: { tenantId: parsed.data.tenantId },
      });
      return res.json({ count });
    }
    
    // Otherwise return full items list
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: parsed.data.tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(items);
  } catch (e: any) {
    console.error('[GET /items] Error listing items:', e);
    res.status(500).json({ error: "failed_to_list_items", message: e?.message });
  }
});

app.get(["/items/:id", "/inventory/:id"], async (req, res) => {
  const it = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
  if (!it) return res.status(404).json({ error: "not_found" });
  res.json(it);
});

const createItemSchema = z.object({
  tenantId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().url().nullable().optional(),
  metadata: z.any().optional(),
  description: z.string().optional(),
  // v3.4 SWIS fields (required by schema)
  title: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  manufacturer: z.string().optional(),
  price: z.union([z.number(), z.string().transform(Number)]).pipe(z.number().nonnegative()).optional(),
  currency: z.string().length(3).optional(),
});

app.post(["/items", "/inventory"], checkSubscriptionLimits, enforcePolicyCompliance, async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    // Auto-populate SWIS fields from legacy fields if not provided
    const data = {
      ...parsed.data,
      title: parsed.data.title || parsed.data.name,
      brand: parsed.data.brand || 'Unknown',
      price: parsed.data.price ?? parsed.data.priceCents / 100,
      currency: parsed.data.currency || 'USD',
    };
    const created = await prisma.inventoryItem.create({ data });
    await audit({ tenantId: created.tenantId, actor: null, action: "inventory.create", payload: { id: created.id, sku: created.sku } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "duplicate_sku" });
    console.error('[POST /items] Error creating item:', e);
    res.status(500).json({ error: "failed_to_create_item", message: e?.message });
  }
});

const updateItemSchema = createItemSchema.partial().extend({ tenantId: z.string().min(1).optional() });
app.put(["/items/:id", "/inventory/:id"], enforcePolicyCompliance, async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    console.error('[PUT /items/:id] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  try {
    const updated = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: parsed.data });
    await audit({ tenantId: updated.tenantId, actor: null, action: "inventory.update", payload: { id: updated.id } });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "failed_to_update_item" });
  }
});

app.delete(["/items/:id", "/inventory/:id"], async (req, res) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_delete_item" });
  }
});

// Update item status (for Google sync control)
app.patch(["/items/:id", "/inventory/:id"], async (req, res) => {
  try {
    const { itemStatus, visibility, availability } = req.body;
    const updateData: any = {};
    
    if (itemStatus) updateData.itemStatus = itemStatus;
    if (visibility) updateData.visibility = visibility;
    if (availability) updateData.availability = availability;
    
    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: updateData,
    });
    
    res.json(updated);
  } catch (error) {
    console.error('[PATCH Item] Error:', error);
    res.status(500).json({ error: "failed_to_update_item" });
  }
});

// Get Google product feed (filtered by status)
app.get("/google/feed", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_required" });
    }

    const { generateProductFeed, getFeedStats } = await import('./lib/google/feed-generator');
    const [feed, stats] = await Promise.all([
      generateProductFeed(tenantId),
      getFeedStats(tenantId),
    ]);

    res.json({ feed, stats });
  } catch (error) {
    console.error('[Google Feed] Error:', error);
    res.status(500).json({ error: "failed_to_generate_feed" });
  }
});

app.get("/__routes", (_req, res) => {
  const out: any[] = [];
  (app as any)._router?.stack?.forEach((r: any) => {
    if (r.route?.path && r.route?.methods) {
      out.push({ methods: Object.keys(r.route.methods).map(m => m.toUpperCase()), path: r.route.path });
    }
  });
  res.json(out);
});
app.get("/__ping", (req, res) => {
  console.log("PING from", req.ip, "at", new Date().toISOString());
  res.json({ ok: true, when: new Date().toISOString() });
});

/* ------------------------------ GOOGLE OAUTH ------------------------------ */
// ENH-2026-043 + ENH-2026-044: Google Connect Suite

/**
 * Initiate OAuth flow
 * GET /google/auth?tenantId=xxx
 */
app.get("/google/auth", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    // Validate NAP (Name, Address, Phone) is complete
    const metadata = tenant.metadata as any;
    if (!metadata?.business_name || !metadata?.city || !metadata?.state) {
      return res.status(400).json({ 
        error: "incomplete_business_profile",
        message: "Please complete your business profile before connecting to Google",
      });
    }

    const authUrl = getAuthorizationUrl(tenantId);
    res.json({ authUrl });
  } catch (error) {
    console.error("[Google OAuth] Auth initiation error:", error);
    res.status(500).json({ error: "oauth_init_failed" });
  }
});

/**
 * OAuth callback handler
 * GET /google/callback?code=xxx&state=xxx
 */
app.get("/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error("[Google OAuth] Authorization error:", error);
      return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/settings/tenant?google_error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: "missing_code_or_state" });
    }

    // Decode and validate state
    const stateData = decodeState(state as string);
    if (!stateData) {
      return res.status(400).json({ error: "invalid_state" });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code as string);
    if (!tokens) {
      return res.status(500).json({ error: "token_exchange_failed" });
    }

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo) {
      return res.status(500).json({ error: "user_info_failed" });
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

    // Store in database (upsert pattern)
    const account = await prisma.googleOAuthAccount.upsert({
      where: {
        tenantId_googleAccountId: {
          tenantId: stateData.tenantId,
          googleAccountId: userInfo.id,
        },
      },
      create: {
        tenantId: stateData.tenantId,
        googleAccountId: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.name,
        profilePictureUrl: userInfo.picture,
        scopes: tokens.scope.split(' '),
        tokens: {
          create: {
            accessTokenEncrypted,
            refreshTokenEncrypted,
            tokenType: tokens.token_type,
            expiresAt,
            scopes: tokens.scope.split(' '),
          },
        },
      },
      update: {
        email: userInfo.email,
        displayName: userInfo.name,
        profilePictureUrl: userInfo.picture,
        scopes: tokens.scope.split(' '),
        tokens: {
          upsert: {
            create: {
              accessTokenEncrypted,
              refreshTokenEncrypted,
              tokenType: tokens.token_type,
              expiresAt,
              scopes: tokens.scope.split(' '),
            },
            update: {
              accessTokenEncrypted,
              refreshTokenEncrypted,
              expiresAt,
              scopes: tokens.scope.split(' '),
            },
          },
        },
      },
      include: {
        tokens: true,
      },
    });

    console.log("[Google OAuth] Account connected:", account.email);

    // Redirect back to frontend
    res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/settings/tenant?google_connected=true`);
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/settings/tenant?google_error=callback_failed`);
  }
});

/**
 * Get Google account status for tenant
 * GET /google/status?tenantId=xxx
 */
app.get("/google/status", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
      include: {
        tokens: true,
        merchantLinks: true,
        gbpLocations: true,
      },
    });

    if (!account) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: account.email,
      displayName: account.displayName,
      profilePictureUrl: account.profilePictureUrl,
      scopes: account.scopes,
      merchantLinks: account.merchantLinks.length,
      gbpLocations: account.gbpLocations.length,
    });
  } catch (error) {
    console.error("[Google OAuth] Status check error:", error);
    res.status(500).json({ error: "status_check_failed" });
  }
});

/**
 * Disconnect Google account
 * DELETE /google/disconnect?tenantId=xxx
 */
app.delete("/google/disconnect", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
      include: { tokens: true },
    });

    if (!account) {
      return res.status(404).json({ error: "account_not_found" });
    }

    // Revoke tokens with Google
    if (account.tokens) {
      const accessToken = decryptToken(account.tokens.accessTokenEncrypted);
      await revokeToken(accessToken);
    }

    // Delete from database (cascade will delete tokens, links, locations)
    await prisma.googleOAuthAccount.delete({
      where: { id: account.id },
    });

    console.log("[Google OAuth] Account disconnected:", account.email);
    res.json({ success: true });
  } catch (error) {
    console.error("[Google OAuth] Disconnect error:", error);
    res.status(500).json({ error: "disconnect_failed" });
  }
});

/* ------------------------------ GOOGLE MERCHANT CENTER ------------------------------ */

/**
 * List merchant accounts
 * GET /google/gmc/accounts?tenantId=xxx
 */
app.get("/google/gmc/accounts", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    const merchants = await listMerchantAccounts(account.id);
    res.json({ merchants });
  } catch (error) {
    console.error("[GMC] List accounts error:", error);
    res.status(500).json({ error: "failed_to_list_merchants" });
  }
});

/**
 * Sync merchant account
 * POST /google/gmc/sync
 */
app.post("/google/gmc/sync", async (req, res) => {
  try {
    const { tenantId, merchantId } = req.body;
    
    if (!tenantId || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    const success = await syncMerchantAccount(account.id, merchantId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "sync_failed" });
    }
  } catch (error) {
    console.error("[GMC] Sync error:", error);
    res.status(500).json({ error: "sync_failed" });
  }
});

/**
 * Get merchant products
 * GET /google/gmc/products?tenantId=xxx&merchantId=xxx
 */
app.get("/google/gmc/products", async (req, res) => {
  try {
    const { tenantId, merchantId } = req.query;
    
    if (!tenantId || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId: tenantId as string },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    const products = await listProducts(account.id, merchantId as string);
    res.json({ products });
  } catch (error) {
    console.error("[GMC] List products error:", error);
    res.status(500).json({ error: "failed_to_list_products" });
  }
});

/**
 * Get product stats
 * GET /google/gmc/stats?tenantId=xxx&merchantId=xxx
 */
app.get("/google/gmc/stats", async (req, res) => {
  try {
    const { tenantId, merchantId } = req.query;
    
    if (!tenantId || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId: tenantId as string },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    const stats = await getProductStats(account.id, merchantId as string);
    res.json({ stats });
  } catch (error) {
    console.error("[GMC] Get stats error:", error);
    res.status(500).json({ error: "failed_to_get_stats" });
  }
});

/* ------------------------------ GOOGLE BUSINESS PROFILE ------------------------------ */

/**
 * List business locations
 * GET /google/gbp/locations?tenantId=xxx
 */
app.get("/google/gbp/locations", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    // First get business accounts
    const businessAccounts = await listBusinessAccounts(account.id);
    
    if (businessAccounts.length === 0) {
      return res.json({ locations: [] });
    }

    // Get locations for first business account
    const locations = await listLocations(account.id, businessAccounts[0].name);
    res.json({ locations });
  } catch (error) {
    console.error("[GBP] List locations error:", error);
    res.status(500).json({ error: "failed_to_list_locations" });
  }
});

/**
 * Sync location
 * POST /google/gbp/sync
 */
app.post("/google/gbp/sync", async (req, res) => {
  try {
    const { tenantId, locationName } = req.body;
    
    if (!tenantId || !locationName) {
      return res.status(400).json({ error: "tenant_id_and_location_name_required" });
    }

    const account = await prisma.googleOAuthAccount.findFirst({
      where: { tenantId },
    });

    if (!account) {
      return res.status(404).json({ error: "google_account_not_found" });
    }

    const locationData = await getLocation(account.id, locationName);
    
    if (!locationData) {
      return res.status(404).json({ error: "location_not_found" });
    }

    const success = await syncLocation(account.id, locationData);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "sync_failed" });
    }
  } catch (error) {
    console.error("[GBP] Sync error:", error);
    res.status(500).json({ error: "sync_failed" });
  }
});

/**
 * Get location insights
 * GET /google/gbp/insights?locationId=xxx&days=30
 */
app.get("/google/gbp/insights", async (req, res) => {
  try {
    const { locationId, days } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ error: "location_id_required" });
    }

    const daysNum = days ? parseInt(days as string) : 30;
    const insights = await getAggregatedInsights(locationId as string, daysNum);
    
    res.json({ insights });
  } catch (error) {
    console.error("[GBP] Get insights error:", error);
    res.status(500).json({ error: "failed_to_get_insights" });
  }
});

/* ------------------------------ EMAIL CONFIGURATION ------------------------------ */
/**
 * Get all email configurations
 * GET /admin/email-config
 */
app.get("/admin/email-config", async (_req, res) => {
  try {
    const configs = await prisma.emailConfiguration.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(configs);
  } catch (error) {
    console.error('[GET /admin/email-config] Error:', error);
    res.status(500).json({ error: "failed_to_get_email_config" });
  }
});

/**
 * Update email configurations (bulk update)
 * PUT /admin/email-config
 * Body: { configs: [{ category: string, email: string }] }
 */
app.put("/admin/email-config", async (req, res) => {
  try {
    const schema = z.object({
      configs: z.array(z.object({
        category: z.string(),
        email: z.string().email()
      }))
    });

    const { configs } = schema.parse(req.body);

    // Upsert each configuration
    const results = await Promise.all(
      configs.map(config =>
        prisma.emailConfiguration.upsert({
          where: { category: config.category },
          update: { 
            email: config.email,
            updatedAt: new Date()
          },
          create: {
            category: config.category,
            email: config.email
          }
        })
      )
    );

    res.json({ success: true, configs: results });
  } catch (error) {
    console.error('[PUT /admin/email-config] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "invalid_request", details: error.issues });
    }
    res.status(500).json({ error: "failed_to_update_email_config" });
  }
});

/* ------------------------------ AUTHENTICATION ------------------------------ */
// Mount auth routes (no authentication required for these endpoints)
app.use('/auth', authRoutes);

/* ------------------------------ v3.5 AUDIT & BILLING APIs ------------------------------ */
// Apply audit middleware globally (logs all write operations)
app.use(auditLogger);

// Mount v3.5 routes
app.use(auditRoutes);
app.use(policyRoutes);
app.use(billingRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/categories', categoryRoutes);
app.use('/performance', performanceRoutes);
app.use('/organizations', organizationRoutes);
app.use('/upgrade-requests', upgradeRequestsRoutes);
app.use(platformSettingsRoutes);

/* ------------------------------ jobs ------------------------------ */
app.post("/jobs/rates/daily", dailyRatesJob);

/* ------------------------------ boot ------------------------------ */
const port = Number(process.env.PORT || process.env.API_PORT || 4000);

// Only start the server when not running tests
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`\n✅ API server running → http://localhost:${port}/health`);
    console.log(`📋 View all routes → http://localhost:${port}/__routes\n`);
  });
}

// Export the app for testing
export { app };
