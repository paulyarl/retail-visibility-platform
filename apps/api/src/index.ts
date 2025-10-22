import express from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./prisma";
import { z } from "zod";
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
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
    res.json(tenants);
  } catch (_e) {
    res.status(500).json({ error: "failed_to_list_tenants" });
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
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: "item_not_found" });

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
        const { error, data } = await supabase.storage.from("photos").upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });
        if (error) return res.status(500).json({ error: error.message });
        publicUrl = supabase.storage.from("photos").getPublicUrl(data.path).data.publicUrl;
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
      const parsed = dataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

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
        const { error, data } = await supabase.storage.from("photos").upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });
        if (error) {
          console.error("Supabase upload error:", error);
          return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
        }
        publicUrl = supabase.storage.from("photos").getPublicUrl(data.path).data.publicUrl;
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
    console.error("upload_error", e);
    return res.status(500).json({ error: "failed_to_upload_photo" });
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
const listQuery = z.object({ tenantId: z.string().min(1) });

app.get(["/items", "/inventory"], async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "tenant_required" });
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: parsed.data.tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: "failed_to_list_items" });
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
  imageUrl: z.string().url().optional(),
  metadata: z.any().optional(),
});

app.post(["/items", "/inventory"], async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const created = await prisma.inventoryItem.create({ data: parsed.data });
    await audit({ tenantId: created.tenantId, actor: null, action: "inventory.create", payload: { id: created.id, sku: created.sku } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "duplicate_sku" });
    res.status(500).json({ error: "failed_to_create_item" });
  }
});

const updateItemSchema = createItemSchema.partial().extend({ tenantId: z.string().min(1).optional() });
app.put(["/items/:id", "/inventory/:id"], async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
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
