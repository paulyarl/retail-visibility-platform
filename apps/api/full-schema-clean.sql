-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'ADMIN', 'OWNER', 'USER');

-- CreateEnum
CREATE TYPE "user_tenant_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "availability_status" AS ENUM ('in_stock', 'out_of_stock', 'preorder');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('new', 'refurbished', 'used');

-- CreateEnum
CREATE TYPE "item_visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('pending', 'success', 'error');

-- CreateEnum
CREATE TYPE "item_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('user', 'system', 'integration');

-- CreateEnum
CREATE TYPE "entity_type" AS ENUM ('inventory_item', 'tenant', 'policy', 'oauth', 'other');

-- CreateEnum
CREATE TYPE "action" AS ENUM ('create', 'update', 'delete', 'sync', 'policy_apply', 'oauth_connect', 'oauth_refresh');

-- CreateEnum
CREATE TYPE "permission_action" AS ENUM ('tenant.create', 'tenant.read', 'tenant.update', 'tenant.delete', 'tenant.manage_users', 'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete', 'analytics.view', 'admin.access_dashboard', 'admin.manage_settings');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'processing', 'success', 'failed');

-- CreateEnum
CREATE TYPE "product_source" AS ENUM ('MANUAL', 'QUICK_START_WIZARD', 'PRODUCT_SCAN', 'IMPORT', 'API', 'BULK_UPLOAD', 'CLOVER_DEMO');

-- CreateEnum
CREATE TYPE "enrichment_status" AS ENUM ('COMPLETE', 'NEEDS_ENRICHMENT', 'PARTIALLY_ENRICHED');

