-- Storefront Category Counts Materialized View
-- Purpose: Instant category navigation for storefront (10-30x faster than real-time queries)
-- Naming: Follows snake_case_plural standard (no _mv suffix)
-- Refresh: Every 5 minutes for near real-time updates

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS storefront_category_counts CASCADE;

-- Create materialized view for storefront category counts
CREATE MATERIALIZED VIEW storefront_category_counts AS
SELECT 
  -- Tenant identification
  ii.tenant_id,
  
  -- Category information (denormalized for performance)
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  tc.sort_order as category_sort_order,
  
  -- Aggregated metrics
  COUNT(ii.id) as product_count,
  MAX(ii.updated_at) as last_product_updated,
  MIN(ii.created_at) as first_product_created,
  
  -- Additional useful fields for storefront
  COUNT(CASE WHEN ii.images IS NOT NULL AND ii.images != '[]' THEN 1 END) as products_with_images,
  COUNT(CASE WHEN ii.marketing_description IS NOT NULL AND ii.marketing_description != '' THEN 1 END) as products_with_descriptions,
  AVG(CASE WHEN ii.price_cents > 0 THEN ii.price_cents END) as avg_price_cents,
  MIN(CASE WHEN ii.price_cents > 0 THEN ii.price_cents END) as min_price_cents,
  MAX(CASE WHEN ii.price_cents > 0 THEN ii.price_cents END) as max_price_cents

FROM inventory_items ii
JOIN tenant_categories tc ON ii.tenant_category_id = tc.id
WHERE ii.item_status = 'active'  -- Only active items
  AND ii.visibility = 'public'   -- Only public items
  AND tc.is_active = true       -- Only active categories
GROUP BY ii.tenant_id, tc.id, tc.name, tc.slug, tc.google_category_id, tc.sort_order
HAVING COUNT(ii.id) > 0;        -- Only categories with products

-- Create indexes for optimal performance
CREATE INDEX idx_storefront_category_counts_tenant_id ON storefront_category_counts(tenant_id);
CREATE INDEX idx_storefront_category_counts_category_id ON storefront_category_counts(category_id);
CREATE INDEX idx_storefront_category_counts_tenant_category ON storefront_category_counts(tenant_id, category_id);
CREATE INDEX idx_storefront_category_counts_slug ON storefront_category_counts(category_slug);
CREATE INDEX idx_storefront_category_counts_product_count ON storefront_category_counts(product_count DESC);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX uq_storefront_category_counts_tenant_category ON storefront_category_counts(tenant_id, category_id);

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW storefront_category_counts IS 'Pre-computed category counts for storefront navigation. Refresh every 5 minutes for near real-time performance.';
COMMENT ON COLUMN storefront_category_counts.tenant_id IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN storefront_category_counts.category_id IS 'Primary category identifier from tenant_categories table';
COMMENT ON COLUMN storefront_category_counts.category_name IS 'Denormalized category name for instant display';
COMMENT ON COLUMN storefront_category_counts.category_slug IS 'URL-friendly category slug for navigation';
COMMENT ON COLUMN storefront_category_counts.google_category_id IS 'Google taxonomy category ID for GBP sync';
COMMENT ON COLUMN storefront_category_counts.product_count IS 'Total number of active, public products in this category';
COMMENT ON COLUMN storefront_category_counts.last_product_updated IS 'Most recent product update timestamp for cache invalidation';
COMMENT ON COLUMN storefront_category_counts.products_with_images IS 'Count of products with images for UI indicators';
COMMENT ON COLUMN storefront_category_counts.products_with_descriptions IS 'Count of products with descriptions for UI indicators';
