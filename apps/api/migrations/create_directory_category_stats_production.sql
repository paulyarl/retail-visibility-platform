-- Create directory_category_stats materialized view
-- Production-compatible version for directory category analytics

BEGIN;

-- Drop existing objects if they exist
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats CASCADE;

-- Create materialized view for directory category statistics
CREATE MATERIALIZED VIEW directory_category_stats AS
SELECT 
  -- Category information
  pc.id AS category_id,
  pc.name AS category_name,
  pc.slug AS category_slug,
  pc.google_category_id,
  pc.icon_emoji AS category_icon,
  pc.level AS category_level,
  pc.parent_id AS category_parent_id,
  
  -- Store counts
  COUNT(DISTINCT t.id) AS store_count,
  COUNT(DISTINCT CASE WHEN dcl.is_primary = true THEN t.id END) AS primary_store_count,
  COUNT(DISTINCT CASE WHEN dcl.is_primary = false THEN t.id END) AS secondary_store_count,
  
  -- Product metrics
  COALESCE(SUM(dcpl.actual_product_count), 0) AS total_products,
  COALESCE(AVG(dcpl.actual_product_count), 0) AS avg_products_per_store,
  COALESCE(SUM(dcpl.products_with_images), 0) AS products_with_images,
  COALESCE(SUM(dcpl.products_with_descriptions), 0) AS products_with_descriptions,
  COALESCE(SUM(dcpl.in_stock_products), 0) AS in_stock_products,
  
  -- Rating metrics
  COALESCE(AVG(dsl.rating_avg), 0) AS avg_rating,
  COALESCE(SUM(dsl.rating_count), 0) AS total_ratings,
  
  -- Geographic distribution
  COUNT(DISTINCT dsl.city) AS unique_locations,
  ARRAY_AGG(DISTINCT dsl.city) FILTER (WHERE dsl.city IS NOT NULL) AS cities,
  ARRAY_AGG(DISTINCT dsl.state) FILTER (WHERE dsl.state IS NOT NULL) AS states,
  
  -- Featured and synced stores
  COUNT(DISTINCT CASE WHEN dsl.is_featured = true THEN t.id END) AS featured_store_count,
  COUNT(DISTINCT CASE WHEN t.google_sync_enabled = true THEN t.id END) AS synced_store_count,
  
  -- Timestamps
  MIN(dsl.created_at) AS first_store_added,
  MAX(dsl.updated_at) AS last_store_updated,
  NOW() AS stats_generated_at

FROM platform_categories pc
LEFT JOIN directory_listing_categories dcl ON dcl.category_id = pc.id
LEFT JOIN directory_listings_list dsl ON dsl.id = dcl.listing_id AND dsl.is_published = true
LEFT JOIN tenants t ON t.id = dsl.tenant_id AND t.location_status = 'active'
LEFT JOIN directory_category_products dcpl ON dcpl.category_id = pc.id AND dcpl.tenant_id = t.id
WHERE pc.is_active = true
GROUP BY 
  pc.id, pc.name, pc.slug, pc.google_category_id, pc.icon_emoji, pc.level, pc.parent_id
HAVING COUNT(DISTINCT t.id) > 0; -- Only categories with stores

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX uq_directory_category_stats_category ON directory_category_stats(category_id);

-- Create performance indexes
CREATE INDEX idx_directory_category_stats_store_count ON directory_category_stats(store_count DESC);
CREATE INDEX idx_directory_category_stats_products ON directory_category_stats(total_products DESC);
CREATE INDEX idx_directory_category_stats_rating ON directory_category_stats(avg_rating DESC);

-- Initial refresh
REFRESH MATERIALIZED VIEW directory_category_stats;

-- Add comments
COMMENT ON MATERIALIZED VIEW directory_category_stats IS 'Directory category statistics with store counts, product metrics, and geographic distribution';
COMMENT ON COLUMN directory_category_stats.category_id IS 'Platform category identifier';
COMMENT ON COLUMN directory_category_stats.store_count IS 'Total number of stores in this category';
COMMENT ON COLUMN directory_category_stats.total_products IS 'Total number of products across all stores in this category';
COMMENT ON COLUMN directory_category_stats.avg_rating IS 'Average rating across all stores in this category';

COMMIT;
