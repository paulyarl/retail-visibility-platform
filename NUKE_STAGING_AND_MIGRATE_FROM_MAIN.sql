-- ============================================================================
-- NUKE STAGING AND MIGRATE FROM MAIN DATABASE
-- ============================================================================
-- Date: November 17, 2025
-- Purpose: Complete reset of staging database and migrate all data from main
-- Run in: STAGING Supabase SQL Editor
-- ⚠️ WARNING: This will DELETE ALL STAGING DATA and replace with MAIN data
-- ============================================================================

-- Step 1: BACKUP WARNING - Create backup first!
-- Go to Supabase Dashboard → Staging Project → Database → Backups → Create Backup
-- Wait for completion before proceeding!

-- Step 2: Reset staging database (drop everything)
BEGIN;

-- Drop all existing tables in correct order to handle foreign keys
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
DROP TABLE IF EXISTS "BarcodeLookupLog" CASCADE;
DROP TABLE IF EXISTS "CategoryMirrorRun" CASCADE;
DROP TABLE IF EXISTS "CloverIntegration" CASCADE;
DROP TABLE IF EXISTS "SquareIntegration" CASCADE;
DROP TABLE IF EXISTS "DirectorySettings" CASCADE;
DROP TABLE IF EXISTS "DirectoryFeaturedListings" CASCADE;
DROP TABLE IF EXISTS "DirectorySupportNotes" CASCADE;
DROP TABLE IF EXISTS "BusinessHours" CASCADE;
DROP TABLE IF EXISTS "BusinessHoursSpecial" CASCADE;
DROP TABLE IF EXISTS "TenantBusinessProfile" CASCADE;
DROP TABLE IF EXISTS "TenantFeatureFlag" CASCADE;
DROP TABLE IF EXISTS "TenantFeatureOverride" CASCADE;
DROP TABLE IF EXISTS "ScanTemplate" CASCADE;
DROP TABLE IF EXISTS "ScanSession" CASCADE;
DROP TABLE IF EXISTS "ScanResult" CASCADE;
DROP TABLE IF EXISTS "GoogleOAuthAccount" CASCADE;
DROP TABLE IF EXISTS "OrganizationRequest" CASCADE;
DROP TABLE IF EXISTS "UserTenant" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "PhotoAsset" CASCADE;
DROP TABLE IF EXISTS "ProductPerformance" CASCADE;
DROP TABLE IF EXISTS "InventoryItem" CASCADE;
DROP TABLE IF EXISTS "SyncJob" CASCADE;
DROP TABLE IF EXISTS "Tenant" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;
DROP TABLE IF EXISTS "PlatformFeatureFlag" CASCADE;
DROP TABLE IF EXISTS "CurrencyRate" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "GbpCategory" CASCADE;
DROP TABLE IF EXISTS "oauth_integrations" CASCADE; -- Added for GBP sync

-- Drop all custom types (enums)
DROP TYPE IF EXISTS "product_condition" CASCADE;
DROP TYPE IF EXISTS "user_role" CASCADE;
DROP TYPE IF EXISTS "sync_status" CASCADE;
DROP TYPE IF EXISTS "scan_status" CASCADE;
DROP TYPE IF EXISTS "enrichment_status" CASCADE;
DROP TYPE IF EXISTS "organization_request_status" CASCADE;
DROP TYPE IF EXISTS "LocationStatus" CASCADE;
DROP TYPE IF EXISTS "ItemStatus" CASCADE;

COMMIT;

-- ============================================================================
-- POST-RESET VERIFICATION
-- ============================================================================

-- Check that everything is dropped
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected result: Empty (no tables)

-- ============================================================================
-- NEXT STEPS (Manual):
-- ============================================================================
--
-- 1. Apply Prisma migrations to recreate schema:
--    cd apps/api
--    npx prisma migrate deploy
--
-- 2. Migrate data from main to staging (choose one method):
--
--    Method A - pg_dump/restore (Recommended for complete migration):
--    pg_dump "MAIN_DATABASE_URL" > main_backup.sql
--    psql "STAGING_DATABASE_URL" < main_backup.sql
--
--    Method B - Manual table-by-table copy (if you have dblink extension):
--    -- Would require setting up dblink between databases
--
-- 3. Verify GBP OAuth token exists in staging after migration
-- ============================================================================
