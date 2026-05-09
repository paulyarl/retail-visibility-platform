-- ========================================
-- SCOPE-AWARE MATERIALIZED VIEWS
-- ========================================
-- Consumer-optimized MVs for the scope system
-- All data pre-computed and optimized for discovery

-- ========================================
-- CLEANUP (Drop existing views if they exist)
-- ========================================
DROP MATERIALIZED VIEW IF EXISTS mv_seasonal_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_sale_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_new_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_selection_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_trending_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_trending_scores CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_shop_discovery CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_category_discovery CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_global_discovery CASCADE;

-- NEW: Drop all featured type MVs for future-proofing
DROP MATERIALIZED VIEW IF EXISTS mv_featured_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_staff_pick_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_clearance_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_store_selection_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_recommended_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_bestseller_products CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_random_discovery_products CASCADE;

-- Drop the refresh function if it exists
DROP FUNCTION IF EXISTS refresh_scope_aware_mvs();

-- ========================================
-- MATERIALIZED VIEW DEFINITIONS
-- ========================================

-- 1. GLOBAL SCOPE MV (Cross-tenant discovery with RICH PRODUCT DATA - DIRECT FROM BASE TABLES)
CREATE MATERIALIZED VIEW mv_global_discovery AS
SELECT 
  -- Basic Product Information (from inventory_items)
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
  
  -- PLATFORM AGGREGATE METRICS (from product_slug_registry)
  -- How many tenants have this product
  COALESCE(
    (SELECT COUNT(DISTINCT psr2.tenant_id) 
     FROM product_slug_registry psr2 
     WHERE psr2.product_slug = psr.product_slug 
       AND psr2.is_active = true),
    1
  ) as platform_tenant_count,
  -- Total purchases across all tenants for this product
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
  -- Total stock across all tenants for this product
  COALESCE(
    (SELECT SUM(ii2.stock) 
     FROM inventory_items ii2 
     WHERE ii2.product_slug = psr.product_slug
       AND ii2.item_status = 'active'),
    0
  ) as platform_total_stock,
  -- RICH PRICING DATA (from inventory_items)
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
  
  -- VARIANT METADATA (Simple approach - API service does parsing)
  ii.metadata as product_metadata,  -- Full metadata for API service parsing
  
  -- Common variant fields (pre-extracted for filtering/sorting only)
  (ii.metadata->>'variant_id')::text as variant_id,
  (ii.metadata->>'variant_name')::text as variant_name,
  (ii.metadata->>'variant_sku')::text as variant_sku,
  (ii.metadata->>'variant_color')::text as variant_color,
  (ii.metadata->>'variant_size')::text as variant_size,
  (ii.metadata->>'variant_material')::text as variant_material,
  (ii.metadata->>'variant_style')::text as variant_style,
  (ii.metadata->>'variant_price_cents')::numeric as variant_price_cents,
  (ii.metadata->>'variant_inventory_quantity')::numeric as variant_inventory_quantity,
  
  -- PRODUCT TYPE AND CLASSIFICATION (from inventory_items and directory_category)
  ii.product_type,
  dc.name as product_category,
  dc.slug as product_category_slug,
  dc."googleCategoryId" as product_google_category_id,
  dc."parentId" as product_parent_category_id,
  (ii.metadata->>'is_digital_product')::boolean as is_digital_product,
  (ii.metadata->>'is_physical_product')::boolean as is_physical_product,
  (ii.metadata->>'is_service')::boolean as is_service,
  (ii.metadata->>'is_variant')::boolean as is_variant,
  (ii.metadata->>'is_bundle')::boolean as is_bundle,
  (ii.metadata->>'is_customizable')::boolean as is_customizable,
  (ii.metadata->>'is_trackable')::boolean as is_trackable,
  (ii.metadata->>'is_taxable')::boolean as is_taxable,
  (ii.metadata->>'is_shipping_required')::boolean as is_shipping_required,
  
  -- RICH METADATA (from inventory_items)
  (ii.metadata->>'specifications')::jsonb as specifications,
  (ii.metadata->>'attributes')::jsonb as attributes,
  (ii.metadata->>'custom_fields')::jsonb as custom_fields,
  (ii.metadata->>'search_keywords')::jsonb as search_keywords,
  (ii.metadata->>'seo_title')::text as seo_title,
  (ii.metadata->>'seo_description')::text as seo_description,
  (ii.metadata->>'seo_keywords')::jsonb as seo_keywords,
  (ii.metadata->>'tags')::jsonb as tags,
  (ii.metadata->>'weight')::numeric as weight,
  (ii.metadata->>'dimensions')::text as dimensions,
  
  -- INVENTORY AND STOCK (from inventory_items)
  ii.stock as inventory_quantity,
  (ii.metadata->>'inventory_policy')::text as inventory_policy,
  (ii.metadata->>'inventory_tracking')::boolean as inventory_tracking,
  (ii.metadata->>'inventory_quantity_tracked')::boolean as inventory_quantity_tracked,
  (ii.metadata->>'allow_backorder')::boolean as allow_backorder,
  (ii.metadata->>'backorder_quantity')::numeric as backorder_quantity,
  (ii.metadata->>'low_stock_threshold')::numeric as low_stock_threshold,
  (ii.metadata->>'requires_shipping')::boolean as requires_shipping,
  (ii.metadata->>'weight_unit')::text as weight_unit,
  (ii.metadata->>'length')::numeric as length,
  (ii.metadata->>'width')::numeric as width,
  (ii.metadata->>'height')::numeric as height,
  (ii.metadata->>'dimension_unit')::text as dimension_unit,
  
  -- FEATURED INFORMATION (from featured_products)
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
    and (
      fp.featured_expires_at is null
      or fp.featured_expires_at > now()
    )
    and (
      fp.featured_at is null
      or fp.featured_at <= now()
    )
    then true
    else false
  end as is_actively_featured,
  null as featured_metadata,  -- featured_products table doesn't have metadata column
  
  -- Product Category Search Helper (from directory_category)
  LOWER(dc.name) as product_category_name_lower,
  
  -- Category counts and validation
  jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) as gbp_secondary_category_count,
  CASE 
    WHEN (t.metadata->'gbp_categories'->'primary') IS NOT NULL THEN 1
    ELSE 0
  END + jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) as gbp_total_category_count,
  
  -- Tenant Information (from tenants)
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  (t.metadata->'gbp_categories'->'primary'->>'name') as shop_category,
  (t.metadata->'gbp_categories'->'primary'->>'id') as shop_category_id,
  (t.metadata->'gbp_categories'->'primary'->>'id') as shop_google_category_id,
  
  -- Location Information (from tenant_business_profiles_list - Phase 5C)
  COALESCE(tbp.city, dsl.city) as tenant_city,
  COALESCE(tbp.state, dsl.state) as tenant_state,
  tbp.country_code as tenant_country,
  tbp.postal_code as tenant_zip,
  tbp.address_line1 as tenant_address,
  COALESCE(tbp.latitude, dsl.latitude) as tenant_latitude,
  COALESCE(tbp.longitude, dsl.longitude) as tenant_longitude,
  (t.metadata->>'timezone')::text as timezone,
  tbp.logo_url as tenant_logo_url,
  
  -- BUSINESS INFORMATION (from tenants metadata)
  (t.metadata->>'business_type')::text as business_type,
  (t.metadata->>'business_category')::text as business_category,
  (t.metadata->>'business_size')::text as business_size,
  (t.metadata->>'established_year')::numeric as established_year,
  
  -- SALES AND ENGAGEMENT METRICS (from user_behavior_simple - last 30 days)
  COALESCE(
    (SELECT COUNT(*) FROM user_behavior_simple ubs 
     WHERE ubs.entity_type = 'product' 
       AND ubs.entity_id = ii.id 
       AND ubs.timestamp >= now() - interval '30 days'
       AND ubs.page_type = 'product_page'
    ), 0
  ) as view_count,
  
  -- Unique viewers (distinct users who viewed this product)
  COALESCE(
    (SELECT COUNT(DISTINCT ubs.user_id) FROM user_behavior_simple ubs 
     WHERE ubs.entity_type = 'product' 
       AND ubs.entity_id = ii.id 
       AND ubs.timestamp >= now() - interval '30 days'
       AND ubs.page_type = 'product_page'
       AND ubs.user_id IS NOT NULL
    ), 0
  ) as unique_viewers,
  
  -- Engagement score (views + conversions as proxy for clicks/add-to-cart)
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
  -- Product reviews/ratings (from inventory_items metadata)
  (ii.metadata->>'average_rating')::numeric as product_average_rating,
  (ii.metadata->>'review_count')::numeric as product_review_count,
  
  -- Store reviews/ratings (from store_reviews table using subqueries)
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
  
  -- Legacy fields for backward compatibility (use store reviews)
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
  
  -- NEW PRODUCT-SPECIFIC REVIEW AGGREGATIONS (live from store_reviews table)
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
  COALESCE(
    (SELECT SUM(sr.helpful_count) 
     FROM store_reviews sr 
     WHERE sr.product_id::text = ii.id::text 
       AND sr.tenant_id = t.id 
       AND sr.approval_status = 'approved'::review_status), 
    0
  )::numeric as product_helpful_count_live,
  COALESCE(
    (SELECT COUNT(sr.id) 
     FROM store_reviews sr 
     WHERE sr.product_id::text = ii.id::text 
       AND sr.tenant_id = t.id 
       AND sr.approval_status = 'approved'::review_status), 
    0
  )::numeric as product_reviews_approved_live,
  -- END NEW FIELDS
  
  (ii.metadata->>'wishlist_count')::numeric as wishlist_count,
  (ii.metadata->>'share_count')::numeric as share_count,
  
  -- Computed Fields
  CASE 
    -- Merchant-controlled types (highest priority for merchant control)
    WHEN fp.featured_type = 'featured' THEN 1        -- Premium featured
    WHEN fp.featured_type = 'new_arrival' THEN 2    -- New arrivals
    WHEN fp.featured_type = 'staff_pick' THEN 3     -- Staff picks
    WHEN fp.featured_type = 'seasonal' THEN 4       -- Seasonal specials
    WHEN fp.featured_type = 'sale' THEN 5            -- Sale items
    WHEN fp.featured_type = 'clearance' THEN 6      -- Clearance items
    WHEN fp.featured_type = 'store_selection' THEN 7 -- Directory featured
    
    -- Platform-controlled types (algorithmic)
    WHEN fp.featured_type = 'trending' THEN 8       -- Platform trending
    WHEN fp.featured_type = 'recommended' THEN 9    -- Platform recommended
    WHEN fp.featured_type = 'bestseller' THEN 10    -- Platform bestseller
    WHEN fp.featured_type = 'random_featured' THEN 11 -- Platform random discovery
    
    ELSE 12
  END as bucket_priority,
  
  -- Trending Score (computed)
  -- Trending score (based on engagement, quality signals, and recency)
  GREATEST(
    -- Recency component (newer products get higher score)
    CASE WHEN fp.featured_at IS NOT NULL 
      THEN GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - fp.featured_at)) / (30 * 86400))) * 0.2
      ELSE GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - ii.created_at)) / (30 * 86400))) * 0.2
    END,
    -- Priority component
    COALESCE(fp.featured_priority, 0) * 0.01,
    -- Quality signals
    CASE WHEN ii.stock > 0 THEN 0.15 ELSE 0 END,
    CASE WHEN ii.image_url IS NOT NULL THEN 0.10 ELSE 0 END,
    CASE WHEN (ii.metadata->>'sale_price_cents')::numeric IS NOT NULL THEN 0.10 ELSE 0 END,
    CASE WHEN (ii.metadata->>'average_rating')::numeric >= 4.0 THEN 0.10 ELSE 0 END,
    0
  ) as trending_score,
  
  -- Price Status (computed)
  CASE 
    WHEN (ii.metadata->>'sale_price_cents')::numeric IS NOT NULL 
    AND (ii.metadata->>'sale_price_cents')::numeric < ii.price_cents THEN 'on_sale'
    WHEN (ii.metadata->>'compare_at_price_cents')::numeric IS NOT NULL 
    AND (ii.metadata->>'compare_at_price_cents')::numeric > ii.price_cents THEN 'discounted'
    ELSE 'regular'
  END as price_status,
  
  -- Stock Status (computed)
  CASE 
    WHEN ii.stock <= 0 THEN 'out_of_stock'
    WHEN ii.stock <= (ii.metadata->>'low_stock_threshold')::numeric THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status,
  
  -- Additional computed flags (from storefront_products logic)
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
      -- For non-OAuth gateways (like Stripe with API keys), just check is_active
      tpg.gateway_type not in ('square', 'paypal')
      or 
      -- For OAuth gateways, verify OAuth is completed and not expired
      -- 24-hour grace period allows time for token refresh
      exists (
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
  
  -- Timestamps
  ii.created_at,
  ii.updated_at,
  (ii.metadata->>'published_at')::timestamp as published_at,
  (ii.metadata->>'archived_at')::timestamp as archived_at,
  now() as mv_refreshed_at

FROM tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN tenant_business_profiles_list tbp ON tbp.tenant_id = t.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id AND dc."tenantId" = t.id
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
  -- NOTE: No fp.is_active filter here - we want ALL products, not just featured ones
  -- Featured products will have fp.* fields populated, non-featured will have NULLs;

-- 2. CATEGORY-AWARE MV (Product + Shop Categories with RICH DATA - DIRECT FROM BASE TABLES)
CREATE MATERIALIZED VIEW mv_category_discovery AS
SELECT 
  -- ALL FIELDS FROM GLOBAL MV (inherits rich product data)
  g.*,
  
  -- Get secondary categories from tenant metadata
  t.metadata->'gbp_categories'->'secondary' as gbp_secondary_categories_array,
  
  -- Category Type Classification
  CASE 
    WHEN g.shop_category IS NOT NULL AND g.shop_category != '' 
     AND jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) > 0 THEN 'both'
    WHEN g.shop_category IS NOT NULL AND g.shop_category != '' THEN 'primary'
    WHEN jsonb_array_length(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) > 0 THEN 'secondary'
    ELSE 'none'
  END as gbp_category_type,
  
  -- GBP Category Search Fields (already available from global view)
  COALESCE(g.shop_category, '') as gbp_primary_category_name,
  COALESCE(g.shop_category_id, '') as gbp_primary_category_id,
  COALESCE(g.shop_google_category_id, '') as gbp_primary_google_category_id,
  
  -- Secondary category IDs (extract from array)
  COALESCE(
    (SELECT jsonb_agg(elem->>'id') FROM jsonb_array_elements(t.metadata->'gbp_categories'->'secondary') elem),
    '[]'::jsonb
  ) as gbp_secondary_category_ids_array,
  
  -- Category Matching Fields (for ILIKE searches)
  LOWER(COALESCE(g.shop_category, '')) as gbp_primary_category_name_lower,
  
  -- Array search support (check if any secondary category name matches common terms)
  EXISTS(
    SELECT 1 
    FROM jsonb_array_elements(COALESCE(t.metadata->'gbp_categories'->'secondary', '[]'::jsonb)) elem
    WHERE LOWER(elem->>'name') ILIKE ANY(ARRAY['%grocery%', '%market%', '%store%', '%restaurant%'])
  ) as has_matching_secondary_category

