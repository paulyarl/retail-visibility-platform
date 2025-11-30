-- Verify the user_behavior_simple table was created successfully

-- Check table exists and has correct structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_behavior_simple' 
ORDER BY ordinal_position;

-- Check indexes were created
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_behavior_simple';

-- Test insert (optional)
INSERT INTO user_behavior_simple (
    session_id,
    entity_type,
    entity_id,
    entity_name,
    page_type
) VALUES (
    'test-session-123',
    'store',
    'test-store-456',
    'Test Store',
    'directory_detail'
);

-- Verify insert worked
SELECT * FROM user_behavior_simple WHERE session_id = 'test-session-123';

-- Clean up test data
DELETE FROM user_behavior_simple WHERE session_id = 'test-session-123';
