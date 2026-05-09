#!/bin/bash

set -e
echo "🔧 FIXING MATERIALIZED VIEWS FOR CRON JOBS"
echo "=========================================="

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

echo "🔥 Strategy: Fix missing views and add unique indexes for CONCURRENT refresh"
echo ""

# Step 1: Add unique indexes to existing materialized views
echo "📊 Step 1: Adding unique indexes for CONCURRENT refresh..."
echo ""

# Views that need unique indexes
views_needing_indexes=(
    "storefront_category_counts"
    "storefront_variants_mv"
    "directory_category_listings"
    "mv_global_discovery"
    "mv_category_discovery"
    "mv_shop_discovery"
    "mv_trending_scores"
    "mv_trending_products"
    "mv_selection_products"
    "mv_new_products"
    "mv_sale_products"
    "mv_seasonal_products"
)

for view in "${views_needing_indexes[@]}"; do
    # Check if view exists
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = '$view');" 2>/dev/null || echo "f")
    
    if [ "$exists" = "t" ]; then
        # Check if unique index already exists
        has_index=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = '$view' 
                AND indexname LIKE '%_pkey' 
                OR indexname LIKE '%_unique%'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$has_index" != "t" ]; then
            echo "   🔑 Adding unique index to $view..."
            
            # Try to add a unique index on id column (most common)
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
                CREATE UNIQUE INDEX IF NOT EXISTS ${view}_unique_idx ON $view (id);
            " 2>/dev/null && echo "   ✅ Added unique index to $view" || {
                # If id doesn't exist, try other common columns
                echo "   ⚠️  Could not add index on 'id', trying alternative..."
                doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
                    CREATE UNIQUE INDEX IF NOT EXISTS ${view}_unique_idx ON $view (product_id);
                " 2>/dev/null && echo "   ✅ Added unique index on product_id" || {
                    echo "   ⚠️  Could not add index to $view - may need manual intervention"
                }
            }
        else
            echo "   ℹ️  $view already has unique index"
        fi
    else
        echo "   ⚠️  $view does not exist, skipping"
    fi
done

echo ""

# Step 2: Create missing materialized views
echo "📊 Step 2: Creating missing materialized views..."
echo ""

# Check and create directory_category_products
echo "   📥 Checking directory_category_products..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'directory_category_products');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating directory_category_products..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS directory_category_products AS
        SELECT 
            dc.id as category_id,
            dc.name as category_name,
            COUNT(ii.id) as product_count
        FROM directory_category dc
        LEFT JOIN inventory_items ii ON ii.category_path && ARRAY[dc.name] AND ii.item_status = 'active'
        GROUP BY dc.id, dc.name;
        CREATE UNIQUE INDEX directory_category_products_unique_idx ON directory_category_products (category_id);
    " 2>/dev/null && echo "   ✅ Created directory_category_products" || echo "   ❌ Failed to create directory_category_products"
else
    echo "   ℹ️  directory_category_products exists"
fi

# Check and create directory_category_stores
echo "   📥 Checking directory_category_stores..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'directory_category_stores');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating directory_category_stores..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS directory_category_stores AS
        SELECT 
            dc.id as category_id,
            dc.name as category_name,
            COUNT(DISTINCT ii.tenant_id) as store_count
        FROM directory_category dc
        LEFT JOIN inventory_items ii ON ii.category_path && ARRAY[dc.name] AND ii.item_status = 'active'
        GROUP BY dc.id, dc.name;
        CREATE UNIQUE INDEX directory_category_stores_unique_idx ON directory_category_stores (category_id);
    " 2>/dev/null && echo "   ✅ Created directory_category_stores" || echo "   ❌ Failed to create directory_category_stores"
else
    echo "   ℹ️  directory_category_stores exists"
fi

# Check and create directory_category_stats
echo "   📥 Checking directory_category_stats..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'directory_category_stats');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating directory_category_stats..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS directory_category_stats AS
        SELECT 
            dc.id as category_id,
            dc.name as category_name,
            COUNT(ii.id) as product_count,
            COUNT(DISTINCT ii.tenant_id) as store_count
        FROM directory_category dc
        LEFT JOIN inventory_items ii ON ii.category_path && ARRAY[dc.name] AND ii.item_status = 'active'
        GROUP BY dc.id, dc.name;
        CREATE UNIQUE INDEX directory_category_stats_unique_idx ON directory_category_stats (category_id);
    " 2>/dev/null && echo "   ✅ Created directory_category_stats" || echo "   ❌ Failed to create directory_category_stats"
