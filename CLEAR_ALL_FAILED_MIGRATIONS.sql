-- Clear ALL Failed Migrations
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- Step 1: Check for all failed migrations
SELECT 
  migration_name,
  started_at,
  finished_at,
  logs
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
ORDER BY started_at DESC;

-- Step 2: Delete ALL failed migrations
DELETE FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;

-- Step 3: Verify they're cleared
SELECT COUNT(*) as remaining_failed_migrations
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;

-- Expected result: 0

-- Step 4: Check how many migrations are marked as applied
SELECT COUNT(*) as applied_migrations
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
