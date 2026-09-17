-- Add metadata column to location_status_logs table
-- This column exists in Prisma schema but is missing from the database

-- Add the metadata column as JSONB type (nullable)
ALTER TABLE location_status_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add comment to describe the column usage
COMMENT ON COLUMN location_status_logs.metadata IS 'Additional metadata for status transitions, such as payment method, tier information, etc.';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'location_status_logs' 
    AND column_name = 'metadata';
