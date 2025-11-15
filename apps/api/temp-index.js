"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
// Fix for Supabase SSL certificate issues in production
// This allows Node.js to accept Supabase's SSL certificates
if (process.env.NODE_ENV === 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('⚠️  SSL certificate validation disabled for Supabase compatibility');
}
const prisma_1 = require("./prisma");
const zod_1 = require("zod");
const csrf_1 = require("./middleware/csrf");
// Debug: Log DATABASE_URL to verify it's correct
// Migration fix applied: ProductCondition enum renamed 'new' to 'brand_new'
// Force rebuild v3: Railway build cache bypass
console.log('[DEBUG] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const tenant_limits_1 = require("./config/tenant-limits");
const context_1 = require("./context");
const storage_config_1 = require("./storage-config");
const audit_1 = require("./audit");
const rates_1 = require("./jobs/rates");
const CategoryService_1 = require("./services/CategoryService");
const business_hours_1 = __importDefault(require("./routes/business-hours"));
const tenant_flags_1 = __importDefault(require("./routes/tenant-flags"));
const platform_flags_1 = __importDefault(require("./routes/platform-flags"));
const effective_flags_1 = __importDefault(require("./routes/effective-flags"));
const oauth_1 = require("./lib/google/oauth");
const gmc_1 = require("./lib/google/gmc");
const gbp_1 = require("./lib/google/gbp");
// v3.5 imports
const audit_2 = __importDefault(require("./routes/audit"));
const policy_1 = __importDefault(require("./routes/policy"));
const billing_1 = __importDefault(require("./routes/billing"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const categories_1 = __importDefault(require("./routes/categories"));
const photos_1 = __importDefault(require("./photos"));
// v3.6.2-prep imports
const feed_jobs_1 = __importDefault(require("./routes/feed-jobs"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const tenant_categories_1 = __importDefault(require("./routes/tenant-categories"));
const taxonomy_admin_1 = __importDefault(require("./routes/taxonomy-admin"));
const feed_validation_1 = __importDefault(require("./routes/feed-validation"));
// Authentication
const auth_routes_1 = __importDefault(require("./auth/auth.routes"));
const auth_1 = require("./middleware/auth");
const platform_admin_1 = require("./utils/platform-admin");
const permissions_1 = require("./middleware/permissions");
const tier_validation_1 = require("./middleware/tier-validation");
const sku_limits_1 = require("./middleware/sku-limits");
const performance_1 = __importDefault(require("./routes/performance"));
const platform_settings_1 = __importDefault(require("./routes/platform-settings"));
const platform_stats_1 = __importDefault(require("./routes/platform-stats"));
const organizations_1 = __importDefault(require("./routes/organizations"));
const organization_requests_1 = __importDefault(require("./routes/organization-requests"));
const upgrade_requests_1 = __importDefault(require("./routes/upgrade-requests"));
const permissions_2 = __importDefault(require("./routes/permissions"));
const users_1 = __importDefault(require("./routes/users"));
const tenant_users_1 = __importDefault(require("./routes/tenant-users"));
const audit_logger_1 = require("./middleware/audit-logger");
const subscription_1 = require("./middleware/subscription");
const policy_enforcement_1 = require("./middleware/policy-enforcement");
const categories_platform_1 = __importDefault(require("./routes/categories.platform"));
const categories_tenant_1 = __importDefault(require("./routes/categories.tenant"));
const categories_mirror_1 = __importDefault(require("./routes/categories.mirror"));
const mirror_admin_1 = __importDefault(require("./routes/mirror.admin"));
const sync_logs_1 = __importDefault(require("./routes/sync-logs"));
const scan_1 = __importDefault(require("./routes/scan"));
const scan_metrics_1 = __importDefault(require("./routes/scan-metrics"));
const quick_start_1 = __importDefault(require("./routes/quick-start"));
const admin_tools_1 = __importDefault(require("./routes/admin-tools"));
const admin_users_1 = __importDefault(require("./routes/admin-users"));
const feature_overrides_1 = __importDefault(require("./routes/admin/feature-overrides"));
const tier_management_1 = __importDefault(require("./routes/admin/tier-management"));
const tier_system_1 = __importDefault(require("./routes/admin/tier-system"));
const clover_1 = __importDefault(require("./routes/integrations/clover"));
// Lazy import Square routes to avoid startup failures
let squareRoutes = null;
const getSquareRoutes = async () => {
    if (!squareRoutes) {
        const { default: routes } = await Promise.resolve().then(() => __importStar(require('./square/square.routes')));
        squareRoutes = routes;
    }
    return squareRoutes;
};
const dashboard_1 = __importDefault(require("./routes/dashboard")); // FIXED VERSION
const tenant_tier_1 = __importDefault(require("./routes/tenant-tier"));
const promotion_1 = __importDefault(require("./routes/promotion"));
const tenant_limits_2 = __importDefault(require("./routes/tenant-limits"));
const app = (0, express_1.default)();
exports.app = app;
/* ------------------------- middleware ------------------------- */
app.use((0, cors_1.default)({
    origin: [/localhost:\d+$/, /\.vercel\.app$/, /vercel\.app$/, /www\.visibleshelf\.com$/, /visibleshelf\.com$/, /\.visibleshelf\.com$/, /visibleshelf\.store$/, /\.visibleshelf\.store$/],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token', 'x-tenant-id'],
}));
app.use(express_1.default.json({ limit: "50mb" })); // keep large to support base64 in dev
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use((0, morgan_1.default)(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(context_1.setRequestContext);
// CSRF: issue cookie and enforce on write operations when FF_ENFORCE_CSRF=true
app.use(csrf_1.setCsrfCookie);
app.use(csrf_1.csrfProtect);
// Ensure audit table exists if auditing is enabled
// TEMP: Commented out due to Prisma JsonBody error in Railway
// ensureAuditTable().catch(() => {});
// Ensure helper view exists for feed category resolution
// TEMP: Commented out due to Prisma JsonBody error in Railway
// ensureFeedCategoryView().catch(() => {});
console.log("✓ Express configured with 50mb body limit");
/* -------------------- static uploads (filesystem for MVP) -------------------- */
const DEV = process.env.NODE_ENV !== "production";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path_1.default.resolve(process.cwd(), "uploads");
// Create upload directory in both dev and production for MVP
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    try {
        fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    catch { }
}
// Serve uploads statically in both dev and production for MVP
app.use("/uploads", express_1.default.static(UPLOAD_DIR));
/* ----------------------------- health ----------------------------- */
const health_1 = __importDefault(require("./routes/health"));
app.use('/health', health_1.default);
/* ------------------------------ TENANTS ------------------------------ */
app.get("/tenants", auth_1.authenticateToken, async (req, res) => {
    try {
        // Platform users (admin, support, viewer) see all tenants, regular users see only their tenants
        const { isPlatformUser } = await Promise.resolve().then(() => __importStar(require('./utils/platform-admin')));
        const tenants = await prisma_1.prisma.tenant.findMany({
            where: isPlatformUser(req.user) ? {} : {
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
    }
    catch (_e) {
        res.status(500).json({ error: "failed_to_list_tenants" });
    }
});
app.get("/tenants/:id", auth_1.authenticateToken, auth_1.checkTenantAccess, async (req, res) => {
    try {
        let tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.params.id } });
        if (!tenant)
            return res.status(404).json({ error: "tenant_not_found" });
        const now = new Date();
        // Auto-set trial expiration date if missing for trial users
        if (tenant.subscriptionStatus === "trial" &&
            !tenant.trialEndsAt) {
            console.log(`[GET /tenants/:id] Trial date missing for tenant ${tenant.id}. Setting trial to expire in ${tenant_limits_1.TRIAL_CONFIG.durationDays} days.`);
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + tenant_limits_1.TRIAL_CONFIG.durationDays);
            tenant = await prisma_1.prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                    trialEndsAt: trialEndsAt,
                    subscriptionStatus: "trial",
                },
            });
            console.log(`[GET /tenants/:id] Trial date set for tenant ${tenant.id}: ${trialEndsAt.toISOString()}`);
        }
        // Check if trial has expired and mark as expired
        // If there is no active subscription attached, downgrade tier to internal google_only
        if (tenant.subscriptionStatus === "trial" &&
            tenant.trialEndsAt &&
            tenant.trialEndsAt < now) {
            const hasStripeSubscription = !!tenant.stripeSubscriptionId;
            console.log(`[GET /tenants/:id] Trial expired for tenant ${tenant.id}.`);
            tenant = await prisma_1.prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                    subscriptionStatus: "expired",
                    // For maintenance-only accounts without a paid subscription, force internal google_only tier
                    subscriptionTier: hasStripeSubscription ? tenant.subscriptionTier : "google_only",
                },
            });
            console.log(`[GET /tenants/:id] Tenant ${tenant.id} marked as expired with tier ${tenant.subscriptionTier}.`);
        }
        res.json(tenant);
    }
    catch (_e) {
        res.status(500).json({ error: "failed_to_get_tenant" });
    }
});
const createTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    ownerId: zod_1.z.string().optional(), // Optional: specify a different owner (for PLATFORM_SUPPORT)
});
app.post("/tenants", auth_1.authenticateToken, permissions_1.checkTenantCreationLimit, async (req, res) => {
    const parsed = createTenantSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    try {
        // Determine who will own this tenant
        // If ownerId is provided and user is PLATFORM_SUPPORT, use that owner
        // Otherwise, the authenticated user becomes the owner
        const ownerId = (req.user?.role === 'PLATFORM_SUPPORT' && parsed.data.ownerId)
            ? parsed.data.ownerId
            : req.user.userId;
        console.log('[POST /tenants] Creating tenant for owner:', ownerId, 'by user:', req.user?.userId);
        // Validate for duplicates (check against the owner, not the creator)
        const { validateTenantCreation } = await Promise.resolve().then(() => __importStar(require('./utils/tenant-validation')));
        const validation = await validateTenantCreation(ownerId, parsed.data.name);
        if (!validation.valid) {
            console.log('[POST /tenants] Validation failed:', validation.errors);
            return res.status(409).json({
                error: 'duplicate_tenant',
                message: 'A location with this information already exists',
                validationErrors: validation.errors,
            });
        }
        // Set trial to expire based on configured trial duration
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + tenant_limits_1.TRIAL_CONFIG.durationDays);
        const tenant = await prisma_1.prisma.tenant.create({
            data: {
                name: parsed.data.name,
                subscriptionTier: 'starter',
                subscriptionStatus: 'trial',
                trialEndsAt: trialEndsAt,
                createdBy: req.user.userId, // Track who created this tenant (for auditing)
            }
        });
        console.log('[POST /tenants] Tenant created:', tenant.id, 'by:', req.user?.userId);
        // Link tenant to the owner (may be different from creator if PLATFORM_SUPPORT)
        console.log('[POST /tenants] Linking tenant to owner:', ownerId);
        await prisma_1.prisma.userTenant.create({
            data: {
                userId: ownerId,
                tenantId: tenant.id,
                role: 'OWNER',
            },
        });
        console.log('[POST /tenants] UserTenant link created successfully');
        await (0, audit_1.audit)({ tenantId: tenant.id, actor: null, action: "tenant.create", payload: { name: parsed.data.name } });
        res.status(201).json(tenant);
    }
    catch (error) {
        console.error('[POST /tenants] Error creating tenant:', error);
        res.status(500).json({ error: "failed_to_create_tenant", message: error instanceof Error ? error.message : 'Unknown error' });
    }
});
const updateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    region: zod_1.z.string().min(1).optional(),
    language: zod_1.z.string().min(1).optional(),
    currency: zod_1.z.string().min(1).optional(),
});
app.put("/tenants/:id", auth_1.authenticateToken, auth_1.checkTenantAccess, async (req, res) => {
    const parsed = updateTenantSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    try {
        const data = {};
        if (parsed.data.name !== undefined)
            data.name = parsed.data.name;
        if (parsed.data.region !== undefined)
            data.region = parsed.data.region;
        if (parsed.data.language !== undefined)
            data.language = parsed.data.language;
        if (parsed.data.currency !== undefined)
            data.currency = parsed.data.currency;
        const tenant = await prisma_1.prisma.tenant.update({ where: { id: req.params.id }, data });
        res.json(tenant);
    }
    catch (e) {
        console.error('[PUT /tenants/:id] Error updating tenant:', e);
        res.status(500).json({ error: "failed_to_update_tenant" });
    }
});
// PATCH /tenants/:id - Update tenant subscription tier (admin only)
const patchTenantSchema = zod_1.z.object({
    subscriptionTier: zod_1.z.enum(['google_only', 'starter', 'professional', 'enterprise', 'organization']).optional(),
    subscriptionStatus: zod_1.z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
    organizationId: zod_1.z.string().optional(), // For linking to organization
});
app.patch("/tenants/:id", auth_1.authenticateToken, auth_1.requireAdmin, tier_validation_1.validateTierAssignment, tier_validation_1.validateTierCompatibility, sku_limits_1.validateTierSKUCompatibility, async (req, res) => {
    const parsed = patchTenantSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    try {
        const tenant = await prisma_1.prisma.tenant.update({
            where: { id: req.params.id },
            data: parsed.data
        });
        res.json(tenant);
    }
    catch (e) {
        console.error('[PATCH /tenants/:id] Error:', e);
        res.status(500).json({ error: "failed_to_update_tenant" });
    }
});
app.delete("/tenants/:id", auth_1.authenticateToken, auth_1.checkTenantAccess, permissions_1.requireTenantOwner, async (req, res) => {
    try {
        await prisma_1.prisma.tenant.delete({ where: { id: req.params.id } });
        res.status(204).end();
    }
    catch {
        res.status(500).json({ error: "failed_to_delete_tenant" });
    }
});
// Tenant profile (business information)
const E164 = /^\+[1-9]\d{1,14}$/; // E.164 phone pattern: MUST start with '+'
const HTTPS_URL = /^https:\/\//i;
const tenantProfileSchema = zod_1.z.object({
    tenant_id: zod_1.z.string().min(1),
    business_name: zod_1.z.string().min(1).optional(),
    address_line1: zod_1.z.string().optional(),
    address_line2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postal_code: zod_1.z.string().optional(),
    country_code: zod_1.z.string().length(2).optional(),
    phone_number: zod_1.z
        .string()
        .refine((v) => !v || E164.test(v), { message: "phone_must_be_e164" })
        .optional(),
    email: zod_1.z.string().email().optional(),
    website: zod_1.z
        .string()
        .url()
        .refine((v) => !v || HTTPS_URL.test(v), { message: "website_must_be_https" })
        .optional(),
    contact_person: zod_1.z.string().optional(),
    logo_url: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    banner_url: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    business_description: zod_1.z.string().optional(),
    hours: zod_1.z.any().optional(),
    social_links: zod_1.z.any().optional(),
    seo_tags: zod_1.z.any().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    display_map: zod_1.z.boolean().optional(),
    map_privacy_mode: zod_1.z.enum(["precise", "neighborhood"]).optional(),
});
app.post("/tenant/profile", auth_1.authenticateToken, async (req, res) => {
    const parsed = tenantProfileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        console.error('[POST /tenant/profile] Validation failed:', parsed.error.flatten());
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }
    try {
        const { tenant_id, ...profileData } = parsed.data;
        console.log('[POST /tenant/profile] Starting for tenant:', tenant_id);
        console.log('[POST /tenant/profile] Profile data:', profileData);
        const existingTenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenant_id } });
        if (!existingTenant) {
            console.error('[POST /tenant/profile] Tenant not found:', tenant_id);
            return res.status(404).json({ error: "tenant_not_found" });
        }
        console.log('[POST /tenant/profile] Found tenant:', existingTenant.name);
        // Use raw SQL instead of Prisma client since it doesn't recognize the new table
        // Import basePrisma to bypass retry wrapper
        const { basePrisma } = await Promise.resolve().then(() => __importStar(require('./prisma')));
        // Check if profile exists
        const existingProfiles = await basePrisma.$queryRaw `
      SELECT tenant_id FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}
    `;
        console.log('[POST /tenant/profile] Existing profiles check result:', existingProfiles);
        let result;
        if (existingProfiles.length > 0) {
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
          UPDATE "tenant_business_profile"
          SET ${updateParts.join(', ')}
          WHERE tenant_id = $${values.length}
        `;
                console.log('[POST /tenant/profile] Update query:', updateQuery);
                console.log('[POST /tenant/profile] Update values:', values);
                await basePrisma.$executeRawUnsafe(updateQuery, ...values);
                console.log('[POST /tenant/profile] Update executed successfully');
            }
            // Get updated profile
            result = await basePrisma.$queryRaw `
        SELECT * FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}
      `;
            console.log('[POST /tenant/profile] Retrieved updated profile');
        }
        else {
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
                hours: profileData.hours,
                social_links: profileData.social_links,
                seo_tags: profileData.seo_tags,
                latitude: profileData.latitude,
                longitude: profileData.longitude,
                display_map: profileData.display_map,
                map_privacy_mode: profileData.map_privacy_mode,
            };
            Object.entries(optionalMappings).forEach(([field, value]) => {
                if (value !== undefined) {
                    insertFields.push(field);
                    insertValues.push(value === '' ? null : value);
                }
            });
            const placeholders = insertFields.map((_, i) => `$${i + 1}`);
            const insertQuery = `
        INSERT INTO "tenant_business_profile" (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
            console.log('[POST /tenant/profile] Insert query:', insertQuery);
            console.log('[POST /tenant/profile] Final insert values:', insertValues);
            result = await basePrisma.$executeRawUnsafe(insertQuery, ...insertValues).then(() => basePrisma.$queryRaw `SELECT * FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}`);
            console.log('[POST /tenant/profile] Created new profile');
        }
        // Keep Tenant.name in sync
        if (profileData.business_name) {
            console.log('[POST /tenant/profile] Updating tenant name to:', profileData.business_name);
            await prisma_1.prisma.tenant.update({ where: { id: tenant_id }, data: { name: profileData.business_name } });
        }
        console.log('[POST /tenant/profile] Success, returning result:', result[0] || result);
        res.json(result[0] || result);
    }
    catch (e) {
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
// GET /tenant/profile - retrieve normalized profile
app.get("/tenant/profile", auth_1.authenticateToken, async (req, res) => {
    try {
        const tenantId = req.query.tenant_id || req.query.tenantId;
        if (!tenantId)
            return res.status(400).json({ error: "tenant_required" });
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            return res.status(404).json({ error: "tenant_not_found" });
        // Use raw SQL instead of Prisma client since it doesn't recognize the new table
        const { basePrisma } = await Promise.resolve().then(() => __importStar(require('./prisma')));
        const bpResults = await basePrisma.$queryRaw `
      SELECT * FROM "tenant_business_profile" WHERE tenant_id = ${tenantId}
    `;
        const bp = bpResults[0] || null;
        const md = tenant.metadata || {};
        const profile = {
            tenant_id: tenant.id,
            business_name: bp?.business_name || md.business_name || tenant.name || null,
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
        };
        return res.json(profile);
    }
    catch (e) {
        console.error("[GET /tenant/profile] Error:", e);
        return res.status(500).json({ error: "failed_to_get_profile" });
    }
});
// Public endpoint to get basic tenant info (no auth required)
app.get("/public/tenant/:tenantId", async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId)
            return res.status(400).json({ error: "tenant_required" });
        const tenant = await prisma_1.prisma.tenant.findUnique({
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
        if (!tenant)
            return res.status(404).json({ error: "tenant_not_found" });
        // Check if tenant has storefront access (tier + overrides)
        const tier = tenant.subscriptionTier || 'trial';
        const hasStorefrontByTier = tier !== 'google_only'; // google_only doesn't have storefront
        // Check for storefront override
        const storefrontOverride = tenant.featureOverrides.find((override) => override.feature === 'storefront');
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
    }
    catch (e) {
        console.error("[GET /public/tenant/:tenantId] Error:", e);
        return res.status(500).json({ error: "failed_to_get_tenant" });
    }
});
// Public endpoint to get tenant product preview (SWIS - Store Window Inventory Showcase)
app.get("/tenant/:tenantId/swis/preview", async (req, res) => {
    try {
        const { tenantId } = req.params;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'updated_desc';
        if (!tenantId)
            return res.status(400).json({ error: "tenant_required" });
        // Build sort order
        let orderBy = { updatedAt: 'desc' };
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
        const products = await prisma_1.prisma.inventoryItem.findMany({
            where: { tenantId },
            orderBy,
            take: limit,
        });
        return res.json({ products, total: products.length });
    }
    catch (e) {
        console.error("[GET /tenant/:tenantId/swis/preview] Error:", e);
        return res.status(500).json({ error: "failed_to_get_preview" });
    }
});
// Public endpoint for product pages to get tenant business profile (no auth required)
app.get("/public/tenant/:tenantId/profile", async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId)
            return res.status(400).json({ error: "tenant_required" });
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            return res.status(404).json({ error: "tenant_not_found" });
        // Use raw SQL instead of Prisma client since it doesn't recognize the new table
        const { basePrisma } = await Promise.resolve().then(() => __importStar(require('./prisma')));
        const bpResults = await basePrisma.$queryRaw `
      SELECT tenant_id, business_name, address_line1, address_line2, city, state, postal_code, country_code, phone_number, email, website, contact_person, logo_url, banner_url, business_description, hours, social_links, seo_tags, latitude, longitude, display_map, map_privacy_mode, created_at, updated_at FROM "tenant_business_profile" WHERE tenant_id = ${tenantId}
    `;
        const bp = bpResults[0] || null;
        // Fetch business hours from BusinessHours table
        const businessHours = await prisma_1.prisma.businessHours.findUnique({ where: { tenantId } });
        const specialHours = await prisma_1.prisma.businessHoursSpecial.findMany({
            where: { tenantId },
            orderBy: { date: 'asc' }
        });
        let hoursData = null;
        if (businessHours && businessHours.periods) {
            // Convert periods array to day-keyed object for storefront
            const periods = businessHours.periods;
            const hoursByDay = { timezone: businessHours.timezone || 'America/New_York' };
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
        }
        else {
            console.log('[Profile API] No business hours found for', tenantId);
        }
        const md = tenant.metadata || {};
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
            banner_url: bp?.banner_url ?? md.banner_url ?? null,
            business_description: bp?.business_description || md.business_description || null,
            hours: hoursData || bp?.hours || md.hours || null,
        };
        return res.json(profile);
    }
    catch (e) {
        console.error("[GET /public/tenant/:tenantId/profile] Error:", e);
        return res.status(500).json({ error: "failed_to_get_profile" });
    }
});
// Public endpoint to get tenant items for storefront (no auth required)
app.get("/public/tenant/:tenantId/items", async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId)
            return res.status(400).json({ error: "tenant_required" });
        // Parse pagination params
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '12', 10);
        const skip = (page - 1) * limit;
        const search = req.query.search;
        // Build where clause - only show active, public items
        const where = {
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
            prisma_1.prisma.inventoryItem.findMany({
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
            prisma_1.prisma.inventoryItem.count({ where }),
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
    }
    catch (e) {
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
    }
    catch (e) {
        console.error("[GET /api/public/features-showcase-config] Error:", e);
        return res.status(500).json({ error: "failed_to_get_config" });
    }
});
// PATCH /tenant/profile - partial update
const tenantProfileUpdateSchema = tenantProfileSchema.partial().extend({ tenant_id: zod_1.z.string().min(1) });
app.patch("/tenant/profile", auth_1.authenticateToken, async (req, res) => {
    const parsed = tenantProfileUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    try {
        const { tenant_id, ...delta } = parsed.data;
        const existingTenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenant_id } });
        if (!existingTenant)
            return res.status(404).json({ error: "tenant_not_found" });
        // Use raw SQL instead of Prisma client since it doesn't recognize the new table
        // Import basePrisma to bypass retry wrapper
        const { basePrisma } = await Promise.resolve().then(() => __importStar(require('./prisma')));
        console.log(`[PATCH /tenant/profile] Processing update for tenant ${tenant_id}`);
        console.log(`[PATCH /tenant/profile] Delta data:`, delta);
        // Check if profile exists
        const existingProfiles = await basePrisma.$queryRaw `
      SELECT tenant_id FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}
    `;
        console.log(`[PATCH /tenant/profile] Existing profiles found:`, existingProfiles.length);
        let result;
        if (existingProfiles.length > 0) {
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
          UPDATE "tenant_business_profile"
          SET ${updateParts.join(', ')}
          WHERE tenant_id = $${values.length}
        `;
                console.log(`[PATCH /tenant/profile] Update query:`, updateQuery);
                console.log(`[PATCH /tenant/profile] Update values:`, values);
                await basePrisma.$executeRawUnsafe(updateQuery, ...values);
                console.log(`[PATCH /tenant/profile] Update executed successfully`);
            }
            // Get updated profile
            result = await basePrisma.$queryRaw `
        SELECT * FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}
      `;
            console.log(`[PATCH /tenant/profile] Retrieved updated profile:`, result);
        }
        else {
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
                    insertValues.push(value === '' ? null : value);
                }
            });
            const placeholders = insertFields.map((_, i) => `$${i + 1}`);
            const insertQuery = `
        INSERT INTO "tenant_business_profile" (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
            console.log(`[PATCH /tenant/profile] Insert query:`, insertQuery);
            console.log(`[PATCH /tenant/profile] Insert values:`, insertValues);
            result = await basePrisma.$executeRawUnsafe(insertQuery, ...insertValues).then(() => basePrisma.$queryRaw `SELECT * FROM "tenant_business_profile" WHERE tenant_id = ${tenant_id}`);
            console.log(`[PATCH /tenant/profile] Created new profile:`, result);
        }
        // Update tenant name if business_name changed
        if (delta.business_name && typeof delta.business_name === 'string' && delta.business_name.trim()) {
            await prisma_1.prisma.tenant.update({ where: { id: tenant_id }, data: { name: delta.business_name } });
        }
        // Handle logo_url clearing from tenant metadata
        if ('logo_url' in delta && delta.logo_url === '') {
            const currentMetadata = existingTenant.metadata || {};
            if (currentMetadata.logo_url) {
                delete currentMetadata.logo_url;
                await prisma_1.prisma.tenant.update({
                    where: { id: tenant_id },
                    data: { metadata: currentMetadata }
                });
            }
        }
        console.log(`[PATCH /tenant/profile] Final result to return:`, result[0] || result);
        return res.json(result[0] || result);
    }
    catch (e) {
        console.error("[PATCH /tenant/profile] Error:", e);
        return res.status(500).json({ error: "failed_to_update_profile" });
    }
});
// Tenant logo upload endpoint (must be defined before multer middleware below)
const logoUploadMulter = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit for logos
const logoDataUrlSchema = zod_1.z.object({
    tenant_id: zod_1.z.string().min(1),
    dataUrl: zod_1.z.string().min(1),
    contentType: zod_1.z.string().min(1),
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
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            console.log(`[Logo Upload] Tenant not found: ${tenantId}`);
            return res.status(404).json({ error: "tenant_not_found" });
        }
        // Initialize Supabase client (will be initialized below in photos section)
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseLogo = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
            ? (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            : null;
        if (!supabaseLogo) {
            return res.status(500).json({ error: "supabase_not_configured" });
        }
        let publicUrl;
        const TENANT_BUCKET = storage_config_1.StorageBuckets.TENANTS;
        // A) multipart/form-data "file" upload
        if (req.file) {
            const f = req.file;
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
        else if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof req.body?.dataUrl === "string") {
            const parsed = logoDataUrlSchema.safeParse(req.body || {});
            if (!parsed.success) {
                console.error(`[Logo Upload] Invalid dataUrl payload:`, parsed.error.flatten());
                return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
            }
            const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
            if (!match)
                return res.status(400).json({ error: "invalid_data_url" });
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
        }
        else {
            return res.status(400).json({ error: "unsupported_payload" });
        }
        // Update tenant metadata with logo URL
        const updatedTenant = await prisma_1.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                metadata: {
                    ...(tenant.metadata || {}),
                    logo_url: publicUrl,
                },
            },
        });
        return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
    }
    catch (e) {
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
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ error: "tenant_not_found" });
        }
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseBanner = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
            ? (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            : null;
        if (!supabaseBanner) {
            return res.status(500).json({ error: "supabase_not_configured" });
        }
        let publicUrl;
        const TENANT_BUCKET = storage_config_1.StorageBuckets.TENANTS;
        // JSON dataUrl upload (frontend sends compressed base64)
        if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof req.body?.dataUrl === "string") {
            const parsed = logoDataUrlSchema.safeParse(req.body || {});
            if (!parsed.success) {
                console.error(`[Banner Upload] Invalid dataUrl payload:`, parsed.error.flatten());
                return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
            }
            const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
            if (!match)
                return res.status(400).json({ error: "invalid_data_url" });
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
        }
        else {
            return res.status(400).json({ error: "unsupported_payload" });
        }
        // Update tenant metadata with banner URL
        const updatedTenant = await prisma_1.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                metadata: {
                    ...(tenant.metadata || {}),
                    banner_url: publicUrl,
                },
            },
        });
        return res.status(200).json({ url: publicUrl, tenant: updatedTenant });
    }
    catch (e) {
        console.error("[Banner Upload Error]:", e?.message);
        return res.status(500).json({
            error: "failed_to_upload_banner",
            details: DEV ? e?.message : undefined
        });
    }
});
/* ----------------------------- PHOTOS (MOUNTED BEFORE /items) ----------------------------- */
/** Accept JSON { url } (already uploaded), JSON { dataUrl } (dev), or multipart "file" (server uploads to Supabase or dev FS) */
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const jsonUrlSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1).optional(), // optional—can be derived from item
    url: zod_1.z.string().url(),
    width: zod_1.z.number().int().positive().optional(),
    height: zod_1.z.number().int().positive().optional(),
    bytes: zod_1.z.number().int().nonnegative().optional(),
    contentType: zod_1.z.string().optional(),
    exifRemoved: zod_1.z.boolean().optional(),
});
const dataUrlSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    dataUrl: zod_1.z.string().min(1),
    contentType: zod_1.z.string().min(1),
});
// Supabase (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;
// Log Supabase configuration status at startup
if (supabase) {
    console.log('✓ Supabase configured for photo storage');
}
else {
    console.warn('⚠ Supabase NOT configured - photo uploads will fail in production');
    console.warn('  Missing env vars:', {
        SUPABASE_URL: !!SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY
    });
}
// Helper: enforce MVP 1MB limit for base64 uploads
function rejectIfOver1MB(bytes) {
    const LIMIT = 1000000;
    if (bytes > LIMIT) {
        const kb = Math.round(bytes / 1024);
        throw Object.assign(new Error("image_too_large"), { code: "IMAGE_TOO_LARGE", bytes: kb });
    }
}
// POST /items/:id/photos and /inventory/:id/photos
// Shared handler for POST /items/:id/photos (and /inventory/:id/photos)
const photoUploadHandler = async (req, res) => {
    try {
        const itemId = req.params.id;
        console.log(`[Photo Upload] Starting upload for item ${itemId}`, {
            hasFile: !!req.file,
            contentType: req.get('content-type'),
            bodyKeys: req.body ? Object.keys(req.body) : [],
            supabaseConfigured: !!supabase
        });
        const item = await prisma_1.prisma.inventoryItem.findUnique({ where: { id: itemId } });
        if (!item) {
            console.log(`[Photo Upload] Item not found: ${itemId}`);
            return res.status(404).json({ error: "item_not_found" });
        }
        console.log(`[Photo Upload] Item found:`, { id: item.id, tenantId: item.tenantId, sku: item.sku });
        // A) JSON { url, ... } → register the asset
        if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof req.body?.url === "string") {
            const parsed = jsonUrlSchema.safeParse(req.body || {});
            if (!parsed.success)
                return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
            const { url, width, height, bytes, contentType, exifRemoved } = parsed.data;
            const created = await prisma_1.prisma.photoAsset.create({
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
            await prisma_1.prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: url } });
            return res.status(201).json(created);
        }
        // B) multipart/form-data "file" → Supabase (if configured) or local FS in dev
        if (req.file) {
            const f = req.file;
            let publicUrl = null;
            if (supabase) {
                const pathKey = `${item.tenantId}/${item.sku || item.id}/${Date.now()}-${(f.originalname || "photo").replace(/\s+/g, "_")}`;
                console.log(`[Photo Upload] Uploading to Supabase:`, { pathKey, size: f.size, mimetype: f.mimetype });
                const { error, data } = await supabase.storage.from(storage_config_1.StorageBuckets.PHOTOS.name).upload(pathKey, f.buffer, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: f.mimetype || "application/octet-stream",
                });
                if (error) {
                    console.error(`[Photo Upload] Supabase upload error:`, error);
                    return res.status(500).json({ error: error.message, details: error });
                }
                publicUrl = supabase.storage.from(storage_config_1.StorageBuckets.PHOTOS.name).getPublicUrl(data.path).data.publicUrl;
                console.log(`[Photo Upload] Supabase upload successful:`, { publicUrl });
            }
            else if (DEV) {
                const ext = f.mimetype.includes("png") ? ".png" : f.mimetype.includes("webp") ? ".webp" : ".jpg";
                const filename = `${item.id}-${Date.now()}${ext}`;
                fs_1.default.writeFileSync(path_1.default.join(UPLOAD_DIR, filename), f.buffer);
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                publicUrl = `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
            }
            else {
                return res.status(500).json({ error: "no_upload_backend_configured" });
            }
            const created = await prisma_1.prisma.photoAsset.create({
                data: {
                    tenantId: item.tenantId,
                    inventoryItemId: item.id,
                    url: publicUrl,
                    contentType: f.mimetype,
                    bytes: f.size,
                    exifRemoved: true,
                },
            });
            // Always update the item's imageUrl to the latest uploaded photo
            await prisma_1.prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: publicUrl } });
            return res.status(201).json(created);
        }
        // C) JSON { dataUrl, contentType } → Supabase Storage or filesystem fallback (enforce <1MB)
        if (!req.file && (req.is("application/json") || req.is("*/json")) && typeof req.body?.dataUrl === "string") {
            console.log(`[Photo Upload] Processing dataUrl upload`);
            const parsed = dataUrlSchema.safeParse(req.body || {});
            if (!parsed.success) {
                console.error(`[Photo Upload] Invalid dataUrl payload:`, parsed.error.flatten());
                return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
            }
            const match = /^data:[^;]+;base64,(.+)$/i.exec(parsed.data.dataUrl);
            if (!match)
                return res.status(400).json({ error: "invalid_data_url" });
            const buf = Buffer.from(match[1], "base64");
            rejectIfOver1MB(buf.length); // MVP constraint
            const ext = parsed.data.contentType.includes("png")
                ? ".png"
                : parsed.data.contentType.includes("webp")
                    ? ".webp"
                    : ".jpg";
            let publicUrl;
            // Prefer Supabase Storage if configured
            if (supabase) {
                const pathKey = `${item.tenantId}/${item.sku || item.id}/${Date.now()}${ext}`;
                console.log(`[Photo Upload] Uploading dataUrl to Supabase:`, { pathKey, size: buf.length, contentType: parsed.data.contentType });
                const { error, data } = await supabase.storage.from(storage_config_1.StorageBuckets.PHOTOS.name).upload(pathKey, buf, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: parsed.data.contentType,
                });
                if (error) {
                    console.error("[Photo Upload] Supabase dataUrl upload error:", error);
                    return res.status(500).json({ error: "supabase_upload_failed", details: error.message });
                }
                publicUrl = supabase.storage.from(storage_config_1.StorageBuckets.PHOTOS.name).getPublicUrl(data.path).data.publicUrl;
                console.log(`[Photo Upload] Supabase dataUrl upload successful:`, { publicUrl });
            }
            else {
                // Fallback to filesystem
                const filename = `${itemId}-${Date.now()}${ext}`;
                fs_1.default.writeFileSync(path_1.default.join(UPLOAD_DIR, filename), buf);
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                publicUrl = `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
            }
            const created = await prisma_1.prisma.photoAsset.create({
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
            await prisma_1.prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: publicUrl } });
            return res.status(201).json(created);
        }
        return res.status(400).json({ error: "unsupported_payload" });
    }
    catch (e) {
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
app.use(photos_1.default);
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
const listQuery = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    count: zod_1.z.string().optional(), // Return only count for performance
    page: zod_1.z.string().optional(), // Page number (1-indexed)
    limit: zod_1.z.string().optional(), // Items per page
    search: zod_1.z.string().optional(), // Search by SKU or name
    status: zod_1.z.enum(['all', 'active', 'inactive', 'syncing']).optional(), // Filter by status
    visibility: zod_1.z.enum(['all', 'public', 'private']).optional(), // Filter by visibility
    sortBy: zod_1.z.enum(['name', 'sku', 'price', 'stock', 'updatedAt', 'createdAt']).optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
});
app.get(["/api/items", "/api/inventory", "/items", "/inventory"], auth_1.authenticateToken, async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ error: "tenant_required" });
    // Check tenant access
    const tenantId = parsed.data.tenantId;
    const isAdmin = (0, platform_admin_1.isPlatformAdmin)(req.user);
    const hasAccess = isAdmin || req.user?.tenantIds.includes(tenantId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'tenant_access_denied', message: 'You do not have access to this tenant' });
    }
    try {
        // Build where clause
        const where = { tenantId };
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
            }
            else if (parsed.data.status === 'inactive') {
                where.itemStatus = 'inactive';
            }
            else if (parsed.data.status === 'syncing') {
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
            }
            else if (parsed.data.visibility === 'private') {
                where.visibility = 'private';
            }
        }
        // If count=true, return only the count
        if (req.query.count === 'true') {
            const count = await prisma_1.prisma.inventoryItem.count({ where });
            return res.json({ count });
        }
        // Parse pagination params
        const page = parseInt(parsed.data.page || '1', 10);
        const limit = parseInt(parsed.data.limit || '25', 10);
        const skip = (page - 1) * limit;
        // Build orderBy clause
        const sortBy = parsed.data.sortBy || 'updatedAt';
        const sortOrder = parsed.data.sortOrder || 'desc';
        const orderBy = {};
        if (sortBy === 'price') {
            orderBy.priceCents = sortOrder;
        }
        else {
            orderBy[sortBy] = sortOrder;
        }
        // Fetch items with pagination (includes category relation for better UX)
        const [items, totalCount] = await Promise.all([
            prisma_1.prisma.inventoryItem.findMany({
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
            prisma_1.prisma.inventoryItem.count({ where }),
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
    }
    catch (e) {
        console.error('[GET /items] Error listing items:', e);
        res.status(500).json({ error: "failed_to_list_items", message: e?.message });
    }
});
app.get(["/api/items/:id", "/api/inventory/:id", "/items/:id", "/inventory/:id"], async (req, res) => {
    const it = await prisma_1.prisma.inventoryItem.findUnique({
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
    if (!it)
        return res.status(404).json({ error: "not_found" });
    res.json(it);
});
const createItemSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    sku: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    priceCents: zod_1.z.number().int().nonnegative().default(0),
    stock: zod_1.z.number().int().nonnegative().default(0),
    imageUrl: zod_1.z.string().url().nullable().optional(),
    metadata: zod_1.z.any().optional(),
    description: zod_1.z.string().optional(),
    // v3.4 SWIS fields (required by schema)
    title: zod_1.z.string().min(1).optional(),
    brand: zod_1.z.string().min(1).optional(),
    manufacturer: zod_1.z.string().optional(),
    price: zod_1.z.union([zod_1.z.number(), zod_1.z.string().transform(Number)]).pipe(zod_1.z.number().nonnegative()).optional(),
    currency: zod_1.z.string().length(3).optional(),
    availability: zod_1.z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
    // Item status and visibility
    itemStatus: zod_1.z.enum(['active', 'inactive', 'archived']).optional(),
    visibility: zod_1.z.enum(['public', 'private']).optional(),
});
app.post(["/items", "/inventory"], subscription_1.checkSubscriptionLimits, policy_enforcement_1.enforcePolicyCompliance, async (req, res) => {
    const parsed = createItemSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
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
        const created = await prisma_1.prisma.inventoryItem.create({ data });
        await (0, audit_1.audit)({ tenantId: created.tenantId, actor: null, action: "inventory.create", payload: { id: created.id, sku: created.sku } });
        res.status(201).json(created);
    }
    catch (e) {
        if (e?.code === "P2002")
            return res.status(409).json({ error: "duplicate_sku" });
        console.error('[POST /items] Error creating item:', e);
        res.status(500).json({ error: "failed_to_create_item", message: e?.message });
    }
});
const updateItemSchema = createItemSchema.partial().extend({ tenantId: zod_1.z.string().min(1).optional() });
app.put(["/items/:id", "/inventory/:id"], policy_enforcement_1.enforcePolicyCompliance, async (req, res) => {
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
        const updated = await prisma_1.prisma.inventoryItem.update({ where: { id: req.params.id }, data: updateData });
        await (0, audit_1.audit)({ tenantId: updated.tenantId, actor: null, action: "inventory.update", payload: { id: updated.id } });
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: "failed_to_update_item" });
    }
});
app.delete(["/items/:id", "/inventory/:id"], auth_1.authenticateToken, permissions_1.requireTenantAdmin, async (req, res) => {
    try {
        await prisma_1.prisma.inventoryItem.delete({ where: { id: req.params.id } });
        res.status(204).end();
    }
    catch {
        res.status(500).json({ error: "failed_to_delete_item" });
    }
});
// Category assignment endpoint
const categoryAssignmentSchema = zod_1.z.object({
    categorySlug: zod_1.z.string().min(1),
});
app.patch("/api/v1/tenants/:tenantId/items/:itemId/category", auth_1.authenticateToken, auth_1.checkTenantAccess, async (req, res) => {
    try {
        const { tenantId, itemId } = req.params;
        const parsed = categoryAssignmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
        }
        const updated = await CategoryService_1.categoryService.assignItemCategory(tenantId, itemId, {
            categorySlug: parsed.data.categorySlug,
        });
        res.json(updated);
    }
    catch (error) {
        console.error('[PATCH /api/v1/tenants/:tenantId/items/:itemId/category] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message || "failed_to_assign_category" });
    }
});
// Update item status (for Google sync control)
app.patch(["/items/:id", "/inventory/:id"], auth_1.authenticateToken, async (req, res) => {
    try {
        const { itemStatus, visibility, availability } = req.body;
        const updateData = {};
        if (itemStatus)
            updateData.itemStatus = itemStatus;
        if (visibility)
            updateData.visibility = visibility;
        if (availability)
            updateData.availability = availability;
        const updated = await prisma_1.prisma.inventoryItem.update({
            where: { id: req.params.id },
            data: updateData,
        });
        res.json(updated);
    }
    catch (error) {
        console.error('[PATCH Item] Error:', error);
        res.status(500).json({ error: "failed_to_update_item" });
    }
});
// Sync availability status for all items (fix out-of-sync items)
app.post("/items/sync-availability", auth_1.authenticateToken, async (req, res) => {
    try {
        const tenantId = req.body.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_required" });
        }
        // Get all items for the tenant
        const items = await prisma_1.prisma.inventoryItem.findMany({
            where: { tenantId },
            select: { id: true, stock: true, availability: true },
        });
        // Find items that are out of sync
        const outOfSync = items.filter(item => {
            const expectedAvailability = item.stock > 0 ? 'in_stock' : 'out_of_stock';
            return item.availability !== expectedAvailability;
        });
        // Update out-of-sync items
        const updates = await Promise.all(outOfSync.map(item => prisma_1.prisma.inventoryItem.update({
            where: { id: item.id },
            data: { availability: item.stock > 0 ? 'in_stock' : 'out_of_stock' },
        })));
        res.json({
            success: true,
            total: items.length,
            synced: updates.length,
            message: `Synced ${updates.length} out of ${items.length} items`,
        });
    }
    catch (error) {
        console.error('[Sync Availability] Error:', error);
        res.status(500).json({ error: "failed_to_sync_availability" });
    }
});
//* ------------------------------ GOOGLE TAXONOMY SEARCH ------------------------------ */
app.get('/api/google/taxonomy/browse', async (req, res) => {
    try {
        const { level = '1' } = req.query;
        const targetLevel = parseInt(level, 10);
        // Get top-level categories (those without parentId or with specific parent)
        // Instead of relying on level field, get categories that represent top-level groupings
        const categories = await prisma_1.prisma.googleTaxonomy.findMany({
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
        let finalCategories = categories;
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
        const categoriesWithChildren = await Promise.all(finalCategories.map(async (cat) => {
            let children = [];
            // If using fallback categories, get children from the hardcoded list
            if (categories.length === 0) {
                children = finalCategories.filter(c => c.parentId === cat.categoryId);
            }
            else {
                // Get children from database
                children = await prisma_1.prisma.googleTaxonomy.findMany({
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
        }));
        res.json({
            success: true,
            categories: categoriesWithChildren,
        });
    }
    catch (error) {
        console.error('[Google Taxonomy Browse] Error:', error);
        res.status(500).json({ success: false, error: 'Browse failed' });
    }
});
app.get('/api/google/taxonomy/search', async (req, res) => {
    try {
        const { q: query, limit = '10' } = req.query;
        // Disable caching for search results
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter required' });
        }
        // Search real Google taxonomy data from database
        const lowerQuery = query.toLowerCase();
        const categories = await prisma_1.prisma.googleTaxonomy.findMany({
            where: {
                isActive: true,
                OR: [
                    { categoryPath: { contains: query } }, // Try case-sensitive first
                    { categoryId: { contains: query } }
                ]
            },
            take: parseInt(limit, 10),
            orderBy: { categoryPath: 'asc' }
        });
        // If no results with case-sensitive, try case-insensitive approach
        if (categories.length === 0) {
            const caseInsensitiveCategories = await prisma_1.prisma.googleTaxonomy.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { categoryPath: { contains: lowerQuery } },
                        { categoryId: { contains: lowerQuery } }
                    ]
                },
                take: parseInt(limit, 10),
                orderBy: { categoryPath: 'asc' }
            });
            categories.push(...caseInsensitiveCategories);
        }
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
    }
    catch (error) {
        console.error('[Google Taxonomy Search] Error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});
app.get("/__routes", (_req, res) => {
    const out = [];
    // Always include known core routes
    out.push({ methods: ["GET"], path: "/health" });
    out.push({ methods: ["GET"], path: "/__ping" });
    function collect(stack, base = "") {
        stack?.forEach((layer) => {
            if (layer.route && layer.route.path) {
                const methods = layer.route.methods
                    ? Array.isArray(layer.route.methods)
                        ? layer.route.methods
                        : Object.keys(layer.route.methods)
                    : [];
                const path = base + layer.route.path;
                out.push({ methods: methods.map((m) => m.toUpperCase()), path });
            }
            else if (layer.name === 'router' && layer.handle?.stack) {
                const match = layer.regexp && layer.regexp.fast_slash ? "" : (layer.regexp?.source || "");
                collect(layer.handle.stack, base);
            }
        });
    }
    const stack = app._router?.stack || [];
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
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_id_required" });
        }
        // Verify tenant exists
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ error: "tenant_not_found" });
        }
        // Validate NAP (Name, Address, Phone) is complete
        // Check tenant_business_profile table first, fallback to metadata for backwards compatibility
        const businessProfile = await prisma_1.prisma.tenantBusinessProfile.findUnique({
            where: { tenantId }
        });
        const hasProfile = businessProfile
            ? (businessProfile.businessName && businessProfile.city && businessProfile.state)
            : (tenant.metadata?.business_name && tenant.metadata?.city && tenant.metadata?.state);
        if (!hasProfile) {
            return res.status(400).json({
                error: "incomplete_business_profile",
                message: "Please complete your business profile before connecting to Google",
            });
        }
        const authUrl = (0, oauth_1.getAuthorizationUrl)(tenantId);
        res.json({ authUrl });
    }
    catch (error) {
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
        const stateData = (0, oauth_1.decodeState)(state);
        if (!stateData) {
            return res.status(400).json({ error: "invalid_state" });
        }
        // Exchange code for tokens
        const tokens = await (0, oauth_1.exchangeCodeForTokens)(code);
        if (!tokens) {
            return res.status(500).json({ error: "token_exchange_failed" });
        }
        // Get user info
        const userInfo = await (0, oauth_1.getUserInfo)(tokens.access_token);
        if (!userInfo) {
            return res.status(500).json({ error: "user_info_failed" });
        }
        // Calculate token expiry
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        // Encrypt tokens
        const accessTokenEncrypted = (0, oauth_1.encryptToken)(tokens.access_token);
        const refreshTokenEncrypted = (0, oauth_1.encryptToken)(tokens.refresh_token);
        // Store in database (upsert pattern)
        const account = await prisma_1.prisma.googleOAuthAccount.upsert({
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
    }
    catch (error) {
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
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_id_required" });
        }
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
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
    }
    catch (error) {
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
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_id_required" });
        }
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId },
            include: { tokens: true },
        });
        if (!account) {
            return res.status(404).json({ error: "account_not_found" });
        }
        // Revoke tokens with Google
        if (account.tokens) {
            const accessToken = (0, oauth_1.decryptToken)(account.tokens.accessTokenEncrypted);
            await (0, oauth_1.revokeToken)(accessToken);
        }
        // Delete from database (cascade will delete tokens, links, locations)
        await prisma_1.prisma.googleOAuthAccount.delete({
            where: { id: account.id },
        });
        console.log("[Google OAuth] Account disconnected:", account.email);
        res.json({ success: true });
    }
    catch (error) {
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
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_id_required" });
        }
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        const merchants = await (0, gmc_1.listMerchantAccounts)(account.id);
        res.json({ merchants });
    }
    catch (error) {
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
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        const success = await (0, gmc_1.syncMerchantAccount)(account.id, merchantId);
        if (success) {
            res.json({ success: true });
        }
        else {
            res.status(500).json({ error: "sync_failed" });
        }
    }
    catch (error) {
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
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId: tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        const products = await (0, gmc_1.listProducts)(account.id, merchantId);
        res.json({ products });
    }
    catch (error) {
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
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId: tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        const stats = await (0, gmc_1.getProductStats)(account.id, merchantId);
        res.json({ stats });
    }
    catch (error) {
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
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "tenant_id_required" });
        }
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        // First get business accounts
        const businessAccounts = await (0, gbp_1.listBusinessAccounts)(account.id);
        if (businessAccounts.length === 0) {
            return res.json({ locations: [] });
        }
        // Get locations for first business account
        const locations = await (0, gbp_1.listLocations)(account.id, businessAccounts[0].name);
        res.json({ locations });
    }
    catch (error) {
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
        const account = await prisma_1.prisma.googleOAuthAccount.findFirst({
            where: { tenantId },
        });
        if (!account) {
            return res.status(404).json({ error: "google_account_not_found" });
        }
        const locationData = await (0, gbp_1.getLocation)(account.id, locationName);
        if (!locationData) {
            return res.status(404).json({ error: "location_not_found" });
        }
        const success = await (0, gbp_1.syncLocation)(account.id, locationData);
        if (success) {
            res.json({ success: true });
        }
        else {
            res.status(500).json({ error: "sync_failed" });
        }
    }
    catch (error) {
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
        const daysNum = days ? parseInt(days) : 30;
        const insights = await (0, gbp_1.getAggregatedInsights)(locationId, daysNum);
        res.json({ insights });
    }
    catch (error) {
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
        const configs = await prisma_1.prisma.emailConfiguration.findMany({
            orderBy: { category: 'asc' }
        });
        res.json(configs);
    }
    catch (error) {
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
        const schema = zod_1.z.object({
            configs: zod_1.z.array(zod_1.z.object({
                category: zod_1.z.string(),
                email: zod_1.z.string().email()
            }))
        });
        const { configs } = schema.parse(req.body);
        // Upsert each configuration
        const results = await Promise.all(configs.map(config => prisma_1.prisma.emailConfiguration.upsert({
            where: { category: config.category },
            update: {
                email: config.email,
                updatedAt: new Date()
            },
            create: {
                category: config.category,
                email: config.email
            }
        })));
        res.json({ success: true, configs: results });
    }
    catch (error) {
        console.error('[PUT /admin/email-config] Error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "invalid_request", details: error.issues });
        }
        res.status(500).json({ error: "failed_to_update_email_config" });
    }
});
/* ------------------------------ AUTHENTICATION ------------------------------ */
// Mount auth routes (no authentication required for these endpoints)
app.use('/auth', auth_routes_1.default);
/* ------------------------------ v3.5 AUDIT & BILLING APIs ------------------------------ */
// Apply audit middleware globally (logs all write operations)
app.use(audit_logger_1.auditLogger);
// Mount v3.5 routes
app.use(audit_2.default);
app.use(policy_1.default);
app.use(billing_1.default);
app.use('/subscriptions', subscriptions_1.default);
app.use('/categories', categories_1.default);
app.use('/performance', performance_1.default);
app.use('/organizations', organizations_1.default);
app.use('/organization-requests', organization_requests_1.default);
app.use('/upgrade-requests', upgrade_requests_1.default);
app.use('/permissions', permissions_2.default);
app.use('/users', users_1.default);
// Directory routes - mount at specific paths to avoid conflicts
// TEMPORARILY DISABLED: Directory listings table missing in production
// Re-enable after running fix_directory_table.sql in production database
/*
app.use('/api/directory', directoryRoutes); // Public directory endpoint - no auth required
app.use('/api/admin/directory', directoryAdminRoutes); // Admin directory management (auth in routes)
app.use('/api/support/directory', directorySupportRoutes); // Support directory tools (auth in routes)
// Tenant directory routes - MUST come before generic tenant routes
app.use('/api/tenants', directoryTenantRoutes); // Tenant directory management (auth in routes)
*/
console.log('⚠️ Directory routes temporarily disabled - missing directory_listings table');
// Generic tenant routes come AFTER directory routes
app.use('/api/tenants', tenant_users_1.default);
app.use(platform_settings_1.default);
app.use('/api/platform-stats', platform_stats_1.default); // Public endpoint - no auth required
app.use('/api', dashboard_1.default); // Mount dashboard routes under /api prefix
console.log('✅ Dashboard routes mounted');
app.use('/api', promotion_1.default); // Promotion endpoints
console.log('✅ Promotion routes mounted');
app.use('/api', business_hours_1.default); // Business hours management
console.log('✅ Business hours routes mounted');
app.use(tenant_tier_1.default); // Tenant tier and usage endpoints
app.use('/api/tenant-limits', tenant_limits_2.default); // Tenant creation limits
console.log('✅ Tenant limits routes mounted');
/* ------------------------------ v3.6.2-prep APIs ------------------------------ */
app.use('/api/feed-jobs', feed_jobs_1.default);
app.use('/api/feedback', feedback_1.default);
app.use('/api/v1/tenants', auth_1.authenticateToken, auth_1.checkTenantAccess, tenant_categories_1.default);
app.use('/api/v1', quick_start_1.default);
// IMPORTANT: Route order matters in Express! More specific routes MUST come before generic ones.
// Tenant flags: accessible by platform admins OR store owners of that specific tenant
// MUST be mounted BEFORE the generic /api/admin route below to prevent route matching conflicts
app.use('/admin', auth_1.authenticateToken, tenant_flags_1.default);
app.use('/api/admin', auth_1.authenticateToken, tenant_flags_1.default);
// Admin tools and users - these are more generic and should come after specific routes
app.use('/api/admin/tools', auth_1.authenticateToken, auth_1.requireAdmin, admin_tools_1.default);
app.use('/api/admin/feature-overrides', feature_overrides_1.default); // Feature overrides (admin-only, auth handled in route)
app.use('/api/admin/tier-management', tier_management_1.default); // Tier management (admin-only, auth handled in route)
app.use('/api/admin/tier-system', tier_system_1.default); // Tier system CRUD (platform staff, auth handled in route)
app.use('/api/integrations', clover_1.default); // Clover POS integration (auth handled in route)
console.log('✅ Clover integration routes mounted');
// Simple Clover connection status endpoint for frontend banners
app.get('/api/tenants/:tenantId/integrations/clover', auth_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const user = req.user;
        // Verify tenant access
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { users: true }
        });
        if (!tenant) {
            return res.status(404).json({ error: 'tenant_not_found' });
        }
        // Check if user has access to this tenant
        const hasAccess = tenant.users.some((ut) => ut.userId === user.id);
        if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
            return res.status(403).json({ error: 'access_denied' });
        }
        // Check if integration exists and is active
        const integration = await prisma_1.prisma.cloverIntegration.findUnique({
            where: { tenantId }
        });
        const connected = integration && integration.status === 'active';
        return res.json({ connected });
    }
    catch (error) {
        console.error('[GET /api/tenants/:tenantId/integrations/clover] Error:', error);
        return res.status(500).json({ error: 'failed_to_check_connection' });
    }
});
app.use('/square', async (req, res, next) => {
    try {
        const routes = await getSquareRoutes();
        return routes(req, res, next);
    }
    catch (error) {
        console.error('[Square Routes] Lazy loading error:', error);
        res.status(500).json({ error: 'square_routes_unavailable' });
    }
}); // Square POS integration (auth handled in route)
app.use('/admin', auth_1.authenticateToken, admin_users_1.default);
app.use('/api/admin', auth_1.authenticateToken, admin_users_1.default);
app.use('/admin/taxonomy', auth_1.requireAdmin, taxonomy_admin_1.default);
app.use('/api', feed_validation_1.default);
/* ------------------------------ TAXONOMY ADMIN API ------------------------------ */
// GET /api/admin/taxonomy/status - Check taxonomy sync status
app.get('/api/admin/taxonomy/status', auth_1.requireAdmin, async (req, res) => {
    try {
        const { TaxonomySyncService } = await Promise.resolve().then(() => __importStar(require('./services/TaxonomySyncService')));
        const syncService = new TaxonomySyncService();
        const status = await syncService.checkForUpdates();
        // Get current taxonomy version
        const currentVersion = await prisma_1.prisma.googleTaxonomy.findFirst({
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
    }
    catch (error) {
        console.error('[Taxonomy Status] Error:', error);
        res.status(500).json({ error: 'Failed to check taxonomy status' });
    }
});
// POST /api/admin/taxonomy/sync - Manually trigger taxonomy sync
app.post('/api/admin/taxonomy/sync', auth_1.requireAdmin, async (req, res) => {
    try {
        const { TaxonomySyncService } = await Promise.resolve().then(() => __importStar(require('./services/TaxonomySyncService')));
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
    }
    catch (error) {
        console.error('[Taxonomy Sync] Error:', error);
        res.status(500).json({ error: 'Taxonomy sync failed' });
    }
});
app.use('/admin', auth_1.authenticateToken, platform_flags_1.default);
app.use('/api/admin', auth_1.authenticateToken, platform_flags_1.default);
// Effective flags: middleware applied per-route (admin for platform, tenant access for tenant)
app.use('/admin', auth_1.authenticateToken, effective_flags_1.default);
app.use('/api/admin', auth_1.authenticateToken, effective_flags_1.default);
// Category scaffolds (M3 start)
app.use(categories_platform_1.default);
app.use(categories_tenant_1.default);
app.use(categories_mirror_1.default);
app.use(mirror_admin_1.default);
app.use(sync_logs_1.default);
// M4: SKU Scanning routes
app.use('/api', scan_1.default);
console.log('✅ Scan routes mounted at /api/scan');
app.use(scan_metrics_1.default);
/* ------------------------------ item category assignment ------------------------------ */
// PATCH /api/v1/tenants/:tenantId/items/:itemId/category
// Body: { tenantCategoryId?: string, categorySlug?: string }
app.patch('/api/v1/tenants/:tenantId/items/:itemId/category', async (req, res) => {
    try {
        const { tenantId, itemId } = req.params;
        const { tenantCategoryId, categorySlug } = (req.body || {});
        const updated = await CategoryService_1.categoryService.assignItemCategory(tenantId, itemId, { tenantCategoryId, categorySlug });
        // ISR revalidation (best-effort) already triggered inside service
        return res.json({ success: true, data: updated });
    }
    catch (e) {
        const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
        const msg = e?.message || 'failed_to_assign_category';
        console.error('[PATCH /api/v1/tenants/:tenantId/items/:itemId/category] Error:', msg);
        return res.status(code).json({ success: false, error: msg });
    }
});
/* ------------------------------ item updates ------------------------------ */
// PUT /api/items/:itemId
// Update an item (general updates, not category assignment)
app.put('/api/items/:itemId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { itemId } = req.params;
        const updateData = req.body;
        // Validate required fields
        if (!updateData) {
            return res.status(400).json({ error: 'update_data_required' });
        }
        // Prepare update data for Prisma
        const prismaUpdateData = {};
        // Handle different field names (camelCase from frontend vs snake_case in DB)
        if (updateData.name !== undefined)
            prismaUpdateData.name = updateData.name;
        if (updateData.price !== undefined)
            prismaUpdateData.price = updateData.price;
        if (updateData.stock !== undefined)
            prismaUpdateData.stock = updateData.stock;
        if (updateData.description !== undefined)
            prismaUpdateData.description = updateData.description;
        if (updateData.visibility !== undefined)
            prismaUpdateData.visibility = updateData.visibility;
        if (updateData.itemStatus !== undefined)
            prismaUpdateData.itemStatus = updateData.itemStatus;
        if (updateData.categoryPath !== undefined)
            prismaUpdateData.categoryPath = updateData.categoryPath;
        // Update the item
        const updatedItem = await prisma_1.prisma.inventoryItem.update({
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
    }
    catch (error) {
        console.error('[PUT /api/items/:itemId] Error:', error);
        return res.status(500).json({ error: 'failed_to_update_item' });
    }
});
/* ------------------------------ products needing enrichment ------------------------------ */
// GET /api/products/needs-enrichment
// Returns products that need enrichment (missing images, descriptions, etc.)
app.get('/api/products/needs-enrichment', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        // Get tenant IDs the user has access to
        const tenantIds = user.tenantIds || [];
        if (tenantIds.length === 0) {
            return res.json({ products: [] });
        }
        // Find products that need enrichment
        // Products created by Quick Start Wizard typically have source = 'QUICK_START_WIZARD' and are missing details
        const products = await prisma_1.prisma.inventoryItem.findMany({
            where: {
                tenantId: { in: tenantIds },
                OR: [
                    // Products with missing images
                    { missingImages: true },
                    // Products with missing descriptions
                    { missingDescription: true },
                    // Products with missing brand
                    { missingBrand: true },
                    // Products with missing specs
                    { missingSpecs: true },
                    // Products created by quick start that might need enrichment
                    { source: 'QUICK_START_WIZARD' }
                ]
            },
            select: {
                id: true,
                name: true,
                source: true,
                missingImages: true,
                missingDescription: true,
                missingBrand: true,
                missingSpecs: true,
                description: true,
                brand: true,
                tenantId: true,
                photos: {
                    select: {
                        id: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit results for performance
        });
        // Transform to match the expected format by ProductEnrichmentBanner
        const enrichedProducts = products.map(product => ({
            id: product.id,
            name: product.name,
            source: product.source,
            enrichmentStatus: 'needs_enrichment',
            missing: {
                missingImages: product.missingImages,
                missingDescription: product.missingDescription,
                missingSpecs: product.missingSpecs,
                missingBrand: product.missingBrand
            }
        }));
        return res.json({ products: enrichedProducts });
    }
    catch (error) {
        console.error('[GET /api/products/needs-enrichment] Error:', error);
        return res.status(500).json({ error: 'failed_to_get_products_needing_enrichment' });
    }
});
/* ------------------------------ jobs ------------------------------ */
app.post("/jobs/rates/daily", rates_1.dailyRatesJob);
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
    }
    catch (error) {
        console.error('[GET /api/gbp/categories/popular] Error:', error);
        return res.status(500).json({ error: 'failed_to_get_popular_categories' });
    }
});
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
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${port} is already in use`);
        }
        else {
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
exports.default = app;
/* ------------------------------ TAXONOMY SYNC JOB ------------------------------ */
(async function startTaxonomySyncJob() {
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
            const { TaxonomySyncService } = await Promise.resolve().then(() => __importStar(require('./services/TaxonomySyncService')));
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
            }
            else {
                console.log('✅ Taxonomy is up to date');
            }
        }
        catch (error) {
            console.error('❌ Taxonomy sync job failed:', error);
        }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
})();
