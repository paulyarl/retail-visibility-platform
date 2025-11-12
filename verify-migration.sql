-- Verify the created_by column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Tenant' AND column_name = 'created_by';

-- Check if the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Tenant' AND indexname = 'Tenant_created_by_idx';
