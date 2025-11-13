import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Fix for Supabase SSL certificate issues in production
// This allows Node.js to accept Supabase's SSL certificates
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('⚠️  SSL certificate validation disabled for Supabase compatibility');
}
import { Pool } from 'pg';
import { prisma } from "./prisma";
import { z } from "zod";
import { setCsrfCookie, csrfProtect } from "./middleware/csrf";

// Debug: Log DATABASE_URL to verify it's correct
// Migration fix applied: ProductCondition enum renamed 'new' to 'brand_new'
// Force rebuild v3: Railway build cache bypass
console.log('[DEBUG] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
import fs from "fs";
import path from "path";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { Flags } from "./config";
import { setRequestContext } from "./context";
import { StorageBuckets } from "./storage-config";
import { audit, ensureAuditTable } from "./audit";
import { dailyRatesJob } from "./jobs/rates";
import { ensureFeedCategoryView } from "./views";
import { triggerRevalidate } from "./utils/revalidate";
import { categoryService } from "./services/CategoryService";
import businessHoursRoutes from './routes/business-hours';
import { runGbpHoursSync } from './jobs/gbpHoursSync';
import tenantFlagsRoutes from './routes/tenant-flags';
import platformFlagsRoutes from './routes/platform-flags';
import effectiveFlagsRoutes from './routes/effective-flags';
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
import photosRouter from './photos';

// v3.6.2-prep imports
import feedJobsRoutes from './routes/feed-jobs';
import feedbackRoutes from './routes/feedback';
import tenantCategoriesRoutes from './routes/tenant-categories';
import taxonomyAdminRoutes from './routes/taxonomy-admin';
import feedValidationRoutes from './routes/feed-validation';
import businessProfileValidationRoutes from './routes/business-profile-validation';

// Authentication
import authRoutes from './auth/auth.routes';
import { authenticateToken, checkTenantAccess, requireAdmin } from './middleware/auth';
import { isPlatformAdmin } from './utils/platform-admin';
import { 
  requireTenantAdmin, 
  requireInventoryAccess, 
  requireTenantOwner,
  checkTenantCreationLimit 
} from './middleware/permissions';
import { validateTierAssignment, validateTierCompatibility } from './middleware/tier-validation';
import { validateSKULimits, validateTierSKUCompatibility } from './middleware/sku-limits';
import performanceRoutes from './routes/performance';
import platformSettingsRoutes from './routes/platform-settings';
import platformStatsRoutes from './routes/platform-stats';
import organizationRoutes from './routes/organizations';
import organizationRequestRoutes from './routes/organization-requests';
import upgradeRequestsRoutes from './routes/upgrade-requests';
import permissionRoutes from './routes/permissions';
import userRoutes from './routes/users';
import tenantUserRoutes from './routes/tenant-users';
import { auditLogger } from './middleware/audit-logger';
import { requireActiveSubscription, checkSubscriptionLimits } from './middleware/subscription';
import { enforcePolicyCompliance } from './middleware/policy-enforcement';
import categoriesPlatformRoutes from './routes/categories.platform';
import categoriesTenantRoutes from './routes/categories.tenant';
import categoriesMirrorRoutes from './routes/categories.mirror';
import mirrorAdminRoutes from './routes/mirror.admin';
import syncLogsRoutes from './routes/sync-logs';
import directoryRoutes from './routes/directory-v2';
import directoryTenantRoutes from './routes/directory-tenant';
import directoryAdminRoutes from './routes/directory-admin';
import directorySupportRoutes from './routes/directory-support';
import scanRoutes from './routes/scan';
import scanMetricsRoutes from './routes/scan-metrics';
import quickStartRoutes from './routes/quick-start';
import adminToolsRoutes from './routes/admin-tools';
import adminUsersRoutes from './routes/admin-users';
import featureOverridesRoutes from './routes/admin/feature-overrides';
import tierManagementRoutes from './routes/admin/tier-management';
import tierSystemRoutes from './routes/admin/tier-system';
import testGbpRoutes from './routes/test-gbp';
import googleBusinessOAuthRoutes from './routes/google-business-oauth';
import cloverRoutes from './routes/integrations/clover';
// Lazy import Square routes to avoid startup failures
let squareRoutes: any = null;

const getSquareRoutes = async () => {
  if (!squareRoutes) {
    const { default: routes } = await import('./square/square.routes');
    squareRoutes = routes;
  }
  return squareRoutes;
};
import dashboardRoutes from './routes/dashboard'; // FIXED VERSION
import tenantTierRoutes from './routes/tenant-tier';
import promotionRoutes from './routes/promotion';
import tenantLimitsRoutes from './routes/tenant-limits';

const app = express();

/* ------------------------- middleware ------------------------- */
app.use(cors({
  origin: [/localhost:\d+$/, /\.vercel\.app$/, /visibleshelf\.com$/, /visibleshelf\.store$/, /\.visibleshelf\.com$/, /\.visibleshelf\.store$/],
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['content-type','authorization','x-csrf-token','x-tenant-id'],
}));
app.use(express.json({ limit: "50mb" })); // keep large to support base64 in dev
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(setRequestContext);
// CSRF: issue cookie and enforce on write operations when FF_ENFORCE_CSRF=true
app.use(setCsrfCookie);
app.use(csrfProtect);

// Ensure audit table exists if auditing is enabled
// TEMP: Commented out due to Prisma JsonBody error in Railway
// ensureAuditTable().catch(() => {});
// Ensure helper view exists for feed category resolution
// TEMP: Commented out due to Prisma JsonBody error in Railway
// ensureFeedCategoryView().catch(() => {});

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
app.get("/tenants", authenticateToken, async (req, res) => {
  try {
    // Platform users (admin, support, viewer) see all tenants, regular users see only their tenants
    const isPlatformUserRole = req.user?.role === 'ADMIN' || 
                                req.user?.role === 'PLATFORM_ADMIN' ||
                                req.user?.role === 'PLATFORM_SUPPORT' ||
                                req.user?.role === 'PLATFORM_VIEWER';
    const tenants = await prisma.tenant.findMany({ 
      where: isPlatformUserRole ? {} : {
        users: {
          some: {
            userId: req.user?.userId
          }
        }
      },
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

app.get("/tenants/:id", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    let tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });
    
    const now = new Date();
    
    // Auto-set trial expiration date if missing for trial users
    if (
      (tenant.subscriptionStatus === "trial" || tenant.subscriptionTier === "trial") &&
      !tenant.trialEndsAt
    ) {
      console.log(`[GET /tenants/:id] Trial date missing for tenant ${tenant.id}. Setting trial to expire in 30 days.`);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          trialEndsAt: trialEndsAt,
          subscriptionStatus: "trial",
        },
      });
      console.log(`[GET /tenants/:id] Trial date set for tenant ${tenant.id}: ${trialEndsAt.toISOString()}`);
    }
    
    // Check if trial has expired and mark as expired (do NOT auto-convert)
    // Admin must manually convert after payment/contract confirmation
    if (
      tenant.subscriptionStatus === "trial" &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < now
    ) {
      console.log(`[GET /tenants/:id] Trial expired for tenant ${tenant.id}. Marking as expired.`);
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: "expired",
        },
      });
      console.log(`[GET /tenants/:id] Tenant ${tenant.id} marked as expired. Admin action required.`);
    }
    
    res.json(tenant);
  } catch (_e) {
    res.status(500).json({ error: "failed_to_get_tenant" });
  }
});

