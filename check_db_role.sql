-- Check what database role/user is being used for the connection
SELECT current_user, session_user;

-- Check if the current user has BYPASSRLS privilege
SELECT 
    rolname,
    rolsuper,
    rolbypassrls
FROM pg_roles
WHERE rolname = current_user;

-- Check grants on directory_photos table
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'directory_photos'
  AND grantee = current_user;
