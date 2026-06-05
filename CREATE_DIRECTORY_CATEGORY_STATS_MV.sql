-- ============================================================================
-- MATERIALIZED VIEW: directory_category_stats
-- Aggregated statistics per category
-- ============================================================================

CREATE MATERIALIZED VIEW directory_category_stats AS
SELECT
  -- Category identity
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  pc.level as category_level,
  
  -- Store counts
  COUNT(DISTINCT dcl.tenant_id) as store_count,
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_primary = true) as primary_store_count,
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_primary = false) as secondary_store_count,
  
  -- Product metrics
  SUM(dcl.product_count) as total_products,
  AVG(dcl.product_count) as avg_products_per_store,
  
  -- Rating metrics
  AVG(dcl.rating_avg) as avg_rating,
  SUM(dcl.rating_count) as total_ratings,
  
  -- Location diversity
  COUNT(DISTINCT dcl.city || ', ' || dcl.state) as unique_locations,
  array_agg(DISTINCT dcl.city ORDER BY dcl.city) FILTER (WHERE dcl.city IS NOT NULL) as cities,
  array_agg(DISTINCT dcl.state ORDER BY dcl.state) FILTER (WHERE dcl.state IS NOT NULL) as states,
  
  -- Featured stores
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_featured = true) as featured_store_count,
  
  -- Google sync status
  COUNT(DISTINCT dcl.id) FILTER (WHERE dcl.is_google_synced = true) as synced_store_count,
  
  -- Timestamps
  MIN(dcl.created_at) as first_store_added,
  MAX(dcl.updated_at) as last_store_updated,
  NOW() as stats_generated_at

FROM platform_categories pc
LEFT JOIN directory_category_listings dcl ON dcl.category_id = pc.id
WHERE pc.is_active = true
GROUP BY 
  pc.id,
  pc.name,
  pc.slug,
  pc.google_category_id,
  pc.parent_id,
  pc.icon_emoji,
  pc.level;

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW
-- ============================================================================

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX uq_directory_category_stats_category_id
ON directory_category_stats(category_id);

-- Lookup by slug
CREATE INDEX idx_directory_category_stats_slug
ON directory_category_stats(category_slug);

-- Lookup by Google ID
CREATE INDEX idx_directory_category_stats_google_id
ON directory_category_stats(google_category_id);

-- Popular categories (by store count)
CREATE INDEX idx_directory_category_stats_store_count
ON directory_category_stats(store_count DESC);

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_directory_category_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON directory_category_stats TO PUBLIC;
