-- ============================================================================
-- CHECK WHAT TABLES EXIST IN YOUR STAGING DATABASE
-- ============================================================================
-- Run this first to see what table names are actually used
-- ============================================================================

-- List all tables in the public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Look for tenant-related tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%tenant%'
ORDER BY table_name;

-- Check if there are any tables with 'user' in the name
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%user%'
ORDER BY table_name;
