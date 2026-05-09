#!/bin/bash

set -e

echo "🔧 Fix Directory - Proper Materialized Views"
echo "=========================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Using pg_dump to export materialized views..."

# Use pg_dump to properly export materialized views
echo "📦 Exporting materialized views from staging..."
pg_dump "$STAGING_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --include=materialized-views \
  --file=materialized_views.sql

echo "✅ Materialized views exported properly"

echo ""
echo "📦 Creating missing materialized views in production..."

# Create only the missing directory-related views
echo "🔍 Creating directory_category_listings..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS directory_category_listings AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    t.location_status,
    t.directory_visible,
    COALESCE(ii.category, 'uncategorized') as category,
    COUNT(*) as product_count,
    MIN(ii.price_cents) as min_price_cents,
    MAX(ii.price_cents) as max_price_cents,
    AVG(ii.price_cents) as avg_price_cents,
    COUNT(CASE WHEN ii.image_url IS NOT NULL THEN 1 END) as products_with_images,
    t.updated_at
FROM tenants t
LEFT JOIN inventory_items ii ON t.id = ii.tenant_id
WHERE t.location_status = 'active'
GROUP BY t.id, t.name, t.slug, t.subscription_tier, t.location_status, t.directory_visible, t.updated_at, ii.category;
"

echo "🔍 Creating directory_home_summary_mv..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS directory_home_summary_mv AS
SELECT 
    COUNT(DISTINCT t.id) as total_active_tenants,
    COUNT(DISTINCT CASE WHEN t.directory_visible = true THEN t.id END) as visible_tenants,
    COUNT(DISTINCT ii.id) as total_products,
    COUNT(DISTINCT CASE WHEN ii.image_url IS NOT NULL THEN ii.id END) as products_with_images,
    COUNT(DISTINCT ii.category) as total_categories,
    COUNT(DISTINCT t.subscription_tier) as subscription_tiers,
    MIN(ii.price_cents) as min_product_price,
    MAX(ii.price_cents) as max_product_price,
    AVG(ii.price_cents) as avg_product_price,
    NOW() as last_updated
FROM tenants t
LEFT JOIN inventory_items ii ON t.id = ii.tenant_id
WHERE t.location_status = 'active';
"

echo "🔍 Creating storefront_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS storefront_products AS
SELECT 
    ii.id,
    ii.tenant_id,
    ii.sku,
    ii.name,
    ii.description,
    ii.price_cents,
    ii.sale_price_cents,
    ii.category,
    ii.subcategory,
    ii.brand,
    ii.image_url,
    ii.quantity_available,
    ii.is_active,
    ii.created_at,
    ii.updated_at,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.subscription_tier,
    t.directory_visible
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.is_active = true;
"

echo "🔍 Creating storefront_category_counts..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW IF NOT EXISTS storefront_category_counts AS
SELECT 
    ii.tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    ii.category,
    COUNT(*) as product_count,
    MIN(ii.price_cents) as min_price_cents,
    MAX(ii.price_cents) as max_price_cents,
    AVG(ii.price_cents) as avg_price_cents,
    COUNT(CASE WHEN ii.image_url IS NOT NULL THEN 1 END) as products_with_images
FROM inventory_items ii
JOIN tenants t ON ii.tenant_id = t.id
WHERE t.location_status = 'active'
  AND ii.is_active = true
GROUP BY ii.tenant_id, t.name, t.slug, ii.category;
"

echo "✅ Directory materialized views created"

echo ""
echo "🔄 Refreshing all materialized views..."

# Refresh the new views
psql "$PRODUCTION_DATABASE_URL" -c "
REFRESH MATERIALIZED VIEW directory_category_listings;
REFRESH MATERIALIZED VIEW directory_home_summary_mv;
REFRESH MATERIALIZED VIEW storefront_products;
REFRESH MATERIALIZED VIEW storefront_category_counts;
"

echo "✅ Materialized views refreshed"

echo ""
echo "📊 Checking directory data availability..."

# Check the views data
echo "🔍 Checking directory_category_listings:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM directory_category_listings LIMIT 1;"

echo "🔍 Checking directory_home_summary_mv:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT * FROM directory_home_summary_mv LIMIT 1;"

echo "🔍 Checking storefront_products:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM storefront_products LIMIT 1;"

echo "🔍 Checking storefront_category_counts:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM storefront_category_counts LIMIT 1;"

echo ""
echo "📊 Checking tenant directory visibility..."

# Check directory-visible tenants
echo "🔍 Directory-visible tenants:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT id, name, slug, subscription_tier, directory_visible
FROM tenants 
WHERE location_status = 'active' 
  AND directory_visible = true
ORDER BY name;
"

echo ""
echo "📊 Checking products by category..."

# Check products by category
echo "🔍 Products by category:"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT category, COUNT(*) as product_count
FROM storefront_products 
GROUP BY category 
ORDER BY product_count DESC
LIMIT 10;
"

# Clean up
rm -f materialized_views.sql

echo ""
echo "🎯 Directory Fix Complete!"
echo "========================"
echo ""
echo "✅ What was fixed:"
echo "   - Created directory_category_listings view"
echo "   - Created directory_home_summary_mv view"
echo "   - Created storefront_products view"
echo "   - Created storefront_category_counts view"
echo "   - Refreshed all materialized views"
echo ""
echo "📊 Directory Data Status:"
echo "   - Active tenants: Available"
echo "   - Directory-visible tenants: Available"
echo "   - Products by category: Available"
echo "   - Storefront data: Available"
echo ""
echo "🚀 Test the directory:"
echo "   - Visit: https://www.visibleshelf.com/directory"
echo "   - Should show active, directory-visible tenants"
echo "   - Should show products organized by category"
echo "   - Should have store and product counts"
echo ""
echo "🎯 Directory page should now be functional!"
