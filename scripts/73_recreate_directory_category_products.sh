#!/bin/bash

set -e
echo "🔧 RECREATING directory_category_products FROM STAGING"
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
echo "📊 Dropping old directory_category_products..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP MATERIALIZED VIEW IF EXISTS directory_category_products CASCADE;"

echo ""
echo "📊 Creating directory_category_products with staging structure..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW public.directory_category_products AS
SELECT
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.icon_emoji as category_icon,
  pc.level as category_level,
  pc.parent_id as category_parent_id,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  t.location_status,
  dsl.id as directory_listing_id,
  dsl.is_published,
  dsl.is_featured as store_is_featured,
  dcl.is_primary,
  dsl.is_published as directory_visible,
  false as google_sync_enabled,
  dsl.rating_avg,
  dsl.rating_count,
  dsl.product_count as directory_product_count,
  count(ii.id) as actual_product_count,
  count(ii.id) filter (where ii.image_url is not null) as products_with_images,
  count(ii.id) filter (where ii.marketing_description is not null) as products_with_descriptions,
  count(ii.id) filter (where ii.brand is not null) as products_with_brand,
  count(ii.id) filter (where ii.price_cents > 0) as products_with_price,
  count(ii.id) filter (where ii.stock > 0 or ii.quantity > 0) as in_stock_products,
  count(distinct psr.brand_normalized) filter (where psr.brand_normalized is not null) as unique_brands_count,
  count(ii.id) filter (where psr.brand_normalized is not null) as products_with_normalized_brand,
  count(fp.id) as featured_product_count,
  count(fp.id) filter (where fp.is_active = true and (fp.featured_expires_at is null or fp.featured_expires_at >= now())) as active_featured_count,
  count(fp.id) filter (where fp.featured_type::text = 'store_selection') as store_selection_count,
  count(fp.id) filter (where fp.featured_type::text = 'new_arrival') as new_arrival_count,
  count(fp.id) filter (where fp.featured_type::text = 'seasonal') as seasonal_count,
  count(fp.id) filter (where fp.featured_type::text = 'sale') as sale_count,
  count(fp.id) filter (where fp.featured_type::text = 'staff_pick') as staff_pick_count,
  case
    when count(ii.id) = 0 then 0::numeric
    else (
      (
        count(ii.id) filter (where ii.image_url is not null) * 20 +
        count(ii.id) filter (where ii.marketing_description is not null) * 20 +
        count(ii.id) filter (where ii.brand is not null) * 15 +
        count(ii.id) filter (where ii.price_cents > 0) * 15 +
        count(ii.id) filter (where ii.stock > 0 or ii.quantity > 0) * 5
      ) / count(ii.id)
    )::numeric + count(fp.id)::numeric * 25.0 / count(ii.id)::numeric
  end as quality_score,
  avg(ii.price_cents) as avg_price_cents,
  min(ii.price_cents) as min_price_cents,
  max(ii.price_cents) as max_price_cents,
  avg(ii.price_cents::numeric / 100.0) as avg_price_dollars,
  avg(ii.price_cents) filter (where fp.is_active = true) as avg_featured_price_cents,
  min(ii.price_cents) filter (where fp.is_active = true) as min_featured_price_cents,
  max(ii.price_cents) filter (where fp.is_active = true) as max_featured_price_cents,
  avg(ii.price_cents::numeric / 100.0) filter (where fp.is_active = true) as avg_featured_price_dollars,
  dsl.address,
  dsl.city as listing_city,
  dsl.state as listing_state,
  dsl.zip_code,
  dsl.latitude,
  dsl.longitude,
  case
    when count(ii.id) > 50 then 'high'
    when count(ii.id) > 10 then 'medium'
    when count(ii.id) > 0 then 'low'
    else 'none'
  end as product_volume_level,
  case
    when dsl.rating_avg >= 4.5 then 'excellent'
    when dsl.rating_avg >= 4.0 then 'good'
    when dsl.rating_avg >= 3.5 then 'average'
    when dsl.rating_avg >= 3.0 then 'fair'
    else 'poor'
  end as rating_tier,
  case
    when dsl.is_featured = true then 'featured'
    when dcl.is_primary = true then 'primary'
    when dsl.rating_count >= 10 then 'popular'
    else 'standard'
  end as listing_tier,
  case
    when count(fp.id) filter (where fp.is_active = true) >= 5 then 'featured_store'
    when count(fp.id) filter (where fp.is_active = true) >= 1 then 'has_featured'
    else 'standard'
  end as featured_store_tier,
  t.created_at as tenant_created_at,
  dsl.created_at as listing_created_at,
  dsl.updated_at as listing_updated_at,
  max(fp.featured_at) as last_featured_at
FROM platform_categories pc
CROSS JOIN tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN directory_listing_categories dcl ON dcl.listing_id = dsl.id AND dcl.category_id = pc.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
  AND ii.item_status = 'active'
  AND ii.visibility = 'public'
  AND (
    ii.directory_category_id = pc.id
    OR (ii.directory_category_id is null AND pc.slug = 'uncategorized')
  )
LEFT JOIN product_slug_registry psr ON psr.product_slug = ii.product_slug AND psr.is_active = true
LEFT JOIN featured_products fp ON fp.inventory_item_id = ii.id AND fp.tenant_id = t.id
WHERE dsl.is_published = true
  AND t.location_status = 'active'
GROUP BY
  pc.id, pc.name, pc.slug, pc.google_category_id, pc.icon_emoji, pc.level, pc.parent_id,
  t.id, t.name, t.slug, t.subscription_tier, t.location_status, t.created_at,
  dsl.id, dsl.is_published, dsl.is_featured, dsl.rating_avg, dsl.rating_count, dsl.product_count,
  dsl.address, dsl.city, dsl.state, dsl.zip_code, dsl.latitude, dsl.longitude,
  dsl.created_at, dsl.updated_at,
  dcl.is_primary;
"

echo ""
echo "📊 Adding unique index..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX directory_category_products_unique_idx ON directory_category_products (category_id, tenant_id);
"

echo ""
echo "📊 Adding performance indexes..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE INDEX idx_dcp_category_id ON directory_category_products(category_id);
CREATE INDEX idx_dcp_tenant_id ON directory_category_products(tenant_id);
CREATE INDEX idx_dcp_category_slug ON directory_category_products(category_slug);
CREATE INDEX idx_dcp_is_published ON directory_category_products(is_published);
CREATE INDEX idx_dcp_store_featured ON directory_category_products(store_is_featured);
"

echo ""
echo "📊 Refreshing view..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_products;" 2>/dev/null || \
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW directory_category_products;"

echo ""
echo "📊 Checking row count..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT COUNT(*) as total_rows FROM directory_category_products;
"

echo ""
echo "📊 Sample data..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT category_name, tenant_name, actual_product_count, quality_score 
FROM directory_category_products 
LIMIT 5;
"

echo ""
echo "🎯 directory_category_products recreated from staging!"