FROM mv_global_discovery g
LEFT JOIN tenants t ON g.tenant_id = t.id;

-- 3. SHOP-SPECIFIC MV (Tenant-specific discovery - DIRECT FROM BASE TABLES)
CREATE MATERIALIZED VIEW mv_shop_discovery AS
SELECT 
  -- ALL FIELDS FROM CATEGORY MV (inherits rich product data)
  c.*,
  
  -- Shop-specific fields (computed from base tables)
  ROW_NUMBER() OVER (PARTITION BY c.tenant_id, c.featured_type ORDER BY c.featured_priority DESC, c.featured_at DESC) as shop_rank,
  COUNT(*) OVER (PARTITION BY c.tenant_id, c.featured_type) as shop_total_count

FROM mv_category_discovery c;

-- 4. TRENDING SCORES MV (For signal-based ranking - DIRECT FROM BASE TABLES)
CREATE MATERIALIZED VIEW mv_trending_scores AS
SELECT 
  -- ALL FIELDS FROM CATEGORY MV (inherits rich product data)
  c.*,
  
  -- Enhanced trending signals (computed from base tables)
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
  
  -- Engagement score (computed from base tables)
  CASE 
    WHEN c.view_count > 0 OR c.unique_viewers > 0 OR c.conversion_count > 0 THEN
      GREATEST(
        (c.view_count * 0.3) + (c.unique_viewers * 0.4) + (c.conversion_count * 0.8),
        1
    )
    ELSE 0
  END as engagement_score,
  
  -- Social proof score (computed from base tables)
  CASE 
    WHEN c.average_rating > 0 AND c.review_count > 0 THEN
      GREATEST(
        c.average_rating * 0.4 + LOG(c.review_count + 1) * 0.3,
        1
      )
    ELSE 0
  END as social_proof_score

