import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { user_role } from '@prisma/client'; 

// Fix for Supabase SSL certificate issues in production
// This allows Node.js to accept Supabase's SSL certificates
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('⚠️  SSL certificate validation disabled for Supabase compatibility');
}
import { Pool } from 'pg';
import { prisma, basePrisma } from "./prisma";
import { z } from "zod";
import { getDirectPool } from "./utils/db-pool";
import { setCsrfCookie, csrfProtect } from "./middleware/csrf";

// Migration fix applied: ProductCondition enum renamed 'new' to 'brand_new'
// Force rebuild v3: Railway build cache bypass
import fs from "fs";
import path from "path";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { Flags } from "./config";
import { TRIAL_CONFIG } from "./config/tenant-limits";
import { setRequestContext } from "./context";
import { StorageBuckets } from "./storage-config";
import { audit, ensureAuditTable } from "./audit";
import { dailyRatesJob } from "./jobs/rates";
import { ensureFeedCategoryView } from "./views";
import { triggerRevalidate } from "./utils/revalidate";
import { categoryService } from "./services/CategoryService";
// Temporarily disable ALL route imports to isolate startup issue
// import businessHoursRoutes from './routes/business-hours';
// import tenantFlagsRoutes from './routes/tenant-flags';
// import platformFlagsRoutes from './routes/platform-flags';
// import effectiveFlagsRoutes from './routes/effective-flags';
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

// v3.5 imports - temporarily disabled
// import auditRoutes from './routes/audit';
// import policyRoutes from './routes/policy';
import billingRoutes from './routes/billing';
// import subscriptionRoutes from './routes/subscriptions';
// import categoryRoutes from './routes/categories';
import photosRouter from './photos';
import directoryPhotosRouter from './routes/directory-photos';

// v3.6.2-prep imports - temporarily disabled
// import feedJobsRoutes from './routes/feed-jobs';
// import feedbackRoutes from './routes/feedback';
// import tenantCategoriesRoutes from './routes/tenant-categories';
   import taxonomyAdminRoutes from './routes/taxonomy-admin';
   import feedValidationRoutes from './routes/feed-validation';
   import businessProfileValidationRoutes from './routes/business-profile-validation';

// Authentication middleware and utilities
// import authRoutes from './auth/auth.routes'; // Now handled by modular mounting
import { authenticateToken, checkTenantAccess, requireAdmin } from './middleware/auth';
import { isPlatformAdmin, isPlatformUser } from './utils/platform-admin';
import { 
  requireTenantAdmin, 
  requireInventoryAccess, 
  requireTenantOwner,
  checkTenantCreationLimit 
} from './middleware/permissions';
import { validateTierAssignment, validateTierCompatibility } from './middleware/tier-validation';
import { validateSKULimits, validateTierSKUCompatibility } from './middleware/sku-limits';
import { auditLogger } from './middleware/audit-logger';
import { requireActiveSubscription, checkSubscriptionLimits, requireWritableSubscription } from './middleware/subscription';
import { enforcePolicyCompliance } from './middleware/policy-enforcement';
// All route imports temporarily disabled for isolation
// import performanceRoutes from './routes/performance';
import platformSettingsRoutes from './routes/platform-settings';
import organizationRoutes from './routes/organizations';
import organizationRequestRoutes from './routes/organization-requests';
import upgradeRequestsRoutes from './routes/upgrade-requests';
import permissionRoutes from './routes/permissions';
// import userRoutes from './routes/users';
// import tenantUserRoutes from './routes/tenant-users';
// import categoriesPlatformRoutes from './routes/categories.platform';
// import categoriesTenantRoutes from './routes/categories.tenant';
// import categoriesMirrorRoutes from './routes/categories.mirror';
// import mirrorAdminRoutes from './routes/mirror.admin';
// import syncLogsRoutes from './routes/sync-logs';
// import directoryRoutes from './routes/directory-v2';
// import directoryTenantRoutes from './routes/directory-tenant';
// import directoryAdminRoutes from './routes/directory-admin';
// import directorySupportRoutes from './routes/directory-support';
// import directoryCategoriesRoutes from './routes/directory-categories';
// import directoryStoreTypesRoutes from './routes/directory-store-types';
import directoryRoutes from './routes/directory-v2';
import directoryTenantRoutes from './routes/directory-tenant';
import directoryCategoriesRoutes from './routes/directory-categories';
import directoryStoreTypesRoutes from './routes/directory-store-types';
import directoryOptimizedRoutes from './routes/directory-optimized';
import directoryCategoriesOptimizedRoutes from './routes/directory-categories-optimized';
import directoryMapRoutes from './routes/directory-map';
import storefrontRoutes from './routes/storefront';
import gbpRoutes from './routes/gbp';
import scanRoutes from './routes/scan';
import scanMetricsRoutes from './routes/scan-metrics';
import quickStartRoutes from './routes/quick-start';
import tenantsRoutes from './routes/tenants';
import productLikesRoutes from './routes/product-likes';
import adminToolsRoutes from './routes/admin-tools';
import adminUsersRoutes from './routes/admin-users';
import cachedProductsRoutes from './routes/cached-products';
import featureOverridesRoutes from './routes/admin/feature-overrides';
import tierSystemRoutes from './routes/admin/tier-system';
// import testGbpRoutes from './routes/test-gbp';
import googleBusinessOAuthRoutes from './routes/google-business-oauth';
import googleMerchantOAuthRoutes from './routes/google-merchant-oauth';
// import cloverRoutes from './routes/integrations/clover';
// import emailTestRoutes from './routes/email-test';
// Legacy Square routes (lazy import) - replaced by /api/integrations routes
// let squareRoutes: any = null;
// const getSquareRoutes = async () => {
//   if (!squareRoutes) {
//     const { default: routes } = await import('./square/square.routes');
//     squareRoutes = routes;
//   }
//   return squareRoutes;
// };
// Temporarily disable all route imports except essential ones
// import dashboardRoutes from './routes/dashboard'; // FIXED VERSION
// import dashboardConsolidatedRoutes from './routes/dashboard-consolidated';
// import tenantTierRoutes from './routes/tenant-tier';
// import promotionRoutes from './routes/promotion';
// import tenantLimitsRoutes from './routes/tenant-limits';

// Temporarily disable all route imports to isolate startup issue
// import testGbpSyncRoutes from './routes/test-gbp-sync';
// import emailManagementRoutes from './routes/email-management';

// Essential routes only - disable all others
// import feedJobsRoutes from './routes/feed-jobs';
// import feedbackRoutes from './routes/feedback';
// import tenantCategoriesRoutes from './routes/tenant-categories';
// import quickStartRoutes from './routes/quick-start';
// import tenantFlagsRoutes from './routes/tenant-flags';
// import adminToolsRoutes from './routes/admin-tools';
// import featureOverridesRoutes from './routes/admin/feature-overrides';
// import tierManagementRoutes from './routes/admin/tier-management';
// import tierSystemRoutes from './routes/admin/tier-system';
// import cloverRoutes from './routes/integrations/clover';
// import emailTestRoutes from './routes/email-test';
// import categoriesPlatformRoutes from './routes/categories.platform';
// import categoriesTenantRoutes from './routes/categories.tenant';
// import categoriesMirrorRoutes from './routes/categories.mirror';
// import mirrorAdminRoutes from './routes/mirror.admin';
// import syncLogsRoutes from './routes/sync-logs';
// import scanMetricsRoutes from './routes/scan-metrics';
// import testGbpSyncRoutes from './routes/test-gbp-sync';

const app = express();

/* ------------------------- middleware ------------------------- */
app.use(cors({
  origin: [/localhost:\d+$/, /\.vercel\.app$/, /vercel\.app$/ ,/www\.visibleshelf\.com$/, /visibleshelf\.com$/, /\.visibleshelf\.com$/, /visibleshelf\.store$/, /\.visibleshelf\.store$/],
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['content-type','authorization','x-csrf-token','x-tenant-id','x-no-retry'],
}));
app.use(express.json({ limit: "50mb" })); // keep large to support base64 in dev
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 🌟 UNIVERSAL TRANSFORM MIDDLEWARE - Makes naming conventions irrelevant!
// Both snake_case AND camelCase work everywhere - API code and frontend get what they expect
// import { universalTransformMiddleware } from './middleware/universal-transform';
// app.use(universalTransformMiddleware);

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


/* -------------------- static uploads (filesystem for MVP) -------------------- */
const DEV = process.env.NODE_ENV !== "production";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
// Create upload directory in both dev and production for MVP
if (!fs.existsSync(UPLOAD_DIR)) {
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
}
// Serve uploads statically in both dev and production for MVP
app.use("/uploads", express.static(UPLOAD_DIR));

/* ------------------------------ tenants ------------------------------ */
import tenantCategoriesRoutes from './routes/tenant-categories';

// Health check route
const healthRoutes = (req: any, res: any) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown'
  });
};

app.use('/health', healthRoutes);

// TENANTS - Now handled by tenantsRoutes below
// app.get("/api/tenants", authenticateToken, async (req, res) => {
//   try {
//     // Platform users (admin, support, viewer) see all tenants, regular users see only their tenants
//     const { isPlatformUser } = await import('./utils/platform-admin');
    
//     // Query parameters for filtering
//     const includeArchived = req.query.includeArchived === 'true';
//     const statusFilter = req.query.status as string;
    
//     // Build where clause
//     const baseWhere = isPlatformUser(req.user) ? {} : {
//       user_tenants: {
//         some: {
//           user_id: req.user?.userId
//         }
//       }
//     };
    
//     // Add status filtering - include archived by default unless specifically excluded
//     let statusCondition: any = {};
//     if (statusFilter) {
//       // Specific status requested
//       statusCondition = { location_status: statusFilter };
//     } else if (includeArchived === false) {
//       // Explicitly exclude archived
//       statusCondition = { location_status: { not: 'archived' } };
//     }
//     // Default: include all statuses including archived
    
//     const tenants = await prisma.tenants.findMany({ 
//       where: {
//         ...baseWhere,
//         ...statusCondition,
//       },
//       orderBy: { created_at: "desc" },
//       include: {
//         organizations_list: {
//           select: {
//             id: true,
//             name: true,
//           }
//         }
//       }
//     });
    
//     // Transform for frontend compatibility - convert organizations_list to organization
//     const transformedTenants = tenants.map(tenant => ({
//       id: tenant.id,
//       name: tenant.name,
//       organizationId: tenant.organization_id,
//       subscriptionTier: tenant.subscription_tier,
//       subscriptionStatus: tenant.subscription_status,
//       locationStatus: tenant.location_status || 'active',
//       createdAt: tenant.created_at,
//       organization: tenant.organizations_list ? {
//         id: tenant.organizations_list.id,
//         name: tenant.organizations_list.name,
//       } : null,
//     }));
    
//     res.json(transformedTenants);
//   } catch (_e) {
//     res.status(500).json({ error: "failed_to_list_tenants" });
//   }
// });


// GET /api/tenants/my-subdomains - Get all subdomains for the current user's tenants
// Query param: tenantId (optional) - scope to specific tenant
app.get("/api/tenants/my-subdomains", authenticateToken, async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.userId || user?.user_id || user?.id;
    const requestedTenantId = req.query.tenantId as string;

    // Get all tenants for this user
    const userTenants = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            created_at: true
          }
        }
      }
    });

    let filteredUserTenants = userTenants;

    // If tenantId is specified, filter to just that tenant
    if (requestedTenantId) {
      filteredUserTenants = userTenants.filter(ut => ut.tenants.id === requestedTenantId);
    }

    // Filter tenants that have subdomains and format the response
    const subdomains = filteredUserTenants
      .filter(ut => ut.tenants.subdomain)
      .map(ut => {
        // Detect platform domain (similar to frontend logic)
        let platformDomain = 'visibleshelf.com';
        let protocol = 'https';
        let port = '';
        
        if (req.headers.host) {
          const hostname = req.headers.host.split(':')[0]; // Remove port if present
          if (hostname.endsWith('.visibleshelf.com')) {
            platformDomain = 'visibleshelf.com';
          } else if (hostname.endsWith('.visibleshelf.store')) {
            platformDomain = 'visibleshelf.store';
          } else if (hostname.endsWith('.localhost') || hostname === 'localhost') {
            platformDomain = 'localhost';
            protocol = 'http'; // Use HTTP for localhost
            port = ':3000'; // Include port for localhost
          }
        }

        return {
          tenantId: ut.tenants.id,
          tenantName: ut.tenants.name,
          subdomain: ut.tenants.subdomain,
          createdAt: ut.tenants.created_at,
          url: `${protocol}://${ut.tenants.subdomain}.${platformDomain}${port}`,
          platformDomain,
          isCurrentTenant: requestedTenantId ? ut.tenants.id === requestedTenantId : false
        };
      });

    res.json({
      success: true,
      subdomains,
      total: subdomains.length,
      scopedToTenant: !!requestedTenantId
    });
  } catch (error: any) {
    console.error('[TENANTS] Error fetching user subdomains:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch subdomains'
    });
  }
});


app.get("/api/tenants/:id", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    let tenant = await prisma.tenants.findUnique({ 
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        created_at: true,
        region: true,
        language: true,
        currency: true,
        subscription_status: true,
        subscription_tier: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        stripe_customer_id: true,
        stripe_subscription_id: true,
        organization_id: true,
        service_level: true,
        managed_services_active: true,
        dedicated_manager: true,
        monthly_sku_quota: true,
        skus_added_this_month: true,
        google_business_access_token: true,
        google_business_refresh_token: true,
        google_business_token_expiry: true,
        created_by: true,
        location_status: true,
        status_changed_at: true,
        status_changed_by: true,
        reopening_date: true,
        closure_reason: true,
        slug: true,
        google_sync_enabled: true,
        google_last_sync: true,
        google_product_count: true,
        directory_visible: true,
        metadata: true,
        data_policy_accepted: true,
      }
    });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });
    
    const now = new Date();
    
    // Auto-set trial expiration date if missing for trial users
    if (
      tenant.subscription_status === "trial" &&
      !tenant.trial_ends_at
    ) {
      const trial_ends_at = new Date();
      trial_ends_at.setDate(trial_ends_at.getDate() + TRIAL_CONFIG.durationDays);
      
      tenant = await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          trial_ends_at: trial_ends_at,
          subscription_status: "trial",
        },
      });
    }
    
    // Check if trial has expired and mark as expired
    // If there is no active subscription attached, downgrade tier to internal google_only
    if (
      tenant.subscription_status === "trial" &&
      tenant.trial_ends_at &&
      tenant.trial_ends_at < now
    ) {
      const hasStripeSubscription = !!tenant.stripe_subscription_id;


      tenant = await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          subscription_status: "expired",
          // For maintenance-only accounts without a paid subscription, force internal google_only tier
          subscription_tier: hasStripeSubscription ? tenant.subscription_tier : "google_only",
        },
      });
    }
    
    // Add location status info
    const { getLocationStatusInfo } = await import('./utils/location-status');
    const statusInfo = getLocationStatusInfo(tenant.location_status);
    
    res.json({
      ...tenant,
      statusInfo,
    });
  } catch (e: any) {
    console.error('[GET /tenants/:id] Error:', e);
    res.status(500).json({ error: "failed_to_get_tenant", details: e?.message });
  }
});

