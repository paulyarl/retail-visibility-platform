-- Fix Tier System Migration - KEEP EXISTING DATA
-- This script marks the migration as applied without dropping tables

-- Step 1: Check if tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM subscription_tiers) as tier_count,
  (SELECT COUNT(*) FROM tier_features) as feature_count,
  (SELECT COUNT(*) FROM tier_change_logs) as log_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('subscription_tiers', 'tier_features', 'tier_change_logs');

-- Step 2: Check migration status
SELECT migration_name, finished_at, logs 
FROM "_prisma_migrations" 
WHERE migration_name = '20251108_add_tier_management_system';

-- Step 3: If tables exist with data, update migration status to mark as successful
-- This tells Prisma the migration completed successfully
UPDATE "_prisma_migrations"
SET 
  finished_at = NOW(),
  logs = 'Migration marked as applied manually - tables already exist with data'
WHERE migration_name = '20251108_add_tier_management_system'
  AND finished_at IS NULL;

-- Step 4: Verify the fix
SELECT migration_name, started_at, finished_at, logs 
FROM "_prisma_migrations" 
WHERE migration_name = '20251108_add_tier_management_system';
