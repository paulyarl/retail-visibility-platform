-- Data Migration: Update existing ADMIN users to PLATFORM_ADMIN
-- This should be run AFTER the schema migration

-- Update users with ADMIN role who have NO tenant assignments to PLATFORM_ADMIN
-- These are platform-wide admins
UPDATE "users"
SET role = 'PLATFORM_ADMIN'
WHERE role = 'ADMIN'
  AND id NOT IN (
    SELECT DISTINCT user_id 
    FROM "user_tenants"
  );

-- Note: Users with ADMIN role who HAVE tenant assignments should remain as ADMIN
-- They will be handled by UserTenant.role = 'ADMIN' for tenant-scoped admin access
-- In the future, consider migrating these to use only UserTenant.role

-- Verify the migration
SELECT 
  role,
  COUNT(*) as count,
  ARRAY_AGG(email) as emails
FROM "users"
WHERE role IN ('PLATFORM_ADMIN', 'ADMIN')
GROUP BY role;
