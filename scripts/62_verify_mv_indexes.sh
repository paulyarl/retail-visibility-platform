#!/bin/bash

set -e
echo "🔍 VERIFYING MATERIALIZED VIEW INDEXES IN PRODUCTION"
echo "====================================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: PRODUCTION_DATABASE_URL environment variable not set"
    exit 1
fi

echo ""
echo "📊 Checking materialized views and their unique indexes..."
echo ""

# List all materialized views
echo "=== MATERIALIZED VIEWS ==="
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;
"

echo ""
echo "=== UNIQUE INDEXES ON MATERIALIZED VIEWS ==="
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 
    t.relname AS materialized_view,
    i.relname AS index_name,
    a.attname AS column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'm'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND ix.indisunique = true
ORDER BY t.relname, i.relname;
"

echo ""
echo "=== VIEWS MISSING UNIQUE INDEXES ==="
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT m.matviewname
FROM pg_matviews m
WHERE m.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_index ix 
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = m.matviewname 
      AND n.nspname = 'public'
      AND ix.indisunique = true
  )
ORDER BY m.matviewname;
"

echo ""
echo "🎯 Verification complete!"
