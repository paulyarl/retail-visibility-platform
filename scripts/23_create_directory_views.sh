#!/bin/bash

set -e

echo "🔧 Create Directory Views Manually"
echo "================================"

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Creating directory materialized views manually..."

# Drop existing views if they exist to recreate them properly
echo "🗑️ Dropping existing views to recreate..."
psql "$PRODUCTION_DATABASE_URL" -c "
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_home_summary_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS storefront_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS storefront_category_counts CASCADE;
"

echo "✅ Existing views dropped"

echo ""
echo "📦 Creating directory_category_listings..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW directory_category_listings AS
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

echo "📦 Creating directory_home_summary_mv..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW directory_home_summary_mv AS
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

echo "📦 Creating storefront_products..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW storefront_products AS
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

echo "📦 Creating storefront_category_counts..."
psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW storefront_category_counts AS
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

echo "✅ All directory views created"

echo ""
echo "🔄 Refreshing materialized views..."

# Refresh all views
psql "$PRODUCTION_DATABASE_URL" -c "
REFRESH MATERIALIZED VIEW directory_category_listings;
REFRESH MATERIALIZED VIEW directory_home_summary_mv;
REFRESH MATERIALIZED VIEW storefront_products;
REFRESH MATERIALIZED VIEW storefront_category_counts;
"

echo "✅ Views refreshed"

echo ""
echo "📊 Checking directory data availability..."

# Check the views data
echo "🔍 directory_category_listings count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM directory_category_listings;"

echo "🔍 directory_home_summary_mv:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT * FROM directory_home_summary_mv;"

echo "🔍 storefront_products count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM storefront_products;"

echo "🔍 storefront_category_counts count:"
psql "$PRODUCTION_DATABASE_URL" -c "SELECT COUNT(*) as count FROM storefront_category_counts;"

echo ""
echo "📊 Checking tenant directory visibility..."

# Check directory-visible tenants
echo "🔍 Directory-visible active tenants:"
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
echo "🔍 Products by category (top 10):"
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT category, COUNT(*) as product_count
FROM storefront_products 
GROUP BY category 
ORDER BY product_count DESC
LIMIT 10;
"

echo ""
echo "🎯 Directory Views Creation Complete!"
echo "===================================="
echo ""
echo "✅ What was created:"
echo "   - directory_category_listings: Tenant and category data"
echo "   - directory_home_summary_mv: Summary statistics"
echo "   - storefront_products: All active products"
echo "   - storefront_category_counts: Category counts by tenant"
echo ""
echo "📊 Directory Data Status:"
echo "   - Active tenants: $(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM tenants WHERE location_status = 'active';" | tr -d ' ')"
echo "   - Directory-visible tenants: $(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM tenants WHERE location_status = 'active' AND directory_visible = true;" | tr -d ' ')"
echo "   - Active products: $(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM inventory_items WHERE is_active = true;" | tr -d ' ')"
echo "   - Storefront products: $(psql "$PRODUCTION_DATABASE_URL" -t -c "SELECT COUNT(*) FROM storefront_products;" | tr -d ' ')"
echo ""
echo "🚀 Test the directory:"
echo "   - Visit: https://www.visibleshelf.com/directory"
echo "   - Should show stores and products now"
echo "   - Check categories and product counts"
echo ""
echo "🎯 Directory page should now be functional!"