const createTenantSchema = z.object({ 
  name: z.string().min(1),
  ownerId: z.string().optional(), // Optional: specify a different owner (for PLATFORM_SUPPORT)
});
app.post("/tenants", authenticateToken, checkTenantCreationLimit, async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  
  try {
    // Determine who will own this tenant
    // If ownerId is provided and user is PLATFORM_SUPPORT, use that owner
    // Otherwise, the authenticated user becomes the owner
    const ownerId = (req.user?.role === 'PLATFORM_SUPPORT' && parsed.data.ownerId) 
      ? parsed.data.ownerId 
      : req.user!.userId;
    
    console.log('[POST /tenants] Creating tenant for owner:', ownerId, 'by user:', req.user?.userId);
    
    // Validate for duplicates (check against the owner, not the creator)
    const { validateTenantCreation } = await import('./utils/tenant-validation');
    const validation = await validateTenantCreation(
      ownerId,
      parsed.data.name
    );
    
    if (!validation.valid) {
      console.log('[POST /tenants] Validation failed:', validation.errors);
      return res.status(409).json({
        error: 'duplicate_tenant',
        message: 'A location with this information already exists',
        validationErrors: validation.errors,
      });
    }
    
    // Set trial to expire 14 days from now (corrected from 30)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    
    const tenant = await prisma.tenant.create({
      data: {
        name: parsed.data.name,
        subscriptionTier: 'starter',
        subscriptionStatus: 'trial',
        trialEndsAt: trialEndsAt,
        createdBy: req.user!.userId, // Track who created this tenant (for auditing)
      }
    });
    console.log('[POST /tenants] Tenant created:', tenant.id, 'by:', req.user?.userId);
    
    // Link tenant to the owner (may be different from creator if PLATFORM_SUPPORT)
    console.log('[POST /tenants] Linking tenant to owner:', ownerId);
    await prisma.userTenant.create({
      data: {
        userId: ownerId,
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });
    console.log('[POST /tenants] UserTenant link created successfully');
    
    await audit({ tenantId: tenant.id, actor: null, action: "tenant.create", payload: { name: parsed.data.name } });
    res.status(201).json(tenant);
  } catch (error) {
    console.error('[POST /tenants] Error creating tenant:', error);
    res.status(500).json({ error: "failed_to_create_tenant", message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
});
app.put("/tenants/:id", authenticateToken, checkTenantAccess, async (req, res) => {
  const parsed = updateTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.region !== undefined) data.region = parsed.data.region;
    if (parsed.data.language !== undefined) data.language = parsed.data.language;
    if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });
    res.json(tenant);
  } catch (e) {
    console.error('[PUT /tenants/:id] Error updating tenant:', e);
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

// PATCH /tenants/:id - Update tenant subscription tier (admin only)
const patchTenantSchema = z.object({
  subscriptionTier: z.enum(['trial', 'google_only', 'starter', 'professional', 'enterprise', 'organization']).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
  organizationId: z.string().optional(), // For linking to organization
});
app.patch("/tenants/:id", authenticateToken, requireAdmin, validateTierAssignment, validateTierCompatibility, validateTierSKUCompatibility, async (req, res) => {
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

app.delete("/tenants/:id", authenticateToken, checkTenantAccess, requireTenantOwner, async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_delete_tenant" });
  }
});

// Tenant profile (business information)
const E164 = /^\+[1-9]\d{1,14}$/; // E.164 phone pattern: MUST start with '+'
const HTTPS_URL = /^https:\/\//i;

const tenantProfileSchema = z.object({
  tenant_id: z.string().min(1),
  business_name: z.string().min(1).optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().length(2).optional(),
  phone_number: z
    .string()
    .refine((v) => !v || E164.test(v), { message: "phone_must_be_e164" })
    .optional(),
  email: z.string().email().optional(),
  website: z
    .string()
    .url()
    .refine((v) => !v || HTTPS_URL.test(v), { message: "website_must_be_https" })
    .optional(),
  contact_person: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  hours: z.any().optional(),
  social_links: z.any().optional(),
  seo_tags: z.any().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  display_map: z.boolean().optional(),
  map_privacy_mode: z.enum(["precise","neighborhood"]).optional(),
});

app.post("/tenant/profile", authenticateToken, async (req, res) => {
  const parsed = tenantProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  
  try {
    const { tenant_id, ...profileData } = parsed.data;
    // Upsert profile into dedicated table
    const upserted = await prisma.tenantBusinessProfile.upsert({
      where: { tenantId: tenant_id },
      create: {
        tenantId: tenant_id,
        businessName: profileData.business_name || "",
        addressLine1: profileData.address_line1 || "",
        addressLine2: profileData.address_line2 || null,
        city: profileData.city || "",
        state: profileData.state || null,
        postalCode: profileData.postal_code || "",
        countryCode: (profileData.country_code || "").toUpperCase(),
        phoneNumber: profileData.phone_number || null,
        email: profileData.email || null,
        website: profileData.website || null,
        contactPerson: profileData.contact_person || null,
        hours: (profileData as any).hours ?? null,
        socialLinks: (profileData as any).social_links ?? null,
        seoTags: (profileData as any).seo_tags ?? null,
        latitude: (profileData as any).latitude ?? null,
        longitude: (profileData as any).longitude ?? null,
        displayMap: (profileData as any).display_map ?? false,
        mapPrivacyMode: (profileData as any).map_privacy_mode ?? "precise",
      },
      update: {
        businessName: profileData.business_name ?? undefined,
        addressLine1: profileData.address_line1 ?? undefined,
        addressLine2: profileData.address_line2 ?? undefined,
        city: profileData.city ?? undefined,
        state: profileData.state ?? undefined,
        postalCode: profileData.postal_code ?? undefined,
        countryCode: profileData.country_code ? profileData.country_code.toUpperCase() : undefined,
        phoneNumber: profileData.phone_number ?? undefined,
        email: profileData.email ?? undefined,
        website: profileData.website ?? undefined,
        contactPerson: profileData.contact_person ?? undefined,
        hours: (profileData as any).hours ?? undefined,
        socialLinks: (profileData as any).social_links ?? undefined,
        seoTags: (profileData as any).seo_tags ?? undefined,
        latitude: (profileData as any).latitude ?? undefined,
        longitude: (profileData as any).longitude ?? undefined,
        displayMap: (profileData as any).display_map ?? undefined,
        mapPrivacyMode: (profileData as any).map_privacy_mode ?? undefined,
      },
    });

    // Keep Tenant.name in sync
    if (profileData.business_name) {
      await prisma.tenant.update({ where: { id: tenant_id }, data: { name: profileData.business_name } });
    }

    res.json(upserted);
  } catch (e: any) {
    console.error("Failed to save tenant profile:", e);
    res.status(500).json({ error: "failed_to_save_profile" });
  }
});

// GET /tenant/profile - retrieve normalized profile
app.get("/tenant/profile", authenticateToken, async (req, res) => {
  try {
    const tenantId = (req.query.tenant_id as string) || (req.query.tenantId as string);
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    const bp = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    const md = (tenant.metadata as any) || {};
    const profile = {
      tenant_id: tenant.id,
      business_name: bp?.businessName || md.business_name || tenant.name || null,
      address_line1: bp?.addressLine1 || md.address_line1 || null,
      address_line2: bp?.addressLine2 || md.address_line2 || null,
      city: bp?.city || md.city || null,
      state: bp?.state || md.state || null,
      postal_code: bp?.postalCode || md.postal_code || null,
      country_code: bp?.countryCode || md.country_code || null,
      phone_number: bp?.phoneNumber || md.phone_number || null,
      email: bp?.email || md.email || null,
      website: bp?.website || md.website || null,
      contact_person: bp?.contactPerson || md.contact_person || null,
      logo_url: bp?.logoUrl ?? md.logo_url ?? null,
      hours: bp?.hours || md.hours || null,
      social_links: bp?.socialLinks || md.social_links || null,
      seo_tags: bp?.seoTags || md.seo_tags || null,
      latitude: bp?.latitude ? Number(bp.latitude) : (md.latitude || null),
      longitude: bp?.longitude ? Number(bp.longitude) : (md.longitude || null),
      display_map: bp?.displayMap ?? md.display_map ?? false,
      map_privacy_mode: bp?.mapPrivacyMode || md.map_privacy_mode || 'precise',
    };
    return res.json(profile);
  } catch (e: any) {
    console.error("[GET /tenant/profile] Error:", e);
    return res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// Public endpoint to get basic tenant info (no auth required)
app.get("/public/tenant/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    
    const tenant = await prisma.tenant.findUnique({ 
      where: { id: tenantId },
      include: {
        featureOverrides: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        }
      }
    });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    // Check if tenant has storefront access (tier + overrides)
    const tier = tenant.subscriptionTier || 'trial';
    const hasStorefrontByTier = tier !== 'google_only'; // google_only doesn't have storefront
    
    // Check for storefront override
    const storefrontOverride = tenant.featureOverrides.find(
      (override: any) => override.feature === 'storefront'
    );
    
    const hasStorefrontAccess = storefrontOverride 
      ? storefrontOverride.granted 
      : hasStorefrontByTier;

    // Return basic public tenant information with access status
    return res.json({
      id: tenant.id,
      name: tenant.name,
      subscriptionTier: tenant.subscriptionTier,
      metadata: tenant.metadata,
      access: {
        storefront: hasStorefrontAccess,
      }
    });
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenantId] Error:", e);
    return res.status(500).json({ error: "failed_to_get_tenant" });
  }
});

// Public endpoint to get tenant product preview (SWIS - Store Window Inventory Showcase)
app.get("/tenant/:tenantId/swis/preview", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;
    const sort = (req.query.sort as string) || 'updated_desc';
    
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    
    // Build sort order
    let orderBy: any = { updatedAt: 'desc' };
    switch (sort) {
      case 'updated_desc':
        orderBy = { updatedAt: 'desc' };
        break;
      case 'updated_asc':
        orderBy = { updatedAt: 'asc' };
        break;
      case 'alpha_asc':
        orderBy = { name: 'asc' };
        break;
      case 'alpha_desc':
        orderBy = { name: 'desc' };
        break;
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
    }
    
    // Fetch products
    const products = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy,
      take: limit,
    });
    
    return res.json({ products, total: products.length });
  } catch (e: any) {
    console.error("[GET /tenant/:tenantId/swis/preview] Error:", e);
    return res.status(500).json({ error: "failed_to_get_preview" });
  }
});

