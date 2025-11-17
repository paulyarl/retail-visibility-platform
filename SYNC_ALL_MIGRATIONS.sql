-- Sync All Migrations to Main Database
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- This marks ALL migrations as applied without actually running them
-- Use this if the main database schema is already correct

-- Step 1: Check current migration status
SELECT COUNT(*) as applied_migrations
FROM "_prisma_migrations";

-- Step 2: List of all 39 migrations that need to be marked as applied
-- Delete any failed migrations first
DELETE FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;

-- Step 3: Mark all migrations as applied
-- This is a bulk insert of all migration names
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT 
  gen_random_uuid(),
  'bulk_sync',
  NOW(),
  migration_name,
  'Bulk synced - schema already correct',
  NULL,
  NOW(),
  1
FROM (VALUES
  ('20241108_tier_system_management'),
  ('20251020000000_add_permission_matrix'),
  ('20251021005847_init_postgres'),
  ('20251021100000_add_feature_flags'),
  ('20251021150500_add_global_readiness_hooks'),
  ('20251021160000_add_currency_rates_table'),
  ('20251022093000_add_tenant_metadata'),
  ('20251023000000_add_google_connect_suite'),
  ('20251023060000_add_subscription_fields'),
  ('20251023070000_add_product_performance'),
  ('20251023110000_add_landing_page_customization'),
  ('20251023120000_add_organization_chain_pricing'),
  ('20251023130000_add_managed_services'),
  ('20251024072209_add_email_configuration'),
  ('20251024120800_add_photo_asset_urls'),
  ('20251027084922_title_fix'),
  ('20251028110417_add_authentication_system'),
  ('20251028155908_add_organization_requests'),
  ('20251029121129_add_tenant_business_profile'),
  ('20251029_add_photo_gallery_fields'),
  ('20251101_add_allow_tenant_override'),
  ('20251102000005_v3_8_sku_scanning'),
  ('20251102143422_add_category_mirror_runs'),
  ('20251103_add_gbp_category_fields'),
  ('20251103_add_gbp_category_table'),
  ('20251103_add_inventory_item_category_relation'),
  ('20251104_add_feature_flag_description'),
  ('20251104_add_product_enrichment_fields'),
  ('20251104_fix_enrichment_column_names'),
  ('20251104_fix_enrichment_status_null'),
  ('20251107_add_platform_admin_role'),
  ('20251107_add_platform_support_viewer_roles'),
  ('20251108_add_tier_management_system'),
  ('20251110_add_directory_promotion'),
  ('20251110_add_square_integration'),
  ('20251110_create_directory'),
  ('20251110_directory_phase1'),
  ('20251110_fix_product_condition_reserved_keyword'),
  ('20251110075527_directory_safe')
) AS migrations(migration_name)
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" m
  WHERE m.migration_name = migrations.migration_name
);

-- Step 4: Verify all migrations are now marked as applied
SELECT COUNT(*) as total_migrations
FROM "_prisma_migrations";

SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY migration_name;
