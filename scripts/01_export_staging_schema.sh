#!/bin/bash

# Export Staging Schema Script
# Usage: ./01_export_staging_schema.sh

set -e

echo "🚀 Starting staging schema export..."

# Check for required tools
if ! command -v pg_dump &> /dev/null; then
  echo "❌ Error: pg_dump not found. Please install PostgreSQL client tools."
  echo ""
  echo "📋 Installation instructions:"
  echo "Windows: Download from https://www.postgresql.org/download/windows/"
  echo "  - Run the installer and include 'Command Line Tools'"
  echo "  - Add PostgreSQL bin directory to PATH"
  echo "  - Example: C:\\Program Files\\PostgreSQL\\16\\bin"
  echo ""
  echo "Alternative: Use Chocolatey"
  echo "  choco install postgresql"
  exit 1
fi

# Configuration - Use Doppler if available
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

STAGING_PROJECT_ID="${STAGING_PROJECT_ID:-your-staging-project-id}"
STAGING_DB_URL="${STAGING_DATABASE_URL}"

# Create export directory
mkdir -p ./migration_exports
cd ./migration_exports

echo "📋 Exporting schema structure..."

# Export schema structure (tables, indexes, constraints)
pg_dump --schema-only --no-owner --no-privileges \
  --exclude-schema=information_schema \
  --exclude-schema=pg_catalog \
  --file=01_staging_schema.sql \
  "$STAGING_DB_URL"

echo "📋 Exporting functions, triggers, and views..."

# Export functions and triggers separately using psql queries
psql "$STAGING_DB_URL" -c "
SELECT 
  'CREATE OR REPLACE FUNCTION ' || r.routine_name || ' (' || 
  COALESCE(
    STRING_AGG(
      p.parameter_name || ' ' || 
      CASE 
        WHEN p.data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(p.character_maximum_length::text, '') || ')'
        WHEN p.data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
        WHEN p.data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
        WHEN p.data_type = 'boolean' THEN 'BOOLEAN'
        WHEN p.data_type = 'integer' THEN 'INTEGER'
        WHEN p.data_type = 'bigint' THEN 'BIGINT'
        WHEN p.data_type = 'text' THEN 'TEXT'
        WHEN p.data_type = 'json' THEN 'JSON'
        WHEN p.data_type = 'jsonb' THEN 'JSONB'
        WHEN p.data_type = 'uuid' THEN 'UUID'
        ELSE p.data_type
      END,
      ', '
    ORDER BY p.ordinal_position
    ),
    ''
  ) || ') RETURNS ' || 
  CASE 
    WHEN r.data_type = 'void' THEN 'void'
    WHEN r.data_type = 'trigger' THEN 'trigger'
    ELSE COALESCE(r.data_type, 'unknown')
  END || 
  ' AS \$\$' || r.routine_definition || '\$\$ LANGUAGE ' || 
  CASE 
    WHEN r.external_language IS NOT NULL THEN r.external_language
    ELSE 'plpgsql'
  END || ';' as function_def
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
  AND r.routine_type = 'FUNCTION'
GROUP BY r.routine_name, r.routine_definition, r.external_language, r.data_type
ORDER BY r.routine_name;
" > 02_staging_functions_triggers.sql

# Also export views
psql "$STAGING_DB_URL" -c "
SELECT 
  'CREATE OR REPLACE VIEW ' || table_name || ' AS ' || view_definition || ';' as view_def
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
" >> 02_staging_functions_triggers.sql

# Export triggers
psql "$STAGING_DB_URL" -c "
SELECT 
  'CREATE TRIGGER ' || trigger_name || ' ' || 
  action_timing || ' ' || 
  event_manipulation || ' ON ' || 
  event_object_table || ' ' || 
  CASE 
    WHEN action_orientation = 'ROW' THEN 'FOR EACH ROW'
    WHEN action_orientation = 'STATEMENT' THEN 'FOR EACH STATEMENT'
    ELSE ''
  END || ' ' ||
  CASE 
    WHEN action_condition IS NOT NULL THEN 'WHEN (' || action_condition || ') '
    ELSE ''
  END ||
  'EXECUTE FUNCTION ' || action_statement || ';' as trigger_def
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
" >> 02_staging_functions_triggers.sql

echo "📋 Exporting materialized views..."

# Export materialized views separately
psql "$STAGING_DB_URL" -c "
SELECT 
  'CREATE MATERIALIZED VIEW IF NOT EXISTS ' || matviewname || ' AS ' || definition || ';'
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;
" > 03_staging_materialized_views.sql

echo "📋 Exporting RLS policies..."

# Export RLS policies
psql "$STAGING_DB_URL" -c "
SELECT 
  'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;' as enable_rls,
  'CREATE POLICY \"' || policyname || '\" ON ' || schemaname || '.' || tablename || 
    ' FOR ' || cmd || ' USING (' || qual || ');' as policy
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" > 04_staging_rls_policies.sql

echo "📋 Exporting indexes..."

# Export indexes (excluding primary key constraints)
psql "$STAGING_DB_URL" -c "
SELECT 
  'CREATE INDEX ' || indexname || ' ON ' || schemaname || '.' || tablename || 
    ' USING ' || indexdef || ';' as create_index
FROM pg_indexes
WHERE schemaname = 'public' 
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;
" > 05_staging_indexes.sql

echo "📋 Exporting table statistics..."

# Export table statistics for validation
psql "$STAGING_DB_URL" -c "
SELECT 
  schemaname,
  relname as tablename,
  n_tup_ins - n_tup_del AS row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY row_count DESC;
" > staging_table_stats.csv

echo "📋 Generating table creation order..."

# Generate table creation order (respecting foreign key dependencies)
psql "$STAGING_DB_URL" -c "
WITH RECURSIVE deps AS (
  SELECT 
    tc.table_name,
    tc.constraint_name,
    ccu.table_name AS references_table,
    1 as level
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
),
ordered_tables AS (
  SELECT 
    table_name,
    MIN(level) as min_level
  FROM deps
  GROUP BY table_name
  UNION
  SELECT 
    table_name,
    0 as min_level
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN (SELECT table_name FROM deps)
)
SELECT table_name
FROM ordered_tables
ORDER BY min_level, table_name;
" > table_creation_order.txt

echo "✅ Schema export complete!"
echo "📁 Files created in ./migration_exports/"
echo "   - 01_staging_schema.sql (tables and basic structure)"
echo "   - 02_staging_functions_triggers.sql (functions and triggers)"
echo "   - 03_staging_materialized_views.sql (materialized views)"
echo "   - 04_staging_rls_policies.sql (RLS policies)"
echo "   - 05_staging_indexes.sql (indexes)"
echo "   - staging_table_stats.csv (validation data)"
echo "   - table_creation_order.txt (table dependency order)"

# Display summary
echo ""
echo "📊 Export Summary:"
wc -l *.sql *.csv *.txt
