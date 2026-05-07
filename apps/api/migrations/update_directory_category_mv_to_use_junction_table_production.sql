-- Update directory_category_products MV to use featured_products junction table for accurate featured counts
-- This is retrofitted from the actual production MV to ensure compatibility

BEGIN;

-- Drop the old view definition
DROP MATERIALIZED VIEW IF EXISTS directory_category_products CASCADE;

-- Recreate with junction table support (based on production MV)
CREATE MATERIALIZED VIEW directory_category_products AS
SELECT 
  -- Category information (from production MV)
  pc.id AS category_id,
  pc.name AS category_name,
  pc.slug AS category_slug,
  pc.google_category_id,
  pc.icon_emoji AS category_icon,
  pc.level AS category_level,
  pc.parent_id AS category_parent_id,
  
  -- Store information (from production MV)
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.subscription_tier,
  t.location_status,
  dsl.id AS directory_listing_id,
  dsl.is_published,
  dsl.is_featured AS store_is_featured,
  dcl.is_primary,
  dsl.is_published AS directory_visible,
  false AS google_sync_enabled,
  dsl.rating_avg,
  dsl.rating_count,
  dsl.product_count AS directory_product_count,
  
  -- Product metrics (from production MV)
  count(ii.id) AS actual_product_count,
  count(ii.id) FILTER (WHERE ii.image_url IS NOT NULL) AS products_with_images,
  count(ii.id) FILTER (WHERE ii.marketing_description IS NOT NULL) AS products_with_descriptions,
  count(ii.id) FILTER (WHERE ii.brand IS NOT NULL) AS products_with_brand,
  count(ii.id) FILTER (WHERE ii.price_cents > 0) AS products_with_price,
  count(ii.id) FILTER (WHERE ii.stock > 0 OR ii.quantity > 0) AS in_stock_products,
  
  -- Featured product metrics from junction table (NEW!)
  count(fp.id) AS featured_product_count,
  count(fp.id) FILTER (WHERE fp.is_active = true AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at >= now())) AS active_featured_count,
  count(fp.id) FILTER (WHERE fp.featured_type = 'store_selection') AS store_selection_count,
  count(fp.id) FILTER (WHERE fp.featured_type = 'new_arrival') AS new_arrival_count,
  count(fp.id) FILTER (WHERE fp.featured_type = 'seasonal') AS seasonal_count,
  count(fp.id) FILTER (WHERE fp.featured_type = 'sale') AS sale_count,
  count(fp.id) FILTER (WHERE fp.featured_type = 'staff_pick') AS staff_pick_count,
  
  -- Quality metrics (from production MV with featured bonus)
  CASE 
    WHEN count(ii.id) = 0 THEN 0::numeric
    ELSE ((count(ii.id) FILTER (WHERE ii.image_url IS NOT NULL) * 20 + 
           count(ii.id) FILTER (WHERE ii.marketing_description IS NOT NULL) * 20 + 
           count(ii.id) FILTER (WHERE ii.brand IS NOT NULL) * 15 + 
           count(ii.id) FILTER (WHERE ii.price_cents > 0) * 15 + 
           count(ii.id) FILTER (WHERE ii.stock > 0 OR ii.quantity > 0) * 5) / count(ii.id))::numeric + 
           count(fp.id)::numeric * 25.0 / count(ii.id)::numeric
  END AS quality_score,
  
  -- Pricing metrics (from production MV)
  avg(ii.price_cents) AS avg_price_cents,
  min(ii.price_cents) AS min_price_cents,
  max(ii.price_cents) AS max_price_cents,
  avg(ii.price_cents::numeric / 100.0) AS avg_price_dollars,
  
  -- Featured pricing metrics (NEW!)
  avg(ii.price_cents) FILTER (WHERE fp.is_active = true) AS avg_featured_price_cents,
  min(ii.price_cents) FILTER (WHERE fp.is_active = true) AS min_featured_price_cents,
  max(ii.price_cents) FILTER (WHERE fp.is_active = true) AS max_featured_price_cents,
  avg(ii.price_cents::numeric / 100.0) FILTER (WHERE fp.is_active = true) AS avg_featured_price_dollars,
  
  -- Geographic data (from production MV)
  dsl.address,
  dsl.city AS listing_city,
  dsl.state AS listing_state,
  dsl.zip_code,
  dsl.latitude,
  dsl.longitude,
  
  -- Computed flags (from production MV)
  CASE 
    WHEN count(ii.id) > 50 THEN 'high'::text
    WHEN count(ii.id) > 10 THEN 'medium'::text
    WHEN count(ii.id) > 0 THEN 'low'::text
    ELSE 'none'::text
  END AS product_volume_level,
  
  CASE 
    WHEN dsl.rating_avg >= 4.5::double precision THEN 'excellent'::text
    WHEN dsl.rating_avg >= 4.0::double precision THEN 'good'::text
    WHEN dsl.rating_avg >= 3.5::double precision THEN 'average'::text
    WHEN dsl.rating_avg >= 3.0::double precision THEN 'fair'::text
    ELSE 'poor'::text
  END AS rating_tier,
  
  CASE 
    WHEN dsl.is_featured = true THEN 'featured'::text
    WHEN dcl.is_primary = true THEN 'primary'::text
    WHEN dsl.rating_count >= 10 THEN 'popular'::text
    ELSE 'standard'::text
  END AS listing_tier,
  
  -- Featured store tier (NEW!)
  CASE 
    WHEN count(fp.id) FILTER (WHERE fp.is_active = true) >= 5 THEN 'featured_store'::text
    WHEN count(fp.id) FILTER (WHERE fp.is_active = true) >= 1 THEN 'has_featured'::text
    ELSE 'standard'::text
  END AS featured_store_tier,
  
  -- Timestamps (from production MV)
  t.created_at AS tenant_created_at,
  dsl.created_at AS listing_created_at,
  dsl.updated_at AS listing_updated_at,
  max(fp.featured_at) AS last_featured_at

