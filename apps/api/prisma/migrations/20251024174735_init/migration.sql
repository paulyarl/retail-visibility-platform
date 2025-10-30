-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'VIEWER');

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

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "data_policy_accepted" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT,
    "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "availability" "availability_status" NOT NULL DEFAULT 'in_stock',
    "quantity" INTEGER,
    "condition" "product_condition" DEFAULT 'new',
    "gtin" TEXT,
    "mpn" TEXT,
    "merchantName" TEXT,
    "locationId" TEXT,
    "visibility" "item_visibility" DEFAULT 'public',
    "syncStatus" "sync_status" DEFAULT 'pending',
    "syncedAt" TIMESTAMP(3),
    "auditLogId" TEXT,
    "itemStatus" "item_status" DEFAULT 'active',
    "eligibilityReason" TEXT,
    "searchTsv" tsvector,
    "marketingDescription" TEXT,
    "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customCta" JSONB,
    "socialLinks" JSONB,
    "customBranding" JSONB,
    "customSections" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "landingPageTheme" TEXT DEFAULT 'default',

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicUrl" TEXT,
    "signedUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "contentType" TEXT,
    "bytes" INTEGER,
    "exifRemoved" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "entity_type" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "action" NOT NULL,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "diff" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pii_scrubbed" BOOLEAN NOT NULL DEFAULT true,

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_updatedAt_idx" ON "InventoryItem"("tenantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "PhotoAsset_tenantId_idx" ON "PhotoAsset"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoAsset_inventoryItemId_idx" ON "PhotoAsset"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PhotoAsset_capturedAt_idx" ON "PhotoAsset"("capturedAt");

-- CreateIndex
CREATE INDEX "ProductPerformance_tenantId_date_idx" ON "ProductPerformance"("tenantId", "date" DESC);

-- CreateIndex
CREATE INDEX "ProductPerformance_approvalStatus_idx" ON "ProductPerformance"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPerformance_itemId_date_key" ON "ProductPerformance"("itemId", "date");

-- CreateIndex
CREATE INDEX "SyncJob_tenantId_status_updatedAt_idx" ON "SyncJob"("tenantId", "status", "updatedAt");

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

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