// Public endpoint for product pages to get tenant business profile (no auth required)
app.get("/public/tenant/:tenantId/profile", async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    const bp = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    const md = (tenant.metadata as any) || {};
    
    // Fetch business hours from BusinessHours table
    const businessHours = await prisma.businessHours.findUnique({ where: { tenantId } });
    const specialHours = await prisma.businessHoursSpecial.findMany({ 
      where: { tenantId },
      orderBy: { date: 'asc' }
    });
    let hoursData = null;
    
    if (businessHours && businessHours.periods) {
      // Convert periods array to day-keyed object for storefront
      const periods = businessHours.periods as any[];
      const hoursByDay: any = { timezone: businessHours.timezone || 'America/New_York' };
      
      for (const period of periods) {
        if (period.day && period.open && period.close) {
          // Convert MONDAY to Monday for storefront compatibility
          const dayName = period.day.charAt(0).toUpperCase() + period.day.slice(1).toLowerCase();
          hoursByDay[dayName] = {
            open: period.open,
            close: period.close
          };
        }
      }
      
      // Add special hours overrides
      if (specialHours && specialHours.length > 0) {
        hoursByDay.special = specialHours.map(sh => ({
          date: sh.date.toISOString().split('T')[0], // YYYY-MM-DD format
          isClosed: sh.isClosed,
          open: sh.open,
          close: sh.close,
          note: sh.note
        }));
      }
      
      hoursData = hoursByDay;
      console.log('[Profile API] Business hours for', tenantId, ':', JSON.stringify(hoursData));
    } else {
      console.log('[Profile API] No business hours found for', tenantId);
    }
    
    // Return public business information only
    const profile = {
      business_name: bp?.businessName || md.business_name || tenant.name || null,
      address_line1: bp?.addressLine1 || md.address_line1 || null,
      address_line2: bp?.addressLine2 || md.address_line2 || null,
      city: bp?.city || md.city || null,
      state: bp?.state || md.state || null,
      postal_code: bp?.postalCode || md.postal_code || null,
      country_code: bp?.countryCode || md.country_code || null,
      phone_number: bp?.phoneNumber || md.phone_number || null,
      email: bp?.email || md.email || null,
      website: bp?.website || md.website || null,
      contact_person: bp?.contactPerson || md.contact_person || null,
      logo_url: bp?.logoUrl ?? md.logo_url ?? null,
      hours: hoursData || bp?.hours || md.hours || null,
      social_links: bp?.socialLinks || md.social_links || null,
      latitude: bp?.latitude ? Number(bp.latitude) : (md.latitude || null),
      longitude: bp?.longitude ? Number(bp.longitude) : (md.longitude || null),
      display_map: bp?.displayMap ?? md.display_map ?? false,
      map_privacy_mode: bp?.mapPrivacyMode || md.map_privacy_mode || 'precise',
    };
    return res.json(profile);
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenantId/profile] Error:", e);
    return res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// Public endpoint to get tenant items for storefront (no auth required)
