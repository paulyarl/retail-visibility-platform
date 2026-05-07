-- Update directory_category_products MV to use featured_products junction table for accurate featured counts
-- This ensures the MV reflects the actual featured product data from the proper source

BEGIN;

-- Drop the old view definition
DROP MATERIALIZED VIEW IF EXISTS directory_category_products CASCADE;

-- Recreate with junction table support for accurate featured counts
CREATE MATERIALIZED VIEW directory_category_products AS
SELECT 
  -- Category information (from directory_categories_list)
  dcl.id as category_id,
  dcl.name as category_name,
  dcl.slug as category_slug,
  dcl.google_category_id,
  '' as category_icon,  -- DEFAULT: empty string since column doesn't exist
  
  -- Store information
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  t.location_status,
  dsl.city as city,  -- FIXED: city is in directory_listings_list
  dsl.state as state,  -- FIXED: state is in directory_listings_list
  
  -- Directory settings
  dsl.id as directory_listing_id,
  dsl.is_published,
  dsl.is_featured,
  dsl.rating_avg,
  dsl.rating_count,
  dsl.product_count as directory_product_count,
  
  -- Product metrics (pre-computed for instant filtering)
  COUNT(ii.id) as actual_product_count,
  COUNT(ii.id) FILTER (WHERE ii.image_url IS NOT NULL) as products_with_images,
  COUNT(ii.id) FILTER (WHERE ii.marketing_description IS NOT NULL) as products_with_descriptions,
  COUNT(ii.id) FILTER (WHERE ii.brand IS NOT NULL) as products_with_brand,
  COUNT(ii.id) FILTER (WHERE ii.price_cents > 0) as products_with_price,
  COUNT(ii.id) FILTER (WHERE ii.stock > 0 OR ii.quantity > 0) as in_stock_products,
  
  -- Featured product metrics from junction table (NEW!)
  COUNT(fp.id) as featured_products_count,
  COUNT(fp.id) FILTER (WHERE fp.is_active = true AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at > NOW())) as active_featured_products,
  COUNT(fp.id) FILTER (WHERE fp.featured_type = 'store_selection') as store_selection_count,
  COUNT(fp.id) FILTER (WHERE fp.featured_type = 'new_arrival') as new_arrival_count,
  COUNT(fp.id) FILTER (WHERE fp.featured_type = 'seasonal') as seasonal_count,
  COUNT(fp.id) FILTER (WHERE fp.featured_type = 'sale') as sale_count,
  COUNT(fp.id) FILTER (WHERE fp.featured_type = 'staff_pick') as staff_pick_count,
  
  -- Quality metrics
  CASE 
    WHEN COUNT(ii.id) = 0 THEN 0
    ELSE round(
      (
        (COUNT(ii.id) FILTER (WHERE ii.image_url IS NOT NULL) * 25) +
        (COUNT(ii.id) FILTER (WHERE ii.marketing_description IS NOT NULL) * 25) +
        (COUNT(ii.id) FILTER (WHERE ii.brand IS NOT NULL) * 20) +
        (COUNT(ii.id) FILTER (WHERE ii.price_cents > 0) * 20) +
        (COUNT(ii.id) FILTER (WHERE ii.stock > 0 OR ii.quantity > 0) * 10)
      ) * 1.0 / NULLIF(COUNT(ii.id), 0), 2
    )
  END as quality_score,
  
  -- Pricing metrics
  AVG(ii.price_cents) as avg_price_cents,
  MIN(ii.price_cents) as min_price_cents,
  MAX(ii.price_cents) as max_price_cents,
  AVG(ii.price_cents / 100.0) as avg_price_dollars,
  
  -- Featured pricing metrics (NEW!)
  AVG(ii.price_cents) FILTER (WHERE fp.is_active = true) as avg_featured_price_cents,
  MIN(ii.price_cents) FILTER (WHERE fp.is_active = true) as min_featured_price_cents,
  MAX(ii.price_cents) FILTER (WHERE fp.is_active = true) as max_featured_price_cents,
  AVG(ii.price_cents / 100.0) FILTER (WHERE fp.is_active = true) as avg_featured_price_dollars,
  
  -- Geographic data
  dsl.address,
  dsl.city as listing_city,
  dsl.state as listing_state,
  dsl.zip_code,
  dsl.latitude,
  dsl.longitude,
  
  -- Computed flags for quick filtering
  CASE 
    WHEN COUNT(ii.id) > 50 THEN 'high'
    WHEN COUNT(ii.id) > 10 THEN 'medium'
    WHEN COUNT(ii.id) > 0 THEN 'low'
    ELSE 'none'
  END as product_volume_level,
  
  CASE 
    WHEN dsl.rating_avg >= 4.5 THEN 'excellent'
    WHEN dsl.rating_avg >= 4.0 THEN 'good'
    WHEN dsl.rating_avg >= 3.5 THEN 'average'
    WHEN dsl.rating_avg >= 3.0 THEN 'fair'
    ELSE 'poor'
  END as rating_tier,
  
  CASE 
    WHEN dsl.is_featured = true THEN 'featured'
    WHEN dsl.rating_count >= 10 THEN 'popular'
    ELSE 'standard'
  END as store_tier,
  
  -- Featured store tier (NEW!)
  CASE 
    WHEN COUNT(fp.id) FILTER (WHERE fp.is_active = true) >= 5 THEN 'featured_store'
    WHEN COUNT(fp.id) FILTER (WHERE fp.is_active = true) >= 1 THEN 'has_featured'
    ELSE 'standard'
  END as featured_store_tier,
  
  -- Recent activity metrics
  COUNT(ii.id) FILTER (WHERE ii.updated_at >= NOW() - INTERVAL '7 days') as recently_updated_products,
  COUNT(ii.id) FILTER (WHERE ii.created_at >= NOW() - INTERVAL '30 days') as recently_added_products,
  
  -- Featured activity metrics (NEW!)
  COUNT(fp.id) FILTER (WHERE fp.featured_at >= NOW() - INTERVAL '7 days') as recently_featured_products,
  COUNT(fp.id) FILTER (WHERE fp.featured_expires_at >= NOW() AND fp.featured_expires_at <= NOW() + INTERVAL '7 days') as expiring_soon_products,
  
  -- Timestamps
  MAX(ii.updated_at) as last_product_updated,
  MIN(ii.created_at) as first_product_created,
  MAX(fp.featured_at) as last_featured_at,
  dsl.created_at as listing_created_at,
  dsl.updated_at as listing_updated_at,
  dcl.created_at as category_created_at,
  dcl.updated_at as category_updated_at

