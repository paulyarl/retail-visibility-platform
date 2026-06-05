#!/bin/bash

set -e
echo "🔍 DIAGNOSING PRODUCTION DIRECTORY ERRORS"
echo "========================================"

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

echo "🔍 Investigating directory functionality errors..."
echo ""

# Check 1: Verify key directory tables exist and have data
echo "📊 Checking directory tables status..."
directory_tables=(
    "directory_category"
    "directory_featured_listings_list"
    "directory_listing_categories"
    "directory_listings_list"
    "directory_photos"
    "directory_settings_list"
    "directory_support_notes_list"
)

for table in "${directory_tables[@]}"; do
    echo "🔍 Checking $table..."
    table_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")
    
    if [ "$table_exists" = "t" ]; then
        record_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERROR")
        echo "   ✅ $table exists with $record_count records"
        
        # Check for null seo_keywords in critical tables
        if [[ "$table" == "directory_listings_list" ]]; then
            null_seo=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$table\" WHERE seo_keywords IS NULL;" 2>/dev/null || echo "ERROR")
            echo "   🔍 Null seo_keywords: $null_seo"
            
            # Show sample data structure
            echo "   📋 Sample record structure:"
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position LIMIT 10;" 2>/dev/null || echo "   ❌ Could not get column info"
        fi
    else
        echo "   ❌ $table does not exist!"
    fi
    echo ""
done

# Check 2: Verify materialized views
echo "🔍 Checking materialized views..."
materialized_views=(
    "mv_global_discovery"
    "mv_category_discovery"
    "mv_shop_discovery"
    "mv_trending_products"
    "directory_category_listings"
    "directory_home_summary_mv"
    "storefront_products"
    "storefront_category_counts"
)

for view in "${materialized_views[@]}"; do
    echo "🔍 Checking $view..."
    view_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = '$view');" 2>/dev/null || echo "false")
    
    if [ "$view_exists" = "t" ]; then
        echo "   ✅ $view exists"
        
        # Check if it's materialized
        is_materialized=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = '$view');" 2>/dev/null || echo "false")
        if [ "$is_materialized" = "t" ]; then
            record_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$view\";" 2>/dev/null || echo "ERROR")
            echo "   📊 Materialized view with $record_count records"
            
            # Check if it needs refresh
            last_refresh=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT pg_stat_get_last_vacuum_time('$view'::regclass);" 2>/dev/null || echo "Unknown")
            echo "   🕐 Last refresh: $last_refresh"
        else
            echo "   ℹ️  Regular view (not materialized)"
        fi
    else
        echo "   ❌ $view does not exist!"
    fi
    echo ""
done

# Check 3: Verify inventory_items (core for products)
echo "🔍 Checking inventory_items table..."
inventory_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items');" 2>/dev/null || echo "false")

if [ "$inventory_exists" = "t" ]; then
    inventory_count=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM inventory_items;" 2>/dev/null || echo "ERROR")
    echo "   ✅ inventory_items exists with $inventory_count records"
    
    # Check for null seo_keywords
    null_seo=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT COUNT(*) FROM inventory_items WHERE seo_keywords IS NULL;" 2>/dev/null || echo "ERROR")
    echo "   🔍 Null seo_keywords in inventory_items: $null_seo"
    
    # Check column structure
    echo "   📋 Checking for seo_keywords column..."
    seo_column_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'seo_keywords');" 2>/dev/null || echo "false")
    
    if [ "$seo_column_exists" = "t" ]; then
        echo "   ✅ seo_keywords column exists"
    else
        echo "   ❌ seo_keywords column MISSING!"
    fi
else
    echo "   ❌ inventory_items does not exist!"
fi

echo ""

# Check 4: Compare with staging
echo "🔍 Comparing with staging structure..."
echo "📊 Staging directory tables:"
doppler run -- psql "$STAGING_DATABASE_URL" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'directory_%' ORDER BY table_name;" 2>/dev/null || echo "   ❌ Could not connect to staging"

echo ""
echo "📊 Production directory tables:"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'directory_%' ORDER BY table_name;" 2>/dev/null || echo "   ❌ Could not connect to production"

echo ""
echo "🎯 DIAGNOSIS COMPLETE!"
echo "===================="
echo ""
echo "📋 Key findings:"
echo "   1. Directory table structure verified"
echo "   2. Materialized views status checked"
echo "   3. inventory_items seo_keywords column verified"
echo "   4. Production vs staging structure compared"
echo ""
echo "🚀 Next steps:"
echo "   1. Identify missing columns/tables"
echo "   2. Fix seo_keywords null issues"
echo "   3. Refresh materialized views"
echo "   4. Test directory functionality"
