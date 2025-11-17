-- ============================================================================
-- STAGING DATABASE MIGRATION - Main to Staging Sync
-- ============================================================================
-- Date: November 16, 2025
-- Purpose: Apply all migrations from main branch to staging database
-- Method: Run via Supabase SQL Editor
-- 
-- ⚠️ IMPORTANT: Create a backup before running this script!
-- ============================================================================

-- Start transaction for safety
BEGIN;

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

-- Check existing migrations
SELECT migration_name, finished_at 
FROM _prisma_migrations 
ORDER BY finished_at DESC 
LIMIT 5;

-- ============================================================================
-- STEP 2: Location Lifecycle System (20251107+)
-- ============================================================================

-- Add location status enum if not exists
DO $$ BEGIN
    CREATE TYPE "LocationStatus" AS ENUM ('active', 'inactive', 'suspended', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status and lifecycle fields to Tenant table
ALTER TABLE "Tenant" 
ADD COLUMN IF NOT EXISTS "status" "LocationStatus" DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "status_changed_by" TEXT,
ADD COLUMN IF NOT EXISTS "status_reason" TEXT,
ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3);

-- Add indexes for status queries
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX IF NOT EXISTS "Tenant_status_changed_at_idx" ON "Tenant"("status_changed_at");

-- ============================================================================
-- STEP 3: Trash System (20251108+)
-- ============================================================================

-- Add 'trashed' to ItemStatus enum
DO $$ BEGIN
    ALTER TYPE "ItemStatus" ADD VALUE IF NOT EXISTS 'trashed';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add trash-related fields to InventoryItem
ALTER TABLE "InventoryItem"
ADD COLUMN IF NOT EXISTS "trashed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "trashed_by" TEXT;

-- Add index for trash queries
CREATE INDEX IF NOT EXISTS "InventoryItem_itemStatus_trashed_idx" ON "InventoryItem"("itemStatus") WHERE "itemStatus" = 'trashed';

-- ============================================================================
-- STEP 4: Platform Admin & Support Roles (20251107)
-- ============================================================================

-- Add platform roles to UserRole enum if not exists
DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPPORT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_VIEWER';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 5: Tenant Support Role (20251112)
-- ============================================================================

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TENANT_SUPPORT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 6: Tenant Profile Enhancements (20251113, 20251114)
-- ============================================================================

-- Add banner and description fields
ALTER TABLE "TenantBusinessProfile"
ADD COLUMN IF NOT EXISTS "banner_image_url" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add missing tenant profile columns
ALTER TABLE "TenantBusinessProfile"
ADD COLUMN IF NOT EXISTS "business_email" TEXT,
ADD COLUMN IF NOT EXISTS "business_phone" TEXT,
ADD COLUMN IF NOT EXISTS "website_url" TEXT,
ADD COLUMN IF NOT EXISTS "social_facebook" TEXT,
ADD COLUMN IF NOT EXISTS "social_instagram" TEXT,
ADD COLUMN IF NOT EXISTS "social_twitter" TEXT;

-- ============================================================================
-- STEP 7: Created By Tracking (20251111)
-- ============================================================================

-- Add created_by to Tenant table
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- Add foreign key constraint
DO $$ BEGIN
    ALTER TABLE "Tenant"
    ADD CONSTRAINT "Tenant_created_by_fkey" 
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 8: Verify Changes
-- ============================================================================

-- Check Tenant table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Tenant'
AND column_name IN ('status', 'status_changed_at', 'created_by')
ORDER BY column_name;

-- Check InventoryItem table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'InventoryItem'
AND column_name IN ('trashed_at', 'trashed_by')
ORDER BY column_name;

-- Check TenantBusinessProfile columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'TenantBusinessProfile'
AND column_name IN ('banner_image_url', 'description', 'business_email')
ORDER BY column_name;

-- Check enum values
SELECT e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'LocationStatus'
ORDER BY e.enumlabel;

SELECT e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'ItemStatus'
ORDER BY e.enumlabel;

SELECT e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'UserRole'
ORDER BY e.enumlabel;

-- ============================================================================
-- STEP 9: Mark Migrations as Applied
-- ============================================================================

-- Insert migration records (adjust migration names as needed)
INSERT INTO _prisma_migrations (
  id, 
  checksum, 
  finished_at, 
  migration_name, 
  logs, 
  rolled_back_at, 
  started_at, 
  applied_steps_count
) VALUES 
  (gen_random_uuid(), '', NOW(), '20251107_add_platform_admin_role', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251107_add_platform_support_viewer_roles', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251108_add_tier_management_system', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251111_add_created_by_to_tenant', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251112_add_tenant_support_role', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251113_add_banner_and_description', NULL, NULL, NOW(), 1),
  (gen_random_uuid(), '', NOW(), '20251114_add_missing_tenant_profile_columns', NULL, NULL, NOW(), 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================

-- Review the output above. If everything looks good:
COMMIT;

-- If something looks wrong:
-- ROLLBACK;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- After committing, verify migration history:
SELECT migration_name, finished_at 
FROM _prisma_migrations 
WHERE migration_name LIKE '202511%'
ORDER BY finished_at DESC;

-- Verify table counts
SELECT 
  'Tenant' as table_name, COUNT(*) as row_count FROM "Tenant"
UNION ALL
SELECT 
  'InventoryItem' as table_name, COUNT(*) as row_count FROM "InventoryItem"
UNION ALL
SELECT 
  'TenantBusinessProfile' as table_name, COUNT(*) as row_count FROM "TenantBusinessProfile"
UNION ALL
SELECT 
  'users' as table_name, COUNT(*) as row_count FROM "users";

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Key Changes Applied:
-- 1. Location Lifecycle: status, status_changed_at, status_changed_by, etc.
-- 2. Trash System: trashed status, trashed_at, trashed_by
-- 3. Platform Roles: PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_VIEWER
-- 4. Tenant Support: TENANT_SUPPORT role
-- 5. Profile Enhancements: banner, description, social links
-- 6. Created By: Tenant creator tracking
--
-- After running this script:
-- 1. Verify all checks pass
-- 2. Test API health endpoint
-- 3. Test web application
-- 4. Monitor logs for errors
--
-- ============================================================================