const createTenantSchema = z.object({ 
  name: z.string().min(1),
  ownerId: z.string().optional(), // Optional: specify a different owner (for PLATFORM_SUPPORT)
});
app.post("/api/tenants", authenticateToken, checkTenantCreationLimit, async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  
  try {
    // Determine who will own this tenant
    // If ownerId is provided and user is PLATFORM_SUPPORT, use that owner
    // Otherwise, the authenticated user becomes the owner
    const userId = req.user!.userId || req.user!.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'authentication_required', message: 'Invalid user ID' });
    }
    
    const ownerId = (req.user?.role === user_role.PLATFORM_SUPPORT || req.user?.role === user_role.PLATFORM_ADMIN) && parsed.data.ownerId 
      ? parsed.data.ownerId 
      : userId;
    
    
    // Validate for duplicates (check against the owner, not the creator)
    const { validateTenantCreation } = await import('./utils/tenant-validation');
    const validation = await validateTenantCreation(
      ownerId,
      parsed.data.name
    );
    
    if (!validation.valid) {
      return res.status(409).json({
        error: 'duplicate_tenant',
        message: 'A location with this information already exists',
        validationErrors: validation.errors,
      });
    }
    
    // Set trial to expire based on configured trial duration
    const trial_ends_at = new Date();
    trial_ends_at.setDate(trial_ends_at.getDate() + TRIAL_CONFIG.durationDays);
    
    // Create tenant and link to user manually (not using $transaction to avoid issues)

    // Create the tenant first

    const tenant = await prisma.tenants.create({
      data: {
        id: generateTenantId(),
        name: parsed.data.name,
        subscription_tier: 'starter',
        subscription_status: 'trial',
        trial_ends_at: trial_ends_at,
        created_by: req.user?.userId || null, // Optional field - null if user not authenticated
      }
    });


    // Now create the UserTenant link (tenant should be committed now)

    // Add debugging to check if tenant still exists before UserTenant creation
    const tenantCheck = await prisma.tenants.findUnique({
      where: { id: tenant.id }
    });

    if (!tenantCheck) {
      console.error('[POST /tenants] CRITICAL: Tenant disappeared before UserTenant creation!');
      return res.status(500).json({ error: "tenant_creation_failed", message: "Tenant was created but is no longer accessible" });
    }

    const userTenant = await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(ownerId, tenant.id),
        user_id: ownerId,
        tenant_id: tenant.id,
        role: 'OWNER' as const,
        updated_at: new Date(),
      },
    });


    // Try to create initial status log (optional - don't fail if table doesn't exist)
    try {
      // Note: location_status_logs model is ignored in Prisma schema
      // Skip creating status log for now
      // await prisma.location_status_logs.create({
      //   data: {
      //     tenant_id: tenant.id,
      //     oldStatus: 'pending', // New tenants start as pending
      //     newStatus: 'active', // But get activated immediately
      //     changedBy: req.user?.userId || 'system',
      //     reason: 'Initial tenant creation',
      //     reopening_date: null,
      //     metadata: {
      //       userAgent: req.headers['user-agent'] || null,
      //       ip: req.ip || (Array.isArray(req.headers['x-forwarded-for']) 
      //         ? req.headers['x-forwarded-for'][0] 
      //         : req.headers['x-forwarded-for']) || null,
      //     },
      //   },
      // });
    } catch (logError: any) {
      console.warn('[POST /tenants] Could not create initial status log (table may not exist):', logError.message);
      // Don't fail the entire operation if logging fails
    }

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
app.put("/api/tenants/:id", authenticateToken, checkTenantAccess, async (req, res) => {
  const parsed = updateTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.region !== undefined) data.region = parsed.data.region;
    if (parsed.data.language !== undefined) data.language = parsed.data.language;
    if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
    const tenant = await prisma.tenants.update({ where: { id: req.params.id }, data });
    res.json(tenant);
  } catch (e) {
    console.error('[PUT /tenants/:id] Error updating tenant:', e);
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

// PATCH /tenants/:id - Update tenant subscription tier (admin only)
const patchTenantSchema = z.object({
  subscription_tier: z.enum(['google_only', 'starter', 'professional', 'enterprise', 'organization']).optional(),
  subscription_status: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
  organization_id: z.string().optional(), // For linking to organization
});
app.patch("/api/tenants/:id", authenticateToken, requireAdmin, validateTierAssignment, validateTierCompatibility, validateTierSKUCompatibility, async (req, res) => {
  const parsed = patchTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const tenant = await prisma.tenants.update({ 
      where: { id: req.params.id }, 
      data: parsed.data 
    });
    res.json(tenant);
  } catch (e: any) {
    console.error('[PATCH /tenants/:id] Error:', e);
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

// POST /api/tenants/:id/geocode - Geocode tenant address and update coordinates
app.post("/api/tenants/:id/geocode", async (req, res) => {
  try {
    const { id } = req.params;
    const { basePrisma } = await import('./prisma');
    
    // Get tenant's address from directory_listings_list
    const listingResult = await basePrisma.$queryRaw<any[]>`
      SELECT address, city, state, zip_code, business_name
      FROM directory_listings_list
      WHERE tenant_id = ${id}
      LIMIT 1
    `;
    
    if (!listingResult || listingResult.length === 0) {
      return res.status(404).json({ error: "tenant_not_found" });
    }
    
    const listing = listingResult[0];
    if (!listing.address || !listing.city || !listing.zip_code) {
      return res.status(400).json({ error: "incomplete_address", message: "Address, city, and zip code are required for geocoding" });
    }
    
    // Build full address string
    const fullAddress = [
      listing.address,
      listing.city,
      listing.state,
      listing.zip_code,
      'USA'
    ].filter(Boolean).join(', ');
    
    console.log(`[POST /api/tenants/${id}/geocode] Geocoding address: ${fullAddress}`);
    
    // Call Google Geocoding API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "geocoding_not_configured", message: "Google Maps API key not configured" });
    }
    
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error(`[POST /api/tenants/${id}/geocode] Geocoding failed:`, geocodeData.status);
      return res.status(400).json({ error: "geocoding_failed", status: geocodeData.status });
    }
    
    const location = geocodeData.results[0].geometry.location;
    const latitude = location.lat;
    const longitude = location.lng;
    
    console.log(`[POST /api/tenants/${id}/geocode] Got coordinates: ${latitude}, ${longitude}`);
    
    // Update both tables
    await basePrisma.$executeRaw`
      UPDATE "tenant_business_profiles_list" 
      SET latitude = ${latitude}, 
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;
    
    await basePrisma.$executeRaw`
      UPDATE "directory_listings_list" 
      SET latitude = ${latitude}, 
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;
    
    console.log(`[POST /api/tenants/${id}/geocode] Updated coordinates for ${listing.business_name}`);
    
    res.json({
      success: true,
      coordinates: { latitude, longitude },
      address: fullAddress,
      tenant_id: id,
    });
  } catch (error: any) {
    console.error('[POST /api/tenants/:id/geocode] Error:', error);
    res.status(500).json({ error: "geocoding_error", message: error.message });
  }
});

// PATCH /api/tenants/:id/coordinates - Update tenant coordinates (for auto-geocoding)
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

app.patch("/api/tenants/:id/coordinates", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = coordinatesSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_coordinates", details: parsed.error.flatten() });
    }

    // Update tenant coordinates in business profile
    const { basePrisma } = await import('./prisma');
    await basePrisma.$executeRaw`
      UPDATE "tenant_business_profiles_list" 
      SET latitude = ${parsed.data.latitude}, 
          longitude = ${parsed.data.longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    // Also update directory_listings_list so coordinates appear in directory/map immediately
    await basePrisma.$executeRaw`
      UPDATE "directory_listings_list" 
      SET latitude = ${parsed.data.latitude}, 
          longitude = ${parsed.data.longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    const tenant = await prisma.tenants.findUnique({
      where: { id },
    });

    console.log(`[PATCH /api/tenants/${id}/coordinates] Updated coordinates for ${tenant?.name || 'unknown'} in business_profiles and directory_listings:`, parsed.data);

    res.json({
      success: true,
      coordinates: parsed.data,
      tenant_id: id,
    });
  } catch (error: any) {
    console.error('[PATCH /api/tenants/:id/coordinates] Error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "tenant_not_found" });
    }
    res.status(500).json({ error: "failed_to_update_coordinates" });
  }
});

app.delete("/api/tenants/:id", authenticateToken, checkTenantAccess, requireTenantOwner, async (req, res) => {
  try {
    const tenant_id = req.params.id;
    
    // Explicitly delete directory-related data to prevent orphaned listings
    await prisma.directory_featured_listings_list.deleteMany({
      where: { tenant_id },
    });
    
    await prisma.directory_settings_list.deleteMany({
      where: { tenant_id },
    });
    
    // Delete the tenant (cascade will handle other relations)
    await prisma.tenants.delete({ where: { id: tenant_id } });
    
    console.log(`[Audit] Tenant deleted: ${tenant_id} (including directory listings)`);
    res.status(204).end();
  } catch (error: any) {
    console.error('[DELETE /tenants/:id] Error:', error);
    res.status(500).json({ error: "failed_to_delete_tenant" });
  }
});

// Location Status Management Endpoints
import {
  validateStatusChange,
  canChangeStatus,
  getLocationStatusInfo,
  getStatusChangeImpact,
  getStatusTransitions,
  UserRole
} from './utils/location-status';

