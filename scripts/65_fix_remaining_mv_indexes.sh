#!/bin/bash

set -e
echo "🔧 ADDING CORRECT UNIQUE INDEXES TO MATERIALIZED VIEWS"
echo "======================================================"

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
echo "📊 Adding unique indexes based on actual view structures..."
echo ""

# directory_category_listings - unique on tenant_id
echo "   📥 Adding unique index to directory_category_listings (tenant_id)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX directory_category_listings_unique_idx ON directory_category_listings (tenant_id);
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

# mv_category_discovery - unique on category
echo "   📥 Adding unique index to mv_category_discovery (category)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX mv_category_discovery_unique_idx ON mv_category_discovery (category);
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

# mv_shop_discovery - unique on tenant_id
echo "   📥 Adding unique index to mv_shop_discovery (tenant_id)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX mv_shop_discovery_unique_idx ON mv_shop_discovery (tenant_id);
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

# mv_trending_scores - unique on product_id
echo "   📥 Adding unique index to mv_trending_scores (product_id)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX mv_trending_scores_unique_idx ON mv_trending_scores (product_id);
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

# storefront_category_counts - composite unique on (tenant_id, category)
echo "   📥 Adding unique index to storefront_category_counts (tenant_id, category)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX storefront_category_counts_unique_idx ON storefront_category_counts (tenant_id, category);
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

# directory_home_summary_mv - single row, use row_number
echo "   📥 Adding unique index to directory_home_summary_mv (using ctid)..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    CREATE UNIQUE INDEX directory_home_summary_mv_unique_idx ON directory_home_summary_mv ((1));
" 2>/dev/null && echo "   ✅ Added" || echo "   ❌ Failed"

echo ""
echo "📊 Verifying all views now have unique indexes..."
echo ""

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
echo "🎯 Index creation complete!"
