-- Check all columns in the Tenant table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Tenant'
ORDER BY ordinal_position;
