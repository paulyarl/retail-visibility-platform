#!/bin/bash

echo "🔍 INSPECTING MATERIALIZED VIEW STRUCTURES"
echo "=========================================="

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
echo "=== directory_category_listings ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'directory_category_listings' ORDER BY ordinal_position;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM directory_category_listings;"
echo "Sample data:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT * FROM directory_category_listings LIMIT 3;"

echo ""
echo "=== mv_category_discovery ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mv_category_discovery' ORDER BY ordinal_position LIMIT 15;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM mv_category_discovery;"

echo ""
echo "=== mv_shop_discovery ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mv_shop_discovery' ORDER BY ordinal_position LIMIT 15;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM mv_shop_discovery;"

echo ""
echo "=== mv_trending_scores ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mv_trending_scores' ORDER BY ordinal_position LIMIT 15;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM mv_trending_scores;"

echo ""
echo "=== storefront_category_counts ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'storefront_category_counts' ORDER BY ordinal_position;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM storefront_category_counts;"

echo ""
echo "=== directory_home_summary_mv ==="
echo "Columns:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'directory_home_summary_mv' ORDER BY ordinal_position;"
echo "Row count:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) FROM directory_home_summary_mv;"

echo ""
echo "🎯 Inspection complete!"
