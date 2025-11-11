-- Fix Failed Migration in Main Database
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- Step 1: Check the failed migration status
SELECT migration_name, started_at, finished_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20251104_fix_enrichment_column_names';

-- Step 2: Mark the failed migration as rolled back
-- This allows Prisma to re-apply it or skip it
UPDATE "_prisma_migrations"
SET 
  finished_at = NOW(),
  rolled_back_at = NOW(),
  logs = 'Manually rolled back to allow fresh migration'
WHERE migration_name = '20251104_fix_enrichment_column_names'
  AND finished_at IS NULL;

-- Step 3: Verify it's marked as rolled back
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20251104_fix_enrichment_column_names';

-- Alternative: Delete the failed migration record entirely (more aggressive)
-- Uncomment if you want to completely remove it and let Prisma re-apply
-- DELETE FROM "_prisma_migrations"
-- WHERE migration_name = '20251104_fix_enrichment_column_names';