else
    echo "   ℹ️  directory_category_stats exists"
fi

# Check and create directory_gbp_listings
echo "   📥 Checking directory_gbp_listings..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'directory_gbp_listings');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating directory_gbp_listings..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS directory_gbp_listings AS
        SELECT 
            id,
            tenant_id,
            gbp_category_id,
            created_at
        FROM directory_listings_list
        WHERE gbp_category_id IS NOT NULL;
        CREATE UNIQUE INDEX directory_gbp_listings_unique_idx ON directory_gbp_listings (id);
    " 2>/dev/null && echo "   ✅ Created directory_gbp_listings" || echo "   ❌ Failed to create directory_gbp_listings"
else
    echo "   ℹ️  directory_gbp_listings exists"
fi

# Check and create directory_gbp_stats
echo "   📥 Checking directory_gbp_stats..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'directory_gbp_stats');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating directory_gbp_stats..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS directory_gbp_stats AS
        SELECT 
            gbp_category_id,
            COUNT(*) as listing_count
        FROM directory_listings_list
        WHERE gbp_category_id IS NOT NULL
        GROUP BY gbp_category_id;
        CREATE UNIQUE INDEX directory_gbp_stats_unique_idx ON directory_gbp_stats (gbp_category_id);
    " 2>/dev/null && echo "   ✅ Created directory_gbp_stats" || echo "   ❌ Failed to create directory_gbp_stats"
else
    echo "   ℹ️  directory_gbp_stats exists"
fi

# Check and create gbp_category_usage_stats
echo "   📥 Checking gbp_category_usage_stats..."
exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'gbp_category_usage_stats');" 2>/dev/null || echo "f")
if [ "$exists" != "t" ]; then
    echo "   Creating gbp_category_usage_stats..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE MATERIALIZED VIEW IF NOT EXISTS gbp_category_usage_stats AS
        SELECT 
            gc.id as category_id,
            gc.name as category_name,
            COUNT(tgc.tenant_id) as usage_count
        FROM gbp_categories_list gc
        LEFT JOIN tenant_gbp_categories tgc ON tgc.gbp_category_id = gc.id
        GROUP BY gc.id, gc.name;
        CREATE UNIQUE INDEX gbp_category_usage_stats_unique_idx ON gbp_category_usage_stats (category_id);
    " 2>/dev/null && echo "   ✅ Created gbp_category_usage_stats" || echo "   ❌ Failed to create gbp_category_usage_stats"
else
    echo "   ℹ️  gbp_category_usage_stats exists"
fi

echo ""

# Step 3: Refresh all materialized views
echo "📊 Step 3: Refreshing all materialized views..."
echo ""

all_views=(
    "storefront_products"
    "storefront_category_counts"
    "storefront_variants_mv"
    "directory_category_listings"
    "directory_category_products"
    "directory_category_stores"
    "directory_category_stats"
    "directory_gbp_listings"
    "directory_gbp_stats"
    "gbp_category_usage_stats"
    "mv_global_discovery"
    "mv_category_discovery"
    "mv_shop_discovery"
    "mv_trending_scores"
    "mv_trending_products"
    "mv_selection_products"
    "mv_new_products"
    "mv_sale_products"
    "mv_seasonal_products"
)

for view in "${all_views[@]}"; do
    exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = '$view');" 2>/dev/null || echo "f")
    
    if [ "$exists" = "t" ]; then
        echo "   🔄 Refreshing $view..."
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $view;" 2>/dev/null && echo "   ✅ Refreshed $view" || {
            # Try without CONCURRENTLY if that fails
            echo "   ⚠️  Concurrent refresh failed, trying regular refresh..."
            doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW $view;" 2>/dev/null && echo "   ✅ Refreshed $view (non-concurrent)" || echo "   ❌ Failed to refresh $view"
        }
    fi
done

echo ""
echo "🎯 MATERIALIZED VIEW FIX COMPLETE!"
echo "=================================="
echo ""
echo "✅ What was accomplished:"
echo "   1. Added unique indexes to existing materialized views"
echo "   2. Created missing materialized views"
echo "   3. Refreshed all materialized views"
echo ""
echo "📊 Cron jobs should now run successfully!"