FROM tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN inventory_items ii ON (
  ii.tenant_id = t.id 
  AND ii.item_status = 'active'
  AND ii.visibility = 'public'
)
LEFT JOIN featured_products fp ON (
  fp.inventory_item_id = ii.id 
  AND fp.tenant_id = t.id
)
LEFT JOIN directory_categories_list dcl ON dcl.id = ii.directory_category_id  -- This links to the renamed table
WHERE t.location_status = 'active'
  AND t.directory_visible = true  -- FIXED: moved from dsl to t
  AND dsl.is_published = true
  AND dcl.id IS NOT NULL  -- Ensure we only include categories that tenants actually have
GROUP BY 
  dcl.id, dcl.name, dcl.slug, dcl.google_category_id,
  t.id, t.name, t.slug, t.subscription_tier, t.location_status, t.directory_visible, t.google_sync_enabled, dsl.city, dsl.state,
  dsl.id, dsl.is_published, dsl.is_featured, 
  dsl.rating_avg, dsl.rating_count, dsl.product_count,
  dsl.address, dsl.city, dsl.state, dsl.zip_code, dsl.latitude, dsl.longitude,
  dsl.created_at, dsl.updated_at
HAVING COUNT(ii.id) > 0 OR dsl.product_count > 0; -- Include stores with products

-- Create essential indexes
CREATE UNIQUE INDEX uq_directory_category_products_unique 
ON directory_category_products(category_id, tenant_id);

CREATE INDEX idx_directory_category_products_category 
ON directory_category_products(category_id, actual_product_count DESC, quality_score DESC);

CREATE INDEX idx_directory_category_products_featured 
ON directory_category_products(category_id, active_featured_products DESC, featured_products_count DESC);

-- Initial refresh
REFRESH MATERIALIZED VIEW directory_category_products;

COMMENT ON MATERIALIZED VIEW directory_category_products IS 'Enhanced category metrics using featured_products junction table for accurate featured product data';
COMMENT ON COLUMN directory_category_products.featured_products_count IS 'Total featured products from junction table';
COMMENT ON COLUMN directory_category_products.active_featured_products_count IS 'Currently active featured products (not expired, not paused)';

COMMIT;
