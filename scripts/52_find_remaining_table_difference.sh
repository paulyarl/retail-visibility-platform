#!/bin/bash

set -e
echo "🔍 FINDING REMAINING TABLE DIFFERENCES"
echo "====================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

# Check if production database URL is set
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
    echo "❌ ERROR: PRODUCTION_DATABASE_URL environment variable not set"
    exit 1
fi

echo "🔍 Comparing table lists between staging and production..."
echo ""

# Get all table names from staging
echo "📥 Getting staging tables..."
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
" > /tmp/staging_tables.txt 2>/dev/null

# Get all table names from production
echo "📥 Getting production tables..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
" > /tmp/production_tables.txt 2>/dev/null

echo ""
echo "📊 Tables only in STAGING (not in production):"
comm -23 /tmp/staging_tables.txt /tmp/production_tables.txt | while read -r table; do
    if [ -n "$table" ]; then
        echo "   - $table"
    fi
done

echo ""
echo "📊 Tables only in PRODUCTION (not in staging):"
comm -13 /tmp/staging_tables.txt /tmp/production_tables.txt | while read -r table; do
    if [ -n "$table" ]; then
        echo "   - $table"
    fi
done

echo ""
echo "📊 Table counts:"
staging_count=$(wc -l < /tmp/staging_tables.txt | tr -d ' ')
production_count=$(wc -l < /tmp/production_tables.txt | tr -d ' ')
echo "   - Staging: $staging_count tables"
echo "   - Production: $production_count tables"
echo "   - Difference: $((production_count - staging_count)) tables"

# Clean up
rm -f /tmp/staging_tables.txt /tmp/production_tables.txt

echo ""
echo "🎯 COMPARISON COMPLETE!"