FROM platform_categories pc
CROSS JOIN tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN directory_listing_categories dcl ON dcl.listing_id = dsl.id AND dcl.category_id = pc.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id 
  AND ii.item_status = 'active'::item_status 
  AND ii.visibility = 'public'::item_visibility 
  AND (ii.directory_category_id = pc.id OR ii.directory_category_id IS NULL AND pc.slug = 'uncategorized'::text)
LEFT JOIN featured_products fp ON fp.inventory_item_id = ii.id AND fp.tenant_id = t.id
WHERE dsl.is_published = true 
  AND t.location_status = 'active'::location_status
GROUP BY pc.id, pc.name, pc.slug, pc.google_category_id, pc.icon_emoji, pc.level, pc.parent_id, 
         t.id, t.name, t.slug, t.subscription_tier, t.location_status, t.created_at, 
         dsl.id, dsl.is_published, dsl.is_featured, dsl.rating_avg, dsl.rating_count, dsl.product_count, 
         dsl.address, dsl.city, dsl.state, dsl.zip_code, dsl.latitude, dsl.longitude, 
         dsl.created_at, dsl.updated_at, dcl.is_primary;

-- Create essential indexes (from production MV + new featured indexes)
CREATE UNIQUE INDEX uq_directory_category_products_id ON public.directory_category_products USING btree (directory_listing_id, category_id);
CREATE INDEX idx_directory_category_products_category ON public.directory_category_products USING btree (category_slug, quality_score DESC);
CREATE INDEX idx_directory_category_products_tenant ON public.directory_category_products USING btree (tenant_id);
CREATE INDEX idx_directory_category_products_featured ON public.directory_category_products USING btree (category_slug, active_featured_count DESC) WHERE (active_featured_count > 0);
CREATE INDEX idx_directory_category_products_quality ON public.directory_category_products USING btree (category_slug, quality_score DESC, rating_avg DESC);
CREATE INDEX idx_directory_category_products_geo ON public.directory_category_products USING btree (category_slug, latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));

-- Initial refresh
REFRESH MATERIALIZED VIEW directory_category_products;

COMMENT ON MATERIALIZED VIEW directory_category_products IS 'Enhanced category metrics using featured_products junction table for accurate featured product data (retrofitted from production)';
COMMENT ON COLUMN directory_category_products.featured_product_count IS 'Total featured products from junction table';
COMMENT ON COLUMN directory_category_products.active_featured_count IS 'Currently active featured products (not expired, not paused)';
COMMENT ON COLUMN directory_category_products.featured_store_tier IS 'Store tier based on featured product activity';

COMMIT;
