-- Fix failed migration by marking it as rolled back
-- This allows Prisma to retry the migration
UPDATE "_prisma_migrations" 
SET finished_at = NULL, 
    applied_steps_count = 0,
    logs = 'Manually marked as rolled back to allow redeployment'
WHERE migration_name = '20251024093000_add_photo_asset_fields';

-- Verify the update
SELECT migration_name, finished_at, applied_steps_count, logs 
FROM "_prisma_migrations" 
WHERE migration_name = '20251024093000_add_photo_asset_fields';
