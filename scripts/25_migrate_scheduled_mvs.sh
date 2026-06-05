#!/bin/bash

set -e

echo "🔍 Migrate Scheduled Materialized Views"
echo "====================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Checking scheduled jobs in production..."

# Check current scheduled jobs
echo "🔍 Current scheduled jobs in production:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT jobid, schedule, command 
FROM cron.job 
ORDER BY jobid;
"

echo ""
echo "📋 Checking scheduled jobs in staging..."

# Check staging scheduled jobs
echo "🔍 Scheduled jobs in staging:"
psql "$STAGING_DATABASE_URL" -c "
SELECT jobid, schedule, command 
FROM cron.job 
ORDER BY jobid;
"

echo ""
echo "📦 Checking which materialized views are missing..."

# Check which MVs exist in staging but not production
echo "🔍 Missing materialized views in production:"
psql "$STAGING_DATABASE_URL" -c "
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
  AND matviewname NOT IN (
    SELECT matviewname 
    FROM pg_matviews 
    WHERE schemaname = 'public'
  )
ORDER BY matviewname;
"

echo ""
echo "📦 Creating missing critical materialized views..."

# Create the most important missing views for directory functionality
echo "🔍 Creating mv_global_discovery..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_discovery AS
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
    t.directory_visible,
    ii.is_featured,
    ii.featured_type,
    ii.featured_priority,
    ii.featured_at,
    ii.featured_until
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true;
"

echo "🔍 Creating mv_category_discovery..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_discovery AS
SELECT 
    COALESCE(ii.category_path[1], 'uncategorized') as category,
    COUNT(*) as product_count,
    COUNT(DISTINCT ii.tenant_id) as tenant_count,
    MIN(ii.price_cents) as min_price_cents,
    MAX(ii.price_cents) as max_price_cents,
    AVG(ii.price_cents) as avg_price_cents,
    COUNT(CASE WHEN ii.image_url IS NOT NULL THEN 1 END) as products_with_images,
    COUNT(DISTINCT ii.brand) as brand_count,
    NOW() as last_updated
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
GROUP BY ii.category_path[1];
"

echo "🔍 Creating mv_featured_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_featured_products AS
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
    ii.featured_type,
    ii.featured_priority,
    ii.featured_at,
    ii.featured_until
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND ii.is_featured = true
  AND (ii.featured_until IS NULL OR ii.featured_until > NOW())
ORDER BY ii.featured_priority DESC, ii.featured_at DESC;
"

echo "🔍 Creating mv_trending_products..."
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
    ii.view_count,
    ii.created_at as trend_score
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.item_status = 'active'
  AND t.directory_visible = true
  AND ii.created_at >= (CURRENT_DATE - INTERVAL '30 days')
ORDER BY ii.view_count DESC, ii.created_at DESC
LIMIT 100;
"

echo "✅ Critical materialized views created"

echo ""
echo "🔄 Refreshing new materialized views..."

# Refresh the new views
psql "$PRODUCTION_DATABASE_URL" -c "
REFRESH MATERIALIZED VIEW mv_global_discovery;
REFRESH MATERIALIZED VIEW mv_category_discovery;
REFRESH MATERIALIZED VIEW mv_featured_products;
REFRESH MATERIALIZED VIEW mv_trending_products;
"

echo "✅ Materialized views refreshed"

echo ""
echo "📋 Scheduling refresh jobs..."

# Schedule the refresh jobs
echo "🔍 Scheduling mv_global_discovery refresh..."
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT cron.unschedule('refresh-mv_global_discovery');
SELECT cron.schedule(
  'refresh-mv_global_discovery',
  '*/10 * * * *',
  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery\$\$
);
"

echo "🔍 Scheduling mv_category_discovery refresh..."
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT cron.unschedule('refresh-mv_category_discovery');
SELECT cron.schedule(
  'refresh-mv_category_discovery',
  '*/10 * * * *',
  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_discovery\$\$
);
"

echo "🔍 Scheduling mv_featured_products refresh..."
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT cron.unschedule('refresh-mv_featured_products');
SELECT cron.schedule(
  'refresh-mv_featured_products',
  '*/15 * * * *',
  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_featured_products\$\$
);
"

echo "🔍 Scheduling mv_trending_products refresh..."
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT cron.unschedule('refresh-mv_trending_products');
SELECT cron.schedule(
  'refresh-mv_trending_products',
  '0 */2 * * *',
  \$\$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_products\$\$
);
"

echo "✅ All refresh jobs scheduled"

echo ""
echo "📊 Verifying scheduled jobs..."

# Verify the scheduled jobs
echo "🔍 Current scheduled jobs after migration:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT jobid, schedule, command 
FROM cron.job 
ORDER BY jobid;
"

echo ""
echo "📊 Checking materialized view data..."

# Check the views data
echo "🔍 mv_global_discovery count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM mv_global_discovery;"

echo "🔍 mv_category_discovery count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM mv_category_discovery;"

echo "🔍 mv_featured_products count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM mv_featured_products;"

echo "🔍 mv_trending_products count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM mv_trending_products;"

echo ""
echo "🎯 Scheduled Materialized Views Migration Complete!"
echo "=================================================="
echo ""
echo "✅ What was migrated:"
echo "   - mv_global_discovery: Global product discovery"
echo "   - mv_category_discovery: Category-based discovery"
echo "   - mv_featured_products: Featured product listings"
echo "   - mv_trending_products: Trending product rankings"
echo ""
echo "⏰ Scheduled Refresh Times:"
echo "   - mv_global_discovery: Every 10 minutes"
echo "   - mv_category_discovery: Every 10 minutes"
echo "   - mv_featured_products: Every 15 minutes"
echo "   - mv_trending_products: Every 2 hours"
echo ""
echo "🚀 Directory Features Now Available:"
echo "   - Global product search and discovery"
echo "   - Category browsing with real-time updates"
echo "   - Featured products showcase"
echo "   - Trending products rankings"
echo ""
echo "🎯 Directory page should now be fully functional with auto-refreshing data!"