// Change location status
app.patch("/api/tenants/:id/status", authenticateToken, checkTenantAccess, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { status, reason, reopening_date } = req.body;

  console.log(`[PATCH /tenants/${id}/status] Starting status change request`, {
    userId: req.user?.userId,
    userRole: req.user?.role,
    tenant_id: id,
    requestedStatus: status,
    reason: reason?.substring(0, 100), // Truncate long reasons
    reopening_date,
    timestamp: new Date().toISOString()
  });

  try {
    // Check if user can change status
    const userRole = req.user?.role || 'USER';
    // Map deprecated roles to valid UserRole values
    let normalizedRole: user_role;
    switch (userRole) {
      case 'ADMIN':
        normalizedRole = user_role.PLATFORM_ADMIN;
        break; 
      case 'OWNER':
        normalizedRole = user_role.TENANT_OWNER;
        break;
      case 'USER':
        normalizedRole = user_role.TENANT_VIEWER;
        break;
      case user_role.ADMIN:
        normalizedRole = user_role.PLATFORM_ADMIN;
        break; 
      case user_role.OWNER:
        normalizedRole = user_role.TENANT_OWNER;
        break;
      case 'USER':
        normalizedRole = user_role.TENANT_VIEWER;
        break;
      default:
        // Try to map existing valid roles, default to viewer for safety
        normalizedRole = (['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER', 'TENANT_MEMBER', 'TENANT_VIEWER'] as const).includes(userRole as UserRole)
          ? userRole as UserRole
          : 'TENANT_VIEWER';
    }
    const tenantRole = req.user?.tenantIds?.includes(id) ? 'TENANT_ADMIN' : normalizedRole;

    console.log(`[PATCH /tenants/${id}/status] Permission check`, {
      userRole,
      normalizedRole,
      tenantRole,
      canChange: canChangeStatus(tenantRole)
    });
    
    if (!canChangeStatus(tenantRole)) {
      console.log(`[PATCH /tenants/${id}/status] Permission denied for user ${req.user?.userId}`);
      return res.status(403).json({ 
        error: "insufficient_permissions", 
        message: "You don't have permission to change location status" 
      });
    }

    // Get current tenant
    console.log(`[PATCH /tenants/${id}/status] Fetching tenant data`);
    const tenant = await prisma.tenants.findUnique({ where: { id } });
    if (!tenant) {
      console.log(`[PATCH /tenants/${id}/status] Tenant not found`);
      return res.status(404).json({ error: "tenant_not_found" });
    }

    console.log(`[PATCH /tenants/${id}/status] Current tenant status`, {
      currentStatus: tenant.location_status,
      requestedStatus: status,
      statusMatch: tenant.location_status === status
    });

    // Check if status is actually changing
    if (tenant.location_status === status) {
      console.log(`[PATCH /tenants/${id}/status] No change needed - tenant already has status '${status}'`);
      const responseTime = Date.now() - startTime;
      console.log(`[PATCH /tenants/${id}/status] Completed in ${responseTime}ms (no-op)`);
      return res.json({
        ...tenant,
        statusInfo: getLocationStatusInfo(status),
        message: "Status unchanged - no update performed"
      });
    }

    // Validate status change
    console.log(`[PATCH /tenants/${id}/status] Validating status change from '${tenant.location_status}' to '${status}'`);
    const validation = validateStatusChange(tenant.location_status, status, reason);
    if (!validation.valid) {
      console.log(`[PATCH /tenants/${id}/status] Validation failed: ${validation.error}`);
      return res.status(400).json({ 
        error: "invalid_status_change", 
        message: validation.error 
      });
    }

    console.log(`[PATCH /tenants/${id}/status] Validation passed, preparing transaction`);

    let auditLogId: string | null = null;

    // Update tenant status (location status logs are ignored in Prisma schema)
    const updated = await basePrisma.tenants.update({
      where: { id },
      data: {
        location_status: status,
        status_changed_at: new Date(),
        status_changed_by: req.user?.userId,
        reopening_date: reopening_date ? new Date(reopening_date) : null,
        closure_reason: reason || null,
      },
    });

    auditLogId = null; // No audit log created since model is ignored

    console.log(`[PATCH /tenants/${id}/status] Transaction successful`, {
      updatedTenantId: updated.id,
      auditLogId,
      newStatus: updated.location_status,
    });

    // Record status change in history (using raw SQL since table is ignored in Prisma)
    try {
      const { basePrisma } = await import('./prisma');
      await basePrisma.$executeRaw`
        INSERT INTO location_status_logs (
          tenant_id, old_status, new_status, changed_by, reason, reopening_date
        ) VALUES (
          ${id}, ${tenant.location_status}::location_status, ${status}::location_status, ${req.user?.userId || null}, ${reason || null}, ${reopening_date ? new Date(reopening_date) : null}
        )
      `;
      console.log(`[PATCH /tenants/${id}/status] Status change logged to history`);
    } catch (historyError) {
      console.error(`[PATCH /tenants/${id}/status] Failed to log status change to history:`, historyError);
      // Don't fail the request if history logging fails
    }

    // Sync to Google Business Profile (async, don't block response)
    const { syncLocationStatusToGoogle } = await import('./services/GoogleBusinessStatusSync');
    console.log(`[PATCH /tenants/${id}/status] Triggering GBP sync`);
    syncLocationStatusToGoogle(id, status, reopening_date ? new Date(reopening_date) : null)
      .then((result) => {
        if (result.success) {
          console.log(`[Status Change] Google sync successful for tenant ${id}:`, result.gbpStatus);
        } else if (result.skipped) {
          console.log(`[Status Change] Google sync skipped for tenant ${id}:`, result.reason);
        } else {
          console.error(`[Status Change] Google sync failed for tenant ${id}:`, result.error);
        }
      })
      .catch((error) => {
        console.error(`[Status Change] Google sync error for tenant ${id}:`, error);
      });

    // TODO: Send notifications (Phase 6)

    const responseTime = Date.now() - startTime;
    console.log(`[PATCH /tenants/${id}/status] Completed successfully in ${responseTime}ms`);

    res.json({
      ...updated,
      statusInfo: getLocationStatusInfo(status),
      auditLogId,
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[PATCH /tenants/${id}/status] Error after ${responseTime}ms:`, {
      error: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
      userId: req.user?.userId,
      tenant_id: id,
      requestedStatus: status
    });
    res.status(500).json({ error: "failed_to_update_status", details: error.message });
  }
});

// Get status change impact preview
app.post("/api/tenants/:id/status/preview", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const tenant = await prisma.tenants.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    const impact = getStatusChangeImpact(tenant.location_status as any, status);
    
    // For preview, only check if transition is allowed (don't require reason yet)
    const allowedTransitions = getStatusTransitions(tenant.location_status as any);
    const valid = allowedTransitions.includes(status);
    const error = valid ? undefined : `Cannot transition from ${tenant.location_status} to ${status}. Allowed transitions: ${allowedTransitions.join(', ')}`;
    
    res.json({
      currentStatus: tenant.location_status,
      newStatus: status,
      valid,
      error,
      impact,
    });
  } catch (error: any) {
    console.error('[POST /api/tenants/:id/status/preview] Error:', error);
    res.status(500).json({ error: "failed_to_preview_status", details: error.message });
  }
});
app.get("/api/tenants/:id/status-history", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Fetch status history using raw SQL
    const { basePrisma } = await import('./prisma');
    const historyResults = await basePrisma.$queryRaw`
      SELECT 
        id, tenant_id, old_status::text, new_status::text, changed_by, reason, reopening_date, created_at
      FROM location_status_logs 
      WHERE tenant_id = ${id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    // Enrich with user information and status info
    const history = (historyResults as any[]).map(log => ({
      id: log.id,
      tenantId: log.tenant_id,
      oldStatus: log.old_status,
      newStatus: log.new_status,
      changedBy: log.changed_by,
      reason: log.reason,
      reopeningDate: log.reopening_date,
      createdAt: log.created_at,
      oldStatusInfo: getLocationStatusInfo(log.old_status),
      newStatusInfo: getLocationStatusInfo(log.new_status),
    }));

    res.json({
      history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('[GET /api/tenants/:id/status-history] Error:', error);
    res.status(500).json({ error: "failed_to_get_status_history", details: error.message });
  }
});

// Get tenants by status (admin only)
app.get("/api/tenants/by-status/:status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      prisma.tenants.findMany({
        where: { location_status: status as any },
        skip,
        take: limit,
        orderBy: { status_changed_at: 'desc' },
        select: {
          id: true,
          name: true,
          location_status: true,
          status_changed_at: true,
          status_changed_by: true,
          reopening_date: true,
          closure_reason: true,
          subscription_tier: true,
          subscription_status: true,
        },
      }),
      prisma.tenants.count({ where: { location_status: status as any } }),
    ]);

    res.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[GET /api/tenants/by-status/:status] Error:', error);
    res.status(500).json({ error: "failed_to_get_tenants", details: error.message });
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
    .refine((v) => {
      if (!v) return true; // Allow empty
      try {
        new URL(v); // Check if it's a valid URL
        return HTTPS_URL.test(v); // Check if it starts with https://
      } catch {
        return false; // Invalid URL format
      }
    }, { message: "Invalid URL" })
    .optional(),
  contact_person: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  banner_url: z.string().url().optional().or(z.literal('')),
  business_description: z.string().optional(),
  hours: z.any().optional(),
  social_links: z.any().optional(),
  seo_tags: z.any().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  display_map: z.boolean().optional(),
  map_privacy_mode: z.enum(["precise","neighborhood"]).optional(),
});

app.post("/api/tenant/profile", authenticateToken, async (req, res) => {
  const parsed = tenantProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    console.error('[POST /tenant/profile] Validation failed:', parsed.error.flatten());
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  
  try {
    const { tenant_id, ...profileData } = parsed.data;
    console.log('[POST /tenant/profile] Starting for tenant:', tenant_id);
    console.log('[POST /tenant/profile] Profile data:', profileData);
    
    const existingTenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!existingTenant) {
      console.error('[POST /tenant/profile] Tenant not found:', tenant_id);
      return res.status(404).json({ error: "tenant_not_found" });
    }
    console.log('[POST /tenant/profile] Found tenant:', existingTenant.name);

    // Use raw SQL instead of Prisma client since it doesn't recognize the new table
    // Import basePrisma to bypass retry wrapper
    const { basePrisma } = await import('./prisma');
    
    // Check if profile exists
    const existingProfiles = await basePrisma.$queryRaw`
      SELECT tenant_id FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
    `;
    console.log('[POST /tenant/profile] Existing profiles check result:', existingProfiles);

    let result;
    if ((existingProfiles as any[]).length > 0) {
      console.log('[POST /tenant/profile] Updating existing profile');
      // Update existing profile - build dynamic update query
      const updateParts = [];
      const values = [];

      Object.entries(profileData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateParts.push(`"${key}" = $${values.length + 1}`);
          values.push(value === '' ? null : value);
        }
      });

      if (updateParts.length > 0) {
        updateParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(tenant_id); // Add tenant_id at the end
        const updateQuery = `
          UPDATE "tenant_business_profiles_list"
          SET ${updateParts.join(', ')}
          WHERE tenant_id = $${values.length}
        `;
        console.log('[POST /tenant/profile] Update query:', updateQuery);
        console.log('[POST /tenant/profile] Update values:', values);
        await basePrisma.$executeRawUnsafe(updateQuery, ...values);
        console.log('[POST /tenant/profile] Update executed successfully');
      }

      // Get updated profile (exclude geography column to avoid Prisma deserialization error)
      result = await basePrisma.$queryRaw`
        SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
      `;
      console.log('[POST /tenant/profile] Retrieved updated profile');
    } else {
      console.log('[POST /tenant/profile] Creating new profile');
      // Create new profile
      const insertFields = ['tenant_id', 'business_name', 'address_line1', 'city', 'postal_code', 'country_code'];
      const insertValues = [
        tenant_id,
        profileData.business_name || existingTenant.name,
        profileData.address_line1 || '',
        profileData.city || '',
        profileData.postal_code || '',
        (profileData.country_code || 'US').toUpperCase()
      ];
      console.log('[POST /tenant/profile] Insert fields:', insertFields);
      console.log('[POST /tenant/profile] Insert values:', insertValues);

      // Add optional fields
      const optionalMappings = {
        address_line2: profileData.address_line2,
        state: profileData.state,
        phone_number: profileData.phone_number,
        email: profileData.email,
        website: profileData.website,
        contact_person: profileData.contact_person,
        logo_url: profileData.logo_url,
        banner_url: profileData.banner_url,
        business_description: profileData.business_description,
        hours: (profileData as any).hours,
        social_links: (profileData as any).social_links,
        seo_tags: (profileData as any).seo_tags,
        latitude: (profileData as any).latitude,
        longitude: (profileData as any).longitude,
        display_map: (profileData as any).display_map,
        map_privacy_mode: (profileData as any).map_privacy_mode,
      };
      console.log('[POST /tenant/profile] Optional mappings social_links:', optionalMappings.social_links);

      // Always add updated_at field with current timestamp
      insertFields.push('updated_at');
      // Don't push a value for updated_at, we'll use CURRENT_TIMESTAMP in SQL

      const placeholders = insertFields.map((field, i) => {
        if (field === 'updated_at') {
          return 'CURRENT_TIMESTAMP';
        }
        // Calculate parameter index excluding updated_at
        const paramIndex = insertFields.slice(0, i).filter(f => f !== 'updated_at').length + 1;
        return `$${paramIndex}`;
      });
      
      const insertQuery = `
        INSERT INTO "tenant_business_profiles_list" (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      console.log('[POST /tenant/profile] Insert query:', insertQuery);
      console.log('[POST /tenant/profile] Final insert values:', insertValues);

      result = await basePrisma.$executeRawUnsafe(insertQuery, ...insertValues).then(() =>
        basePrisma.$queryRaw`SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}`
      );
      console.log('[POST /tenant/profile] Created new profile');
    }

    // Keep Tenant.name in sync
    if (profileData.business_name) {
      console.log('[POST /tenant/profile] Updating tenant name to:', profileData.business_name);
      await prisma.tenants.update({ where: { id: tenant_id }, data: { name: profileData.business_name } });
    }

    console.log('[POST /tenant/profile] Success, returning result:', (result as any)[0] || result);
    res.json((result as any)[0] || result);
  } catch (e: any) {
    console.error("[POST /tenant/profile] Full error details:", {
      message: e?.message,
      stack: e?.stack,
      code: e?.code,
      name: e?.name,
      tenant_id: req.body?.tenant_id
    });
    res.status(500).json({ error: "failed_to_save_profile" });
  }
});

// GET /api/tenant/profile - retrieve normalized profile
app.get("/api/tenant/profile", authenticateToken, async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id as string) || (req.query.tenant_id as string);
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    // Use raw SQL instead of Prisma client since it doesn't recognize the new table
    // Exclude geography column to avoid Prisma deserialization error
    const { basePrisma } = await import('./prisma');
    const bpResults = await basePrisma.$queryRaw`
      SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
    `;
    const bp = (bpResults as any[])[0] || null;
    
    // Fetch business hours from BusinessHours table (optional - tables may not exist)
    let businessHours = null;
    let specialHours = null;
    try {
      const businessHoursResults = await basePrisma.$queryRaw`
        SELECT * FROM "business_hours_list" WHERE tenant_id = ${tenant_id}
      `;
      businessHours = (businessHoursResults as any[])[0] || null;
      
      const specialHoursResults = await basePrisma.$queryRaw`
        SELECT * FROM "business_hours_special_list" WHERE tenant_id = ${tenant_id}
      `;
      specialHours = (specialHoursResults as any[])[0] || null;
    } catch (error) {
      // Business hours tables don't exist yet - continue without them
      console.log('[GET /tenant/profile] Business hours tables not found, continuing without them');
    }
    
    const md = (tenant.metadata as any) || {};
    const profile = {
      tenant_id: tenant.id,
      business_name: bp?.businessName || md.businessName || tenant.name || null,
      address_line1: bp?.address_line1 || md.address_line1 || null,
      address_line2: bp?.address_line2 || md.address_line2 || null,
      city: bp?.city || md.city || null,
      state: bp?.state || md.state || null,
      postal_code: bp?.postal_code || md.postal_code || null,
      country_code: bp?.country_code || md.country_code || null,
      phone_number: bp?.phone_number || md.phone_number || null,
      email: bp?.email || md.email || null,
      website: bp?.website || md.website || null,
      contact_person: bp?.contact_person || md.contact_person || null,
      logo_url: bp?.logo_url ?? md.logo_url ?? null,
      banner_url: bp?.banner_url ?? md.banner_url ?? null,
      business_description: bp?.business_description || md.business_description || null,
      hours: bp?.hours || md.hours || null,
      social_links: bp?.social_links || md.social_links || null,
      seo_tags: bp?.seo_tags || md.seo_tags || null,
      latitude: bp?.latitude ? Number(bp.latitude) : (md.latitude || null),
      longitude: bp?.longitude ? Number(bp.longitude) : (md.longitude || null),
      display_map: bp?.display_map ?? md.display_map ?? false,
      map_privacy_mode: bp?.map_privacy_mode || md.map_privacy_mode || 'precise',
      // GBP category fields from business profile and metadata
      gbpCategoryId: bp?.gbp_category_id || null,
      gbpCategoryName: bp?.gbp_category_name || null,
      gbpCategoryLastMirrored: bp?.gbp_category_last_mirrored || null,
      gbpCategorySyncStatus: bp?.gbp_category_sync_status || null,
      // Secondary categories from metadata
      gbpSecondaryCategories: md?.gbp_categories?.secondary || [],
    };
    return res.json(profile);
  } catch (e: any) {
    console.error("[GET /tenant/profile] Error:", e);
    return res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// PUT /api/tenant/gbp-category - update GBP categories
app.put("/api/tenant/gbp-category", authenticateToken, async (req, res) => {
  try {
    const { tenantId, primary, secondary } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: "tenant_required" });
    }
    
    if (!primary || !primary.id || !primary.name) {
      return res.status(400).json({ error: "primary_category_required" });
    }
    
    console.log('[PUT /api/tenant/gbp-category] Updating GBP categories for tenant:', tenantId);
    console.log('[PUT /api/tenant/gbp-category] Primary:', primary);
    console.log('[PUT /api/tenant/gbp-category] Secondary:', secondary);
    
    // Update business profile with GBP categories using raw SQL
    // (Prisma client needs regeneration to recognize these fields)
    const pool = getDirectPool();
    
    // First, ensure the GBP category exists in gbp_categories_list
    // Insert if not exists (upsert)
    await pool.query(
      `INSERT INTO gbp_categories_list (id, name, display_name, created_at, updated_at)
       VALUES ($1, $2, $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           display_name = EXCLUDED.display_name,
           updated_at = NOW()`,
      [primary.id, primary.name]
    );
    
    console.log('[PUT /api/tenant/gbp-category] GBP category ensured in gbp_categories_list');
    
    // Also ensure secondary categories exist in gbp_categories_list
    if (secondary && Array.isArray(secondary)) {
      for (const secCategory of secondary) {
        if (secCategory.id && secCategory.name) {
          await pool.query(
            `INSERT INTO gbp_categories_list (id, name, display_name, created_at, updated_at)
             VALUES ($1, $2, $2, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name,
                 display_name = EXCLUDED.display_name,
                 updated_at = NOW()`,
            [secCategory.id, secCategory.name]
          );
        }
      }
      console.log(`[PUT /api/tenant/gbp-category] ${secondary.length} secondary categories ensured in gbp_categories_list`);
    }
    
    // Now update the business profile
    await pool.query(
      `UPDATE tenant_business_profiles_list
       SET gbp_category_id = $1,
           gbp_category_name = $2,
           gbp_category_sync_status = 'synced',
           gbp_category_last_mirrored = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $3`,
      [primary.id, primary.name, tenantId]
    );
    
    console.log('[PUT /api/tenant/gbp-category] Business profile updated successfully');
    
    // Also update tenants.metadata with both primary and secondary categories
    // This is needed for backward compatibility during transition
    const gbpMetadata = {
      primary: {
        id: primary.id,
        name: primary.name
      },
      secondary: secondary || [],
      sync_status: 'synced',
      last_synced_at: new Date().toISOString()
    };
    
    await pool.query(
      `UPDATE tenants
       SET metadata = COALESCE(metadata, '{}'::jsonb) || 
         jsonb_build_object('gbp_categories', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(gbpMetadata), tenantId]
    );
    
    console.log('[PUT /api/tenant/gbp-category] Metadata updated with primary and secondary categories');
    
    // NEW: Update junction table with clean relational design
    // Delete existing categories for this tenant
    await pool.query('DELETE FROM tenant_gbp_categories WHERE tenant_id = $1', [tenantId]);
    
    // Insert primary category
    await pool.query(
      `INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type)
       VALUES ($1, $2, 'primary')`,
      [tenantId, primary.id]
    );
    
    console.log('[PUT /api/tenant/gbp-category] Primary category added to junction table');
    
    // Insert secondary categories
    if (secondary && secondary.length > 0) {
      for (const secCategory of secondary) {
        await pool.query(
          `INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type)
           VALUES ($1, $2, 'secondary')`,
          [tenantId, secCategory.id]
        );
      }
      console.log(`[PUT /api/tenant/gbp-category] ${secondary.length} secondary categories added to junction table`);
    }
    
    // Sync GBP categories to gbp_listing_categories junction table
    // Delete existing associations
    await pool.query(
      'DELETE FROM gbp_listing_categories WHERE listing_id = $1',
      [tenantId]
    );
    
    // Insert primary category
    await pool.query(
      `INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
       VALUES ($1, $2, true)`,
      [tenantId, primary.id]
    );
    
    // Insert secondary categories
    if (secondary && secondary.length > 0) {
      for (const cat of secondary) {
        await pool.query(
          `INSERT INTO gbp_listing_categories (listing_id, gbp_category_id, is_primary)
           VALUES ($1, $2, false)`,
          [tenantId, cat.id]
        );
      }
    }
    
    console.log('[PUT /api/tenant/gbp-category] Synced GBP categories to gbp_listing_categories');
    
    // The trigger will automatically refresh the materialized view (with debounce)
    
    return res.json({ 
      success: true,
      message: 'GBP categories updated and synced to directory'
    });
  } catch (e: any) {
    console.error("[PUT /api/tenant/gbp-category] Error:", e);
    return res.status(500).json({ error: "failed_to_update_gbp_category", message: e.message });
  }
});

