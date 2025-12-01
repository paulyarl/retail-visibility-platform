-- Check actual column types for foreign key compatibility
-- This will help us understand the data type mismatch

-- Check tenants table structure
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
    AND table_schema = 'public'
    AND column_name = 'id'
ORDER BY column_name;

-- Check users table structure  
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND column_name = 'id'
ORDER BY column_name;

-- Show sample data to understand the format
SELECT 'tenants' as table_name, id, typeof(id) as id_type, length(id) as id_length
FROM tenants 
LIMIT 3;

SELECT 'users' as table_name, id, typeof(id) as id_type, length(id) as id_length  
FROM users
LIMIT 3;
