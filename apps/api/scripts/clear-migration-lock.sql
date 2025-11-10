-- Clear Prisma migration advisory locks
-- Run this in Supabase SQL Editor if migrations are stuck

-- 1. Check for active locks
SELECT 
    locktype, 
    database, 
    pid, 
    mode, 
    granted,
    pg_blocking_pids(pid) as blocking_pids
FROM pg_locks 
WHERE locktype = 'advisory';

-- 2. Release all advisory locks (Prisma uses lock ID 72707369)
SELECT pg_advisory_unlock_all();

-- 3. Terminate any stuck migration processes (use with caution)
-- SELECT pg_terminate_backend(pid) 
-- FROM pg_stat_activity 
-- WHERE query LIKE '%prisma%migrate%' 
-- AND state = 'active';

-- 4. Check migration status
SELECT * FROM "_prisma_migrations" 
ORDER BY finished_at DESC NULLS FIRST 
LIMIT 10;

-- 5. If a migration is stuck in 'started' state, you can manually mark it as applied:
-- UPDATE "_prisma_migrations" 
-- SET finished_at = NOW(), 
--     success = true 
-- WHERE migration_name = 'YOUR_MIGRATION_NAME' 
-- AND finished_at IS NULL;
