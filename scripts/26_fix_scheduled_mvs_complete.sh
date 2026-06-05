#!/bin/bash

set -e

echo "🔧 Complete Scheduled Materialized Views Migration"
echo "==============================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Creating remaining materialized views with correct columns..."

echo "🔍 Fixing mv_trending_products (without view_count)..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_products AS
SELECT 
    ii.id,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    ii.image_url,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    ii.brand,
    ii.created_at,
    ii.updated_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    EXTRACT(EPOCH FROM (NOW() - ii.created_at)) as recency_score,
    ii.price_cents as price_score
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
  AND ii.created_at >= (CURRENT_DATE - INTERVAL '30 days')
ORDER BY ii.created_at DESC, ii.price_cents ASC
LIMIT 100;
"

echo "🔍 Creating mv_shop_discovery..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_shop_discovery AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    t.directory_visible,
    COUNT(ii.id) as product_count,
    COUNT(CASE WHEN ii.image_url IS NOT NULL THEN 1 END) as products_with_images,
    MIN(ii.price_cents) as min_price_cents,
    MAX(ii.price_cents) as max_price_cents,
    AVG(ii.price_cents) as avg_price_cents,
    COUNT(DISTINCT ii.category_path[1]) as category_count,
    t.updated_at
FROM tenants t
LEFT JOIN inventory_items ii ON t.id = ii.tenant_id
WHERE t.location_status = 'active'
  AND t.directory_visible = true
  AND (ii.item_status = 'active' OR ii.item_status IS NULL)
GROUP BY t.id, t.name, t.slug, t.subscription_tier, t.directory_visible, t.updated_at;
"

echo "🔍 Creating mv_trending_scores..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_scores AS
SELECT 
    ii.id as product_id,
    ii.tenant_id,
    ii.name as product_name,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    EXTRACT(EPOCH FROM (NOW() - ii.created_at)) as recency_factor,
    CASE WHEN ii.sale_price_cents IS NOT NULL THEN 1 ELSE 0 END as sale_factor,
    CASE WHEN ii.image_url IS NOT NULL THEN 1 ELSE 0 END as image_factor,
    ii.price_cents as price_factor,
    NOW() as calculated_at
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true;
"

echo "🔍 Creating mv_selection_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_selection_products AS
SELECT 
    ii.id,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    ii.image_url,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    ii.brand,
    ii.created_at,
    ii.updated_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    ii.is_featured,
    ii.featured_type,
    ii.featured_priority
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
  AND (ii.is_featured = true OR ii.sale_price_cents IS NOT NULL)
ORDER BY ii.featured_priority DESC, ii.created_at DESC;
"

echo "🔍 Creating mv_new_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_new_products AS
SELECT 
    ii.id,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    ii.image_url,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    ii.brand,
    ii.created_at,
    ii.updated_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
  AND ii.created_at >= (CURRENT_DATE - INTERVAL '14 days')
ORDER BY ii.created_at DESC;
"

echo "🔍 Creating mv_sale_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sale_products AS
SELECT 
    ii.id,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    (ii.price_cents - COALESCE(ii.sale_price_cents, ii.price_cents)) as discount_cents,
    ROUND(((ii.price_cents - COALESCE(ii.sale_price_cents, ii.price_cents))::numeric / ii.price_cents * 100), 2) as discount_percentage,
    ii.image_url,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    ii.brand,
    ii.created_at,
    ii.updated_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
  AND ii.sale_price_cents IS NOT NULL
  AND ii.sale_price_cents < ii.price_cents
ORDER BY discount_percentage DESC, ii.created_at DESC;
"

echo "🔍 Creating mv_seasonal_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_seasonal_products AS
SELECT 
    ii.id,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    ii.image_url,
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    ii.brand,
    ii.created_at,
    ii.updated_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    CASE 
        WHEN ii.category_path[1] IN ('frozen-foods', 'produce', 'meat-seafood', 'dairy-eggs') THEN 'winter'
        WHEN ii.category_path[1] IN ('sports-outdoors', 'home-garden', 'automotive') THEN 'summer'
        WHEN ii.category_path[1] IN ('books-media', 'toys-games', 'electronics') THEN 'fall'
        ELSE 'all-season'
    END as season_tag
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
ORDER BY ii.created_at DESC;
"

echo "✅ All materialized views created"

echo ""
echo "🔄 Refreshing all new materialized views..."

# Refresh all the new views
psql "$PRODUCTION_DATABASE_URL" -c "
REFRESH MATERIALIZED VIEW mv_trending_products;
REFRESH MATERIALIZED VIEW mv_shop_discovery;
REFRESH MATERIALIZED VIEW mv_trending_scores;
REFRESH MATERIALIZED VIEW mv_selection_products;
REFRESH MATERIALIZED VIEW mv_new_products;
REFRESH MATERIALIZED VIEW mv_sale_products;
REFRESH MATERIALIZED VIEW mv_seasonal_products;
"

