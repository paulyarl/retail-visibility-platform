-- Check which migrations have been applied to main database
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- Check if _prisma_migrations table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = '_prisma_migrations'
) as migrations_table_exists;

-- List all applied migrations (if table exists)
SELECT 
  migration_name,
  finished_at,
  applied_steps_count
FROM "_prisma_migrations"
ORDER BY finished_at DESC;

-- Count total migrations applied
SELECT COUNT(*) as total_migrations_applied
FROM "_prisma_migrations";

-- Check if product_condition enum exists and its values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'product_condition'
)
ORDER BY enumsortorder;
