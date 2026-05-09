#!/bin/bash

set -e
echo "🔧 ADDING product_category_name_lower TO mv_global_discovery"
echo "=========================================================="

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
echo "📊 Dropping old view..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "DROP MATERIALIZED VIEW IF EXISTS mv_global_discovery_old CASCADE;"

echo ""
echo "📊 Recreating mv_global_discovery with product_category_name_lower..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE MATERIALIZED VIEW mv_global_discovery AS
SELECT 
  ii.id as inventory_item_id,
  ii.name as product_name,
  ii.title as product_title,
  ii.description as product_description,
  ii.marketing_description,
  ii.sku,
  ii.brand,
  ii.manufacturer,
  ii.condition,
  ii.gtin,
  ii.mpn,
  ii.stock,
  ii.quantity,
  ii.availability,
  ii.item_status,
  ii.visibility,
  ii.custom_cta,
  ii.social_links,
  ii.custom_branding,
  ii.custom_sections,
  ii.landing_page_theme,
  ii.image_url,
  ii.image_gallery as image_urls,
  (ii.metadata->>'video_url')::text as video_url,
  (ii.metadata->>'gallery_urls')::jsonb as gallery_urls,
  (ii.metadata->>'thumbnail_url')::text as thumbnail_url,
  (ii.metadata->>'featured_image_url')::text as featured_image_url,
  
  -- PRODUCT SLUG DATA (from product_slug_registry)
  psr.product_slug,
  psr.universal_sku,
  psr.brand_normalized,
  psr.category_normalized,
  psr.slug_type,
  psr.slug_prefix,
  psr.original_sku,
  
  -- PLATFORM AGGREGATE METRICS
  COALESCE(
    (SELECT COUNT(DISTINCT psr2.tenant_id) 
     FROM product_slug_registry psr2 
     WHERE psr2.product_slug = psr.product_slug 
       AND psr2.is_active = true),
    1
  ) as platform_tenant_count,
  COALESCE(
    (SELECT SUM(oi.quantity) 
     FROM order_items oi 
     JOIN orders o ON o.id = oi.order_id 
     JOIN inventory_items ii2 ON ii2.id = oi.inventory_item_id 
     WHERE ii2.product_slug = psr.product_slug
       AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
       AND o.payment_status IN ('paid', 'partially_refunded')),
    0
  ) as platform_purchase_count,
  COALESCE(
    (SELECT SUM(ii2.stock) 
     FROM inventory_items ii2 
     WHERE ii2.product_slug = psr.product_slug
       AND ii2.item_status = 'active'),
    0
  ) as platform_total_stock,
  
  -- PRICING DATA
  ii.price_cents as list_price_cents,
  ii.sale_price_cents,
  COALESCE(ii.sale_price_cents, ii.price_cents) as current_price_cents,
  CASE 
    WHEN ii.sale_price_cents IS NOT NULL AND ii.sale_price_cents > 0 
    THEN (ii.sale_price_cents::numeric / 100.0)::numeric(10, 2)
    WHEN ii.price_cents > 0 
    THEN (ii.price_cents::numeric / 100.0)::numeric(10, 2)
    ELSE 0::numeric
  END as price,
  CASE 
    WHEN ii.sale_price_cents IS NOT NULL AND ii.sale_price_cents < ii.price_cents 
    THEN true 
    ELSE false 
  END as is_on_sale,
  CASE 
    WHEN ii.sale_price_cents IS NOT NULL AND ii.sale_price_cents < ii.price_cents 
    THEN ROUND(((ii.price_cents - ii.sale_price_cents)::numeric / ii.price_cents::numeric) * 100, 0)
    ELSE 0 
  END as discount_percentage,
  ii.currency,
  
  -- METADATA
  ii.metadata as product_metadata,
  (ii.metadata->>'variant_id')::text as variant_id,
  (ii.metadata->>'variant_name')::text as variant_name,
  (ii.metadata->>'variant_sku')::text as variant_sku,
  (ii.metadata->>'variant_color')::text as variant_color,
  (ii.metadata->>'variant_size')::text as variant_size,
  (ii.metadata->>'variant_material')::text as variant_material,
  (ii.metadata->>'variant_style')::text as variant_style,
  (ii.metadata->>'variant_price_cents')::numeric as variant_price_cents,
  (ii.metadata->>'variant_inventory_quantity')::numeric as variant_inventory_quantity,
  
  -- PRODUCT TYPE
  ii.product_type,
  dc.name as product_category,
  dc.slug as product_category_slug,
  dc.\"googleCategoryId\" as product_google_category_id,
  dc.\"parentId\" as product_parent_category_id,
  LOWER(dc.name) as product_category_name_lower,
  (ii.metadata->>'is_digital_product')::boolean as is_digital_product,
  (ii.metadata->>'is_physical_product')::boolean as is_physical_product,
  (ii.metadata->>'is_service')::boolean as is_service,
  (ii.metadata->>'is_variant')::boolean as is_variant,
  (ii.metadata->>'is_bundle')::boolean as is_bundle,
  (ii.metadata->>'is_customizable')::boolean as is_customizable,
  (ii.metadata->>'is_trackable')::boolean as is_trackable,
  (ii.metadata->>'is_taxable')::boolean as is_taxable,
  (ii.metadata->>'is_shipping_required')::boolean as is_shipping_required,
  
  -- FEATURED INFORMATION
  fp.featured_type,
  (SELECT jsonb_agg(DISTINCT fp2.featured_type) 
   FROM featured_products fp2 
   WHERE fp2.inventory_item_id = ii.id 
     AND fp2.tenant_id = t.id 
     AND fp2.is_active = true
  ) as featured_type_array,
  fp.featured_priority,
  fp.featured_at,
  fp.featured_expires_at as featured_until,
  fp.is_active as featured_is_active,
  case
    when fp.id is not null
    and fp.is_active = true
    and (fp.featured_expires_at is null or fp.featured_expires_at > now())
    and (fp.featured_at is null or fp.featured_at <= now())
    then true
    else false
  end as is_actively_featured,
  
  -- TENANT INFORMATION
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  (t.metadata->'gbp_categories'->'primary'->>'name') as shop_category,
  (t.metadata->'gbp_categories'->'primary'->>'id') as shop_category_id,
  (t.metadata->'gbp_categories'->'primary'->>'id') as shop_google_category_id,
  
  -- LOCATION INFORMATION
  COALESCE(tbp.city, dsl.city) as tenant_city,
  COALESCE(tbp.state, dsl.state) as tenant_state,
  tbp.country_code as tenant_country,
  tbp.postal_code as tenant_zip,
  tbp.address_line1 as tenant_address,
  COALESCE(tbp.latitude, dsl.latitude) as tenant_latitude,
  COALESCE(tbp.longitude, dsl.longitude) as tenant_longitude,
  (t.metadata->>'timezone')::text as timezone,
  tbp.logo_url as tenant_logo_url,
  
  -- BUSINESS INFORMATION
  (t.metadata->>'business_type')::text as business_type,
  (t.metadata->>'business_category')::text as business_category,
  (t.metadata->>'business_size')::text as business_size,
  (t.metadata->>'established_year')::numeric as established_year,
  
  -- SALES AND ENGAGEMENT METRICS
  COALESCE(
    (SELECT COUNT(*) FROM user_behavior_simple ubs 
     WHERE ubs.entity_type = 'product' 
       AND ubs.entity_id = ii.id 
       AND ubs.timestamp >= now() - interval '30 days'
       AND ubs.page_type = 'product_page'
    ), 0
  ) as view_count,
  COALESCE(
    (SELECT COUNT(DISTINCT ubs.user_id) FROM user_behavior_simple ubs 
     WHERE ubs.entity_type = 'product' 
       AND ubs.entity_id = ii.id 
       AND ubs.timestamp >= now() - interval '30 days'
       AND ubs.page_type = 'product_page'
       AND ubs.user_id IS NOT NULL
    ), 0
  ) as unique_viewers,
  COALESCE(
    (SELECT COUNT(*) FROM user_behavior_simple ubs 
     WHERE ubs.entity_type = 'product' 
       AND ubs.entity_id = ii.id 
       AND ubs.timestamp >= now() - interval '30 days'
       AND ubs.page_type = 'product_page'
    ), 0
  ) as engagement_count,
  COALESCE(
    (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi 
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.inventory_item_id = ii.id 
       AND o.tenant_id = t.id
       AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
       AND o.payment_status IN ('paid', 'partially_refunded')
    ), 0
  ) as conversion_count,
  COALESCE(
    (SELECT SUM(oi.subtotal_cents) FROM order_items oi 
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.inventory_item_id = ii.id 
       AND o.tenant_id = t.id
       AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
       AND o.payment_status IN ('paid', 'partially_refunded')
    ), 0
  ) as revenue_cents,
  COALESCE(
    (SELECT SUM(oi.quantity) FROM order_items oi 
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.inventory_item_id = ii.id 
       AND o.tenant_id = t.id
       AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
       AND o.payment_status IN ('paid', 'partially_refunded')
    ), 0
  ) as units_sold,
  
  -- RATINGS
  (ii.metadata->>'average_rating')::numeric as product_average_rating,
  (ii.metadata->>'review_count')::numeric as product_review_count,
  COALESCE(
    (SELECT AVG(sr.rating) 
     FROM store_reviews sr 
     WHERE sr.tenant_id = t.id AND sr.approval_status = 'approved'), 
    0
  )::numeric as store_average_rating,
  COALESCE(
    (SELECT COUNT(sr.id) 
     FROM store_reviews sr 
     WHERE sr.tenant_id = t.id AND sr.approval_status = 'approved'), 
    0
  )::numeric as store_review_count,
  COALESCE(
    (SELECT AVG(sr.rating) 
     FROM store_reviews sr 
     WHERE sr.tenant_id = t.id AND sr.approval_status = 'approved'), 
    0
  )::numeric as average_rating,
  COALESCE(
    (SELECT COUNT(sr.id) 
     FROM store_reviews sr 
     WHERE sr.tenant_id = t.id AND sr.approval_status = 'approved'), 
    0
  )::numeric as review_count,
  
  -- PRODUCT-SPECIFIC REVIEWS
  COALESCE(
    (SELECT AVG(sr.rating) 
     FROM store_reviews sr 
     WHERE sr.product_id::text = ii.id::text 
       AND sr.tenant_id = t.id 
       AND sr.approval_status = 'approved'::review_status), 
    0
  )::numeric as product_rating_live,
  COALESCE(
    (SELECT COUNT(sr.id) 
     FROM store_reviews sr 
     WHERE sr.product_id::text = ii.id::text 
       AND sr.tenant_id = t.id 
       AND sr.approval_status = 'approved'::review_status), 
    0
  )::numeric as product_reviews_count_live,
  
  (ii.metadata->>'wishlist_count')::numeric as wishlist_count,
  (ii.metadata->>'share_count')::numeric as share_count,
  
  -- COMPUTED FIELDS
  CASE 
    WHEN fp.featured_type = 'featured' THEN 1
    WHEN fp.featured_type = 'new_arrival' THEN 2
    WHEN fp.featured_type = 'staff_pick' THEN 3
    WHEN fp.featured_type = 'seasonal' THEN 4
    WHEN fp.featured_type = 'sale' THEN 5
    WHEN fp.featured_type = 'clearance' THEN 6
    WHEN fp.featured_type = 'store_selection' THEN 7
    WHEN fp.featured_type = 'trending' THEN 8
    WHEN fp.featured_type = 'recommended' THEN 9
    WHEN fp.featured_type = 'bestseller' THEN 10
    WHEN fp.featured_type = 'random_featured' THEN 11
    ELSE 12
  END as bucket_priority,
  
  GREATEST(
    CASE WHEN fp.featured_at IS NOT NULL 
      THEN GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - fp.featured_at)) / (30 * 86400))) * 0.2
      ELSE GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - ii.created_at)) / (30 * 86400))) * 0.2
    END,
    COALESCE(fp.featured_priority, 0) * 0.01,
    CASE WHEN ii.stock > 0 THEN 0.15 ELSE 0 END,
    CASE WHEN ii.image_url IS NOT NULL THEN 0.10 ELSE 0 END,
    CASE WHEN (ii.metadata->>'sale_price_cents')::numeric IS NOT NULL THEN 0.10 ELSE 0 END,
    CASE WHEN (ii.metadata->>'average_rating')::numeric >= 4.0 THEN 0.10 ELSE 0 END,
    0
  ) as trending_score,
  
  CASE 
    WHEN (ii.metadata->>'sale_price_cents')::numeric IS NOT NULL 
    AND (ii.metadata->>'sale_price_cents')::numeric < ii.price_cents THEN 'on_sale'
    WHEN (ii.metadata->>'compare_at_price_cents')::numeric IS NOT NULL 
    AND (ii.metadata->>'compare_at_price_cents')::numeric > ii.price_cents THEN 'discounted'
    ELSE 'regular'
  END as price_status,
  
  CASE 
    WHEN ii.stock <= 0 THEN 'out_of_stock'
    WHEN ii.stock <= (ii.metadata->>'low_stock_threshold')::numeric THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status,
  
  case when ii.image_url is not null then true else false end as has_image,
  case when ii.image_gallery is not null and ii.image_gallery <> '{}'::text[] then true else false end as has_gallery,
  case when ii.marketing_description is not null then true else false end as has_description,
  case when ii.brand is not null then true else false end as has_brand,
  case when ii.price_cents > 0 then true else false end as has_price,
  case when ii.stock > 0 or ii.quantity > 0 then true else false end as in_stock,
  case when exists (
    select 1 from tenant_payment_gateways tpg 
    where tpg.tenant_id = t.id and tpg.is_active = true
    and (
      tpg.gateway_type not in ('square', 'paypal')
      or exists (
        select 1 from oauth_tokens ot 
        where ot.tenant_id = tpg.tenant_id 
        and ot.gateway_type = tpg.gateway_type 
        and ot.expires_at > now() - interval '24 hours'
      )
    )
  ) then true else false end as has_active_payment_gateway,
  COALESCE(
    (select tpg.gateway_type from tenant_payment_gateways tpg where tpg.tenant_id = t.id and tpg.is_active = true and tpg.is_default = true limit 1),
    (select tpg.gateway_type from tenant_payment_gateways tpg where tpg.tenant_id = t.id and tpg.is_active = true limit 1)
  ) as default_gateway_type,
  
  ii.created_at,
  ii.updated_at,
  (ii.metadata->>'published_at')::timestamp as published_at,
  (ii.metadata->>'archived_at')::timestamp as archived_at,
  now() as mv_refreshed_at