app.get("/public/tenant/:tenantId/items", async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    
    // Parse pagination params
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '12', 10);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    
    // Build where clause - only show active, public items
    const where: any = { 
      tenantId,
      itemStatus: 'active',
      visibility: 'public'
    };
    
    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      where.OR = [
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    
    // Fetch items with pagination (includes category for public display)
    const [items, totalCount] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          tenantCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              googleCategoryId: true,
            },
          },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);
    
    // Return paginated response
    res.json({
      items,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + items.length < totalCount,
      },
    });
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenantId/items] Error:", e);
    return res.status(500).json({ error: "failed_to_get_items" });
  }
});

// Public endpoint for features showcase config (no auth required)
app.get("/api/public/features-showcase-config", async (req, res) => {
  try {
    // Return default config for now (can be extended to read from database later)
    const defaultConfig = {
      mode: 'hybrid',
      rotationEnabled: false,
      rotationInterval: 24,
      enabledModes: ['hybrid', 'random', 'fixed']
    };
    return res.json(defaultConfig);
  } catch (e: any) {
    console.error("[GET /api/public/features-showcase-config] Error:", e);
    return res.status(500).json({ error: "failed_to_get_config" });
  }
});

// PATCH /tenant/profile - partial update
const tenantProfileUpdateSchema = tenantProfileSchema.partial().extend({ tenant_id: z.string().min(1) });
app.patch("/tenant/profile", authenticateToken, async (req, res) => {
  const parsed = tenantProfileUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const { tenant_id, ...delta } = parsed.data;
    console.log('[PATCH /tenant/profile] Delta:', JSON.stringify(delta, null, 2));
    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenant_id } });
    if (!existingTenant) return res.status(404).json({ error: "tenant_not_found" });

    const updated = await prisma.tenantBusinessProfile.upsert({
      where: { tenantId: tenant_id },
      create: {
        tenantId: tenant_id,
        businessName: delta.business_name || existingTenant.name,
        addressLine1: delta.address_line1 || "",
        city: delta.city || "",
        postalCode: delta.postal_code || "",
        countryCode: (delta.country_code || "US").toUpperCase(),
        addressLine2: delta.address_line2 ?? null,
        state: delta.state ?? null,
        phoneNumber: delta.phone_number ?? null,
        email: delta.email ?? null,
        website: delta.website ?? null,
        contactPerson: delta.contact_person ?? null,
        logoUrl: delta.logo_url ?? null,
        hours: (delta as any).hours ?? null,
        socialLinks: (delta as any).social_links ?? null,
        seoTags: (delta as any).seo_tags ?? null,
        latitude: (delta as any).latitude ?? null,
        longitude: (delta as any).longitude ?? null,
        displayMap: (delta as any).display_map ?? false,
        mapPrivacyMode: (delta as any).map_privacy_mode ?? 'precise',
      },
      update: {
        businessName: delta.business_name ?? undefined,
        addressLine1: delta.address_line1 ?? undefined,
        addressLine2: delta.address_line2 ?? undefined,
        city: delta.city ?? undefined,
        state: delta.state ?? undefined,
        postalCode: delta.postal_code ?? undefined,
        countryCode: delta.country_code ? delta.country_code.toUpperCase() : undefined,
        phoneNumber: delta.phone_number ?? undefined,
        email: delta.email ?? undefined,
        website: delta.website ?? undefined,
        contactPerson: delta.contact_person ?? undefined,
        logoUrl: 'logo_url' in delta ? (delta.logo_url === '' ? null : delta.logo_url) : undefined,
        hours: (delta as any).hours ?? undefined,
        socialLinks: (delta as any).social_links ?? undefined,
        seoTags: (delta as any).seo_tags ?? undefined,
        latitude: (delta as any).latitude ?? undefined,
        longitude: (delta as any).longitude ?? undefined,
        displayMap: (delta as any).display_map ?? undefined,
        mapPrivacyMode: (delta as any).map_privacy_mode ?? undefined,
      },
    });

    if (delta.business_name) {
      await prisma.tenant.update({ where: { id: tenant_id }, data: { name: delta.business_name } });
    }

    // Also clear logo_url from tenant metadata if it's being removed
    if ('logo_url' in delta && delta.logo_url === '') {
      const currentMetadata = (existingTenant.metadata as any) || {};
      if (currentMetadata.logo_url) {
        delete currentMetadata.logo_url;
        await prisma.tenant.update({ 
          where: { id: tenant_id }, 
          data: { metadata: currentMetadata } 
        });
      }
    }

    console.log('[PATCH /tenant/profile] Updated logoUrl:', updated.logoUrl);
    return res.json(updated);
  } catch (e: any) {
    console.error("[PATCH /tenant/profile] Error:", e);
    return res.status(500).json({ error: "failed_to_update_profile" });
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
    const TENANT_BUCKET = StorageBuckets.TENANTS;

    // A) multipart/form-data "file" upload
    if (req.file) {
      const f = req.file as any;
      const ext = f.mimetype.includes("png") ? ".png" : f.mimetype.includes("webp") ? ".webp" : ".jpg";
      const pathKey = `tenants/${tenantId}/logo-${Date.now()}${ext}`;
      
      console.log(`[Logo Upload] Uploading to Supabase:`, { 
        bucket: TENANT_BUCKET.name,
        pathKey, 
        size: f.size, 
        mimetype: f.mimetype 
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });

      if (error) {
        console.error(`[Logo Upload] Supabase upload error:`, error);
        return res.status(500).json({ error: error.message, details: error });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Logo Upload] Supabase upload successful:`, { publicUrl });
    }
    // B) JSON { url } upload
    else if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
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
        bucket: TENANT_BUCKET.name,
        pathKey, 
        size: buf.length, 
        contentType: parsed.data.contentType 
      });

      const { error, data } = await supabaseLogo.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

      if (error) {
        console.error("[Logo Upload] Supabase dataUrl upload error:", error);
        return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
      }

      publicUrl = supabaseLogo.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
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

// Banner upload endpoint (similar to logo but for wide banners)
app.post("/tenant/:id/banner", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenantId = req.params.id;
    console.log(`[Banner Upload] Starting upload for tenant ${tenantId}`);

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseBanner = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    if (!supabaseBanner) {
      return res.status(500).json({ error: "supabase_not_configured" });
    }

    let publicUrl: string;
    const TENANT_BUCKET = StorageBuckets.TENANTS;

    // JSON dataUrl upload (frontend sends compressed base64)
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.dataUrl === "string") {
      const parsed = logoDataUrlSchema.safeParse(req.body || {});
      if (!parsed.success) {
        console.error(`[Banner Upload] Invalid dataUrl payload:`, parsed.error.flatten());
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      }

      const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
      if (!match) return res.status(400).json({ error: "invalid_data_url" });
      
      const buf = Buffer.from(match[1], "base64");
      
      // Enforce 5MB limit for banners
      if (buf.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: "banner_too_large", maxSizeMB: 5 });
      }

      const ext = parsed.data.contentType.includes("png")
        ? ".png"
        : parsed.data.contentType.includes("webp")
        ? ".webp"
        : ".jpg";
      
      const pathKey = `tenants/${tenantId}/banner-${Date.now()}${ext}`;
      console.log(`[Banner Upload] Uploading dataUrl to Supabase:`, { 
        bucket: TENANT_BUCKET.name,
        pathKey, 
        size: buf.length 
      });

      const { error, data } = await supabaseBanner.storage
        .from(TENANT_BUCKET.name)
        .upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

      if (error) {
        console.error("[Banner Upload] Supabase upload error:", error);
        return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
      }

      publicUrl = supabaseBanner.storage.from(TENANT_BUCKET.name).getPublicUrl(data.path).data.publicUrl;
      console.log(`[Banner Upload] Supabase upload successful:`, { publicUrl });
    } else {
      return res.status(400).json({ error: "unsupported_payload" });
    }

    // Update tenant metadata with banner URL
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...(tenant.metadata as any || {}),
          banner_url: publicUrl,
        },
      },
    });

    return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
  } catch (e: any) {
    console.error("[Banner Upload Error]:", e?.message);
    return res.status(500).json({ 
      error: "failed_to_upload_banner",
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
      const f = req.file as any;
      let publicUrl: string | null = null;

      if (supabase) {
        const pathKey = `${item.tenantId}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;
        console.log(`[Photo Upload] Uploading to Supabase:`, { pathKey, size: f.size, mimetype: f.mimetype });
        
        const { error, data } = await supabase.storage.from(StorageBuckets.PHOTOS.name).upload(pathKey, f.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.mimetype || "application/octet-stream",
        });
        
        if (error) {
          console.error(`[Photo Upload] Supabase upload error:`, error);
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
        
        const { error, data } = await supabase.storage.from(StorageBuckets.PHOTOS.name).upload(pathKey, buf, {
          cacheControl: "3600",
          upsert: false,
          contentType: parsed.data.contentType,
        });

        if (error) {
          console.error("[Photo Upload] Supabase dataUrl upload error:", error);
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

// Mount photos router (handles all photo endpoints with position support)
console.log("🔧 Mounting photos router...");
app.use(photosRouter);
console.log("✓ Photos router mounted");

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
  tenantId: z.string().min(1),
  count: z.string().optional(), // Return only count for performance
  page: z.string().optional(), // Page number (1-indexed)
  limit: z.string().optional(), // Items per page
  search: z.string().optional(), // Search by SKU or name
  status: z.enum(['all', 'active', 'inactive', 'syncing']).optional(), // Filter by status
  visibility: z.enum(['all', 'public', 'private']).optional(), // Filter by visibility
  sortBy: z.enum(['name', 'sku', 'price', 'stock', 'updatedAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

app.get(["/api/items", "/api/inventory", "/items", "/inventory"], authenticateToken, async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "tenant_required" });
  
  // Check tenant access
  const tenantId = parsed.data.tenantId;
  const isAdmin = isPlatformAdmin(req.user);
  const hasAccess = isAdmin || req.user?.tenantIds.includes(tenantId);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'tenant_access_denied', message: 'You do not have access to this tenant' });
  }
  
  try {
    // Build where clause
    const where: any = { tenantId };
    
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
        where.itemStatus = 'active';
      } else if (parsed.data.status === 'inactive') {
        where.itemStatus = 'inactive';
      } else if (parsed.data.status === 'syncing') {
        where.AND = [
          { OR: [{ itemStatus: 'active' }, { itemStatus: null }] },
          { OR: [{ visibility: 'public' }, { visibility: null }] },
        ];
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
      const count = await prisma.inventoryItem.count({ where });
      return res.json({ count });
    }
    
    // Parse pagination params
    const page = parseInt(parsed.data.page || '1', 10);
    const limit = parseInt(parsed.data.limit || '25', 10);
    const skip = (page - 1) * limit;
    
    // Build orderBy clause
    const sortBy = parsed.data.sortBy || 'updatedAt';
    const sortOrder = parsed.data.sortOrder || 'desc';
    const orderBy: any = {};
    
    if (sortBy === 'price') {
      orderBy.priceCents = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }
    
    // Fetch items with pagination (includes category relation for better UX)
    const [items, totalCount] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          tenantCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              googleCategoryId: true,
            },
          },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);
    
    // Return paginated response
    res.json({
      items,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + items.length < totalCount,
      },
    });

  } catch (e: any) {
    console.error('[GET /items] Error listing items:', e);
    res.status(500).json({ error: "failed_to_list_items", message: e?.message });
  }
});

