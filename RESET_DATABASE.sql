-- RESET MAIN DATABASE - FRESH START
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)
-- ⚠️ WARNING: This will DELETE ALL DATA and rebuild the schema

-- Step 1: Drop all existing tables (in correct order to handle foreign keys)
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

-- Step 2: Drop all custom types (enums)
DROP TYPE IF EXISTS "product_condition" CASCADE;
DROP TYPE IF EXISTS "user_role" CASCADE;
DROP TYPE IF EXISTS "sync_status" CASCADE;
DROP TYPE IF EXISTS "scan_status" CASCADE;
DROP TYPE IF EXISTS "enrichment_status" CASCADE;
DROP TYPE IF EXISTS "organization_request_status" CASCADE;

-- Step 3: Verify everything is dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected result: Empty (no tables)

-- Step 4: After running this, redeploy on Vercel
-- Prisma will apply all 39 migrations fresh and rebuild the entire schema
