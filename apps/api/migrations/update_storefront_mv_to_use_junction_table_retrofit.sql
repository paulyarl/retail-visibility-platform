-- Update storefront_products MV to use featured_products junction table instead of legacy inventory_items fields
-- This is retrofitted from the production MV to ensure compatibility

BEGIN;

-- Drop the old view definition
DROP MATERIALIZED VIEW IF EXISTS storefront_products CASCADE;

-- Recreate with junction table support (based on production MV)
CREATE MATERIALIZED VIEW storefront_products AS
SELECT 
  -- Store information
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.subscription_tier,
  t.location_status,
  dsl.city,
  dsl.state,
  
  -- Directory settings
  dsl.id AS directory_listing_id,
  dsl.is_published,
  dsl.is_featured AS listing_is_featured,
  dsl.rating_avg,
  dsl.rating_count,
  dsl.product_count AS directory_product_count,
  
  -- Product information
  ii.id,
  ii.name,
  ii.sku,
  ii.title,
  ii.description,
  ii.marketing_description,
  CASE 
    WHEN ii.price_cents > 0 THEN (ii.price_cents::numeric / 100.0)::numeric(10,2)
    ELSE 0::numeric
  END AS price,
  ii.price_cents,
  ii.currency,
  ii.brand,
  ii.manufacturer,
  ii.condition,
  ii.gtin,
  ii.mpn,
  ii.metadata,
  ii.custom_cta,
  ii.social_links,
  ii.custom_branding,
  ii.custom_sections,
  ii.landing_page_theme,
  ii.stock,
  ii.quantity,
  ii.availability,
  ii.image_url,
  ii.image_gallery,
  ii.item_status,
  ii.visibility,
  ii.created_at,
  ii.updated_at,
  
  -- Featured product fields from junction table (NEW!)
  CASE WHEN fp.id IS NOT NULL THEN true ELSE false END as is_featured,
  fp.featured_at,
  fp.featured_expires_at as featured_until,
  fp.featured_priority,
  fp.featured_type,
  fp.is_active as featured_is_active,
  CASE 
    WHEN fp.id IS NOT NULL 
    AND fp.is_active = true
    AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at > now())
    AND (fp.featured_at IS NULL OR fp.featured_at <= now())
    THEN true
    ELSE false
  END AS is_actively_featured,
  
  -- Category information (from production MV)
  ii.directory_category_id AS category_id,
  COALESCE(dc.slug, NULL::text) AS category_slug,
  COALESCE(dc.name, array_to_string(ii.category_path, ' > '::text)) AS category_name,
  dc."googleCategoryId" AS google_category_id,
  
  -- Geographic data
  dsl.address,
  dsl.city AS listing_city,
  dsl.state AS listing_state,
  dsl.zip_code,
  dsl.latitude,
  dsl.longitude,
  
  -- Computed flags (from production MV)
  CASE 
    WHEN ii.image_url IS NOT NULL THEN true
    ELSE false
  END AS has_image,
  
  CASE 
    WHEN ii.image_gallery IS NOT NULL AND ii.image_gallery <> '{}'::text[] THEN true
    ELSE false
  END AS has_gallery,
  
  CASE 
    WHEN ii.marketing_description IS NOT NULL THEN true
    ELSE false
  END AS has_description,
  
  CASE 
    WHEN ii.brand IS NOT NULL THEN true
    ELSE false
  END AS has_brand,
  
  CASE 
    WHEN ii.price_cents > 0 THEN true
    ELSE false
  END AS has_price,
  
  CASE 
    WHEN ii.stock > 0 OR ii.quantity > 0 THEN true
    ELSE false
  END AS in_stock,
  
  -- Payment gateway fields (from production MV)
  CASE 
    WHEN (EXISTS ( SELECT 1
         FROM tenant_payment_gateways tpg
        WHERE tpg.tenant_id = t.id AND tpg.is_active = true)) THEN true
    ELSE false
  END AS has_active_payment_gateway,
  
  COALESCE(( SELECT tpg.gateway_type
         FROM tenant_payment_gateways tpg
        WHERE tpg.tenant_id = t.id AND tpg.is_active = true AND tpg.is_default = true
         LIMIT 1), ( SELECT tpg.gateway_type
         FROM tenant_payment_gateways tpg
        WHERE tpg.tenant_id = t.id AND tpg.is_active = true
         LIMIT 1)) AS default_gateway_type

FROM tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
LEFT JOIN featured_products fp ON fp.inventory_item_id = ii.id AND fp.tenant_id = t.id
LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id
WHERE t.location_status = 'active'::location_status 
  AND dsl.is_published = true 
  AND t.directory_visible = true 
  AND ii.item_status = 'active'::item_status 
  AND ii.visibility = 'public'::item_visibility;

-- Create essential indexes (from production MV + unique index for concurrent refresh)
-- Unique index (required for CONCURRENT refresh) - includes featured_type for uniqueness
CREATE UNIQUE INDEX uq_storefront_products_tenant_id ON storefront_products(tenant_id, id, featured_type);
CREATE INDEX idx_storefront_products_tenant ON public.storefront_products USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_storefront_products_featured ON public.storefront_products USING btree (is_actively_featured, featured_priority DESC, featured_at DESC);
CREATE INDEX idx_storefront_products_category ON public.storefront_products USING btree (category_id, tenant_id);
CREATE INDEX idx_storefront_products_location ON public.storefront_products USING btree (city, state, tenant_id);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW storefront_products;

COMMENT ON MATERIALIZED VIEW storefront_products IS 'Optimized product catalog using featured_products junction table for proper featuring support (retrofitted from production)';
COMMENT ON COLUMN storefront_products.featured_type IS 'Type of featured product from junction table: store_selection, new_arrival, seasonal, sale, staff_pick';
COMMENT ON COLUMN storefront_products.featured_is_active IS 'Active status from junction table for pause/resume functionality';

COMMIT;
