#!/bin/bash

set -e
echo "🔧 SYNCING gbp_listing_categories FROM STAGING TO PRODUCTION"
echo "============================================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

if [ -z "$STAGING_DATABASE_URL" ] || [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: STAGING_DATABASE_URL and PRODUCTION_DATABASE_URL must be set"
    exit 1
fi

echo ""
echo "📊 Checking staging row count..."
staging_count=$(doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT COUNT(*) FROM gbp_listing_categories;")
echo "   Staging: $staging_count rows"

echo ""
echo "📊 Checking production row count..."
prod_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM gbp_listing_categories;" 2>/dev/null || echo "0")
echo "   Production: $prod_count rows"

echo ""
echo "📊 Truncating production table..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "TRUNCATE TABLE gbp_listing_categories CASCADE;"

echo ""
echo "📊 Dumping data from staging..."
doppler run -- pg_dump "$STAGING_DATABASE_URL" -t gbp_listing_categories --data-only > /tmp/gbp_listing_categories.sql

echo ""
echo "📊 Loading data to production..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -f /tmp/gbp_listing_categories.sql

echo ""
echo "📊 Verifying production row count..."
new_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM gbp_listing_categories;")
echo "   Production now: $new_count rows"

echo ""
echo "📊 Sample data..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT * FROM gbp_listing_categories LIMIT 5;"

# Cleanup
rm -f /tmp/gbp_listing_categories.sql

echo ""
echo "🎯 gbp_listing_categories synced from staging to production!"
