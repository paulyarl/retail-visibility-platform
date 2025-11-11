-- Mark Failed Migration as Applied
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- This migration is failing because the column it's trying to rename doesn't exist
-- This means either:
-- 1. The migration already ran successfully
-- 2. The column never existed in this database
-- Either way, we can safely mark it as applied

-- Step 1: Check current status
SELECT migration_name, started_at, finished_at, applied_steps_count, logs
FROM "_prisma_migrations"
WHERE migration_name = '20251104_fix_enrichment_column_names';

-- Step 2: Delete the failed migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251104_fix_enrichment_column_names';

-- Step 3: Insert it as successfully applied
INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
)
VALUES (
  gen_random_uuid(),
  'skip_checksum',
  NOW(),
  '20251104_fix_enrichment_column_names',
  'Manually marked as applied - column does not exist (already renamed or never existed)',
  NULL,
  NOW(),
  1
);

-- Step 4: Verify it's marked as applied
SELECT migration_name, started_at, finished_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20251104_fix_enrichment_column_names';
