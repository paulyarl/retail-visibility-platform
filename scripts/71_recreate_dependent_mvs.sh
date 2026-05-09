#!/bin/bash

set -e
echo "🔧 RECREATING DEPENDENT MATERIALIZED VIEWS"
echo "=========================================="

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
echo "📊 Creating mv_category_discovery..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_category_discovery AS
SELECT 
  g.*,
  t.metadata->'gbp_categories'->'secondary' as gbp_secondary_categories_array,
  CASE 
    WHEN g.shop_category IS NOT NULL AND g.shop_category != '' 
     AND jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) > 0 THEN 'both'
    WHEN g.shop_category IS NOT NULL AND g.shop_category != '' THEN 'primary'
    WHEN jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) > 0 THEN 'secondary'
    ELSE 'none'
  END as gbp_category_type,
  COALESCE(g.shop_category, '') as gbp_primary_category_name,
  COALESCE(g.shop_category_id, '') as gbp_primary_category_id,
  COALESCE(g.shop_google_category_id, '') as gbp_primary_google_category_id,
  COALESCE(
    (SELECT jsonb_agg(elem->>'id') FROM jsonb_array_elements(t.metadata->'gbp_categories'->'secondary') elem),
    '[]'::jsonb
  ) as gbp_secondary_category_ids_array,
  LOWER(COALESCE(g.shop_category, '')) as gbp_primary_category_name_lower
FROM mv_global_discovery g
LEFT JOIN tenants t ON g.tenant_id = t.id;
"

echo ""
echo "📊 Adding unique index to mv_category_discovery..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX idx_mv_category_discovery_unique ON mv_category_discovery(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));
"

echo ""
echo "📊 Creating mv_shop_discovery..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_shop_discovery AS
SELECT 
  c.*,
  ROW_NUMBER() OVER (PARTITION BY c.tenant_id, c.featured_type ORDER BY c.featured_priority DESC, c.featured_at DESC) as shop_rank,
  COUNT(*) OVER (PARTITION BY c.tenant_id, c.featured_type) as shop_total_count
FROM mv_category_discovery c;
"

echo ""
echo "📊 Adding unique index to mv_shop_discovery..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX idx_mv_shop_discovery_unique ON mv_shop_discovery(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));
"

echo ""
echo "📊 Creating mv_trending_scores..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_trending_scores AS
SELECT 
  c.*,
  CASE 
    WHEN c.featured_type = 'trending' THEN 
      GREATEST(
        EXTRACT(EPOCH FROM (now() - c.featured_at)) / 86400 * 0.3,
        c.featured_priority * 0.01,
        CASE WHEN c.stock > 0 THEN 0.2 ELSE 0 END,
        CASE WHEN c.image_url IS NOT NULL THEN 0.1 ELSE 0 END,
        CASE WHEN (c.product_metadata->>'sale_price_cents')::numeric IS NOT NULL THEN 0.15 ELSE 0 END,
        CASE WHEN (c.product_metadata->>'average_rating')::numeric >= 4.0 THEN 0.1 ELSE 0 END,
        CASE WHEN c.view_count > 0 THEN 0.05 * LOG(c.view_count + 1) ELSE 0 END,
        CASE WHEN c.unique_viewers > 0 THEN 0.05 * LOG(c.unique_viewers + 1) ELSE 0 END,
        CASE WHEN c.conversion_count > 0 THEN 0.10 * LOG(c.conversion_count + 1) ELSE 0 END
      )
    ELSE 0
  END as enhanced_trending_score,
  CASE 
    WHEN c.view_count > 0 OR c.unique_viewers > 0 OR c.conversion_count > 0 THEN
      GREATEST(
        (c.view_count * 0.3) + (c.unique_viewers * 0.4) + (c.conversion_count * 0.8),
        1
    )
    ELSE 0
  END as engagement_score,
  CASE 
    WHEN c.average_rating > 0 AND c.review_count > 0 THEN
      GREATEST(
        c.average_rating * 0.4 + LOG(c.review_count + 1) * 0.3,
        1
      )
    ELSE 0
  END as social_proof_score
FROM mv_category_discovery c;
"

echo ""
echo "📊 Adding unique index to mv_trending_scores..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX idx_mv_trending_scores_unique ON mv_trending_scores(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));
"

echo ""
echo "📊 Creating bucket-specific MVs..."

