#!/bin/bash

set -e
echo "🔧 ADDING MISSING UNIQUE INDEXES TO MATERIALIZED VIEWS"
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
echo "📊 Adding unique indexes to views missing them..."
echo ""

# Function to add unique index
add_unique_index() {
    local view_name=$1
    local column_name=$2
    
    echo "   📥 Adding unique index to $view_name on $column_name..."
    
    # Check if index already exists
    local exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = '${view_name}_unique_idx'
        );
    " 2>/dev/null)
    
    if [ "$exists" = "t" ]; then
        echo "   ℹ️  $view_name already has unique index"
        return 0
    fi
    
    # Try to add the index
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE UNIQUE INDEX ${view_name}_unique_idx ON $view_name ($column_name);
    " 2>/dev/null && echo "   ✅ Added unique index to $view_name" || {
        echo "   ⚠️  Failed to add index, trying alternative column..."
        
        # Try with id column if inventory_item_id fails
        doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
            CREATE UNIQUE INDEX ${view_name}_unique_idx ON $view_name (id);
        " 2>/dev/null && echo "   ✅ Added unique index to $view_name (id)" || {
            echo "   ❌ Failed to add unique index to $view_name"
        }
    }
}

# Add indexes to all views missing them
add_unique_index "directory_category_listings" "id"
add_unique_index "directory_home_summary_mv" "id"
add_unique_index "mv_category_discovery" "inventory_item_id"
add_unique_index "mv_featured_products" "inventory_item_id"
add_unique_index "mv_global_discovery" "inventory_item_id"
add_unique_index "mv_new_products" "inventory_item_id"
add_unique_index "mv_sale_products" "inventory_item_id"
add_unique_index "mv_seasonal_products" "inventory_item_id"
add_unique_index "mv_selection_products" "inventory_item_id"
add_unique_index "mv_shop_discovery" "inventory_item_id"
add_unique_index "mv_trending_products" "inventory_item_id"
add_unique_index "mv_trending_scores" "inventory_item_id"
add_unique_index "storefront_category_counts" "category_id"
add_unique_index "storefront_variants_mv" "id"

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
