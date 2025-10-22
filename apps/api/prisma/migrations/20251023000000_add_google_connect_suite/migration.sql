-- Google Connect Suite v1 Schema
-- ENH-2026-043 + ENH-2026-044

-- Google OAuth Accounts (unified for GMC + GBP)
CREATE TABLE "google_oauth_accounts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "google_account_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT,
  "profile_picture_url" TEXT,
  "scopes" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_oauth_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Google OAuth Tokens (encrypted storage)
CREATE TABLE "google_oauth_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "account_id" TEXT NOT NULL,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "token_type" TEXT NOT NULL DEFAULT 'Bearer',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_oauth_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Google Merchant Center Links
CREATE TABLE "google_merchant_links" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
  CONSTRAINT "google_merchant_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Google Business Profile Locations
CREATE TABLE "gbp_locations" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
  CONSTRAINT "gbp_locations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_oauth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- GBP Insights Daily (analytics data)
CREATE TABLE "gbp_insights_daily" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "location_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "views_search" INTEGER DEFAULT 0,
  "views_maps" INTEGER DEFAULT 0,
  "actions_website" INTEGER DEFAULT 0,
  "actions_phone" INTEGER DEFAULT 0,
  "actions_directions" INTEGER DEFAULT 0,
  "photos_count" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gbp_insights_daily_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add source column to SyncJob for tracking Google feeds
ALTER TABLE "SyncJob" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';

-- Indexes for performance
CREATE UNIQUE INDEX "google_oauth_accounts_tenant_id_google_account_id_key" ON "google_oauth_accounts"("tenant_id", "google_account_id");
CREATE UNIQUE INDEX "google_oauth_tokens_account_id_key" ON "google_oauth_tokens"("account_id");
CREATE INDEX "google_merchant_links_account_id_idx" ON "google_merchant_links"("account_id");
CREATE INDEX "google_merchant_links_merchant_id_idx" ON "google_merchant_links"("merchant_id");
CREATE UNIQUE INDEX "gbp_locations_account_id_location_id_key" ON "gbp_locations"("account_id", "location_id");
CREATE INDEX "gbp_insights_daily_location_id_date_idx" ON "gbp_insights_daily"("location_id", "date");
CREATE UNIQUE INDEX "gbp_insights_daily_location_id_date_key" ON "gbp_insights_daily"("location_id", "date");
