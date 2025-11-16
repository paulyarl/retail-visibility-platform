-- ============================================================================
-- MANUAL MIGRATION: Category Directory Enhancement
-- ============================================================================
-- Run this SQL in your database SQL editor (Supabase, pgAdmin, etc.)
-- This adds all required fields and creates the materialized view
-- ============================================================================

-- Step 1: Add Google sync tracking fields to Tenant table
-- ============================================================================

ALTER TABLE "Tenant" 
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "google_sync_enabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "google_last_sync" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "google_product_count" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "directory_visible" BOOLEAN DEFAULT true;

-- Add unique constraint on slug
ALTER TABLE "Tenant" 
  ADD CONSTRAINT "Tenant_slug_key" UNIQUE ("slug");

-- Step 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX IF NOT EXISTS "Tenant_google_sync_enabled_google_last_sync_idx" 
  ON "Tenant"("google_sync_enabled", "google_last_sync");
CREATE INDEX IF NOT EXISTS "Tenant_directory_visible_idx" 
  ON "Tenant"("directory_visible");

-- Step 3: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN "Tenant"."slug" IS 
  'URL-friendly identifier for tenant (e.g., joes-market)';
COMMENT ON COLUMN "Tenant"."google_sync_enabled" IS 
  'Whether this tenant is actively syncing products with Google Merchant Center';
COMMENT ON COLUMN "Tenant"."google_last_sync" IS 
  'Timestamp of last successful sync with Google';
COMMENT ON COLUMN "Tenant"."google_product_count" IS 
  'Number of products currently synced to Google';
COMMENT ON COLUMN "Tenant"."directory_visible" IS 
  'Whether this tenant should appear in the public directory';

-- Step 4: Create materialized view for directory category stores
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS directory_category_stores;

CREATE MATERIALIZED VIEW directory_category_stores AS
SELECT 
  t.id as tenant_id,
  t.name as store_name,
  t.slug as store_slug,
  bp.latitude,
  bp.longitude,
  bp.city,
  bp.state,
  bp.postal_code as zip_code,
  bp.address_line1 as address,
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  COUNT(ii.id) as product_count,
  MAX(ii.updated_at) as last_product_update,
  t.google_last_sync,
  t.google_sync_enabled,
  t.directory_visible
FROM "Tenant" t
INNER JOIN tenant_business_profile bp ON bp.tenant_id = t.id
INNER JOIN "InventoryItem" ii ON ii.tenant_id = t.id
INNER JOIN tenant_category tc ON ii.tenant_category_id = tc.id
WHERE 
  t.google_sync_enabled = true
  AND t.google_last_sync > NOW() - INTERVAL '24 hours'
  AND t.directory_visible = true
  AND t.location_status = 'active'
  AND ii.item_status = 'active'
  AND ii.visibility = 'public'
  AND tc.is_active = true
GROUP BY 
  t.id,
  t.name,
  t.slug,
  bp.latitude,
  bp.longitude,
  bp.city,
  bp.state,
  bp.postal_code,
  bp.address_line1,
  tc.id,
  tc.name,
  tc.slug,
  tc.google_category_id,
  t.google_last_sync,
  t.google_sync_enabled,
  t.directory_visible;

-- Step 5: Create indexes on materialized view
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_category 
  ON directory_category_stores(category_id);

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_tenant 
  ON directory_category_stores(tenant_id);

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_location 
  ON directory_category_stores(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_slug 
  ON directory_category_stores(category_slug);

-- Step 6: Create refresh function
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_directory_category_stores()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stores;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Add comment on view
-- ============================================================================

COMMENT ON MATERIALIZED VIEW directory_category_stores IS 
  'Pre-computed store-category associations for directory. 
   Only includes verified stores (syncing with Google within 24 hours).
   Refresh every 15 minutes via cron or manually.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify migration ran successfully
-- 2. Run: SELECT * FROM directory_category_stores LIMIT 10;
-- 3. In your app, run: npx prisma generate
-- 4. Replace category-directory.service.ts with .DISABLED.ts version
-- 5. Restart your application
-- ============================================================================

-- Optional: Set up automatic refresh (requires pg_cron extension)
-- ============================================================================
-- Uncomment if you have pg_cron installed:
-- SELECT cron.schedule(
--   'refresh-directory-categories', 
--   '*/15 * * * *', 
--   'SELECT refresh_directory_category_stores()'
-- );
