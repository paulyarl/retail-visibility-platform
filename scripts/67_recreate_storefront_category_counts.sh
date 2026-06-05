#!/bin/bash

set -e
echo "🔧 RECREATING storefront_category_counts FROM STAGING"
echo "===================================================="

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
echo "📊 Dropping old storefront_category_counts..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP MATERIALIZED VIEW IF EXISTS storefront_category_counts CASCADE;"

echo ""
echo "📊 Creating storefront_category_counts with correct structure..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW public.storefront_category_counts AS
SELECT
  ii.tenant_id,
  t.name AS tenant_name,
  dc.id AS category_id,
  dc.name AS category_name,
  dc.slug AS category_slug,
  dc.\"googleCategoryId\" AS google_category_id,
  dc.\"sortOrder\" AS category_sort_order,
  0 AS category_level,
  dc.\"parentId\" AS category_parent_id,
  COUNT(ii.id) AS product_count,
  MAX(ii.updated_at) AS last_product_updated,
  MIN(ii.created_at) AS first_product_created,
  NOW() AS calculated_at,
  COUNT(CASE WHEN ii.image_url IS NOT NULL THEN 1 ELSE NULL::INTEGER END) AS products_with_images,
  COUNT(CASE WHEN ii.description IS NOT NULL AND ii.description <> ''::TEXT THEN 1 ELSE NULL::INTEGER END) AS products_with_descriptions,
  COUNT(CASE WHEN ii.brand IS NOT NULL AND ii.brand <> 'Unknown'::TEXT THEN 1 ELSE NULL::INTEGER END) AS products_with_brand,
  COUNT(CASE WHEN ii.price_cents > 0 THEN 1 ELSE NULL::INTEGER END) AS products_with_price,
  COUNT(CASE WHEN ii.stock > 0 THEN 1 ELSE NULL::INTEGER END) AS in_stock_products,
  AVG(CASE WHEN ii.price_cents > 0 THEN ii.price_cents ELSE NULL::INTEGER END) AS avg_price_cents,
  MIN(CASE WHEN ii.price_cents > 0 THEN ii.price_cents ELSE NULL::INTEGER END) AS min_price_cents,
  MAX(CASE WHEN ii.price_cents > 0 THEN ii.price_cents ELSE NULL::INTEGER END) AS max_price_cents,
  COALESCE(srs.rating_avg, 0::NUMERIC) AS store_rating_avg,
  COALESCE(srs.rating_count, 0) AS store_rating_count,
  COALESCE(srs.rating_1_count, 0) AS store_rating_1_count,
  COALESCE(srs.rating_2_count, 0) AS store_rating_2_count,
  COALESCE(srs.rating_3_count, 0) AS store_rating_3_count,
  COALESCE(srs.rating_4_count, 0) AS store_rating_4_count,
  COALESCE(srs.rating_5_count, 0) AS store_rating_5_count,
  COALESCE(srs.verified_purchase_count, 0) AS store_verified_purchase_count,
  srs.last_review_at
FROM inventory_items ii
JOIN tenants t ON t.id = ii.tenant_id
LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id
LEFT JOIN store_rating_summary srs ON srs.tenant_id = ii.tenant_id
WHERE ii.item_status = 'active'::item_status
  AND ii.visibility = 'public'::item_visibility
  AND (dc.\"isActive\" = true OR dc.\"isActive\" IS NULL)
  AND t.location_status = 'active'::location_status
GROUP BY
  ii.tenant_id,
  t.name,
  dc.id,
  dc.name,
  dc.slug,
  dc.\"googleCategoryId\",
  dc.\"sortOrder\",
  dc.\"parentId\",
  srs.rating_avg,
  srs.rating_count,
  srs.rating_1_count,
  srs.rating_2_count,
  srs.rating_3_count,
  srs.rating_4_count,
  srs.rating_5_count,
  srs.verified_purchase_count,
  srs.last_review_at
HAVING COUNT(ii.id) > 0;
"

echo ""
echo "📊 Adding unique index..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX storefront_category_counts_unique_idx ON storefront_category_counts (tenant_id, category_id);
"

echo ""
echo "📊 Refreshing view..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_category_counts;" 2>/dev/null || \
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW storefront_category_counts;"

echo ""
echo "📊 Verifying structure..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storefront_category_counts' 
  AND column_name IN ('category_id', 'category_name', 'category_slug')
ORDER BY column_name;
"

echo ""
echo "🎯 storefront_category_counts recreated with correct structure!"
