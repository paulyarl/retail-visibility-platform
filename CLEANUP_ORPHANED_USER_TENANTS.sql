-- ============================================================================
-- CLEANUP ORPHANED USER-TENANT RELATIONSHIPS
-- ============================================================================
-- This script identifies and removes UserTenant records that reference
-- non-existent tenants, which causes the login error:
-- "Field tenant is required to return data, got `null` instead."
-- ============================================================================

-- First, let's identify orphaned UserTenant records
SELECT
    ut.id as user_tenant_id,
    ut.user_id,
    ut.tenant_id,
    ut.role,
    ut.created_at,
    u.email as user_email
FROM user_tenants ut
LEFT JOIN users u ON ut.user_id = u.id
LEFT JOIN tenants t ON ut.tenant_id = t.id
WHERE t.id IS NULL
ORDER BY ut.created_at DESC;

-- Count of orphaned records
SELECT COUNT(*) as orphaned_user_tenants_count
FROM user_tenants ut
LEFT JOIN tenants t ON ut.tenant_id = t.id
WHERE t.id IS NULL;

-- ============================================================================
-- CRITICAL: REMOVE ORPHANED USER-TENANT RECORDS
-- ============================================================================
-- WARNING: This will permanently remove user access to deleted tenants
-- Only run this if you're sure these tenants should no longer exist
-- ============================================================================

-- DELETE FROM user_tenants
-- WHERE tenant_id IN (
--     SELECT ut.tenant_id
--     FROM user_tenants ut
--     LEFT JOIN tenants t ON ut.tenant_id = t.id
--     WHERE t.id IS NULL
-- );

-- Alternative: If you want to be more selective, uncomment and modify:
-- DELETE FROM user_tenants WHERE id = 'specific-user-tenant-id-here';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After cleanup, verify no orphaned records remain
SELECT COUNT(*) as remaining_orphaned_count
FROM user_tenants ut
LEFT JOIN tenants t ON ut.tenant_id = t.id
WHERE t.id IS NULL;

-- Verify login query works (should return results without null tenant fields)
-- This simulates the auth service login query
SELECT
    u.id,
    u.email,
    u."first_name",
    u."last_name",
    u.role,
    u."email_verified",
    ut.role as tenant_role,
    t.id as tenant_id,
    t.name as tenant_name
FROM users u
LEFT JOIN user_tenants ut ON u.id = ut.user_id
LEFT JOIN tenants t ON ut.tenant_id = t.id
WHERE u.email = 'test@example.com' -- Replace with actual email
ORDER BY u.id;

-- ============================================================================
-- PREVENTION
-- ============================================================================

-- To prevent this issue in the future, ensure proper cascade deletes
-- The current schema already has: onDelete: Cascade for UserTenant -> Tenant
-- But if tenants are deleted outside of Prisma, orphaned records can remain

-- Add a foreign key constraint to enforce referential integrity at DB level
-- (This should already be in place with the current Prisma schema)

-- Check existing foreign key constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'user_tenants'
ORDER BY tc.table_name, tc.constraint_name;
