-- Check sample data format (PostgreSQL-compatible version)
-- This will show us the actual ID format in your database

-- Show sample tenant IDs
SELECT 
    'tenants' as table_name, 
    id, 
    pg_typeof(id) as id_type, 
    length(id) as id_length,
    substring(id, 1, 8) as id_prefix
FROM tenants 
LIMIT 3;

-- Show sample user IDs
SELECT 
    'users' as table_name, 
    id, 
    pg_typeof(id) as id_type, 
    length(id) as id_length,
    substring(id, 1, 8) as id_prefix
FROM users
LIMIT 3;

-- Check if they look like UUIDs or other format
SELECT 
    CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN 'UUID format'
        ELSE 'Other format'
    END as id_format_type,
    COUNT(*) as count
FROM tenants
GROUP BY id_format_type;
