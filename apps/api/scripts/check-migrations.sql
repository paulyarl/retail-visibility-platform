-- Check for stuck or failed migrations
SELECT 
    migration_name,
    started_at,
    finished_at,
    success,
    CASE 
        WHEN finished_at IS NULL THEN 'STUCK/RUNNING'
        WHEN success = true THEN 'SUCCESS'
        ELSE 'FAILED'
    END as status
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 20;
