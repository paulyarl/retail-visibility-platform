-- NUCLEAR RESET - Drop EVERYTHING in public schema
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)
-- ⚠️ WARNING: This will DELETE EVERYTHING

-- Step 1: Drop the entire public schema and recreate it
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Step 2: Grant permissions back to postgres and authenticated users
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 3: Verify the schema is completely empty
SELECT 
  schemaname,
  tablename 
FROM pg_tables 
WHERE schemaname = 'public';

-- Expected result: Empty (0 rows)

-- Step 4: Check for any remaining types
SELECT 
  n.nspname as schema,
  t.typname as type
FROM pg_type t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype = 'e';

-- Expected result: Empty (0 rows)

-- Step 5: After running this, redeploy on Vercel
-- The database is now completely clean