app.get(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], async (req, res) => {
  const it = await prisma.inventoryItem.findUnique({ 
    where: { id: req.params.id },
    include: {
      tenantCategory: {
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true,
        },
      },
    },
  });
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
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
  // Item status and visibility
  itemStatus: z.enum(['active', 'inactive', 'archived']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
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
      // Auto-set availability based on stock if not explicitly provided
      availability: parsed.data.availability || (parsed.data.stock > 0 ? 'in_stock' : 'out_of_stock'),
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
    // Auto-sync availability based on stock count
    const updateData = { ...parsed.data };
    if (updateData.stock !== undefined) {
      // If stock is being updated, automatically set availability
      updateData.availability = updateData.stock > 0 ? 'in_stock' : 'out_of_stock';
    }
    
    const updated = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: updateData });
    await audit({ tenantId: updated.tenantId, actor: null, action: "inventory.update", payload: { id: updated.id } });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "failed_to_update_item" });
  }
});

app.delete(["/items/:id", "/inventory/:id"], authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_delete_item" });
  }
});

// Category assignment endpoint
const categoryAssignmentSchema = z.object({
  categorySlug: z.string().min(1),
});
app.patch("/api/v1/tenants/:tenantId/items/:itemId/category", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, itemId } = req.params;
    const parsed = categoryAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const updated = await categoryService.assignItemCategory(tenantId, itemId, {
      categorySlug: parsed.data.categorySlug,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('[PATCH /api/v1/tenants/:tenantId/items/:itemId/category] Error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || "failed_to_assign_category" });
  }
});