FROM mv_category_discovery c;

-- 5. BUCKET-SPECIFIC MVs (For each bucket type)

-- TRENDING: Dynamic calculation based on engagement metrics + ACTUAL PURCHASES + GEOCODING (not from featured_products)
-- Includes latitude/longitude for proximity-based discovery
CREATE MATERIALIZED VIEW mv_trending_products AS
SELECT 
  c.*,
  -- Get recent order counts (last 30 days) for purchase signal
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
  
  -- Geocoding flags for proximity queries (Phase 5C)
  CASE WHEN c.tenant_latitude IS NOT NULL 
       AND c.tenant_longitude IS NOT NULL 
       THEN true ELSE false END as has_geocoding,
  
  -- Dynamic trending score based on recency, engagement, purchases, and quality signals
  (
    -- Recency score (newer = higher, decay over 30 days)
    GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - c.created_at)) / (30 * 86400))) * 0.15 +
    
    -- Purchase score (STRONGEST SIGNAL - actual sales, harder to game)
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
    
    -- Engagement score (views and unique viewers - easier to game, lower weight)
    CASE 
      WHEN c.view_count > 0 OR c.unique_viewers > 0 THEN
        LEAST(1, (c.view_count * 0.05 + c.unique_viewers * 0.15) / 100)
      ELSE 0
    END * 0.20 +
    
    -- Quality signals (has image, has description, in stock)
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
  -- Only include products with meaningful trending activity
  AND (
    -- Has recent purchases (strongest signal)
    EXISTS (
      SELECT 1 FROM order_items oi 
      JOIN orders o ON o.id = oi.order_id 
      WHERE oi.inventory_item_id = c.inventory_item_id 
        AND o.tenant_id = c.tenant_id
        AND o.created_at >= now() - interval '30 days'
        AND o.order_status IN ('paid', 'processing', 'shipped', 'delivered')
        AND o.payment_status IN ('paid', 'partially_refunded')
    )
    -- OR has engagement activity (views or unique viewers)
    OR (c.view_count > 0 OR c.unique_viewers > 0)
    -- OR is recently added (within 7 days)
    OR c.created_at >= now() - interval '7 days'
  )