// Public endpoint to get basic tenant info (no auth required)
app.get("/public/tenant/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    const tenant = await prisma.tenants.findUnique({ 
      where: { id: tenant_id }
    });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    // Check location status for storefront visibility
    const { shouldShowStorefront, getStorefrontMessage } = await import('./utils/location-status');
    const location_status = tenant.location_status as any || 'active';
    const canShowStorefront = shouldShowStorefront(location_status);
    const storefrontMessage = getStorefrontMessage(location_status, tenant.reopening_date);

    // Check if tenant has storefront access (tier-based)
    const tier = tenant.subscription_tier as string;
    const hasStorefrontAccess = tier !== 'google_only'; // google_only doesn't have storefront

    // Storefront is accessible if: tier allows it AND location status allows it
    const finalStorefrontAccess = hasStorefrontAccess && canShowStorefront;

    // Return basic public tenant information with access status
    return res.json({
      id: tenant.id,
      name: tenant.name,
      subscription_tier: tenant.subscription_tier,
      metadata: tenant.metadata,
      location_status,
      reopening_date: tenant.reopening_date,
      access: {
        storefront: finalStorefrontAccess,
      },
      storefrontMessage: storefrontMessage || undefined,
    });
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenant_id] Error:", e);
    return res.status(500).json({ error: "failed_to_get_tenant" });
  }
});

// Public endpoint to get tenant product preview (SWIS - Store Window Inventory Showcase)
app.get("/tenant/:tenant_id/swis/preview", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;
    const sort = (req.query.sort as string) || 'updated_desc';
    
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    // Build sort order
    let orderBy: any = { updated_at: 'desc' };
    switch (sort) {
      case 'updated_desc':
        orderBy = { updated_at: 'desc' };
        break;
      case 'updated_asc':
        orderBy = { updated_at: 'asc' };
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
    const products = await prisma.inventory_items.findMany({
      where: { tenant_id: tenant_id },
      orderBy,
      take: limit,
    });
    
    return res.json({ products, total: products.length });
  } catch (e: any) {
    console.error("[GET /tenant/:tenant_id/swis/preview] Error:", e);
    return res.status(500).json({ error: "failed_to_get_preview" });
  }
});

// Public endpoint for product pages to get tenant business profile (no auth required)
app.get("/public/tenant/:tenant_id/profile", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    // Use raw SQL instead of Prisma client since it doesn't recognize the new table
    const { basePrisma } = await import('./prisma');
    const bpResults = await basePrisma.$queryRaw`
      SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
    `;
    const bp = (bpResults as any[])[0] || null;
    
    // Fetch business hours from BusinessHours table (optional - tables may not exist)
    let businessHours = null;
    let specialHours = null;
    try {
      const businessHoursResults = await basePrisma.$queryRaw`
        SELECT * FROM "business_hours_list" WHERE tenant_id = ${tenant_id}
      `;
      businessHours = (businessHoursResults as any[])[0] || null;
      
      const specialHoursResults = await basePrisma.$queryRaw`
        SELECT * FROM "business_hours_special_list" WHERE tenant_id = ${tenant_id}
      `;
      specialHours = (specialHoursResults as any[]) || [];
    } catch (error) {
      // Business hours tables don't exist yet - continue without them
      console.log('[GET /public/tenant/:tenant_id/profile] Business hours tables not found, continuing without them');
    }
    
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
        hoursByDay.special = specialHours.map((sh: any) => ({
          date: sh.date.toISOString().split('T')[0], // YYYY-MM-DD format
          isClosed: sh.isClosed || sh.is_closed || false,  // ✅ Handle both camelCase and snake_case
          open: sh.open,
          close: sh.close,
          note: sh.note
        }));
        // console.log('[Profile API] Special hours raw data:', specialHours.map(sh => ({ isClosed: sh.isClosed, is_closed: sh.is_closed, date: sh.date })));
        // console.log('[Profile API] Special hours processed:', hoursByDay.special);
      }
      
      hoursData = hoursByDay;
      // console.log('[Profile API] Business hours for', tenant_id, ':', JSON.stringify(hoursData));
    } else {
      // console.log('[Profile API] No business hours found for', tenant_id);
    }
    
    const md = (tenant.metadata as any) || {};
    
    // Return public business information only
    const profile = {
      business_name: bp?.business_name || md.businessName || tenant.name || null,
      address_line1: bp?.address_line1 || md.address_line1 || null,
      address_line2: bp?.address_line2 || md.address_line2 || null,
      city: bp?.city || md.city || null,
      state: bp?.state || md.state || null,
      postal_code: bp?.postal_code || md.postal_code || null,
      country_code: bp?.country_code || md.country_code || null,
      phone_number: bp?.phone_number || md.phone_number || null,
      email: bp?.email || md.email || null,
      website: bp?.website || md.website || null,
      contact_person: bp?.contact_person || md.contact_person || null,
      logo_url: bp?.logo_url ?? md.logo_url ?? null,
      banner_url: bp?.banner_url ?? md.banner_url ?? null,
      business_description: bp?.business_description || md.business_description || null,
      hours: hoursData || bp?.hours || md.hours || null,
      social_links: bp?.social_links || md.social_links || null,
      seo_tags: bp?.seo_tags || md.seo_tags || null,
      latitude: bp?.latitude || md.latitude || null,
      longitude: bp?.longitude || md.longitude || null,
      metadata: tenant.metadata || null, // Include metadata for GBP categories
    };
    return res.json(profile);
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenant_id/profile] Error:", e);
    return res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// Public endpoint to get tenant items for storefront (no auth required)
app.get("/public/tenant/:tenant_id/items", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    // Parse pagination params
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '12', 10);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const categorySlug = req.query.category as string;
    
    // Build where clause - only show active, public items
    const where: any = { 
      tenant_id,
      item_status: 'active',
      visibility: 'public'
    };
    
    // Apply category filter
    if (categorySlug) {
      where.directoryCategory = {
        slug: categorySlug,
      };
    }
    
    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      where.OR = [
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }
    
    // Fetch items with pagination (includes category relation for better UX)
    const [items, totalCount] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventory_items.count({ where }),
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
    console.error("[GET /public/tenant/:tenant_id/items] Error:", e);
    return res.status(500).json({ error: "failed_to_get_items" });
  }
});

// Public endpoint to get tenant categories with product counts (no auth required)
app.get("/public/tenant/:tenant_id/categories", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    // Import category count utility
    const { getCategoryCounts, getUncategorizedCount, getTotalProductCount } = await import('./utils/category-counts');
    
    // Get categories with counts (only active, public products)
    const categories = await getCategoryCounts(tenant_id, false);
    const uncategorizedCount = await getUncategorizedCount(tenant_id, false);
    
    // Calculate total correctly by summing numeric counts, not concatenating strings
    const totalCount = categories.reduce((sum: number, cat: any) => sum + (Number(cat.count) || 0), 0);
    
    // Clean response to avoid field duplication
    const cleanResponse = {
      categories,
      uncategorized_count: uncategorizedCount,
      total_count: totalCount,
    };

    // Send as raw JSON to bypass Express middleware that adds camelCase fields
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (e: any) {
    console.error("[GET /public/tenant/:tenant_id/categories] Error:", e);
    return res.status(500).json({ error: "failed_to_get_categories" });
  }
});

// Product-level categories endpoint (for product sidebar)
app.get("/api/categories/product-level/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    // Use direct database pool to avoid Prisma issues
    const { getDirectPool } = await import('./utils/db-pool');
    const pool = getDirectPool();
    
    // Query categories with product counts directly from inventory_items
    // Group by slug to handle duplicate categories with same slug
    const result = await pool.query(
      `SELECT
        slug,
        SUM(count) as count,
        -- Pick the first category by name for each slug group
        (SELECT json_build_object(
          'id', dc.id,
          'name', dc.name,
          'slug', dc.slug,
          'googleCategoryId', dc."googleCategoryId"
        )
        FROM directory_category dc
        WHERE dc.slug = category_counts.slug
          AND dc."tenantId" = $1
          AND dc."isActive" = true
        ORDER BY dc.name
        LIMIT 1) as category
      FROM (
        SELECT
          dc.slug,
          COUNT(DISTINCT ii.id)::int as count
        FROM directory_category dc
        INNER JOIN inventory_items ii ON ii.directory_category_id = dc.id
        WHERE dc."tenantId" = $1
          AND dc."isActive" = true
          AND ii.tenant_id = $1
          AND ii.item_status = 'active'
          AND ii.visibility = 'public'
        GROUP BY dc.slug
        HAVING COUNT(DISTINCT ii.id) > 0
      ) category_counts
      GROUP BY slug
      ORDER BY slug`,
      [tenant_id]
    );
    
    // Get total product count (ALL active/public products, including uncategorized)
    const totalProductsResult = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM inventory_items ii
       WHERE ii.tenant_id = $1
         AND ii.item_status = 'active'
         AND ii.visibility = 'public'`,
      [tenant_id]
    );
    const totalProducts = totalProductsResult.rows[0]?.count || 0;
    
    // Debug: Check for uncategorized products
    const uncategorizedResult = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM inventory_items ii
       WHERE ii.tenant_id = $1
         AND ii.item_status = 'active'
         AND ii.visibility = 'public'
         AND ii.directory_category_id IS NULL`,
      [tenant_id]
    );
    const uncategorizedCount = uncategorizedResult.rows[0]?.count || 0;
    
    if (uncategorizedCount > 0) {
      console.log(`[Product Categories] Tenant ${tenant_id} has ${uncategorizedCount} uncategorized products`);
    }
    
    // Transform to expected format
    const categories = result.rows.map(cat => ({
      id: cat.category.id,
      name: cat.category.name,
      slug: cat.category.slug,
      googleCategoryId: cat.category.googleCategoryId,
      count: parseInt(cat.count),
      category_type: 'tenant'
    }));
    
    const cleanResponse = {
      success: true,
      data: {
        tenant_id: tenant_id,
        categories: categories,
        summary: {
          total_categories: categories.length,
          total_products: totalProducts,
          category_type: 'product-level'
        }
      }
    };

    // Send as raw JSON to bypass Express middleware
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (e: any) {
    console.error("[GET /api/categories/product-level/:tenant_id] Error:", e);
    return res.status(500).json({ error: "failed_to_get_product_categories" });
  }
});

