-- Update storefront_products MV to use featured_products junction table instead of legacy inventory_items fields
-- This migrates the MV to use the proper data structure for featured products

BEGIN;

-- Drop the old view definition
DROP MATERIALIZED VIEW IF EXISTS storefront_products CASCADE;

-- Recreate with junction table support
CREATE MATERIALIZED VIEW storefront_products AS
SELECT 
  -- Store information
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_tier,
  t.location_status,
  dsl.city as city,
  dsl.state as state,
  
  -- Directory settings
  dsl.id as directory_listing_id,
  dsl.is_published,
  dsl.is_featured as listing_is_featured,
  dsl.rating_avg,
  dsl.rating_count,
  dsl.product_count as directory_product_count,
  
  -- Product information
  ii.id as id,
  ii.name as name,
  ii.sku,
  ii.title,
  ii.description,
  ii.marketing_description,
  CASE 
    WHEN ii.price_cents > 0 THEN (ii.price_cents / 100.0)::numeric(10,2)
    ELSE 0
  END as price,
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
    AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at > NOW())
    AND (fp.featured_at IS NULL OR fp.featured_at <= NOW())
    THEN true
    ELSE false
  END as is_actively_featured,
  
  -- Category information (simplified with proper field names)
  ii.directory_category_id as category_id,
  COALESCE(pc.slug, NULL) as category_slug,
  COALESCE(pc.name, array_to_string(ii.category_path, ' > ')) as category_name,
  pc.id as google_category_id,
  
  -- Geographic data
  dsl.address,
  dsl.city as listing_city,
  dsl.state as listing_state,
  dsl.zip_code,
  dsl.latitude,
  dsl.longitude,
  
  -- Computed flags
  CASE 
    WHEN ii.image_url IS NOT NULL THEN true
    ELSE false
  END as has_image,
  
  CASE 
    WHEN ii.image_gallery IS NOT NULL AND ii.image_gallery != '{}' THEN true
    ELSE false
  END as has_gallery,
  
  CASE 
    WHEN ii.marketing_description IS NOT NULL THEN true
    ELSE false
  END as has_description,
  
  CASE 
    WHEN ii.brand IS NOT NULL THEN true
    ELSE false
  END as has_brand,
  
  CASE 
    WHEN ii.price_cents > 0 THEN true
    ELSE false
  END as has_price,
  
  CASE 
    WHEN (ii.stock > 0 OR ii.quantity > 0) THEN true
    ELSE false
  END as in_stock,
  
  -- Payment gateway fields
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM tenant_payment_gateways tpg 
      WHERE tpg.tenant_id = t.id 
      AND tpg.is_active = true
    ) THEN true
    ELSE false
  END as has_active_payment_gateway,
  
  COALESCE(
    (SELECT gateway_type FROM tenant_payment_gateways tpg 
     WHERE tpg.tenant_id = t.id 
     AND tpg.is_active = true 
     AND tpg.is_default = true 
     LIMIT 1),
    (SELECT gateway_type FROM tenant_payment_gateways tpg 
     WHERE tpg.tenant_id = t.id 
     AND tpg.is_active = true 
     LIMIT 1)
  ) as default_gateway_type

FROM tenants t
LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = t.id
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
LEFT JOIN featured_products fp ON fp.inventory_item_id = ii.id AND fp.tenant_id = t.id
LEFT JOIN platform_categories pc ON pc.id = ii.directory_category_id
WHERE t.location_status = 'active'
  AND dsl.is_published = true
  AND t.directory_visible = true
  AND ii.item_status = 'active'
  AND ii.visibility = 'public';

-- Create essential indexes
-- Unique index (required for CONCURRENT refresh) - includes featured_type for uniqueness
CREATE UNIQUE INDEX uq_storefront_products_tenant_id ON storefront_products(tenant_id, id, featured_type);
CREATE INDEX idx_storefront_products_tenant_featured ON storefront_products(tenant_id, is_actively_featured, featured_priority DESC, featured_at DESC);
CREATE INDEX idx_storefront_products_featured_type ON storefront_products(tenant_id, featured_type, is_actively_featured, featured_priority DESC);
CREATE INDEX idx_storefront_products_category ON storefront_products(directory_category_id, is_actively_featured);
CREATE INDEX idx_storefront_products_search ON storefront_products(tenant_id, is_actively_featured, name, sku);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW storefront_products;

COMMENT ON MATERIALIZED VIEW storefront_products IS 'Optimized product catalog using featured_products junction table for proper featuring support';
COMMENT ON COLUMN storefront_products.featured_type IS 'Type of featured product from junction table: store_selection, new_arrival, seasonal, sale, staff_pick';
COMMENT ON COLUMN storefront_products.featured_is_active IS 'Active status from junction table for pause/resume functionality';

COMMIT;