ORDER BY dynamic_trending_score DESC;

-- SELECTION: Union of store_selection and staff_pick
CREATE MATERIALIZED VIEW mv_selection_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type IN ('store_selection', 'staff_pick')
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_new_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'new_arrival' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_sale_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'sale' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_seasonal_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'seasonal' 
  AND featured_is_active = true;

-- NEW BUCKET-SPECIFIC MVs for all featured types

-- Merchant-controlled types
CREATE MATERIALIZED VIEW mv_featured_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'featured' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_staff_pick_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'staff_pick' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_clearance_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'clearance' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_store_selection_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'store_selection' 
  AND featured_is_active = true;

-- Platform-controlled types (algorithmic) - these will be populated dynamically
CREATE MATERIALIZED VIEW mv_recommended_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'recommended' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_bestseller_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'bestseller' 
  AND featured_is_active = true;

CREATE MATERIALIZED VIEW mv_random_discovery_products AS
SELECT * FROM mv_category_discovery 
WHERE featured_type = 'random_featured' 
  AND featured_is_active = true;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Unique indexes for concurrent refresh support (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
-- Include featured_type to allow products to appear once per featured type
CREATE UNIQUE INDEX idx_mv_global_discovery_unique ON mv_global_discovery(inventory_item_id, tenant_id, featured_type);
CREATE UNIQUE INDEX idx_mv_category_discovery_unique ON mv_category_discovery(inventory_item_id, tenant_id, featured_type);
CREATE UNIQUE INDEX idx_mv_shop_discovery_unique ON mv_shop_discovery(inventory_item_id, tenant_id, featured_type);
CREATE UNIQUE INDEX idx_mv_trending_scores_unique ON mv_trending_scores(inventory_item_id, tenant_id, featured_type);

-- Unique indexes for bucket-specific views
CREATE UNIQUE INDEX idx_mv_trending_products_unique ON mv_trending_products(inventory_item_id, tenant_id, featured_type);
CREATE UNIQUE INDEX idx_mv_selection_products_unique ON mv_selection_products(inventory_item_id, tenant_id, featured_type);
CREATE UNIQUE INDEX idx_mv_new_products_unique ON mv_new_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_sale_products_unique ON mv_sale_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_seasonal_products_unique ON mv_seasonal_products(inventory_item_id, tenant_id);

-- New unique indexes for all featured types
CREATE UNIQUE INDEX idx_mv_featured_products_unique ON mv_featured_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_staff_pick_products_unique ON mv_staff_pick_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_clearance_products_unique ON mv_clearance_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_store_selection_products_unique ON mv_store_selection_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_recommended_products_unique ON mv_recommended_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_bestseller_products_unique ON mv_bestseller_products(inventory_item_id, tenant_id);
CREATE UNIQUE INDEX idx_mv_random_discovery_products_unique ON mv_random_discovery_products(inventory_item_id, tenant_id);

-- Global discovery indexes
CREATE INDEX idx_mv_global_discovery_tenant_id ON mv_global_discovery(tenant_id);
CREATE INDEX idx_mv_global_discovery_featured_type ON mv_global_discovery(featured_type);
CREATE INDEX idx_mv_global_discovery_priority ON mv_global_discovery(featured_priority DESC, featured_at DESC);
CREATE INDEX idx_mv_global_discovery_product_category ON mv_global_discovery(product_category);

-- Category discovery indexes
CREATE INDEX idx_mv_category_discovery_product_category ON mv_category_discovery(product_category);
CREATE INDEX idx_mv_category_discovery_gbp_category ON mv_category_discovery(gbp_primary_category_name_lower);
CREATE INDEX idx_mv_category_discovery_category_type ON mv_category_discovery(gbp_category_type);
CREATE INDEX idx_mv_category_discovery_shop_category ON mv_category_discovery(shop_category);

-- Shop discovery indexes
CREATE INDEX idx_mv_shop_discovery_tenant_bucket ON mv_shop_discovery(tenant_id, featured_type);
CREATE INDEX idx_mv_shop_discovery_rank ON mv_shop_discovery(tenant_id, featured_type, shop_rank);

-- Trending scores indexes
CREATE INDEX idx_mv_trending_scores_score ON mv_trending_scores(trending_score DESC);
CREATE INDEX idx_mv_trending_scores_type_score ON mv_trending_scores(featured_type, trending_score DESC);

-- Bucket-specific indexes
CREATE INDEX idx_mv_trending_products_score ON mv_trending_products(dynamic_trending_score DESC);
CREATE INDEX idx_mv_selection_products_priority ON mv_selection_products(featured_priority DESC);
CREATE INDEX idx_mv_new_products_date ON mv_new_products(featured_at DESC);
CREATE INDEX idx_mv_sale_products_priority ON mv_sale_products(featured_priority DESC);
CREATE INDEX idx_mv_seasonal_products_priority ON mv_seasonal_products(featured_priority DESC);

-- New performance indexes for all featured types
CREATE INDEX idx_mv_featured_products_priority ON mv_featured_products(featured_priority DESC);
CREATE INDEX idx_mv_staff_pick_products_priority ON mv_staff_pick_products(featured_priority DESC);
CREATE INDEX idx_mv_clearance_products_priority ON mv_clearance_products(featured_priority DESC);
CREATE INDEX idx_mv_store_selection_products_priority ON mv_store_selection_products(featured_priority DESC);
CREATE INDEX idx_mv_recommended_products_priority ON mv_recommended_products(featured_priority DESC);
CREATE INDEX idx_mv_bestseller_products_priority ON mv_bestseller_products(featured_priority DESC);
CREATE INDEX idx_mv_random_discovery_products_priority ON mv_random_discovery_products(featured_priority DESC);

-- ========================================
-- INITIAL DATA POPULATION
-- ========================================

-- Refresh all materialized views to populate with initial data
REFRESH MATERIALIZED VIEW mv_global_discovery;
REFRESH MATERIALIZED VIEW mv_category_discovery;
REFRESH MATERIALIZED VIEW mv_shop_discovery;
REFRESH MATERIALIZED VIEW mv_trending_scores;

-- Refresh bucket-specific views
REFRESH MATERIALIZED VIEW mv_trending_products;
REFRESH MATERIALIZED VIEW mv_selection_products;
REFRESH MATERIALIZED VIEW mv_new_products;
REFRESH MATERIALIZED VIEW mv_sale_products;
REFRESH MATERIALIZED VIEW mv_seasonal_products;

-- Refresh new featured type MVs
REFRESH MATERIALIZED VIEW mv_featured_products;
REFRESH MATERIALIZED VIEW mv_staff_pick_products;
REFRESH MATERIALIZED VIEW mv_clearance_products;
REFRESH MATERIALIZED VIEW mv_store_selection_products;
REFRESH MATERIALIZED VIEW mv_recommended_products;
REFRESH MATERIALIZED VIEW mv_bestseller_products;
REFRESH MATERIALIZED VIEW mv_random_discovery_products;

-- ========================================
-- REFRESH FUNCTIONS
-- ========================================

-- Function to refresh all scope-aware MVs
CREATE OR REPLACE FUNCTION refresh_scope_aware_mvs()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Refreshing scope-aware materialized views...';
  
  -- Refresh base MVs first
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_discovery;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_shop_discovery;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_scores;
  
  -- Refresh bucket-specific MVs
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_selection_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_new_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sale_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_seasonal_products;
  
  -- Refresh new featured type MVs
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_featured_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_staff_pick_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clearance_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_selection_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recommended_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bestseller_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_random_discovery_products;
  
  RAISE NOTICE 'Scope-aware MVs refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- USAGE EXAMPLES
-- ========================================

-- Dynamic trending products (calculated from engagement metrics, no featured_type needed!)
SELECT * FROM mv_trending_products 
ORDER BY dynamic_trending_score DESC 
LIMIT 12;

-- Product category discovery (pre-computed!)
SELECT * FROM mv_category_discovery 
WHERE LOWER(product_category) ILIKE '%electronics%'
  AND gbp_category_type IN ('primary', 'both')
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 12;

-- Shop category discovery (pre-computed!)
SELECT * FROM mv_category_discovery 
WHERE gbp_primary_category_name_lower ILIKE '%electronics store%'
  AND gbp_category_type IN ('primary', 'secondary', 'both')
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 12;

-- Both categories discovery (pre-computed!)
SELECT * FROM mv_category_discovery 
WHERE LOWER(product_category) ILIKE '%electronics%'
  AND gbp_primary_category_name_lower ILIKE '%electronics store%'
  AND gbp_category_type = 'both'
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 12;

-- Shop-specific discovery (pre-computed!)
SELECT * FROM mv_shop_discovery 
WHERE tenant_id = 'tid-123'
  AND featured_type = 'trending'
ORDER BY shop_rank
LIMIT 12;

-- NEW USAGE EXAMPLES for all featured types

-- Merchant-controlled types
SELECT * FROM mv_featured_products 
WHERE tenant_id = 'tid-123'
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 8;

SELECT * FROM mv_staff_pick_products 
WHERE tenant_id = 'tid-123'
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 8;

SELECT * FROM mv_clearance_products 
WHERE tenant_id = 'tid-123'
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 8;

SELECT * FROM mv_store_selection_products 
WHERE tenant_id = 'tid-123'
ORDER BY featured_priority DESC, featured_at DESC 
LIMIT 8;

-- Platform-controlled types (algorithmic)
SELECT * FROM mv_recommended_products 
WHERE tenant_id = 'tid-123'
ORDER BY product_average_rating DESC, product_reviews_count_live DESC 
LIMIT 8;

SELECT * FROM mv_bestseller_products 
WHERE tenant_id = 'tid-123'
ORDER BY units_sold DESC, revenue_cents DESC 
LIMIT 8;

SELECT * FROM mv_random_discovery_products 
WHERE tenant_id = 'tid-123'
ORDER BY RANDOM()
LIMIT 8;