// Diagnostic endpoint for category count investigation
app.get("/api/diagnostic/category-counts/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    const { getDirectPool } = await import('./utils/db-pool');
    const pool = getDirectPool();
    
    // 1. Check raw inventory_items data
    const rawProductsResult = await pool.query(`
      SELECT 
        directory_category_id,
        COUNT(*) as total_count,
        COUNT(CASE WHEN item_status = 'active' AND visibility = 'public' THEN 1 END) as active_public_count
      FROM inventory_items 
      WHERE tenant_id = $1
      GROUP BY directory_category_id
      ORDER BY directory_category_id
    `, [tenant_id]);
    
    // 2. Check directory_category data
    const categoriesResult = await pool.query(`
      SELECT id, name, slug, "isActive", "tenantId"
      FROM directory_category 
      WHERE "tenantId" = $1
      ORDER BY name
    `, [tenant_id]);
    
    // 3. Check JOIN results (our current count query)
    const joinCountResult = await pool.query(`
      SELECT 
        dc.id,
        dc.name,
        dc.slug,
        COUNT(DISTINCT ii.id)::int as count
      FROM directory_category dc
      INNER JOIN inventory_items ii ON ii.directory_category_id = dc.id
      WHERE dc."tenantId" = $1
        AND dc."isActive" = true
        AND ii.tenant_id = $1
        AND ii.item_status = 'active'
        AND ii.visibility = 'public'
      GROUP BY dc.id, dc.name, dc.slug
      ORDER BY dc.name
    `, [tenant_id]);
    
    // 4. Check storefront filter query (what actually returns products)
    const storefrontFilterResult = await pool.query(`
      SELECT 
        dc.id,
        dc.name,
        dc.slug,
        COUNT(DISTINCT ii.id)::int as count
      FROM inventory_items ii
      LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id
      WHERE ii.tenant_id = $1
        AND ii.item_status = 'active'
        AND ii.visibility = 'public'
        AND dc."tenantId" = $1
        AND dc."isActive" = true
      GROUP BY dc.id, dc.name, dc.slug
      ORDER BY dc.name
    `, [tenant_id]);
    
    // 5. Check for any products with invalid category IDs
    const invalidCategoriesResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        array_agg(DISTINCT directory_category_id) as invalid_category_ids
      FROM inventory_items 
      WHERE tenant_id = $1
        AND directory_category_id IS NOT NULL
        AND directory_category_id NOT IN (
          SELECT id FROM directory_category WHERE "tenantId" = $1
        )
    `, [tenant_id]);
    
    // 6. Check materialized view if it exists
    let mvResult = null;
    try {
      mvResult = await pool.query(`
        SELECT 
          category_id,
          category_name,
          category_slug,
          product_count
        FROM storefront_category_counts
        WHERE tenant_id = $1
          AND category_type = 'tenant'
        ORDER BY category_name
      `, [tenant_id]);
    } catch (mvError) {
      console.log('Materialized view not accessible:', (mvError as Error)?.message || 'Unknown error');
    }
    
    const diagnostic = {
      tenant_id,
      timestamp: new Date().toISOString(),
      raw_products: rawProductsResult.rows,
      categories: categoriesResult.rows,
      join_counts: joinCountResult.rows,
      storefront_filter_counts: storefrontFilterResult.rows,
      invalid_categories: invalidCategoriesResult.rows[0],
      materialized_view: mvResult?.rows || null,
      summary: {
        total_raw_products: rawProductsResult.rows.reduce((sum, r) => sum + parseInt(r.total_count), 0),
        total_active_public: rawProductsResult.rows.reduce((sum, r) => sum + parseInt(r.active_public_count), 0),
        total_categories: categoriesResult.rows.length,
        total_with_valid_categories: joinCountResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
        has_invalid_categories: invalidCategoriesResult.rows[0].count > 0
      }
    };
    
    res.json({
      success: true,
      data: diagnostic
    });
  } catch (e: any) {
    console.error("[Diagnostic] Error:", e);
    return res.status(500).json({ error: "diagnostic_failed", message: e.message });
  }
});

// Store-level categories endpoint (for store sidebar)
// Returns GBP primary and secondary categories for a tenant
app.get("/api/categories/store-level/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });
    
    // Query tenant_google_categories for GBP primary and secondary categories
    const { getDirectPool } = await import('./utils/db-pool');
    const pool = getDirectPool();
    
    const query = `
      SELECT 
        gc.id,
        gc.name,
        gc.display_name,
        tgc.category_type,
        tgc.gbp_category_id,
        CASE WHEN tgc.category_type = 'primary' THEN true ELSE false END as is_primary,
        (SELECT COUNT(*) FROM inventory_items WHERE tenant_id = $1 AND item_status = 'active' AND visibility = 'public') as count
      FROM tenant_gbp_categories tgc
      INNER JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
      WHERE tgc.tenant_id = $1
        AND tgc.category_type IN ('primary', 'secondary')
        AND gc.is_active = true
      ORDER BY 
        CASE WHEN tgc.category_type = 'primary' THEN 0 ELSE 1 END,
        gc.display_name ASC
    `;
    
    const result = await pool.query(query, [tenant_id]);
    
    // Transform to expected format
    const storeCategories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.display_name || row.name,
      slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category_type: row.category_type === 'primary' ? 'gbp_primary' : 'gbp_secondary',
      is_primary: row.is_primary,
      gbp_category_id: row.gbp_category_id,
      count: parseInt(row.count) || 0
    }));
    
    // Clean response to avoid field duplication
    const cleanResponse = {
      success: true,
      data: {
        tenant_id: tenant_id,
        categories: storeCategories,
        summary: {
          total_categories: storeCategories.length,
          total_products: storeCategories.length > 0 ? storeCategories[0].count : 0,
          category_type: 'store-level'
        }
      }
    };

    // Send as raw JSON to bypass Express middleware
    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (e: any) {
    console.error("[GET /api/categories/store-level/:tenant_id] Error:", e);
    return res.status(500).json({ error: "failed_to_get_store_categories" });
  }
});

// Debug endpoint to analyze database structure (development only)
app.post("/public/debug-query", async (req, res) => {
  try {
    const { Pool } = await import('pg');
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "query_required" });
    }
    
    console.log('[POST /public/debug-query] Running analysis query...');
    
    // Use shared connection pool to prevent connection exhaustion
    const { getDirectPool } = await import('./utils/db-pool');
    const pool = getDirectPool();
    
    const result = await pool.query(query);
    // Don't close the shared pool
    
    console.log('[POST /public/debug-query] Query executed successfully');
    
    res.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[POST /public/debug-query] Error:', e);
    return res.status(500).json({ 
      error: "failed_to_execute_query",
      details: e.message 
    });
  }
});

// Public endpoint to refresh materialized views (no auth required for development)
app.post("/public/refresh-materialized-views", async (req, res) => {
  try {
    console.log('[POST /public/refresh-materialized-views] Refreshing storefront_category_counts...');
    
    // Use shared connection pool to prevent connection exhaustion
    const { getDirectPool } = await import('./utils/db-pool');
    const pool = getDirectPool();
    
    // Use non-concurrent refresh since concurrent is not available
    await pool.query('REFRESH MATERIALIZED VIEW storefront_category_counts');
    // Don't close the shared pool
    
    console.log('[POST /public/refresh-materialized-views] Materialized view refreshed successfully');
    
    res.json({
      success: true,
      message: 'Materialized views refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[POST /public/refresh-materialized-views] Error:', e);
    return res.status(500).json({ 
      error: "failed_to_refresh_views",
      details: e.message 
    });
  }
});

// Public endpoint to lookup Google taxonomy category by ID (no auth required)
app.get("/public/google-taxonomy/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) return res.status(400).json({ error: "category_id_required" });
    
    // Import Google taxonomy utility
    const { getCategoryById } = await import('./lib/google/taxonomy');
    
    // Get category by ID
    const category = getCategoryById(categoryId);
    
    if (!category) {
      return res.status(404).json({ error: "category_not_found" });
    }
    
    res.json(category);
  } catch (e: any) {
    console.error("[GET /public/google-taxonomy/:categoryId] Error:", e);
    return res.status(500).json({ error: "failed_to_get_category" });
  }
});

// Authenticated endpoint to get tenant categories with ALL product counts
app.get("/api/tenants/:tenant_id/categories", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    
    // Import category count utility
    const { getCategoryCounts, getUncategorizedCount, getTotalProductCount } = await import('./utils/category-counts');
    
    // Get categories with counts (ALL items, not just public)
    const categories = await getCategoryCounts(tenant_id, true);
    const uncategorizedCount = await getUncategorizedCount(tenant_id, true);
    const totalCount = await getTotalProductCount(tenant_id, true);
    
    res.json({
      categories,
      uncategorizedCount,
      totalCount,
    });
  } catch (e: any) {
    console.error("[GET /api/tenants/:tenant_id/categories] Error:", e);
    return res.status(500).json({ error: "failed_to_get_categories" });
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

// PATCH /api/tenant/profile - partial update
const tenantProfileUpdateSchema = tenantProfileSchema.partial().extend({ tenant_id: z.string().min(1) });
app.patch("/api/tenant/profile", authenticateToken, async (req, res) => {
  const parsed = tenantProfileUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const { tenant_id, ...delta } = parsed.data;
    const existingTenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!existingTenant) return res.status(404).json({ error: "tenant_not_found" });

    // Use raw SQL instead of Prisma client since it doesn't recognize the new table
    // Import basePrisma to bypass retry wrapper
    const { basePrisma } = await import('./prisma');
    console.log(`[PATCH /tenant/profile] Processing update for tenant ${tenant_id}`);
    console.log(`[PATCH /tenant/profile] Delta data:`, delta);
    
    // Check if profile exists
    const existingProfiles = await basePrisma.$queryRaw`
      SELECT tenant_id FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
    `;
    console.log(`[PATCH /tenant/profile] Existing profiles found:`, (existingProfiles as any[]).length);
    let result;
    if ((existingProfiles as any[]).length > 0) {
      console.log(`[PATCH /tenant/profile] Updating existing profile`);
      // Update existing profile - build dynamic update query
      const updateParts = [];
      const values = [];

      Object.entries(delta).forEach(([key, value]) => {
        if (value !== undefined) {
          updateParts.push(`"${key}" = $${values.length + 1}`);
          values.push(value === '' ? null : value);
        }
      });

      if (updateParts.length > 0) {
        updateParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(tenant_id); // Add tenant_id at the end
        const updateQuery = `
          UPDATE "tenant_business_profiles_list"
          SET ${updateParts.join(', ')}
          WHERE tenant_id = $${values.length}
        `;
        console.log(`[PATCH /tenant/profile] Update query:`, updateQuery);
        console.log(`[PATCH /tenant/profile] Update values:`, values);
        await basePrisma.$executeRawUnsafe(updateQuery, ...values);
        console.log(`[PATCH /tenant/profile] Update executed successfully`);
      }

      // Get updated profile (exclude geography column to avoid Prisma deserialization error)
      result = await basePrisma.$queryRaw`
        SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}
      `;
      console.log(`[PATCH /tenant/profile] Retrieved updated profile:`, result);
    } else {
      console.log(`[PATCH /tenant/profile] Creating new profile`);
      // Create new profile
      const insertFields = ['tenant_id', 'business_name', 'address_line1', 'city', 'postal_code', 'country_code'];
      const insertValues = [
        tenant_id,
        delta.business_name || existingTenant.name,
        delta.address_line1 || '',
        delta.city || '',
        delta.postal_code || '',
        (delta.country_code || 'US').toUpperCase()
      ];

      // Add optional fields
      const optionalMappings = {
        address_line2: delta.address_line2,
        state: delta.state,
        phone_number: delta.phone_number,
        email: delta.email,
        website: delta.website,
        contact_person: delta.contact_person,
        logo_url: delta.logo_url,
        banner_url: delta.banner_url,
        business_description: delta.business_description,
      };

      Object.entries(optionalMappings).forEach(([field, value]) => {
        if (value !== undefined) {
          insertFields.push(field);
          insertValues.push(value === '' ? null : (value as any));
        }
      });

      // Always add updated_at field with current timestamp
      insertFields.push('updated_at');
      insertValues.push(new Date().toISOString());

      const placeholders = insertFields.map((_, i) => `$${i + 1}`);
      const insertQuery = `
        INSERT INTO "tenant_business_profiles_list" (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      console.log(`[PATCH /tenant/profile] Insert query:`, insertQuery);
      console.log(`[PATCH /tenant/profile] Insert values:`, insertValues);

      result = await basePrisma.$executeRawUnsafe(insertQuery, ...insertValues).then(() =>
        basePrisma.$queryRaw`SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, gbp_category_id, gbp_category_name, gbp_category_last_mirrored, gbp_category_sync_status, updated_at FROM "tenant_business_profiles_list" WHERE tenant_id = ${tenant_id}`
      );
      console.log(`[PATCH /tenant/profile] Created new profile:`, result);
    }

    // Update tenant name if business_name changed
    if (delta.business_name && typeof delta.business_name === 'string' && delta.business_name.trim()) {
      await prisma.tenants.update({ where: { id: tenant_id }, data: { name: delta.business_name } });
    }

    // Handle logo_url clearing from tenant metadata
    if ('logo_url' in delta && delta.logo_url === '') {
      const currentMetadata = (existingTenant.metadata as any) || {};
      if (currentMetadata.logo_url) {
        delete currentMetadata.logo_url;
        await prisma.tenants.update({
          where: { id: tenant_id },
          data: { metadata: currentMetadata }
        });
      }
    }

    console.log(`[PATCH /tenant/profile] Final result to return:`, (result as any)[0] || result);
    return res.json((result as any)[0] || result);
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

app.post("/api/tenants/:id/logo", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenant_id = req.params.id;
    console.log(`[Logo Upload] Starting upload for tenant ${tenant_id}`, {
      hasFile: !!req.file,
      contentType: req.get('content-type'),
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      console.log(`[Logo Upload] Tenant not found: ${tenant_id}`);
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
      const pathKey = `tenants/${tenant_id}/logo-${Date.now()}${ext}`;
      
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
      
      const pathKey = `tenants/${tenant_id}/logo-${Date.now()}${ext}`;
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
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenant_id },
      data: {
        metadata: {
          ...(tenant.metadata as any || {}),
          logo_url: publicUrl,
        },
      },
    });

    // Also update business profile logo_url for directory listings (if profile exists)
    try {
      await prisma.tenant_business_profiles_list.update({
        where: { tenant_id },
        data: { logo_url: publicUrl },
      });
    } catch (profileError: any) {
      // Business profile doesn't exist yet, skip updating it
      // It will be created with logo during directory publish
      console.log(`[Logo Upload] Business profile not found for tenant ${tenant_id}, logo will be set during directory publish`);
    }

    return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
  } catch (e: any) {
    console.error("[Logo Upload Error] Full error details:", {
      message: e?.message,
      stack: e?.stack,
      tenant_id: req.params.id,
    });
    return res.status(500).json({ 
      error: "failed_to_upload_logo",
      details: DEV ? e?.message : undefined 
    });
  }
});

