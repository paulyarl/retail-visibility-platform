-- Reset Tier System Migration on Staging
-- Run this script to clean up the failed migration

-- Step 1: Drop the tier tables if they exist
DROP TABLE IF EXISTS tier_change_logs CASCADE;
DROP TABLE IF EXISTS tier_features CASCADE;
DROP TABLE IF EXISTS subscription_tiers CASCADE;

-- Step 2: Remove the failed migration record
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251108_add_tier_management_system';

-- Verify cleanup
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('subscription_tiers', 'tier_features', 'tier_change_logs');

-- Should return 0 rows if cleanup was successful
