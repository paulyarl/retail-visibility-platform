-- Add Google sync tracking fields to Tenant model
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "google_sync_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "google_last_sync" TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "google_product_count" INTEGER DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "directory_visible" BOOLEAN DEFAULT true;

-- Add slug field for tenant URLs (will be populated by application)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Create index for directory queries
CREATE INDEX IF NOT EXISTS "idx_tenant_google_sync" ON "Tenant"("google_sync_enabled", "google_last_sync");
CREATE INDEX IF NOT EXISTS "idx_tenant_directory_visible" ON "Tenant"("directory_visible");
CREATE INDEX IF NOT EXISTS "idx_tenant_slug" ON "Tenant"("slug");

-- Comment on new fields
COMMENT ON COLUMN "Tenant"."google_sync_enabled" IS 'Whether this tenant is actively syncing products with Google Merchant Center';
COMMENT ON COLUMN "Tenant"."google_last_sync" IS 'Timestamp of last successful sync with Google';
COMMENT ON COLUMN "Tenant"."google_product_count" IS 'Number of products currently synced to Google';
COMMENT ON COLUMN "Tenant"."directory_visible" IS 'Whether this tenant should appear in the public directory';
COMMENT ON COLUMN "Tenant"."slug" IS 'URL-friendly identifier for tenant (e.g., joes-market)';
