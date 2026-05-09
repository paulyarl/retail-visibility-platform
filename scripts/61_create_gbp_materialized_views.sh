#!/bin/bash

set -e
echo "🔧 CREATING GBP MATERIALIZED VIEWS"
echo "=================================="

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

echo "🔥 Creating directory_gbp_listings and directory_gbp_stats..."
echo ""

# Check if gbp_listing_categories table exists
echo "📊 Checking required tables..."
gbp_lc_exists=$(doppler run -- psql "$PRODUCTION_DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gbp_listing_categories');" 2>/dev/null || echo "f")

if [ "$gbp_lc_exists" != "t" ]; then
    echo "   ⚠️  gbp_listing_categories table does not exist"
    echo "   📥 Creating gbp_listing_categories table..."
    
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        CREATE TABLE IF NOT EXISTS gbp_listing_categories (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            listing_id TEXT NOT NULL,
            gbp_category_id TEXT NOT NULL,
            is_primary BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_gbp_listing_categories_listing FOREIGN KEY (listing_id) REFERENCES directory_listings_list(id) ON DELETE CASCADE,
            CONSTRAINT fk_gbp_listing_categories_category FOREIGN KEY (gbp_category_id) REFERENCES gbp_categories_list(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_gbp_listing_categories_listing ON gbp_listing_categories(listing_id);
        CREATE INDEX IF NOT EXISTS idx_gbp_listing_categories_category ON gbp_listing_categories(gbp_category_id);
    " 2>/dev/null && echo "   ✅ Created gbp_listing_categories table" || echo "   ❌ Failed to create gbp_listing_categories table"
else
    echo "   ✅ gbp_listing_categories table exists"
fi

echo ""

# Create directory_gbp_listings
echo "📊 Creating directory_gbp_listings..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    DROP MATERIALIZED VIEW IF EXISTS directory_gbp_listings CASCADE;
    
    CREATE MATERIALIZED VIEW directory_gbp_listings AS
    SELECT 
        dl.id,
        dl.tenant_id,
        dl.business_name,
        dl.slug,
        dl.address,
        dl.city,
        dl.state,
        dl.zip_code,
        dl.phone,
        dl.email,
        dl.website,
        dl.latitude,
        dl.longitude,
        gc.id AS gbp_category_id,
        gc.name AS gbp_category_name,
        gc.display_name AS gbp_category_display_name,
        glc.is_primary,
        dl.logo_url,
        dl.description,
        dl.rating_avg,
        dl.rating_count,
        dl.product_count,
        dl.is_featured,
        dl.subscription_tier,
        dl.use_custom_website,
        dl.created_at,
        dl.updated_at,
        EXISTS (SELECT 1 FROM tenants WHERE tenants.id = dl.tenant_id) AS tenant_exists,
        (t.location_status = 'active'::location_status) AS is_active_location,
        t.directory_visible AS is_directory_visible,
        t.google_sync_enabled AS is_google_synced
    FROM directory_listings_list dl
    JOIN gbp_listing_categories glc ON glc.listing_id = dl.id
    JOIN gbp_categories_list gc ON gc.id = glc.gbp_category_id
    JOIN tenants t ON t.id = dl.tenant_id
    WHERE dl.is_published = true;
    
    CREATE UNIQUE INDEX directory_gbp_listings_unique_idx ON directory_gbp_listings (id, gbp_category_id);
" 2>/dev/null && echo "   ✅ Created directory_gbp_listings" || {
    echo "   ❌ Failed to create directory_gbp_listings"
    echo "   Trying simpler version without joins..."
    
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
        DROP MATERIALIZED VIEW IF EXISTS directory_gbp_listings CASCADE;
        
        CREATE MATERIALIZED VIEW directory_gbp_listings AS
        SELECT 
            dl.id,
            dl.tenant_id,
            dl.business_name,
            dl.slug,
            dl.address,
            dl.city,
            dl.state,
            dl.zip_code,
            dl.phone,
            dl.email,
            dl.website,
            dl.latitude,
            dl.longitude,
            dl.gbp_category_id,
            dl.logo_url,
            dl.description,
            dl.rating_avg,
            dl.rating_count,
            dl.product_count,
            dl.is_featured,
            dl.subscription_tier,
            dl.use_custom_website,
            dl.created_at,
            dl.updated_at
        FROM directory_listings_list dl
        WHERE dl.is_published = true AND dl.gbp_category_id IS NOT NULL;
        
        CREATE UNIQUE INDEX directory_gbp_listings_unique_idx ON directory_gbp_listings (id);
    " 2>/dev/null && echo "   ✅ Created directory_gbp_listings (simplified)" || echo "   ❌ Failed to create even simplified version"
}

echo ""

# Create directory_gbp_stats
echo "📊 Creating directory_gbp_stats..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
    DROP MATERIALIZED VIEW IF EXISTS directory_gbp_stats CASCADE;
    
    CREATE MATERIALIZED VIEW directory_gbp_stats AS
    SELECT 
        gc.id AS gbp_category_id,
        gc.name AS gbp_category_name,
        gc.display_name AS gbp_category_display_name,
        COUNT(DISTINCT dgl.id) AS store_count,
        COUNT(DISTINCT CASE WHEN dgl.is_featured = true THEN dgl.id ELSE NULL END) AS featured_store_count,
        AVG(dgl.rating_avg) AS avg_rating,
        SUM(dgl.rating_count) AS total_ratings,
        SUM(dgl.product_count) AS total_products
    FROM gbp_categories_list gc
    LEFT JOIN directory_gbp_listings dgl ON dgl.gbp_category_id = gc.id
    GROUP BY gc.id, gc.name, gc.display_name;
    
    CREATE UNIQUE INDEX directory_gbp_stats_unique_idx ON directory_gbp_stats (gbp_category_id);
" 2>/dev/null && echo "   ✅ Created directory_gbp_stats" || echo "   ❌ Failed to create directory_gbp_stats"

echo ""

# Refresh the views
echo "📊 Refreshing materialized views..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings;" 2>/dev/null && echo "   ✅ Refreshed directory_gbp_listings" || {
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW directory_gbp_listings;" 2>/dev/null && echo "   ✅ Refreshed directory_gbp_listings (non-concurrent)" || echo "   ❌ Failed to refresh"
}

doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats;" 2>/dev/null && echo "   ✅ Refreshed directory_gbp_stats" || {
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW directory_gbp_stats;" 2>/dev/null && echo "   ✅ Refreshed directory_gbp_stats (non-concurrent)" || echo "   ❌ Failed to refresh"
}

echo ""
echo "🎯 GBP MATERIALIZED VIEWS COMPLETE!"