// Banner upload endpoint (similar to logo but for wide banners)
app.post("/api/tenant/:id/banner", logoUploadMulter.single("file"), async (req, res) => {
  try {
    const tenant_id = req.params.id;
    console.log(`[Banner Upload] Starting upload for tenant ${tenant_id}`);

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
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
      
      const pathKey = `tenants/${tenant_id}/banner-${Date.now()}${ext}`;
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
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenant_id },
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
    
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) {
      console.log(`[Photo Upload] Item not found: ${itemId}`);
      return res.status(404).json({ error: "item_not_found" });
    }
    console.log(`[Photo Upload] Item found:`, { id: item.id, tenant_id: item.tenant_id, sku: item.sku });

    // A) JSON { url, ... } → register the asset
    if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof (req.body as any)?.url === "string") {
      const parsed = jsonUrlSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      const { url, width, height, bytes, contentType, exifRemoved } = parsed.data;

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id,item.id),
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

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id,item.id),
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
        const pathKey = `${item.tenant_id}/${item.sku || item.id}/${Date.now()}${ext}`;
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

      const created = await prisma.photo_assets.create({
        data: {
          id: generatePhotoId(item.tenant_id,item.id),
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
app.use('/api', photosRouter);

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
app.get(["/api/items/stats", "/api/inventory/stats"], authenticateToken, async (req, res) => {
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
      console.error('[GET /api/items/stats] Error checking tenant membership:', e);
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
    console.error('[GET /api/items/stats] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_stats' });
  }
});

app.get(["/api/items", "/api/inventory", "/items", "/inventory"], authenticateToken, async (req, res) => {
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
      console.error('[GET /api/items] Error checking tenant membership:', e);
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
    
    const itemsWithoutPriceCents = items.map((item: { [x: string]: any; price?: any; price_cents?: any; directory_category_id?: any; image_url?: any; category_path?: any; }) => {
      const { price_cents, directory_category_id, image_url, ...itemWithoutPriceCents } = item;
      
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
      
      return {
        ...itemWithoutPriceCents,
        price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
        tenantCategoryId: tenantCategory ? tenantCategory.id : null,
        tenantCategory: tenantCategory || null,
        imageUrl: image_url || null, // Map image_url to imageUrl for frontend
        categoryPath: item.category_path || [], // Also include category_path for completeness
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
    console.error('[GET /items] Error listing items:', e);
    res.status(500).json({ error: "failed_to_list_items", message: e?.message });
  }
});

app.get(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], async (req, res) => {
  const it = await prisma.inventory_items.findUnique({
    where: { id: req.params.id },
  });
  if (!it) return res.status(404).json({ error: "not_found" });

  // Security: Only allow public access to items that are active AND public
  // Draft, archived, and private items should not be accessible via public URLs
  const isAuthenticated = req.headers.authorization; // Check if request has auth token
  if (!isAuthenticated) {
    // For unauthenticated requests, only show active + public items
    if (it.item_status !== 'active' || it.visibility !== 'public') {
      return res.status(404).json({ error: "not_found" });
    }
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

  // Convert Decimal price to number for frontend compatibility
  // Hide price_cents from frontend since price is the authoritative field
  // Map image_url to imageUrl for frontend compatibility
  const { price_cents, image_url, ...itemWithoutPriceCents } = it;
  const transformed = {
    ...itemWithoutPriceCents,
    price: it.price !== null && it.price !== undefined ? Number(it.price) : null,
    imageUrl: image_url || null,
    tenantCategory,
    tenantCategoryId: it.directory_category_id,
  };

  res.json(transformed);
});

const conditionSchema = z.enum(['new', 'brand_new', 'refurbished', 'used']).transform((v) => (v === 'new' ? 'brand_new' : v));

const baseItemSchema = z.object({
  tenant_id: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(), // Accept camelCase from frontend
  sku: z.string().min(1),
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  image_url: z.string().url().nullable().optional(),
  metadata: z.any().optional(),
  description: z.string().optional(),
  // v3.4 SWIS fields (required by schema)
  title: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  manufacturer: z.string().optional(),
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
});

const createItemSchema = baseItemSchema.extend({
  // Apply defaults only for creation
  price_cents: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
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

app.post(["/api/items", "/api/inventory", "/items", "/inventory"], /* checkSubscriptionLimits, */ async (req, res) => {
  console.log('[POST /items] Raw request body:', JSON.stringify(req.body, null, 2));
  
  const parsed = createItemSchema.safeParse(req.body ?? {});
  console.log('[POST /items] Zod validation result:', parsed.success);
  if (!parsed.success) {
    console.log('[POST /items] Validation errors:', JSON.stringify(parsed.error.flatten(), null, 2));
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  
  console.log('[POST /items] Parsed data:', parsed.data);
  try {
    const data = {
      ...parsed.data,
      title: parsed.data.title || parsed.data.name,
      brand: parsed.data.brand || 'Unknown',
      // Price logic: prioritize price (dollars) over price_cents (cents)
      // Ensure price is never undefined since it's required in the schema
      price: parsed.data.price ?? (parsed.data.price_cents ? parsed.data.price_cents / 100 : 0),
      price_cents: parsed.data.price_cents ?? (parsed.data.price ? Math.round(parsed.data.price * 100) : 0),
      currency: parsed.data.currency || 'USD',
      // Auto-set availability based on stock if not explicitly provided
      availability: parsed.data.availability || (parsed.data.stock > 0 ? 'in_stock' : 'out_of_stock'),
      tenant_id: parsed.data.tenant_id || '', // Ensure tenant_id is always a string
      // Category assignment - keep both directory_category_id and category_path for storefront compatibility
      directory_category_id: parsed.data.directory_category_id || null,
      category_path: parsed.data.category_path || [],
    };
    
    const created = await prisma.inventory_items.create({ 
      data: {
        id: generateItemId(),
        ...data,
        updated_at: new Date(),
      }
    });
    // await audit({ tenant_id: created.tenant_id, actor: null, action: "inventory.create", payload: { id: created.id, sku: created.sku } });
    
    // Convert Decimal price to number and hide price_cents for frontend compatibility
    const { price_cents, ...itemWithoutPriceCents } = created;
    const transformed = {
      ...itemWithoutPriceCents,
      price: created.price !== null && created.price !== undefined ? Number(created.price) : null,
    };
    
    res.status(201).json(transformed);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "duplicate_sku" });
    console.error('[POST /items] Error creating item:', e);
    res.status(500).json({ error: "failed_to_create_item", message: e?.message });
  }
});

app.put(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], /* enforcePolicyCompliance, */ async (req, res) => {
  console.log('[PUT /items/:id] Received body:', JSON.stringify(req.body));
  const parsed = updateItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    console.error('[PUT /items/:id] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  console.log('[PUT /items/:id] Validation passed, parsed data:', JSON.stringify(parsed.data));
  try {
    // Remove tenant_id from update data (can't be changed)
    const { tenant_id: _, tenantId: __, itemStatus, item_status, tenantCategoryId, directory_category_id, status, ...rest } = parsed.data;
    
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
        console.error('[PUT /items/:id] Error fetching category for tenantCategoryId:', tenantCategoryId, error);
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
        console.error('[PUT /items/:id] Error fetching category for directory_category_id:', directory_category_id, error);
      }
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

    // Sync price and price_cents fields
    if (updateData.price !== undefined) {
      updateData.price_cents = Math.round(updateData.price * 100);
    } else if (updateData.price_cents !== undefined) {
      updateData.price = updateData.price_cents / 100;
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date();
    
    console.log('[PUT /items/:id] Final update data:', JSON.stringify(updateData));
    
    const updated = await prisma.inventory_items.update({
      where: { id: req.params.id },
      data: updateData,
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'item_not_found' });
    }
    
    console.log('[PUT /items/:id] Database returned directory_category_id:', updated.directory_category_id);
    
    await audit({ tenantId: updated.tenant_id, actor: null, action: "inventory.update", payload: { id: updated.id } });
    
    // Convert Decimal price to number and hide price_cents for frontend compatibility
    const { price_cents, ...itemWithoutPriceCents } = updated;
    const transformed = {
      ...itemWithoutPriceCents,
      price: updated.price !== null && updated.price !== undefined ? Number(updated.price) : null,
    };
    
    console.log('[PUT /items/:id] Sending to frontend directory_category_id:', transformed.directory_category_id);
    
    res.json(transformed);
  } catch (error) {
    console.error('[PUT /items/:id] Error updating item:', error);
    res.status(500).json({ error: "failed_to_update_item", details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Soft delete - move item to trash (with capacity check)
app.delete(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    // Get item to find tenant
    const item = await prisma.inventory_items.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ error: "item_not_found" });
    }

    // Get tenant to check tier
    const tenant = await prisma.tenants.findUnique({ where: { id: item.tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    // Check trash capacity
    const { isTrashFull, getTrashCapacity } = await import('./utils/trash-capacity');
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
    res.json(updated);
  } catch (error) {
    console.error('[Delete Item] Error:', error);
    res.status(500).json({ error: "failed_to_trash_item" });
  }
});

// Get trash capacity info
app.get(["/api/trash/capacity", "/trash/capacity"], authenticateToken, async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    
    console.log('2322 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    // Get tenant to check tier
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    // Get trash count and capacity info
    const { getTrashCapacityInfo } = await import('./utils/trash-capacity');
    const trashCount = await prisma.inventory_items.count({
      where: { tenant_id: tenant_id, item_status: 'trashed' }
    });
    
    const capacityInfo = getTrashCapacityInfo(trashCount, tenant.subscription_tier || 'starter');
    res.json(capacityInfo);
  } catch (error) {
    console.error('[Trash Capacity] Error:', error);
    res.status(500).json({ error: "failed_to_get_trash_capacity" });
  }
});

// Restore from trash
app.patch(["/api/items/:id/restore", "/items/:id/restore"], authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const item = await prisma.inventory_items.update({
      where: { id: req.params.id },
      data: { item_status: 'active' }
    });
    res.json(item);
  } catch {
    res.status(500).json({ error: "failed_to_restore_item" });
  }
});

// Permanent delete (purge) - only works on trashed items
app.delete(["/api/items/:id/purge", "/items/:id/purge"], authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    // First check if item is trashed
    const item = await prisma.inventory_items.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ error: "item_not_found" });
    }
    if (item.item_status !== 'trashed') {
      return res.status(400).json({ error: "item_not_in_trash", message: "Item must be in trash before it can be permanently deleted" });
    }
    
    // Permanently delete
    await prisma.inventory_items.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "failed_to_purge_item" });
  }
});

// Category assignment endpoint
const categoryAssignmentSchema = z.object({
  categorySlug: z.string().min(1),
});
app.patch("/api/v1/tenants/:tenant_id/items/:itemId/category", authenticateToken, checkTenantAccess, async (req, res) => {
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
      return res.status(404).json({ error: 'item_not_found' });
    }
    
    const { price_cents, ...itemWithoutPriceCents } = updated;
    const transformed = {
      ...itemWithoutPriceCents,
      price: updated.price !== null && updated.price !== undefined ? Number(updated.price) : null,
    };

    res.json(transformed);
  } catch (error: any) {
    console.error('[PATCH /api/v1/tenants/:tenant_id/items/:itemId/category] Error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || "failed_to_assign_category" });
  }
});

// Update item status (for Google sync control)
app.patch(["/items/:id", "/inventory/:id"], authenticateToken, async (req, res) => {
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
    console.error('[PATCH Item] Error:', error);
    res.status(500).json({ error: "failed_to_update_item" });
  }
});

// Sync availability status for all items (fix out-of-sync items)
app.post("/items/sync-availability", authenticateToken, async (req, res) => {
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
    console.error('[Sync Availability] Error:', error);
    res.status(500).json({ error: "failed_to_sync_availability" });
  }
});

//* ------------------------------ GOOGLE TAXONOMY SEARCH ------------------------------ */

app.get('/api/google/taxonomy/browse', async (req, res) => {
  try {
    const { parent } = req.query;
    const parentPath = parent ? decodeURIComponent(parent as string) : null;

    // Try database first, fall back to JSON file
    const dbCount = await prisma.google_taxonomy_list.count();
    const useDatabase = dbCount > 0;
    
    let categories: any[] = [];

    if (useDatabase) {
      if (!parentPath) {
        // Get top-level categories (level 1)
        categories = await prisma.google_taxonomy_list.findMany({
          where: {
            is_active: true,
            level: 1
          },
          orderBy: { category_path: 'asc' },
          take: 50
        });
      } else {
        // Get direct children of the specified parent path
        const parentDepth = parentPath.split(' > ').length;
        
        categories = await prisma.google_taxonomy_list.findMany({
          where: {
            is_active: true,
            category_path: {
              startsWith: parentPath + ' > '
            }
          },
          orderBy: { category_path: 'asc' }
        });

        // Filter to only direct children (one level deeper)
        categories = categories.filter(cat => {
          const catDepth = cat.category_path.split(' > ').length;
          return catDepth === parentDepth + 1;
        });
      }
    } else {
      // Fallback to JSON file
      const taxonomyData = require('./lib/google/taxonomy-data.json');
      const allCategories = taxonomyData.categories || [];
      
      if (!parentPath) {
        // Get top-level categories (path length = 1)
        categories = allCategories
          .filter((cat: any) => cat.path.length === 1)
          .map((cat: any) => ({
            category_id: cat.id,
            category_path: cat.fullPath,
            level: 1
          }));
      } else {
        // Get direct children
        const parentDepth = parentPath.split(' > ').length;
        categories = allCategories
          .filter((cat: any) => {
            return cat.fullPath.startsWith(parentPath + ' > ') && 
                   cat.path.length === parentDepth + 1;
          })
          .map((cat: any) => ({
            category_id: cat.id,
            category_path: cat.fullPath,
            level: cat.path.length
          }));
      }
      
      console.log(`[Taxonomy Browse] Using JSON fallback, found ${categories.length} categories for path: ${parentPath || 'root'}`);
    }

    // For each category, check if it has children
    let categoriesWithChildInfo: any[];
    
    if (useDatabase) {
      categoriesWithChildInfo = await Promise.all(
        categories.map(async (cat: any) => {
          const childCount = await prisma.google_taxonomy_list.count({
            where: {
              is_active: true,
              category_path: {
                startsWith: cat.category_path + ' > '
              }
            }
          });

          return {
            id: cat.category_id,
            name: cat.category_path.split(' > ').pop() || cat.category_path,
            path: cat.category_path.split(' > '),
            fullPath: cat.category_path,
            hasChildren: childCount > 0
          };
        })
      );
    } else {
      // Use JSON data for child count
      const taxonomyData = require('./lib/google/taxonomy-data.json');
      const allCategories = taxonomyData.categories || [];
      
      categoriesWithChildInfo = categories.map((cat: any) => {
        const hasChildren = allCategories.some((c: any) => 
          c.fullPath.startsWith(cat.category_path + ' > ')
        );

        return {
          id: cat.category_id,
          name: cat.category_path.split(' > ').pop() || cat.category_path,
          path: cat.category_path.split(' > '),
          fullPath: cat.category_path,
          hasChildren
        };
      });
    }

    res.json({
      success: true,
      categories: categoriesWithChildInfo,
    });
  } catch (error) {
    console.error('[Google Taxonomy Browse] Error:', error);
    res.status(500).json({ success: false, error: 'Browse failed' });
  }
});

