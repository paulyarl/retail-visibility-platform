-- ============================================================================
-- NUKE STAGING DATABASE - DROP ALL ACTUAL TABLES
-- ============================================================================
-- Based on the actual tables found in staging database
-- Run this in STAGING Supabase SQL Editor
-- ============================================================================

BEGIN;

-- First drop extensions that require certain tables
DROP EXTENSION IF EXISTS postgis CASCADE;

-- Drop all tables found in staging (from your query results)
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "barcode_enrichment" CASCADE;
DROP TABLE IF EXISTS "barcode_lookup_log" CASCADE;
DROP TABLE IF EXISTS "business_hours" CASCADE;
DROP TABLE IF EXISTS "business_hours_special" CASCADE;
DROP TABLE IF EXISTS "category_mirror_runs" CASCADE;
DROP TABLE IF EXISTS "clover_demo_snapshots" CASCADE;
DROP TABLE IF EXISTS "clover_integrations" CASCADE;
DROP TABLE IF EXISTS "clover_item_mappings" CASCADE;
DROP TABLE IF EXISTS "clover_sync_logs" CASCADE;
DROP TABLE IF EXISTS "directory_featured_listings" CASCADE;
DROP TABLE IF EXISTS "directory_listings" CASCADE;
DROP TABLE IF EXISTS "directory_settings" CASCADE;
DROP TABLE IF EXISTS "directory_support_notes" CASCADE;
DROP TABLE IF EXISTS "email_configuration" CASCADE;
DROP TABLE IF EXISTS "feed_push_jobs" CASCADE;
DROP TABLE IF EXISTS "gbp_categories" CASCADE;
DROP TABLE IF EXISTS "gbp_insights_daily" CASCADE;
DROP TABLE IF EXISTS "gbp_locations" CASCADE;
DROP TABLE IF EXISTS "google_merchant_links" CASCADE;
DROP TABLE IF EXISTS "google_oauth_accounts" CASCADE;
DROP TABLE IF EXISTS "google_oauth_tokens" CASCADE;
DROP TABLE IF EXISTS "google_taxonomy" CASCADE;
DROP TABLE IF EXISTS "organization" CASCADE;
DROP TABLE IF EXISTS "organization_requests" CASCADE;
DROP TABLE IF EXISTS "outreach_feedback" CASCADE;
DROP TABLE IF EXISTS "permission_audit_log" CASCADE;
DROP TABLE IF EXISTS "permission_matrix" CASCADE;
DROP TABLE IF EXISTS "platform_feature_flags" CASCADE;
DROP TABLE IF EXISTS "platform_settings" CASCADE;
DROP TABLE IF EXISTS "scan_results" CASCADE;
DROP TABLE IF EXISTS "scan_sessions" CASCADE;
DROP TABLE IF EXISTS "scan_templates" CASCADE;
DROP TABLE IF EXISTS "sku_billing_policy" CASCADE;
DROP TABLE IF EXISTS "sku_billing_policy_history" CASCADE;
DROP TABLE IF EXISTS "spatial_ref_sys" CASCADE; -- This should work now that postgis is dropped
DROP TABLE IF EXISTS "square_integrations" CASCADE;
DROP TABLE IF EXISTS "square_product_mappings" CASCADE;
DROP TABLE IF EXISTS "square_sync_logs" CASCADE;
DROP TABLE IF EXISTS "subscription_tiers" CASCADE;
DROP TABLE IF EXISTS "tenant_business_profile" CASCADE;
DROP TABLE IF EXISTS "tenant_category" CASCADE;
DROP TABLE IF EXISTS "tenant_feature_flags" CASCADE;
DROP TABLE IF EXISTS "tenant_feature_overrides" CASCADE;
DROP TABLE IF EXISTS "tier_change_logs" CASCADE;
DROP TABLE IF EXISTS "tier_features" CASCADE;
DROP TABLE IF EXISTS "upgrade_requests" CASCADE;
DROP TABLE IF EXISTS "user_sessions" CASCADE;
DROP TABLE IF EXISTS "user_tenants" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Also drop any _prisma_migrations or other system tables
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

COMMIT;

-- ============================================================================
-- VERIFY NUKE WAS SUCCESSFUL
-- ============================================================================

-- Check that staging is now empty
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: Empty result set

-- ============================================================================
-- VERIFY NUKE WAS SUCCESSFUL
-- ============================================================================

-- Check that staging is now empty
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: Empty result set
