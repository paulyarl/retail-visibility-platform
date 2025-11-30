-- Check what materialized views actually exist
SELECT 
  matviewname,
  schemaname,
  definition IS NOT NULL as has_definition
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;

-- Also check regular tables that might be used for directory listings
SELECT 
  tablename,
  schemaname,
  tableowner
FROM pg_tables 
WHERE tablename LIKE '%directory%' OR tablename LIKE '%listing%'
ORDER BY tablename;