FROM tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN tenant_business_profiles_list tbp ON tbp.tenant_id = t.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id AND dc.\"tenantId\" = t.id
LEFT JOIN product_slug_registry psr ON psr.product_slug = ii.product_slug AND psr.is_active = true
LEFT JOIN featured_products fp ON fp.inventory_item_id = ii.id 
  AND fp.tenant_id = t.id 
  AND fp.is_active = true
  AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at > now())
  AND (fp.featured_at IS NULL OR fp.featured_at <= now())
WHERE
  t.location_status = 'active'::location_status
  AND dsl.is_published = true
  AND t.directory_visible = true
  AND ii.item_status = 'active'::item_status
  AND ii.visibility = 'public'::item_visibility;
"

echo ""
echo "📊 Adding unique index..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE UNIQUE INDEX idx_mv_global_discovery_unique ON mv_global_discovery(inventory_item_id, tenant_id, COALESCE(featured_type, 'none'));
"

echo ""
echo "📊 Adding performance indexes..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
CREATE INDEX idx_mv_global_discovery_tenant_id ON mv_global_discovery(tenant_id);
CREATE INDEX idx_mv_global_discovery_featured_type ON mv_global_discovery(featured_type);
CREATE INDEX idx_mv_global_discovery_priority ON mv_global_discovery(featured_priority DESC, featured_at DESC);
CREATE INDEX idx_mv_global_discovery_product_category ON mv_global_discovery(product_category);
CREATE INDEX idx_mv_global_discovery_product_slug ON mv_global_discovery(product_slug);
CREATE INDEX idx_mv_global_discovery_category_lower ON mv_global_discovery(product_category_name_lower);
"

echo ""
echo "📊 Refreshing view..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery;" 2>/dev/null || \
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "REFRESH MATERIALIZED VIEW mv_global_discovery;"

echo ""
echo "📊 Verifying product_category_name_lower column exists..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'mv_global_discovery' 
  AND column_name = 'product_category_name_lower';
"

echo ""
echo "📊 Sample data with product_category_name_lower..."
doppler run -- psql "$PRODUCTION_DATABASE_URL" -c "
SELECT inventory_item_id, product_category, product_category_name_lower, product_slug 
FROM mv_global_discovery 
LIMIT 5;
"

echo ""
echo "🎯 mv_global_discovery updated with product_category_name_lower!"
