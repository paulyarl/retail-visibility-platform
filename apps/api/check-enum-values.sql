-- Check all values in user_tenant_role enum
SELECT 
    e.enumlabel as role_value,
    e.enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_tenant_role'
ORDER BY e.enumsortorder;
