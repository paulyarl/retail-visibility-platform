-- Create storefront_category_counts materialized view (production-compatible)
-- Based on the actual production MV definition

BEGIN;

-- Drop the old view definition (if it exists)
DROP MATERIALIZED VIEW IF EXISTS storefront_category_counts CASCADE;
DROP VIEW IF EXISTS storefront_category_counts_status CASCADE;

-- Create materialized view matching production definition
CREATE MATERIALIZED VIEW storefront_category_counts AS
SELECT 
  -- Store information
  ii.tenant_id,
  t.name AS tenant_name,
  
  -- Category information
  pc.id AS category_id,
  pc.name AS category_name,
  pc.slug AS category_slug,
  pc.google_category_id,
  pc.sort_order AS category_sort_order,
  pc.level AS category_level,
  pc.parent_id AS category_parent_id,
  
  -- Product counts
  count(ii.id) AS product_count,
  max(ii.updated_at) AS last_product_updated,
  min(ii.created_at) AS first_product_created,
  now() AS calculated_at,
  
  -- Quality metrics
  count(
    CASE
      WHEN ii.image_url IS NOT NULL THEN 1
      ELSE NULL::integer
    END) AS products_with_images,
  count(
    CASE
      WHEN ii.description IS NOT NULL AND ii.description <> ''::text THEN 1
      ELSE NULL::integer
    END) AS products_with_descriptions,
  count(
    CASE
      WHEN ii.brand IS NOT NULL AND ii.brand <> 'Unknown'::text THEN 1
      ELSE NULL::integer
    END) AS products_with_brand,
  count(
    CASE
      WHEN ii.price_cents > 0 THEN 1
      ELSE NULL::integer
    END) AS products_with_price,
  count(
    CASE
      WHEN ii.stock > 0 THEN 1
      ELSE NULL::integer
    END) AS in_stock_products,
  
  -- Pricing metrics
  avg(
    CASE
      WHEN ii.price_cents > 0 THEN ii.price_cents
      ELSE NULL::integer
    END) AS avg_price_cents,
  min(
    CASE
      WHEN ii.price_cents > 0 THEN ii.price_cents
      ELSE NULL::integer
    END) AS min_price_cents,
  max(
    CASE
      WHEN ii.price_cents > 0 THEN ii.price_cents
      ELSE NULL::integer
    END) AS max_price_cents

FROM inventory_items ii
JOIN tenants t ON t.id = ii.tenant_id
CROSS JOIN platform_categories pc
WHERE ii.item_status = 'active'::item_status 
  AND ii.visibility = 'public'::item_visibility 
  AND pc.is_active = true 
  AND t.location_status = 'active'::location_status
GROUP BY ii.tenant_id, t.name, pc.id, pc.name, pc.slug, pc.google_category_id, pc.sort_order, pc.level, pc.parent_id
HAVING count(ii.id) > 0;

-- Create indexes matching production
CREATE INDEX idx_storefront_category_counts_tenant_id ON public.storefront_category_counts USING btree (tenant_id);
CREATE INDEX idx_storefront_category_counts_category_id ON public.storefront_category_counts USING btree (category_id);
CREATE UNIQUE INDEX uq_storefront_category_counts_tenant_category ON public.storefront_category_counts USING btree (tenant_id, category_id);

-- Create status view for monitoring
CREATE VIEW storefront_category_counts_status AS
SELECT 
  'storefront_category_counts' as view_name,
  pg_size_pretty(pg_total_relation_size('public.storefront_category_counts')) as size,
  COUNT(*) as total_records,
  COUNT(DISTINCT tenant_id) as unique_tenants,
  COUNT(DISTINCT category_id) as unique_categories,
  SUM(product_count) as total_products,
  MAX(calculated_at) as last_calculated,
  NOW() as checked_at
FROM storefront_category_counts;

-- Initial refresh
REFRESH MATERIALIZED VIEW storefront_category_counts;

COMMENT ON MATERIALIZED VIEW storefront_category_counts IS 'Pre-computed category counts for storefront navigation. Matches production definition for consistency.';
COMMENT ON COLUMN storefront_category_counts.tenant_id IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN storefront_category_counts.category_id IS 'Platform category identifier';
COMMENT ON COLUMN storefront_category_counts.product_count IS 'Total number of active, public products in this category';

COMMIT;