-- CreateTable
CREATE TABLE "platform_feature_flags" (
    "id" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rollout" TEXT,
    "allow_tenant_override" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_feature_flags" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rollout" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_feature_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "periods" JSONB NOT NULL DEFAULT '[]',
    "source_hash" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "sync_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours_special" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "open" TEXT,
    "close" TEXT,
    "note" TEXT,
    "source_hash" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_hours_special_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "data_policy_accepted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "subscriptionStatus" TEXT DEFAULT 'trial',
    "subscriptionTier" TEXT DEFAULT 'starter',
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "organizationId" TEXT,
    "serviceLevel" TEXT DEFAULT 'self_service',
    "managedServicesActive" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedManager" TEXT,
    "monthlySkuQuota" INTEGER,
    "skusAddedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "googleBusinessAccessToken" TEXT,
    "googleBusinessRefreshToken" TEXT,
    "googleBusinessTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionTier" TEXT DEFAULT 'chain_starter',
    "subscriptionStatus" TEXT DEFAULT 'trial',
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "maxLocations" INTEGER NOT NULL DEFAULT 5,
    "maxTotalSKUs" INTEGER NOT NULL DEFAULT 2500,
    "metadata" JSONB,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketingDescription" TEXT,
    "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customCta" JSONB,
    "socialLinks" JSONB,
    "customBranding" JSONB,
    "customSections" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "landingPageTheme" TEXT DEFAULT 'default',
    "auditLogId" TEXT,
    "availability" "availability_status" NOT NULL DEFAULT 'in_stock',
    "brand" TEXT NOT NULL,
    "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenant_category_id" TEXT,
    "condition" "product_condition" DEFAULT 'new',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "eligibilityReason" TEXT,
    "gtin" TEXT,
    "itemStatus" "item_status" DEFAULT 'active',
    "locationId" TEXT,
    "merchantName" TEXT,
    "mpn" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER,
    "searchTsv" tsvector,
    "syncStatus" "sync_status" DEFAULT 'pending',
    "syncedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "visibility" "item_visibility" DEFAULT 'public',
    "manufacturer" TEXT,
    "source" "product_source" NOT NULL DEFAULT 'MANUAL',
    "enrichmentStatus" "enrichment_status" NOT NULL DEFAULT 'COMPLETE',
    "enriched_at" TIMESTAMP(3),
    "enriched_by" TEXT,
    "enriched_from_barcode" TEXT,
    "missing_images" BOOLEAN NOT NULL DEFAULT false,
    "missing_description" BOOLEAN NOT NULL DEFAULT false,
    "missing_specs" BOOLEAN NOT NULL DEFAULT false,
    "missing_brand" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "contentType" TEXT,
    "bytes" INTEGER,
    "exifRemoved" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicUrl" TEXT,
    "signedUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,
    "caption" TEXT,

    CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPerformance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "approvalStatus" TEXT,
    "rejectionReason" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "visibilityScore" INTEGER NOT NULL DEFAULT 0,
    "searchRank" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_mirror_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "strategy" TEXT NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "error" TEXT,
    "job_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "category_mirror_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "google_account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "profile_picture_url" TEXT,
    "scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_tokens" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_merchant_links" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "merchant_name" TEXT,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" TEXT DEFAULT 'pending',
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_merchant_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_locations" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "store_code" TEXT,
    "address" TEXT,
    "phone_number" TEXT,
    "website_url" TEXT,
    "category" TEXT,
    "is_verified" BOOLEAN DEFAULT false,
    "is_published" BOOLEAN DEFAULT false,
    "last_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_insights_daily" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views_search" INTEGER NOT NULL DEFAULT 0,
    "views_maps" INTEGER NOT NULL DEFAULT 0,
    "actions_website" INTEGER NOT NULL DEFAULT 0,
    "actions_phone" INTEGER NOT NULL DEFAULT 0,
    "actions_directions" INTEGER NOT NULL DEFAULT 0,
    "photos_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_insights_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "diff" JSONB NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" "entity_type" NOT NULL,
    "ip" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pii_scrubbed" BOOLEAN NOT NULL DEFAULT true,
    "request_id" TEXT,
    "user_agent" TEXT,
    "action" "action" NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platform_name" TEXT,
    "platform_description" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_billing_policy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "count_active_private" BOOLEAN NOT NULL,
    "count_preorder" BOOLEAN NOT NULL,
    "count_zero_price" BOOLEAN NOT NULL,
    "require_image" BOOLEAN NOT NULL,
    "require_currency" BOOLEAN NOT NULL,
    "note" TEXT,
    "updated_by" TEXT,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_billing_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_billing_policy_history" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "count_active_private" BOOLEAN NOT NULL,
    "count_preorder" BOOLEAN NOT NULL,
    "count_zero_price" BOOLEAN NOT NULL,
    "require_image" BOOLEAN NOT NULL,
    "require_currency" BOOLEAN NOT NULL,
    "notes" TEXT,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_billing_policy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_configuration" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "email_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "current_tier" TEXT NOT NULL,
    "requested_tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "admin_notes" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "request_type" TEXT NOT NULL DEFAULT 'join',
    "estimated_cost" DOUBLE PRECISION,
    "cost_currency" TEXT DEFAULT 'USD',
    "notes" TEXT,
    "admin_notes" TEXT,
    "cost_agreed" BOOLEAN NOT NULL DEFAULT false,
    "cost_agreed_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business_profile" (
    "tenant_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "phone_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "contact_person" TEXT,
    "logo_url" TEXT,
    "hours" JSONB,
    "social_links" JSONB,
    "seo_tags" JSONB,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "display_map" BOOLEAN NOT NULL DEFAULT false,
    "map_privacy_mode" TEXT NOT NULL DEFAULT 'precise',
    "gbp_category_id" TEXT,
    "gbp_category_name" TEXT,
    "gbp_category_last_mirrored" TIMESTAMP(3),
    "gbp_category_sync_status" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_business_profile_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tenants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "user_tenant_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_matrix" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" "permission_action" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_log" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" BOOLEAN,
    "new_value" BOOLEAN NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_push_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT,
    "job_status" "job_status" NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "last_attempt" TIMESTAMP(3),
    "next_retry" TIMESTAMP(3),
    "error_message" TEXT,
    "error_code" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "feed_push_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_feedback" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "feedback" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_category" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "google_category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_taxonomy" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "category_path" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '2024-09',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCategory" TEXT,
    "defaultPriceCents" INTEGER,
    "defaultCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "defaultVisibility" TEXT NOT NULL DEFAULT 'private',
    "enrichmentRules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "template_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "device_type" TEXT,
    "scanned_count" INTEGER NOT NULL DEFAULT 0,
    "committed_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sku" TEXT,
    "raw_payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "enrichment" JSONB,
    "validation" JSONB,
    "duplicate_of" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_lookup_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "response" JSONB,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_lookup_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_enrichment" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT,
    "brand" TEXT,
    "description" TEXT,
    "category_path" TEXT[],
    "price_cents" INTEGER,
    "image_url" TEXT,
    "image_thumbnail_url" TEXT,
    "metadata" JSONB,
    "source" TEXT NOT NULL,
    "last_fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetch_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barcode_enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clover_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "status" TEXT NOT NULL DEFAULT 'active',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "merchant_id" TEXT,
    "demo_enabled_at" TIMESTAMP(3),
    "demo_last_active_at" TIMESTAMP(3),
    "production_enabled_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clover_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clover_sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_succeeded" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_details" JSONB,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "clover_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clover_item_mappings" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "clover_item_id" TEXT NOT NULL,
    "clover_item_name" TEXT NOT NULL,
    "clover_sku" TEXT,
    "rvp_item_id" TEXT,
    "rvp_sku" TEXT,
    "mapping_status" TEXT NOT NULL DEFAULT 'pending',
    "conflict_reason" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clover_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clover_demo_snapshots" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "item_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clover_demo_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_tiers" (
    "id" TEXT NOT NULL,
    "tier_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" INTEGER NOT NULL,
    "max_skus" INTEGER,
    "max_locations" INTEGER,
    "tier_type" TEXT NOT NULL DEFAULT 'individual',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_features" (
    "id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_inherited" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_change_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "changed_by" TEXT NOT NULL,
    "changed_by_email" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tier_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "square_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "merchant_id" TEXT NOT NULL,
    "location_id" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" TEXT[],
    "mode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "square_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "square_product_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "square_catalog_object_id" TEXT NOT NULL,
    "square_item_variation_id" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "last_synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "conflict_resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "square_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "square_sync_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "mapping_id" TEXT,
    "sync_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "error_code" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "items_affected" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "square_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "seo_description" TEXT,
    "seo_keywords" TEXT[],
    "primary_category" TEXT,
    "secondary_categories" TEXT[],
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMP(3),
    "slug" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_featured_listings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "featured_from" TIMESTAMP(3) NOT NULL,
    "featured_until" TIMESTAMP(3) NOT NULL,
    "placement_priority" INTEGER NOT NULL DEFAULT 5,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_featured_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_support_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_support_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_feature_flags_flag_key" ON "platform_feature_flags"("flag");

-- CreateIndex
CREATE INDEX "tenant_feature_flags_tenant_id_idx" ON "tenant_feature_flags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_id_flag_key" ON "tenant_feature_flags"("tenant_id", "flag");

-- CreateIndex
CREATE INDEX "tenant_feature_overrides_tenant_id_idx" ON "tenant_feature_overrides"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_feature_overrides_feature_idx" ON "tenant_feature_overrides"("feature");

-- CreateIndex
CREATE INDEX "tenant_feature_overrides_expires_at_idx" ON "tenant_feature_overrides"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_overrides_tenant_id_feature_key" ON "tenant_feature_overrides"("tenant_id", "feature");

-- CreateIndex
CREATE INDEX "business_hours_tenant_id_idx" ON "business_hours"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_tenant_id_key" ON "business_hours"("tenant_id");

-- CreateIndex
CREATE INDEX "business_hours_special_tenant_id_date_idx" ON "business_hours_special"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_special_tenant_id_date_key" ON "business_hours_special"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");

-- CreateIndex
CREATE INDEX "Tenant_serviceLevel_idx" ON "Tenant"("serviceLevel");

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripeCustomerId_key" ON "organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripeSubscriptionId_key" ON "organization"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "organization_ownerId_idx" ON "organization"("ownerId");

-- CreateIndex
CREATE INDEX "organization_subscriptionStatus_idx" ON "organization"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_updatedAt_idx" ON "InventoryItem"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_tenant_category_id_idx" ON "InventoryItem"("tenant_category_id");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_enrichmentStatus_idx" ON "InventoryItem"("tenantId", "enrichmentStatus");

-- CreateIndex
CREATE INDEX "InventoryItem_source_idx" ON "InventoryItem"("source");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "PhotoAsset_tenantId_idx" ON "PhotoAsset"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoAsset_inventoryItemId_idx" ON "PhotoAsset"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PhotoAsset_capturedAt_idx" ON "PhotoAsset"("capturedAt");

-- CreateIndex
CREATE INDEX "PhotoAsset_inventoryItemId_position_idx" ON "PhotoAsset"("inventoryItemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAsset_inventoryItemId_position_key" ON "PhotoAsset"("inventoryItemId", "position");

-- CreateIndex
CREATE INDEX "ProductPerformance_tenantId_date_idx" ON "ProductPerformance"("tenantId", "date" DESC);

-- CreateIndex
CREATE INDEX "ProductPerformance_approvalStatus_idx" ON "ProductPerformance"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPerformance_itemId_date_key" ON "ProductPerformance"("itemId", "date");

-- CreateIndex
CREATE INDEX "SyncJob_tenantId_status_updatedAt_idx" ON "SyncJob"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "category_mirror_runs_tenant_id_strategy_started_at_idx" ON "category_mirror_runs"("tenant_id", "strategy", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_accounts_tenant_id_google_account_id_key" ON "google_oauth_accounts"("tenant_id", "google_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_tokens_account_id_key" ON "google_oauth_tokens"("account_id");

-- CreateIndex
CREATE INDEX "google_merchant_links_account_id_idx" ON "google_merchant_links"("account_id");

-- CreateIndex
CREATE INDEX "google_merchant_links_merchant_id_idx" ON "google_merchant_links"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_locations_account_id_location_id_key" ON "gbp_locations"("account_id", "location_id");

-- CreateIndex
CREATE INDEX "gbp_insights_daily_location_id_date_idx" ON "gbp_insights_daily"("location_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_insights_daily_location_id_date_key" ON "gbp_insights_daily"("location_id", "date");

-- CreateIndex
CREATE INDEX "gbp_categories_is_active_idx" ON "gbp_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_categories_name_key" ON "gbp_categories"("name");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_occurred_at_idx" ON "audit_log"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_type_actor_id_idx" ON "audit_log"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "audit_log_request_id_idx" ON "audit_log"("request_id");

-- CreateIndex
CREATE INDEX "sku_billing_policy_history_scope_effective_from_idx" ON "sku_billing_policy_history"("scope", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "email_configuration_category_key" ON "email_configuration"("category");

-- CreateIndex
CREATE INDEX "email_configuration_category_idx" ON "email_configuration"("category");

-- CreateIndex
CREATE INDEX "upgrade_requests_tenant_id_idx" ON "upgrade_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "upgrade_requests_status_idx" ON "upgrade_requests"("status");

-- CreateIndex
CREATE INDEX "upgrade_requests_created_at_idx" ON "upgrade_requests"("created_at");

-- CreateIndex
CREATE INDEX "organization_requests_tenant_id_idx" ON "organization_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "organization_requests_organization_id_idx" ON "organization_requests"("organization_id");

-- CreateIndex
CREATE INDEX "organization_requests_status_idx" ON "organization_requests"("status");

-- CreateIndex
CREATE INDEX "organization_requests_requested_by_idx" ON "organization_requests"("requested_by");

-- CreateIndex
CREATE INDEX "organization_requests_created_at_idx" ON "organization_requests"("created_at");

-- CreateIndex
CREATE INDEX "tenant_business_profile_gbp_category_id_idx" ON "tenant_business_profile"("gbp_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_profile_tenant_id_key" ON "tenant_business_profile"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "user_tenants_user_id_idx" ON "user_tenants"("user_id");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "user_tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenants_user_id_tenant_id_key" ON "user_tenants"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "permission_matrix_role_idx" ON "permission_matrix"("role");

-- CreateIndex
CREATE INDEX "permission_matrix_action_idx" ON "permission_matrix"("action");

-- CreateIndex
CREATE UNIQUE INDEX "permission_matrix_role_action_key" ON "permission_matrix"("role", "action");

-- CreateIndex
CREATE INDEX "permission_audit_log_role_idx" ON "permission_audit_log"("role");

-- CreateIndex
CREATE INDEX "permission_audit_log_changed_by_idx" ON "permission_audit_log"("changed_by");

-- CreateIndex
CREATE INDEX "permission_audit_log_changed_at_idx" ON "permission_audit_log"("changed_at");

-- CreateIndex
CREATE INDEX "feed_push_jobs_tenant_id_job_status_idx" ON "feed_push_jobs"("tenant_id", "job_status");

-- CreateIndex
CREATE INDEX "feed_push_jobs_job_status_idx" ON "feed_push_jobs"("job_status");

-- CreateIndex
CREATE INDEX "feed_push_jobs_next_retry_idx" ON "feed_push_jobs"("next_retry");

-- CreateIndex
CREATE INDEX "feed_push_jobs_created_at_idx" ON "feed_push_jobs"("created_at");

-- CreateIndex
CREATE INDEX "feed_push_jobs_tenant_id_sku_idx" ON "feed_push_jobs"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "outreach_feedback_tenant_id_created_at_idx" ON "outreach_feedback"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "outreach_feedback_score_idx" ON "outreach_feedback"("score");

-- CreateIndex
CREATE INDEX "outreach_feedback_category_idx" ON "outreach_feedback"("category");

-- CreateIndex
CREATE INDEX "outreach_feedback_context_idx" ON "outreach_feedback"("context");

-- CreateIndex
CREATE INDEX "outreach_feedback_created_at_idx" ON "outreach_feedback"("created_at");

-- CreateIndex
CREATE INDEX "tenant_category_tenant_id_is_active_idx" ON "tenant_category"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tenant_category_google_category_id_idx" ON "tenant_category"("google_category_id");

-- CreateIndex
CREATE INDEX "tenant_category_parent_id_idx" ON "tenant_category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_category_tenant_id_slug_key" ON "tenant_category"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "google_taxonomy_category_id_key" ON "google_taxonomy"("category_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_category_id_idx" ON "google_taxonomy"("category_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_parent_id_idx" ON "google_taxonomy"("parent_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_version_is_active_idx" ON "google_taxonomy"("version", "is_active");

-- CreateIndex
CREATE INDEX "scan_templates_tenant_id_idx" ON "scan_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_templates_tenant_id_name_key" ON "scan_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "scan_sessions_tenant_id_status_idx" ON "scan_sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "scan_sessions_started_at_idx" ON "scan_sessions"("started_at");

-- CreateIndex
CREATE INDEX "scan_results_tenant_id_status_created_at_idx" ON "scan_results"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "scan_results_session_id_idx" ON "scan_results"("session_id");

-- CreateIndex
CREATE INDEX "scan_results_barcode_idx" ON "scan_results"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "scan_results_tenant_id_session_id_barcode_key" ON "scan_results"("tenant_id", "session_id", "barcode");

-- CreateIndex
CREATE INDEX "barcode_lookup_log_tenant_id_created_at_idx" ON "barcode_lookup_log"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "barcode_lookup_log_barcode_idx" ON "barcode_lookup_log"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "barcode_enrichment_barcode_key" ON "barcode_enrichment"("barcode");

-- CreateIndex
CREATE INDEX "barcode_enrichment_barcode_idx" ON "barcode_enrichment"("barcode");

-- CreateIndex
CREATE INDEX "barcode_enrichment_source_idx" ON "barcode_enrichment"("source");

-- CreateIndex
CREATE INDEX "barcode_enrichment_last_fetched_at_idx" ON "barcode_enrichment"("last_fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "clover_integrations_tenant_id_key" ON "clover_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "clover_integrations_tenant_id_idx" ON "clover_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "clover_integrations_status_idx" ON "clover_integrations"("status");

-- CreateIndex
CREATE INDEX "clover_integrations_mode_idx" ON "clover_integrations"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "clover_sync_logs_trace_id_key" ON "clover_sync_logs"("trace_id");

-- CreateIndex
CREATE INDEX "clover_sync_logs_integration_id_idx" ON "clover_sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX "clover_sync_logs_trace_id_idx" ON "clover_sync_logs"("trace_id");

-- CreateIndex
CREATE INDEX "clover_sync_logs_status_idx" ON "clover_sync_logs"("status");

-- CreateIndex
CREATE INDEX "clover_sync_logs_started_at_idx" ON "clover_sync_logs"("started_at");

-- CreateIndex
CREATE INDEX "clover_item_mappings_integration_id_idx" ON "clover_item_mappings"("integration_id");

-- CreateIndex
CREATE INDEX "clover_item_mappings_rvp_item_id_idx" ON "clover_item_mappings"("rvp_item_id");

-- CreateIndex
CREATE INDEX "clover_item_mappings_mapping_status_idx" ON "clover_item_mappings"("mapping_status");

-- CreateIndex
CREATE UNIQUE INDEX "clover_item_mappings_integration_id_clover_item_id_key" ON "clover_item_mappings"("integration_id", "clover_item_id");

-- CreateIndex
CREATE INDEX "clover_demo_snapshots_integration_id_idx" ON "clover_demo_snapshots"("integration_id");

-- CreateIndex
CREATE INDEX "clover_demo_snapshots_expires_at_idx" ON "clover_demo_snapshots"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_tiers_tier_key_key" ON "subscription_tiers"("tier_key");

-- CreateIndex
CREATE INDEX "subscription_tiers_tier_key_idx" ON "subscription_tiers"("tier_key");

-- CreateIndex
CREATE INDEX "subscription_tiers_is_active_sort_order_idx" ON "subscription_tiers"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "subscription_tiers_tier_type_idx" ON "subscription_tiers"("tier_type");

-- CreateIndex
CREATE INDEX "tier_features_tier_id_idx" ON "tier_features"("tier_id");

-- CreateIndex
CREATE INDEX "tier_features_feature_key_idx" ON "tier_features"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "tier_features_tier_id_feature_key_key" ON "tier_features"("tier_id", "feature_key");

-- CreateIndex
CREATE INDEX "tier_change_logs_entity_type_entity_id_idx" ON "tier_change_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "tier_change_logs_changed_by_idx" ON "tier_change_logs"("changed_by");

-- CreateIndex
CREATE INDEX "tier_change_logs_created_at_idx" ON "tier_change_logs"("created_at");

-- CreateIndex
CREATE INDEX "square_integrations_tenant_id_idx" ON "square_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "square_integrations_enabled_idx" ON "square_integrations"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "square_integrations_tenant_id_key" ON "square_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "square_product_mappings_tenant_id_idx" ON "square_product_mappings"("tenant_id");

-- CreateIndex
CREATE INDEX "square_product_mappings_integration_id_idx" ON "square_product_mappings"("integration_id");

-- CreateIndex
CREATE INDEX "square_product_mappings_inventory_item_id_idx" ON "square_product_mappings"("inventory_item_id");

-- CreateIndex
CREATE INDEX "square_product_mappings_sync_status_idx" ON "square_product_mappings"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "square_product_mappings_tenant_id_inventory_item_id_key" ON "square_product_mappings"("tenant_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "square_sync_logs_tenant_id_created_at_idx" ON "square_sync_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "square_sync_logs_integration_id_created_at_idx" ON "square_sync_logs"("integration_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "square_sync_logs_status_created_at_idx" ON "square_sync_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "directory_settings_tenant_id_key" ON "directory_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "directory_settings_slug_key" ON "directory_settings"("slug");

-- CreateIndex
CREATE INDEX "directory_settings_is_published_idx" ON "directory_settings"("is_published");

-- CreateIndex
CREATE INDEX "directory_settings_is_featured_idx" ON "directory_settings"("is_featured");

-- CreateIndex
CREATE INDEX "directory_settings_slug_idx" ON "directory_settings"("slug");

-- CreateIndex
CREATE INDEX "directory_featured_listings_tenant_id_featured_until_idx" ON "directory_featured_listings"("tenant_id", "featured_until");

-- CreateIndex
CREATE INDEX "directory_featured_listings_placement_priority_featured_fro_idx" ON "directory_featured_listings"("placement_priority", "featured_from" DESC);

-- CreateIndex
CREATE INDEX "directory_support_notes_tenant_id_created_at_idx" ON "directory_support_notes"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours_special" ADD CONSTRAINT "business_hours_special_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenant_category_id_fkey" FOREIGN KEY ("tenant_category_id") REFERENCES "tenant_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_mirror_runs" ADD CONSTRAINT "category_mirror_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_accounts" ADD CONSTRAINT "google_oauth_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_tokens" ADD CONSTRAINT "google_oauth_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_merchant_links" ADD CONSTRAINT "google_merchant_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_locations" ADD CONSTRAINT "gbp_locations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_insights_daily" ADD CONSTRAINT "gbp_insights_daily_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_profile" ADD CONSTRAINT "tenant_business_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_profile" ADD CONSTRAINT "tenant_business_profile_gbp_category_id_fkey" FOREIGN KEY ("gbp_category_id") REFERENCES "gbp_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_templates" ADD CONSTRAINT "scan_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "scan_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_lookup_log" ADD CONSTRAINT "barcode_lookup_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clover_integrations" ADD CONSTRAINT "clover_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clover_sync_logs" ADD CONSTRAINT "clover_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "clover_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clover_item_mappings" ADD CONSTRAINT "clover_item_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "clover_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clover_demo_snapshots" ADD CONSTRAINT "clover_demo_snapshots_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "clover_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_features" ADD CONSTRAINT "tier_features_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_settings" ADD CONSTRAINT "directory_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_featured_listings" ADD CONSTRAINT "directory_featured_listings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_featured_listings" ADD CONSTRAINT "directory_featured_listings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_support_notes" ADD CONSTRAINT "directory_support_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_support_notes" ADD CONSTRAINT "directory_support_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

