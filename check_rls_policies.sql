-- Check for RLS policies on directory_photos and related tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('directory_photos', 'directory_listings_list', 'tenants')
ORDER BY tablename, policyname;

-- Also check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('directory_photos', 'directory_listings_list', 'tenants');
