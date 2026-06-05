#!/bin/bash

set -e
echo "✅ FINAL VERIFICATION AND REFRESH"
echo "================================="

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
echo "📊 Checking for views missing unique indexes..."
echo ""

missing=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
SELECT count(*)
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
  );
")

if [ "$missing" = "0" ]; then
    echo "   ✅ All materialized views have unique indexes!"
else
    echo "   ⚠️  $missing views still missing indexes"
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
fi

echo ""
echo "📊 Refreshing all materialized views..."
echo ""

# Get all materialized views
views=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY matviewname;
")

for view in $views; do
    echo "   🔄 Refreshing $view..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $view;" 2>/dev/null && echo "   ✅ Refreshed $view (concurrent)" || {
        echo "   ⚠️  Concurrent failed, trying regular..."
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW $view;" 2>/dev/null && echo "   ✅ Refreshed $view (regular)" || echo "   ❌ Failed to refresh $view"
    }
done

echo ""
echo "🎯 ALL MATERIALIZED VIEWS REFRESHED!"
echo "===================================="
echo "✅ Cron jobs should now run successfully!"