app.get('/api/google/taxonomy/search', async (req, res) => {
  try {
    const { q: query, limit = '20' } = req.query;

    // Disable caching for search results
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const searchQuery = query.trim().toLowerCase();
    const maxResults = parseInt(limit as string, 10);

    // Search real Google taxonomy data from database
    // Fetch more results than needed so we can sort by relevance
    const categories = await prisma.google_taxonomy_list.findMany({
      where: {
        is_active: true,
        OR: [
          { category_path: { contains: query, mode: 'insensitive' } },
          { category_id: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: maxResults * 5, // Fetch extra for relevance sorting
      orderBy: { category_path: 'asc' }
    });

    // Score and sort results by relevance
    const scoredResults = categories.map(cat => {
      const path = cat.category_path;
      const leafName = path.split(' > ').pop()?.toLowerCase() || '';
      const pathLower = path.toLowerCase();
      
      let score = 0;
      
      // Exact leaf name match (highest priority)
      if (leafName === searchQuery) {
        score += 1000;
      }
      // Leaf name starts with query
      else if (leafName.startsWith(searchQuery)) {
        score += 500;
      }
      // Leaf name contains query as whole word
      else if (new RegExp(`\\b${searchQuery}\\b`, 'i').test(leafName)) {
        score += 300;
      }
      // Leaf name contains query
      else if (leafName.includes(searchQuery)) {
        score += 100;
      }
      
      // Bonus for shorter paths (more specific categories)
      const depth = path.split(' > ').length;
      score += Math.max(0, 50 - depth * 5);
      
      // Bonus if query appears in path (for context)
      if (pathLower.includes(searchQuery) && !leafName.includes(searchQuery)) {
        score += 20;
      }
      
      return {
        id: cat.category_id,
        name: path.split(' > ').pop() || path,
        path: path.split(' > '),
        fullPath: path,
        score
      };
    });

    // Sort by score descending, then by path alphabetically
    scoredResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.fullPath.localeCompare(b.fullPath);
    });

    // Take top results and remove score from output
    const results = scoredResults.slice(0, maxResults).map(({ score, ...rest }) => rest);

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
 * GET /google/auth?tenant_id=xxx
 */
app.get("/google/auth", async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    console.log('2683 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    // Validate NAP (Name, Address, Phone) is complete
    // Check tenant_business_profiles_list table first, fallback to metadata for backwards compatibility
    const businessProfileRaw = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id }
    });
    
    // Enhance business profile to have both naming conventions
    const { enhanceDatabaseResult } = require('./middleware/universal-transform');
    const businessProfile = enhanceDatabaseResult(businessProfileRaw);
    
    const hasProfile = businessProfile 
      ? (businessProfile.businessName && businessProfile.city && businessProfile.state)
      : ((tenant.metadata as any)?.businessName && (tenant.metadata as any)?.city && (tenant.metadata as any)?.state);
    
    if (!hasProfile) {
      return res.status(400).json({ 
        error: "incomplete_business_profile",
        message: "Please complete your business profile before connecting to Google",
      });
    }

    const authUrl = getAuthorizationUrl(tenant_id);
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
    const account = await prisma.google_oauth_accounts_list.upsert({
      where: {
        tenant_id_google_account_id: {
          tenant_id: stateData.tenantId,
          google_account_id: userInfo.id,
        },
      },
      create: {
        id: crypto.randomUUID(),
        tenant_id: stateData.tenantId,
        google_account_id: userInfo.id,
        email: userInfo.email,
        display_name: userInfo.name,
        profile_picture_url: userInfo.picture,
        scopes: tokens.scope.split(' '),
        updated_at: new Date(),
      },
      update: {
        email: userInfo.email,
        display_name: userInfo.name,
        profile_picture_url: userInfo.picture,
        scopes: tokens.scope.split(' '),
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
 * GET /google/status?tenant_id=xxx
 */
app.get("/google/status", async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    
    console.log('2810 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
    });

    if (!account) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: account.email,
      display_name: account.display_name,
      profile_picture_url: account.profile_picture_url,
      scopes: account.scopes,
      merchant_links: 0, // Placeholder - relations not available
      gbp_locations: 0, // Placeholder - relations not available
    });
  } catch (error) {
    console.error("[Google OAuth] Status check error:", error);
    res.status(500).json({ error: "status_check_failed" });
  }
});

/**
 * Disconnect Google account
 * DELETE /google/disconnect?tenant_id=xxx
 */
app.delete("/google/disconnect", async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    
    console.log('2846 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
    });

    if (!account) {
      return res.status(404).json({ error: "account_not_found" });
    }

    // Note: Token revocation would need to be handled differently without the tokens relation
    // For now, just delete the account

    // Delete from database (cascade will delete tokens, links, locations)
    await prisma.google_oauth_accounts_list.delete({
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
 * GET /google/gmc/accounts?tenant_id=xxx
 */
app.get("/google/gmc/accounts", async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    
    console.log('2885 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id },
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
    const { tenant_id, merchantId } = req.body;
    
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
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
 * GET /google/gmc/products?tenant_id=xxx&merchantId=xxx
 */
app.get("/google/gmc/products", async (req, res) => {
  try {
    const { tenant_id, merchantId } = req.query;
    
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id as string },
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
 * GET /google/gmc/stats?tenant_id=xxx&merchantId=xxx
 */
app.get("/google/gmc/stats", async (req, res) => {
  try {
    const { tenant_id, merchantId } = req.query;
    
    if (!tenant_id || !merchantId) {
      return res.status(400).json({ error: "tenant_id_and_merchant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenant_id as string },
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
 * GET /google/gbp/locations?tenant_id=xxx
 */
app.get("/google/gbp/locations", async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    
    console.log('3005 Expects tenant_id ' + tenant_id);
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
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
    const { tenant_id, locationName } = req.body;
    
    if (!tenant_id || !locationName) {
      return res.status(400).json({ error: "tenant_id_and_location_name_required" });
    }

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id },
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
    const configs = await prisma.email_configuration_list.findMany({
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
        // prisma.emailConfiguration.upsert({
        //   where: { category: config.category },
        //   update: { 
        //     email: config.email,
        //   },
        //   create: {
        //     category: config.category,
        //     email: config.email,
        //   }
        // })
        Promise.resolve({ category: config.category, email: config.email }) // Temporary placeholder
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

/* ------------------------------ ROUTE MOUNTING ------------------------------ */
// Use modular route mounting for better isolation and debugging
import { mountMinimalRoutes, mountAllRoutes } from './routes';
import { generateItemId, generatePhotoId, generateTenantId, generateUserTenantId } from './lib/id-generator';

// For debugging: mount only minimal routes
// mountMinimalRoutes(app);

// For full functionality: mount all routes (enabled for localhost testing)
mountAllRoutes(app);
/* ------------------------------ TAXONOMY ADMIN API ------------------------------ */

// GET /api/admin/taxonomy/status - Check taxonomy sync status
app.get('/api/admin/taxonomy/status', requireAdmin, async (req, res) => {
  try {
    const { TaxonomySyncService } = await import('./services/TaxonomySyncService');
    const syncService = new TaxonomySyncService();

    const status = await syncService.checkForUpdates();

    // Get current taxonomy version
    const currentVersion = await prisma.google_taxonomy_list.findFirst({
      select: { version: true },
      orderBy: { created_at: 'desc' }
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
// app.use('/admin', authenticateToken, platformFlagsRoutes);
// app.use('/api/admin', authenticateToken, platformFlagsRoutes);
// Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
// app.use('/admin', authenticateToken, effectiveFlagsRoutes);
// app.use('/api/admin', authenticateToken, effectiveFlagsRoutes);
// Category scaffolds (M3 start)
// app.use(categoriesPlatformRoutes);
// app.use(categoriesTenantRoutes);
// app.use(categoriesMirrorRoutes);
// app.use(mirrorAdminRoutes);
// app.use(syncLogsRoutes);
// M4: SKU Scanning routes
app.use('/api', scanRoutes);
console.log('✅ Scan routes mounted at /api');

/* ------------------------------ item category assignment ------------------------------ */
// PATCH /api/v1/tenants/:tenant_id/items/:itemId/category
// Body: { directory_category_id?: string, categorySlug?: string }
app.patch('/api/v1/tenants/:tenant_id/items/:itemId/category', async (req, res) => {
  try {
    const { tenant_id, itemId } = req.params as { tenant_id: string; itemId: string };
    const { directory_category_id, categorySlug } = (req.body || {}) as { directory_category_id?: string; categorySlug?: string };

    const updated = await categoryService.assignItemCategory(tenant_id, itemId, { directoryCategoryId: directory_category_id, categorySlug });
    // ISR revalidation (best-effort) already triggered inside service
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
    const msg = e?.message || 'failed_to_assign_category';
    console.error('[PATCH /api/v1/tenants/:tenant_id/items/:itemId/category] Error:', msg);
    return res.status(code).json({ success: false, error: msg });
  }
});

/* ------------------------------ item updates ------------------------------ */
// Note: GET /api/items endpoint is handled at line ~1976 with multiple route aliases

// PUT /api/items/:itemId
// Update an item (general updates, not category assignment)
// PUT /api/items/:itemId
// Update an item (general updates, not category assignment)
app.put('/api/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;
    
    console.log('[PUT /api/items/:itemId] Received request:', { itemId, updateData: JSON.stringify(updateData) });
    console.log('[PUT /api/items/:itemId] Stock field type:', typeof updateData.stock, 'value:', updateData.stock);

    // Validate required fields
    if (!updateData) {
      return res.status(400).json({ error: 'update_data_required' });
    }

    // Prepare update data for Prisma
    const prismaUpdateData: any = {};
    
    // Handle different field names (camelCase from frontend vs snake_case in DB)
    if (updateData.name !== undefined) prismaUpdateData.name = updateData.name;
    if (updateData.price !== undefined) prismaUpdateData.price = updateData.price;
    if (updateData.stock !== undefined) {
      // Ensure stock is an integer
      const stockValue = typeof updateData.stock === 'string' ? parseInt(updateData.stock, 10) : updateData.stock;
      console.log('[PUT /api/items/:itemId] Stock update:', { original: updateData.stock, converted: stockValue, type: typeof stockValue });
      prismaUpdateData.stock = stockValue;
      prismaUpdateData.quantity = stockValue; // Keep quantity in sync with stock
    }
    if (updateData.description !== undefined) prismaUpdateData.description = updateData.description;
    if (updateData.visibility !== undefined) prismaUpdateData.visibility = updateData.visibility;
    if (updateData.item_status !== undefined) prismaUpdateData.item_status = updateData.item_status;
    if (updateData.category_path !== undefined) prismaUpdateData.category_path = updateData.category_path;

    // Log what we're about to send to Prisma
    console.log('[PUT /api/items/:itemId] Prisma update data:', JSON.stringify(prismaUpdateData, null, 2));
    console.log('[PUT /api/items/:itemId] Stock type check:', typeof prismaUpdateData.stock);
    
    // Update the item
    const updatedItem = await prisma.inventory_items.update({
      where: { id: itemId },
      data: prismaUpdateData,
    });

    // Transform snake_case back to camelCase for frontend
    const result = {
      id: updatedItem.id,
      tenant_id: updatedItem.tenant_id,
      sku: updatedItem.sku,
      name: updatedItem.name,
      price: updatedItem.price,
      stock: updatedItem.stock,
      description: updatedItem.description,
      visibility: updatedItem.visibility,
      status: updatedItem.item_status,
      category_path: updatedItem.category_path,
      created_at: updatedItem.created_at,
      updated_at: updatedItem.updated_at,
    };

    return res.json(result);
  } catch (error) {
    console.error('[PUT /api/items/:itemId] Error:', error);
    return res.status(500).json({ error: 'failed_to_update_item' });
  }
});

/* ------------------------------ products needing enrichment ------------------------------ */
// GET /api/products/needs-enrichment
// Returns products that need enrichment (missing images, descriptions, etc.)
app.get('/api/products/needs-enrichment', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { isPlatformUser } = await import('./utils/platform-admin');

    // Get tenant IDs the user has access to
    let tenantIds: string[] = [];

    if (isPlatformUser(user)) {
      // Platform users can see all tenants
      const allTenants = await prisma.tenants.findMany({
        select: { id: true }
      });
      tenantIds = allTenants.map(t => t.id);
    } else {
      // Regular users can only see tenants they have access to
      const userTenants = await prisma.user_tenants.findMany({
        where: { user_id: user.userId },
        select: { tenant_id: true }
      });
      tenantIds = userTenants.map(ut => ut.tenant_id);
    }

    if (tenantIds.length === 0) {
      return res.json({ products: [] });
    }

    // Find products that need enrichment
    // Products created by Quick Start Wizard typically have source = 'QUICK_START_WIZARD' and are missing details
    const products = await prisma.inventory_items.findMany({
      where: {
        tenant_id: { in: tenantIds },
        OR: [
          // Products with missing images
          { missing_images: true },
          // Products with missing descriptions
          { missing_description: true },
          // Products with missing brand
          { missing_brand: true },
          // Products with missing specs
          { missing_specs: true },
          // Products created by quick start that might need enrichment
          { source: 'QUICK_START_WIZARD' as any }
        ]
      },
      select: {
        id: true,
        name: true,
        source: true,
        missing_images: true,
        missing_description: true,
        missing_brand: true,
        missing_specs: true,
        description: true,
        brand: true,
        tenant_id: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50 // Limit results for performance
    });

    // Transform to match the expected format by ProductEnrichmentBanner
    const enrichedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      source: product.source,
      enrichmentStatus: 'needs_enrichment',
      missing: {
        missingImages: product.missing_images,
        missingDescription: product.missing_description,
        missingSpecs: product.missing_specs,
        missingBrand: product.missing_brand
      }
    }));

    return res.json({ products: enrichedProducts });
  } catch (error) {
    console.error('[GET /api/products/needs-enrichment] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_products_needing_enrichment' });
  }
});

/* ------------------------------ jobs ------------------------------ */
app.post("/jobs/rates/daily", dailyRatesJob);

/* ------------------------------ GBP Categories ------------------------------ */
// GET /api/gbp/categories/popular - Get popular retail categories
app.get("/api/gbp/categories/popular", async (req, res) => {
  try {
    // Hardcoded popular retail categories based on common use cases
    const popularCategories = [
      // Food & Beverage
      { id: "gcid:grocery_store", name: "Grocery store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:convenience_store", name: "Convenience store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:supermarket", name: "Supermarket", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:liquor_store", name: "Liquor store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:specialty_food_store", name: "Specialty food store", path: ["Shopping", "Food & Beverage"] },
      
      // General Retail
      { id: "gcid:clothing_store", name: "Clothing store", path: ["Shopping", "Apparel"] },
      { id: "gcid:shoe_store", name: "Shoe store", path: ["Shopping", "Apparel"] },
      { id: "gcid:electronics_store", name: "Electronics store", path: ["Shopping", "Electronics"] },
      { id: "gcid:furniture_store", name: "Furniture store", path: ["Shopping", "Home & Garden"] },
      { id: "gcid:hardware_store", name: "Hardware store", path: ["Shopping", "Home & Garden"] },
      
      // Health & Beauty
      { id: "gcid:pharmacy", name: "Pharmacy", path: ["Health", "Pharmacy"] },
      { id: "gcid:beauty_supply_store", name: "Beauty supply store", path: ["Shopping", "Beauty & Spa"] },
      { id: "gcid:cosmetics_store", name: "Cosmetics store", path: ["Shopping", "Beauty & Spa"] },
      { id: "gcid:health_and_beauty_shop", name: "Health and beauty shop", path: ["Shopping", "Beauty & Spa"] },
      
      // Specialty Stores
      { id: "gcid:book_store", name: "Book store", path: ["Shopping", "Books & Media"] },
      { id: "gcid:pet_store", name: "Pet store", path: ["Shopping", "Pets"] },
      { id: "gcid:toy_store", name: "Toy store", path: ["Shopping", "Toys & Games"] },
      { id: "gcid:sporting_goods_store", name: "Sporting goods store", path: ["Shopping", "Sports & Recreation"] },
      { id: "gcid:gift_shop", name: "Gift shop", path: ["Shopping", "Gifts & Specialty"] },
    ];

    return res.json({ items: popularCategories });
  } catch (error) {
    console.error('[GET /api/gbp/categories/popular] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_popular_categories' });
  }
});

// GET /api/gbp/categories - Search GBP categories
app.get("/api/gbp/categories", async (req, res) => {
  try {
    const { query, limit = '20' } = req.query;

    // Disable caching for search results
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Try to search database first (if populated)
    const dbCategories = await prisma.gbp_categories_list.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { display_name : { contains: query, mode: 'insensitive' } }
        ]
      },
      take: parseInt(limit as string, 10),
      orderBy: { name: 'asc' }
    });

    // If database has results, use them
    if (dbCategories.length > 0) {
      const results = dbCategories.map((cat: any) => ({
        id: cat.id,
        name: cat.displayName || cat.name,
        path: [] // GBP categories don't have hierarchical paths
      }));
      return res.json({ items: results, source: 'database' });
    }

    // Fallback: Search hardcoded popular categories (for now)
    const popularCategories = [
      // Food & Beverage
      { id: "gcid:grocery_store", name: "Grocery store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:convenience_store", name: "Convenience store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:supermarket", name: "Supermarket", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:liquor_store", name: "Liquor store", path: ["Shopping", "Food & Beverage"] },
      { id: "gcid:specialty_food_store", name: "Specialty food store", path: ["Shopping", "Food & Beverage"] },
      
      // General Retail
      { id: "gcid:clothing_store", name: "Clothing store", path: ["Shopping", "Apparel"] },
      { id: "gcid:shoe_store", name: "Shoe store", path: ["Shopping", "Apparel"] },
      { id: "gcid:electronics_store", name: "Electronics store", path: ["Shopping", "Electronics"] },
      { id: "gcid:furniture_store", name: "Furniture store", path: ["Shopping", "Home & Garden"] },
      { id: "gcid:hardware_store", name: "Hardware store", path: ["Shopping", "Home & Garden"] },
      
      // Health & Beauty
      { id: "gcid:pharmacy", name: "Pharmacy", path: ["Health", "Pharmacy"] },
      { id: "gcid:beauty_supply_store", name: "Beauty supply store", path: ["Shopping", "Beauty & Spa"] },
      { id: "gcid:cosmetics_store", name: "Cosmetics store", path: ["Shopping", "Beauty & Spa"] },
      { id: "gcid:health_and_beauty_shop", name: "Health and beauty shop", path: ["Shopping", "Beauty & Spa"] },
      
      // Specialty Stores
      { id: "gcid:book_store", name: "Book store", path: ["Shopping", "Books & Media"] },
      { id: "gcid:pet_store", name: "Pet store", path: ["Shopping", "Pets"] },
      { id: "gcid:toy_store", name: "Toy store", path: ["Shopping", "Toys & Games"] },
      { id: "gcid:sporting_goods_store", name: "Sporting goods store", path: ["Shopping", "Sports & Recreation"] },
      { id: "gcid:gift_shop", name: "Gift shop", path: ["Shopping", "Gifts & Specialty"] },
      
      // Additional common categories
      { id: "gcid:department_store", name: "Department store", path: ["Shopping", "General"] },
      { id: "gcid:discount_store", name: "Discount store", path: ["Shopping", "General"] },
      { id: "gcid:variety_store", name: "Variety store", path: ["Shopping", "General"] },
      { id: "gcid:home_goods_store", name: "Home goods store", path: ["Shopping", "Home & Garden"] },
      { id: "gcid:jewelry_store", name: "Jewelry store", path: ["Shopping", "Accessories"] },
      { id: "gcid:florist", name: "Florist", path: ["Shopping", "Gifts & Specialty"] },
      { id: "gcid:bakery", name: "Bakery", path: ["Food", "Bakery"] },
      { id: "gcid:butcher_shop", name: "Butcher shop", path: ["Food", "Meat"] },
      { id: "gcid:produce_market", name: "Produce market", path: ["Food", "Produce"] },
      { id: "gcid:wine_store", name: "Wine store", path: ["Shopping", "Food & Beverage"] },
    ];

    // Case-insensitive search in hardcoded list
    const lowerQuery = query.toLowerCase();
    const filteredCategories = popularCategories
      .filter(cat => 
        cat.name.toLowerCase().includes(lowerQuery) ||
        cat.path.some(p => p.toLowerCase().includes(lowerQuery))
      )
      .slice(0, parseInt(limit as string, 10));

    return res.json({ items: filteredCategories, source: 'hardcoded' });
  } catch (error) {
    console.error('[GET /api/gbp/categories] Error:', error);
    return res.status(500).json({ error: 'failed_to_search_categories' });
  }
});

// Mount test GBP sync routes
// app.use('/test', testGbpSyncRoutes);

/* ------------------------------ platform settings ------------------------------ */
app.use('/api', platformSettingsRoutes);
console.log('✅ Platform settings routes mounted at /api');

/* ------------------------------ permissions ------------------------------ */
app.use('/api/permissions', permissionRoutes);
console.log('✅ Permissions routes mounted at /api/permissions');

/* ------------------------------ admin enrichment ------------------------------ */
import adminEnrichmentRoutes from './routes/admin-enrichment';
app.use('/api/admin/enrichment', authenticateToken, requireAdmin, adminEnrichmentRoutes);
console.log('✅ Admin enrichment routes mounted at /api/admin/enrichment');

/* ------------------------------ admin tier system ------------------------------ */
app.use('/api/admin/tier-system', authenticateToken, requireAdmin, tierSystemRoutes);
console.log('✅ Admin tier system routes mounted at /api/admin/tier-system');

/* ------------------------------ admin tier management ------------------------------ */
import tierManagementRoutes from './routes/admin/tier-management';
app.use('/api/admin/tiers', authenticateToken, tierManagementRoutes);
console.log('✅ Admin tier management routes mounted at /api/admin/tiers');

/* ------------------------------ admin scan metrics ------------------------------ */
app.use('/api/admin/scan-metrics', scanMetricsRoutes);
console.log('✅ Admin scan metrics routes mounted at /api/admin/scan-metrics');

/* ------------------------------ admin cached products ------------------------------ */
app.use('/api/admin/cached-products', cachedProductsRoutes);
console.log('✅ Admin cached products routes mounted at /api/admin/cached-products');

/* ------------------------------ admin tools ------------------------------ */
app.use('/api/admin/tools', authenticateToken, requireAdmin, adminToolsRoutes);
console.log('✅ Admin tools routes mounted at /api/admin/tools');

/* ------------------------------ directory ------------------------------ */
/* ------------------------------ directory optimized ------------------------------ */
app.use('/api/directory-optimized', directoryOptimizedRoutes);
console.log('✅ Directory optimized routes mounted (materialized view - 6.7x faster)');

/* ------------------------------ directory categories optimized ------------------------------ */
app.use('/api/directory/categories-optimized', directoryCategoriesOptimizedRoutes);
console.log('✅ Directory categories optimized routes mounted (category statistics - 10x faster)');

/* ------------------------------ directory main ------------------------------ */
app.use('/api/directory', directoryRoutes);
console.log('✅ Directory listings routes mounted (directory_listings table)');

/* ------------------------------ directory tenant ------------------------------ */
app.use('/api/directory/tenant', directoryTenantRoutes);
console.log('✅ Directory tenant routes mounted');

/* ------------------------------ directory categories ------------------------------ */
app.use('/api/directory/categories', directoryCategoriesRoutes);
console.log('✅ Directory categories routes mounted (category-based discovery)');

/* ------------------------------ directory store types ------------------------------ */
app.use('/api/directory/store-types', directoryStoreTypesRoutes);
console.log('✅ Directory store types routes mounted (store type discovery)');

/* ------------------------------ directory map ------------------------------ */
app.use('/api/directory', directoryMapRoutes);
console.log('✅ Directory map routes mounted (unified map data with coordinates)');

/* ------------------------------ recommendations ------------------------------ */
import recommendationRoutes from './routes/recommendations';
app.use('/api/recommendations', recommendationRoutes);
console.log('✅ Recommendation routes mounted (MVP recommendation system)');

/* ------------------------------ storefront (materialized view) ------------------------------ */
app.use('/api/storefront', storefrontRoutes);
console.log('✅ Storefront routes mounted (materialized view for instant category filtering)');

/* ------------------------------ GBP categories ------------------------------ */
app.use('/api/gbp', gbpRoutes);
console.log('✅ GBP routes mounted (Google Business Profile category search)');

/* ------------------------------ tenants ------------------------------ */
app.use('/api/tenants', tenantsRoutes);
console.log('✅ Tenants routes mounted at /api/tenants');

/* ------------------------------ feed validation ------------------------------ */
// NOTE: Must be mounted BEFORE tenantCategoriesRoutes to avoid /:tenantId/categories/:id matching /coverage
app.use('/api/tenant', authenticateToken, feedValidationRoutes);
console.log('✅ Feed validation routes mounted at /api/tenant');

/* ------------------------------ tenant categories (GBP) ------------------------------ */
app.use('/api/tenant', authenticateToken, tenantCategoriesRoutes);
console.log('✅ Tenant categories routes mounted at /api/tenant');

/* ------------------------------ photos ------------------------------ */
app.use('/api/items', photosRouter);
console.log('✅ Photos routes mounted at /api/items');

/* ------------------------------ directory photos ------------------------------ */
app.use('/api/directory', directoryPhotosRouter);
console.log('✅ Directory photos routes mounted at /api/directory');

/* ------------------------------ store reviews ------------------------------ */
import storeReviewsRoutes from './routes/store-reviews';
app.use('/api', storeReviewsRoutes);
console.log('✅ Store reviews routes mounted at /api');

/* ------------------------------ product likes ------------------------------ */
app.use('/api/products', productLikesRoutes);
console.log('✅ Product likes routes mounted at /api/products');

/* ------------------------------ clone (products & categories) ------------------------------ */
import cloneRoutes from './routes/clone';
app.use('/api/clone', cloneRoutes);
console.log('✅ Clone routes mounted at /api/clone (product & category cloning)');

/* ------------------------------ upgrade requests ------------------------------ */
app.use('/api/upgrade-requests', upgradeRequestsRoutes);
console.log('✅ Upgrade requests routes mounted at /api/upgrade-requests');

/* ------------------------------ organization requests ------------------------------ */
app.use('/api/organization-requests', organizationRequestRoutes);
console.log('✅ Organization requests routes mounted at /api/organization-requests');

/* ------------------------------ organizations ------------------------------ */
app.use('/organizations', organizationRoutes);
console.log('✅ Organizations routes mounted at /organizations');

/* ------------------------------ POS integrations ------------------------------ */
import cloverRoutes from './routes/integrations/clover';
import squareRoutes from './routes/integrations/square';
app.use('/api/integrations', cloverRoutes);
app.use('/api/integrations', squareRoutes);
console.log('✅ POS integration routes mounted at /api/integrations (Clover, Square)');

/* ------------------------------ Google Business Profile OAuth ------------------------------ */
app.use('/api', googleBusinessOAuthRoutes);
app.use('/auth', googleBusinessOAuthRoutes);  // Also mount at /auth for callback (matches GOOGLE_BUSINESS_REDIRECT_URI)
console.log('✅ Google Business Profile OAuth routes mounted at /api/google/business and /auth/google/business');

/* ------------------------------ Google Merchant Center OAuth ------------------------------ */
app.use('/api', googleMerchantOAuthRoutes);
console.log('✅ Google Merchant Center OAuth routes mounted at /api/google/oauth');

/* ------------------------------ billing ------------------------------ */
console.log('🔄 Billing routes imported successfully');

app.use('/api', billingRoutes);
console.log('✅ Billing routes mounted at /api');

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
  try {
    console.log('🔧 About to start server...');
    const server = app.listen(port, '0.0.0.0', async () => {
      console.log(`\n✅ API server running → http://localhost:${port}/health`);
      console.log(`📋 View all routes → http://localhost:${port}/__routes\n`);
      
      // Start GMC scheduled sync (every 6 hours)
      try {
        const { startGMCScheduledSync } = await import('./jobs/gmc-scheduled-sync');
        startGMCScheduledSync();
        console.log('🔄 GMC scheduled sync started (every 6 hours)');
      } catch (err) {
        console.error('⚠️ Failed to start GMC scheduled sync:', err);
      }
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
  } catch (error) {
    console.error('❌ Fatal error during server startup:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    process.exit(1);
  }
}

// Export the Express app for Vercel compatibility
export default app;