# Trending products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_trending_products AS
SELECT 
  c.*,
  COALESCE(
    (SELECT COUNT(DISTINCT oi.order_id) 
     FROM order_items oi 
     JOIN orders o ON o.id = oi.order_id 
     WHERE oi.inventory_item_id = c.inventory_item_id 
       AND o.tenant_id = c.tenant_id
       AND o.created_at >= now() - interval '30 days'
       AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
       AND o.payment_status IN ('paid', 'partially_refunded')
    ), 0
  ) as recent_purchase_count,
  CASE WHEN c.tenant_latitude IS NOT NULL AND c.tenant_longitude IS NOT NULL THEN true ELSE false END as has_geocoding,
  (
    GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - c.created_at)) / (30 * 86400))) * 0.15 +
    LEAST(1, COALESCE(
      (SELECT COUNT(DISTINCT oi.order_id) 
       FROM order_items oi 
       JOIN orders o ON o.id = oi.order_id 
       WHERE oi.inventory_item_id = c.inventory_item_id 
         AND o.tenant_id = c.tenant_id
         AND o.created_at >= now() - interval '30 days'
         AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
         AND o.payment_status IN ('paid', 'partially_refunded')
      ), 0
    ) * 0.2) * 0.50 +
    CASE 
      WHEN c.view_count > 0 OR c.unique_viewers > 0 THEN
        LEAST(1, (c.view_count * 0.05 + c.unique_viewers * 0.15) / 100)
      ELSE 0
    END * 0.20 +
    (
      CASE WHEN c.has_image THEN 0.05 ELSE 0 END +
      CASE WHEN c.has_description THEN 0.05 ELSE 0 END +
      CASE WHEN c.in_stock THEN 0.05 ELSE 0 END
    ) * 0.15
  ) as dynamic_trending_score
FROM mv_category_discovery c
WHERE c.in_stock = true
  AND c.item_status = 'active'
  AND c.visibility = 'public'
  AND (
    EXISTS (
      SELECT 1 FROM order_items oi 
      JOIN orders o ON o.id = oi.order_id 
      WHERE oi.inventory_item_id = c.inventory_item_id 
        AND o.tenant_id = c.tenant_id
        AND o.created_at >= now() - interval '30 days'
        AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
        AND o.payment_status IN ('paid', 'partially_refunded')
    )
    OR (c.view_count > 0 OR c.unique_viewers > 0)
    OR c.created_at >= now() - interval '7 days'
  )
ORDER BY dynamic_trending_score DESC;
"

doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_trending_products_unique ON mv_trending_products(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));"

# Selection products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_selection_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type IN ('store_selection', 'staff_pick')
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_selection_products_unique ON mv_selection_products(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));"

# New products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_new_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'new_arrival' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_new_products_unique ON mv_new_products(inventory_item_id, tenant_id);"

# Sale products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_sale_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'sale' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_sale_products_unique ON mv_sale_products(inventory_item_id, tenant_id);"

# Seasonal products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_seasonal_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'seasonal' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_seasonal_products_unique ON mv_seasonal_products(inventory_item_id, tenant_id);"

# Featured products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_featured_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'featured' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_featured_products_unique ON mv_featured_products(inventory_item_id, tenant_id);"

# Staff pick products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_staff_pick_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'staff_pick' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_staff_pick_products_unique ON mv_staff_pick_products(inventory_item_id, tenant_id);"

# Clearance products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_clearance_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'clearance' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_clearance_products_unique ON mv_clearance_products(inventory_item_id, tenant_id);"

# Store selection products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_store_selection_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'store_selection' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_store_selection_products_unique ON mv_store_selection_products(inventory_item_id, tenant_id);"

# Recommended products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_recommended_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'recommended' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_recommended_products_unique ON mv_recommended_products(inventory_item_id, tenant_id);"

# Bestseller products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_bestseller_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'bestseller' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_bestseller_products_unique ON mv_bestseller_products(inventory_item_id, tenant_id);"

# Random discovery products
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_random_discovery_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'random_featured' 
  AND featured_is_active = true;
"
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "CREATE UNIQUE INDEX idx_mv_random_discovery_products_unique ON mv_random_discovery_products(inventory_item_id, tenant_id);"

echo ""
echo "📊 Refreshing all views..."
for view in mv_category_discovery mv_shop_discovery mv_trending_scores mv_trending_products mv_selection_products mv_new_products mv_sale_products mv_seasonal_products mv_featured_products mv_staff_pick_products mv_clearance_products mv_store_selection_products mv_recommended_products mv_bestseller_products mv_random_discovery_products; do
    echo "   🔄 Refreshing $view..."
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $view;" 2>/dev/null || \
    doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW $view;"
done

echo ""
echo "📊 Verifying all MVs exist..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT matviewname, (SELECT COUNT(*) FROM pg_index WHERE indrelid = (SELECT oid FROM pg_class WHERE relname = matviewname) AND indisunique = true) as unique_indexes
FROM pg_matviews 
WHERE schemaname = 'public' 
  AND matviewname LIKE 'mv_%'
ORDER BY matviewname;
"

echo ""
echo "🎯 All dependent MVs recreated!"