// Update item status (for Google sync control)
app.patch(["/items/:id", "/inventory/:id"], authenticateToken, async (req, res) => {
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

// Sync availability status for all items (fix out-of-sync items)
app.post("/items/sync-availability", authenticateToken, async (req, res) => {
  try {
    const tenantId = req.body.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_required" });
    }

    // Get all items for the tenant
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
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
        prisma.inventoryItem.update({
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
    console.error('[Sync Availability] Error:', error);
    res.status(500).json({ error: "failed_to_sync_availability" });
  }
});

//* ------------------------------ GOOGLE TAXONOMY SEARCH ------------------------------ */

app.get('/api/google/taxonomy/browse', async (req, res) => {
  try {
    const { level = '1' } = req.query;
    const targetLevel = parseInt(level as string, 10);

    // Get top-level categories (those without parentId or with specific parent)
    // Instead of relying on level field, get categories that represent top-level groupings
    const categories = await prisma.googleTaxonomy.findMany({
      where: {
        isActive: true,
        OR: [
          { parentId: null },
          { parentId: { equals: '' } }
        ]
      },
      orderBy: { categoryPath: 'asc' },
      take: 20 // Limit for performance
    });

    // For now, return some test categories if database is empty
    let finalCategories: any[] = categories;
    if (categories.length === 0) {
      console.log('No categories found in database, using fallback test categories');
      finalCategories = [
        {
          categoryId: "8",
          categoryPath: "Food, Beverages & Tobacco",
          level: 1,
          parentId: null,
          isActive: true
        },
        {
          categoryId: "7", 
          categoryPath: "Electronics",
          level: 1,
          parentId: null,
          isActive: true
        },
        {
          categoryId: "499685",
          categoryPath: "Food, Beverages & Tobacco > Food Items",
          level: 2,
          parentId: "8",
          isActive: true
        },
        {
          categoryId: "499686",
          categoryPath: "Food, Beverages & Tobacco > Beverages", 
          level: 2,
          parentId: "8",
          isActive: true
        },
        {
          categoryId: "499776",
          categoryPath: "Food, Beverages & Tobacco > Beverages > Coffee",
          level: 3,
          parentId: "499686",
          isActive: true
        },
        {
          categoryId: "499777",
          categoryPath: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          level: 3,
          parentId: "499686", 
          isActive: true
        }
      ];
    }

    // For each top-level category, get some children
    const categoriesWithChildren = await Promise.all(
      finalCategories.map(async (cat: any) => {
        let children: any[] = [];
        
        // If using fallback categories, get children from the hardcoded list
        if (categories.length === 0) {
          children = finalCategories.filter(c => c.parentId === cat.categoryId);
        } else {
          // Get children from database
          children = await prisma.googleTaxonomy.findMany({
            where: {
              isActive: true,
              categoryPath: {
                startsWith: cat.categoryPath + ' > '
              }
            },
            orderBy: { categoryPath: 'asc' },
            take: 10 // Limit children for UI performance
          });
        }

        return {
          id: cat.categoryId,
          name: cat.categoryPath.split(' > ').pop() || cat.categoryPath,
          path: cat.categoryPath.split(' > '),
          fullPath: cat.categoryPath,
          children: children.map(child => ({
            id: child.categoryId,
            name: child.categoryPath.split(' > ').pop() || child.categoryPath,
            path: child.categoryPath.split(' > '),
            fullPath: child.categoryPath
          }))
        };
      })
    );

    res.json({
      success: true,
      categories: categoriesWithChildren,
    });
  } catch (error) {
    console.error('[Google Taxonomy Browse] Error:', error);
    res.status(500).json({ success: false, error: 'Browse failed' });
  }
});

app.get('/api/google/taxonomy/search', async (req, res) => {
  try {
    const { q: query, limit = '10' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Search real Google taxonomy data from database
    const lowerQuery = query.toLowerCase();
    const categories = await prisma.googleTaxonomy.findMany({
      where: {
        isActive: true,
        OR: [
          { categoryPath: { contains: lowerQuery, mode: 'insensitive' } },
          { categoryId: { contains: lowerQuery } }
        ]
      },
      take: parseInt(limit as string, 10),
      orderBy: { categoryPath: 'asc' }
    });

    const results = categories.map(cat => ({
      id: cat.categoryId,
      name: cat.categoryPath.split(' > ').pop() || cat.categoryPath,
      path: cat.categoryPath.split(' > '),
      fullPath: cat.categoryPath
    }));

    res.json({
      success: true,
      categories: results,
    });
  } catch (error) {
    console.error('[Google Taxonomy Search] Error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

app.get("/__routes", (_req, res) => {
  const out: any[] = [];
  // Always include known core routes
  out.push({ methods: ["GET"], path: "/health" });
  out.push({ methods: ["GET"], path: "/__ping" });
  function collect(stack: any[], base = "") {
    stack?.forEach((layer: any) => {
      if (layer.route && layer.route.path) {
        const methods = layer.route.methods
          ? Array.isArray(layer.route.methods)
            ? layer.route.methods
          : Object.keys(layer.route.methods)
          : [];
        const path = base + layer.route.path;
        out.push({ methods: methods.map((m: string) => m.toUpperCase()), path });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const match = layer.regexp && layer.regexp.fast_slash ? "" : (layer.regexp?.source || "");
        collect(layer.handle.stack, base);
      }
    });
  }
  const stack = (app as any)._router?.stack || [];
  collect(stack);
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
    // Check TenantBusinessProfile table first, fallback to metadata for backwards compatibility
    const businessProfile = await prisma.tenantBusinessProfile.findUnique({
      where: { tenantId }
    });
    
    const hasProfile = businessProfile 
      ? (businessProfile.businessName && businessProfile.city && businessProfile.state)
      : ((tenant.metadata as any)?.business_name && (tenant.metadata as any)?.city && (tenant.metadata as any)?.state);
    
    if (!hasProfile) {
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
app.use('/organization-requests', organizationRequestRoutes);
app.use('/upgrade-requests', upgradeRequestsRoutes);
app.use('/permissions', permissionRoutes);
app.use('/users', userRoutes);
// Directory routes - mount at specific paths to avoid conflicts
app.use('/api/directory', directoryRoutes); // Public directory endpoint - no auth required
app.use('/api/admin/directory', directoryAdminRoutes); // Admin directory management (auth in routes)
app.use('/api/support/directory', directorySupportRoutes); // Support directory tools (auth in routes)
// Tenant directory routes - MUST come before generic tenant routes
app.use('/api/tenants', directoryTenantRoutes); // Tenant directory management (auth in routes)
console.log('✅ Directory routes mounted (public, tenant, admin, support)');
// Generic tenant routes come AFTER directory routes
app.use('/api/tenants', tenantUserRoutes);
app.use(platformSettingsRoutes);
app.use('/api/platform-stats', platformStatsRoutes); // Public endpoint - no auth required
app.use('/api', dashboardRoutes); // Mount dashboard routes under /api prefix
console.log('✅ Dashboard routes mounted');
app.use('/api', promotionRoutes); // Promotion endpoints
console.log('✅ Promotion routes mounted');
app.use(tenantTierRoutes); // Tenant tier and usage endpoints
app.use('/api/tenant-limits', tenantLimitsRoutes); // Tenant creation limits
console.log('✅ Tenant limits routes mounted');

/* ------------------------------ v3.6.2-prep APIs ------------------------------ */
app.use('/api/feed-jobs', feedJobsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/v1/tenants', authenticateToken, checkTenantAccess, tenantCategoriesRoutes);
app.use('/api/v1', quickStartRoutes);
// IMPORTANT: Route order matters in Express! More specific routes MUST come before generic ones.
// Tenant flags: accessible by platform admins OR store owners of that specific tenant
// MUST be mounted BEFORE the generic /api/admin route below to prevent route matching conflicts
app.use('/admin', authenticateToken, tenantFlagsRoutes);
app.use('/api/admin', authenticateToken, tenantFlagsRoutes);
// Admin tools and users - these are more generic and should come after specific routes
app.use('/api/admin/tools', authenticateToken, requireAdmin, adminToolsRoutes);
app.use('/api/admin/feature-overrides', featureOverridesRoutes); // Feature overrides (admin-only, auth handled in route)
app.use('/api/admin/tier-management', tierManagementRoutes); // Tier management (admin-only, auth handled in route)
app.use('/api/admin/tier-system', tierSystemRoutes); // Tier system CRUD (platform staff, auth handled in route)
app.use('/api/integrations', cloverRoutes); // Clover POS integration (auth handled in route)
app.use('/square', async (req, res, next) => {
  try {
    const routes = await getSquareRoutes();
    return routes(req, res, next);
  } catch (error) {
    console.error('[Square Routes] Lazy loading error:', error);
    res.status(500).json({ error: 'square_routes_unavailable' });
  }
}); // Square POS integration (auth handled in route)
app.use('/admin', authenticateToken, adminUsersRoutes);
app.use('/api/admin', authenticateToken, adminUsersRoutes);
app.use('/admin/taxonomy', requireAdmin, taxonomyAdminRoutes);
app.use('/api', feedValidationRoutes);
/* ------------------------------ TAXONOMY ADMIN API ------------------------------ */

// GET /api/admin/taxonomy/status - Check taxonomy sync status
app.get('/api/admin/taxonomy/status', requireAdmin, async (req, res) => {
  try {
    const { TaxonomySyncService } = await import('./services/TaxonomySyncService');
    const syncService = new TaxonomySyncService();

    const status = await syncService.checkForUpdates();

    // Get current taxonomy version
    const currentVersion = await prisma.googleTaxonomy.findFirst({
      select: { version: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      currentVersion: currentVersion?.version || 'unknown',
      latestVersion: status.latestVersion,
      hasUpdates: status.hasUpdates,
      changeCount: status.changes.length,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Taxonomy Status] Error:', error);
    res.status(500).json({ error: 'Failed to check taxonomy status' });
  }
});

// POST /api/admin/taxonomy/sync - Manually trigger taxonomy sync
app.post('/api/admin/taxonomy/sync', requireAdmin, async (req, res) => {
  try {
    const { TaxonomySyncService } = await import('./services/TaxonomySyncService');
    const syncService = new TaxonomySyncService();

    const status = await syncService.checkForUpdates();

    if (!status.hasUpdates) {
      return res.json({
        success: true,
        message: 'Taxonomy is already up to date',
        changes: []
      });
    }

    const migrationResult = await syncService.applySafeUpdates(status.changes);
    const itemMigration = await syncService.migrateAffectedItems(status.changes);

    res.json({
      success: true,
      message: `Applied ${migrationResult.applied} updates, ${migrationResult.needsReview} need review`,
      applied: migrationResult.applied,
      needsReview: migrationResult.needsReview,
      migratedItems: itemMigration.migrated,
      flaggedItems: itemMigration.flagged
    });
  } catch (error) {
    console.error('[Taxonomy Sync] Error:', error);
    res.status(500).json({ error: 'Taxonomy sync failed' });
  }
});
app.use('/auth', googleBusinessOAuthRoutes); // Google Business Profile OAuth flow
app.use('/admin', authenticateToken, platformFlagsRoutes);
app.use('/api/admin', authenticateToken, platformFlagsRoutes);
// Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
app.use('/admin', authenticateToken, effectiveFlagsRoutes);
app.use('/api/admin', authenticateToken, effectiveFlagsRoutes);
// Category scaffolds (M3 start)
app.use(categoriesPlatformRoutes);
app.use(categoriesTenantRoutes);
app.use(categoriesMirrorRoutes);
app.use(mirrorAdminRoutes);
app.use(syncLogsRoutes);
// M4: SKU Scanning routes
app.use(scanRoutes);
app.use(scanMetricsRoutes);

/* ------------------------------ item category assignment ------------------------------ */
// PATCH /api/v1/tenants/:tenantId/items/:itemId/category
// Body: { tenantCategoryId?: string, categorySlug?: string }
app.patch('/api/v1/tenants/:tenantId/items/:itemId/category', async (req, res) => {
  try {
    const { tenantId, itemId } = req.params as { tenantId: string; itemId: string };
    const { tenantCategoryId, categorySlug } = (req.body || {}) as { tenantCategoryId?: string; categorySlug?: string };

    const updated = await categoryService.assignItemCategory(tenantId, itemId, { tenantCategoryId, categorySlug });
    // ISR revalidation (best-effort) already triggered inside service
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
    const msg = e?.message || 'failed_to_assign_category';
    console.error('[PATCH /api/v1/tenants/:tenantId/items/:itemId/category] Error:', msg);
    return res.status(code).json({ success: false, error: msg });
  }
});

/* ------------------------------ item updates ------------------------------ */
// PUT /api/items/:itemId
// Update an item (general updates, not category assignment)
app.put('/api/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;

    // Validate required fields
    if (!updateData) {
      return res.status(400).json({ error: 'update_data_required' });
    }

    // Prepare update data for Prisma
    const prismaUpdateData: any = {};
    
    // Handle different field names (camelCase from frontend vs snake_case in DB)
    if (updateData.name !== undefined) prismaUpdateData.name = updateData.name;
    if (updateData.price !== undefined) prismaUpdateData.price = updateData.price;
    if (updateData.stock !== undefined) prismaUpdateData.stock = updateData.stock;
    if (updateData.description !== undefined) prismaUpdateData.description = updateData.description;
    if (updateData.visibility !== undefined) prismaUpdateData.visibility = updateData.visibility;
    if (updateData.itemStatus !== undefined) prismaUpdateData.itemStatus = updateData.itemStatus;
    if (updateData.categoryPath !== undefined) prismaUpdateData.categoryPath = updateData.categoryPath;

    // Update the item
    const updatedItem = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: prismaUpdateData,
    });

    // Transform snake_case back to camelCase for frontend
    const result = {
      id: updatedItem.id,
      tenantId: updatedItem.tenantId,
      sku: updatedItem.sku,
      name: updatedItem.name,
      price: updatedItem.price,
      stock: updatedItem.stock,
      description: updatedItem.description,
      visibility: updatedItem.visibility,
      status: updatedItem.itemStatus,
      categoryPath: updatedItem.categoryPath,
      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt,
    };

    return res.json(result);
  } catch (error) {
    console.error('[PUT /api/items/:itemId] Error:', error);
    return res.status(500).json({ error: 'failed_to_update_item' });
  }
});

/* ------------------------------ jobs ------------------------------ */
app.post("/jobs/rates/daily", dailyRatesJob);

/* ------------------------------ boot ------------------------------ */
const port = Number(process.env.PORT || process.env.API_PORT || 4000);

// Log startup environment
console.log('\n🚀 Starting API server...');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${port}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   WEB_URL: ${process.env.WEB_URL || 'Not set'}\n`);

// Only start the server when not running tests
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n✅ API server running → http://localhost:${port}/health`);
    console.log(`📋 View all routes → http://localhost:${port}/__routes\n`);
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Export the app for testing
export default app;
export { app };

/* ------------------------------ TAXONOMY SYNC JOB ------------------------------ */

(async function startTaxonomySyncJob(){
  const enabled = String(process.env.FF_TAXONOMY_AUTO_SYNC || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('📋 Taxonomy sync job disabled');
    return;
  }

  console.log('📋 Taxonomy sync job enabled - checking weekly');

  // Check for updates every 7 days (604800000 ms)
  setInterval(async () => {
    try {
      console.log('🔄 Checking for Google taxonomy updates...');

      const { TaxonomySyncService } = await import('./services/TaxonomySyncService');
      const syncService = new TaxonomySyncService();

      const result = await syncService.checkForUpdates();

      if (result.hasUpdates) {
        console.log(`📈 Found ${result.changes.length} taxonomy changes for version ${result.latestVersion}`);

        // Apply safe updates automatically
        const migrationResult = await syncService.applySafeUpdates(result.changes);
        console.log(`✅ Applied ${migrationResult.applied} safe updates, ${migrationResult.needsReview} need review`);

        // Migrate affected items
        const itemMigration = await syncService.migrateAffectedItems(result.changes);
        console.log(`🔄 Migrated ${itemMigration.migrated} items, flagged ${itemMigration.flagged} for review`);

        // TODO: Send admin notification for manual review items
        if (migrationResult.needsReview > 0 || itemMigration.flagged > 0) {
          console.log('⚠️  Manual review required - check admin dashboard');
        }
      } else {
        console.log('✅ Taxonomy is up to date');
      }
    } catch (error) {
      console.error('❌ Taxonomy sync job failed:', error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days
})();
