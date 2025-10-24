-- First, delete the failed migration record
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251024093000_add_photo_asset_fields';

-- Mark the migration as successfully applied since the columns already exist
INSERT INTO "_prisma_migrations" (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count
) VALUES (
    gen_random_uuid()::text,
    '8f3e51022084b755e6e5bbd56889ea0f',
    NOW(),
    '20251024093000_add_photo_asset_fields',
    'Manually marked as applied - columns already exist in database',
    NULL,
    NOW(),
    1
);

-- Verify the migration is now marked as applied
SELECT migration_name, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
WHERE migration_name = '20251024093000_add_photo_asset_fields';