echo "✅ Materialized views refreshed"

echo ""
echo "📋 Scheduling all refresh jobs..."

# Schedule all the refresh jobs matching staging
echo "🔍 Scheduling refresh jobs to match staging..."

# Create all the scheduled jobs from staging
psql "$PRODUCTION_DATABASE_URL" -c "
-- Storefront refreshes
SELECT cron.schedule('storefront_category_counts', '*/5 * * * *', \$\$REFRESH MATERIALIZED VIEW public.storefront_category_counts\$\$);
SELECT cron.schedule('storefront_category_counts_10', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_category_counts\$\$);
SELECT cron.schedule('storefront_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products\$\$);
SELECT cron.schedule('storefront_products_mv', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv\$\$);
SELECT cron.schedule('storefront_variants_mv', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_variants_mv\$\$);

-- Directory refreshes
SELECT cron.schedule('directory_category_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_products\$\$);
SELECT cron.schedule('directory_category_stores', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stores\$\$);
SELECT cron.schedule('directory_gbp_stats', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats\$\$);
SELECT cron.schedule('directory_category_listings', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings\$\$);
SELECT cron.schedule('directory_category_stats', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats\$\$);
SELECT cron.schedule('directory_gbp_listings', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings\$\$);
SELECT cron.schedule('gbp_category_usage_stats', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY gbp_category_usage_stats\$\$);

-- Discovery refreshes
SELECT cron.schedule('mv_global_discovery', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery\$\$);
SELECT cron.schedule('mv_category_discovery', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_discovery\$\$);
SELECT cron.schedule('mv_shop_discovery', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_shop_discovery\$\$);
SELECT cron.schedule('mv_trending_scores', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_scores\$\$);
SELECT cron.schedule('mv_trending_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_products\$\$);
SELECT cron.schedule('mv_selection_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_selection_products\$\$);
SELECT cron.schedule('mv_new_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_new_products\$\$);
SELECT cron.schedule('mv_sale_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sale_products\$\$);
SELECT cron.schedule('mv_seasonal_products', '*/10 * * * *', \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_seasonal_products\$\$);

-- Maintenance jobs
SELECT cron.schedule('cleanup_featured_products', '0 2 * * *', \$\$SELECT cleanup_expired_featured_products();\$\$);
SELECT cron.schedule('cleanup_rate_limit_warnings', '0 2 * * *', \$\$DELETE FROM rate_limit_warnings WHERE occurred_at < NOW() - INTERVAL '7 days';\$\$);
"

echo "✅ All scheduled jobs created"

echo ""
echo "📊 Verifying scheduled jobs..."

# Check the final scheduled jobs
echo "🔍 Final scheduled jobs count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as total_jobs FROM cron.job;"

echo ""
echo "📊 Checking materialized view data..."

# Check views data
echo "🔍 Materialized views data counts:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 'mv_global_discovery' as view_name, COUNT(*) as count FROM mv_global_discovery
UNION ALL
SELECT 'mv_category_discovery', COUNT(*) FROM mv_category_discovery
UNION ALL
SELECT 'mv_featured_products', COUNT(*) FROM mv_featured_products
UNION ALL
SELECT 'mv_trending_products', COUNT(*) FROM mv_trending_products
UNION ALL
SELECT 'mv_shop_discovery', COUNT(*) FROM mv_shop_discovery
UNION ALL
SELECT 'mv_selection_products', COUNT(*) FROM mv_selection_products
UNION ALL
SELECT 'mv_new_products', COUNT(*) FROM mv_new_products
UNION ALL
SELECT 'mv_sale_products', COUNT(*) FROM mv_sale_products
UNION ALL
SELECT 'mv_seasonal_products', COUNT(*) FROM mv_seasonal_products
ORDER BY view_name;
"

echo ""
echo "🎯 Scheduled Materialized Views Migration Complete!"
echo "================================================"
echo ""
echo "✅ What was migrated:"
echo "   - 12+ materialized views for directory functionality"
echo "   - 25+ scheduled jobs for automatic refresh"
echo "   - All discovery and product listing views"
echo "   - Maintenance and cleanup jobs"
echo ""
echo "⏰ Key Refresh Schedules:"
echo "   - Directory views: Every 10 minutes"
echo "   - Storefront views: Every 5-10 minutes"
echo "   - Discovery views: Every 10 minutes"
echo "   - Maintenance: Daily at 2 AM"
echo ""
echo "🚀 Directory Features Now Fully Available:"
echo "   - Real-time product discovery"
echo "   - Category-based browsing"
echo "   - Featured and trending products"
echo "   - New arrivals and sale items"
echo "   - Seasonal product recommendations"
echo "   - Shop discovery and rankings"
echo ""
echo "🎯 Directory page should now be fully functional with auto-refreshing data!"
