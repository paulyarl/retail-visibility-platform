-- Check what migrations are in the database
SELECT 
  migration_name,
  finished_at,
  rolled_back_at,
  logs
FROM "_prisma_migrations"
ORDER BY migration_name;

-- Check for duplicates
SELECT 
  migration_name,
  COUNT(*) as count
FROM "_prisma_migrations"
GROUP BY migration_name
HAVING COUNT(*) > 1
ORDER BY count DESC;
