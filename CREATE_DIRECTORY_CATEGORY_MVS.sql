-- ============================================================================
-- DIRECTORY CATEGORY MATERIALIZED VIEWS
-- Creates both directory_category_listings and directory_category_stats
-- ============================================================================

-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS directory_category_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS directory_category_listings CASCADE;

-- ============================================================================
-- MATERIALIZED VIEW 1: directory_category_listings
-- One row per listing per category (flattened for fast filtering)
-- ============================================================================

CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT 
  -- Listing ID (can appear multiple times, once per category)
  dl.id,
  dl.tenant_id,
  
  -- Business information
  dl.business_name,
  dl.slug,
  dl.address,
  dl.city,
  dl.state,
  dl.zip_code,
  dl.phone,
  dl.email,
  dl.website,
  
  -- Location data
  dl.latitude,
  dl.longitude,
  
  -- Category information (from normalized table)
  pc.id as category_id,
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id,
  pc.parent_id as category_parent_id,
  pc.icon_emoji as category_icon,
  dlc.is_primary,
  
  -- Metrics
  dl.logo_url,
  dl.description,
  dl.rating_avg,
  dl.rating_count,
  dl.product_count,
  dl.is_featured,
  dl.subscription_tier,
  dl.use_custom_website,
  
  -- Timestamps
  dl.created_at,
  dl.updated_at,
  
  -- Computed flags (for fast filtering)
  EXISTS(SELECT 1 FROM tenants WHERE id = dl.tenant_id) as tenant_exists,
  t.location_status = 'active' as is_active_location,
  t.directory_visible as is_directory_visible,
  t.google_sync_enabled as is_google_synced

FROM directory_listings_list dl
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
INNER JOIN tenants t ON t.id = dl.tenant_id
WHERE dl.is_published = true
  AND pc.is_active = true;

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW 1
-- ============================================================================

-- Primary index: Category ID lookup (most common query)
CREATE INDEX idx_directory_category_listings_category_id 
ON directory_category_listings(category_id);

-- Google taxonomy ID lookup
CREATE INDEX idx_directory_category_listings_google_id 
ON directory_category_listings(google_category_id);

-- Category slug lookup (for SEO URLs)
CREATE INDEX idx_directory_category_listings_category_slug 
ON directory_category_listings(category_slug);

-- Composite index: Category + location filtering
CREATE INDEX idx_directory_category_listings_category_location 
ON directory_category_listings(category_id, city, state);

-- Primary categories only
CREATE INDEX idx_directory_category_listings_primary 
ON directory_category_listings(category_id, is_primary) 
WHERE is_primary = true;

-- Featured listings per category
CREATE INDEX idx_directory_category_listings_featured 
ON directory_category_listings(is_featured, category_id) 
WHERE is_featured = true;

-- Sorting indexes
CREATE INDEX idx_directory_category_listings_rating 
ON directory_category_listings(category_id, rating_avg DESC NULLS LAST, rating_count DESC);

CREATE INDEX idx_directory_category_listings_products 
ON directory_category_listings(category_id, product_count DESC NULLS LAST);

CREATE INDEX idx_directory_category_listings_newest 
ON directory_category_listings(category_id, created_at DESC);

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX uq_directory_category_listings_id_category
ON directory_category_listings(id, category_id);

-- ============================================================================
-- MATERIALIZED VIEW 2: directory_category_stats
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
-- INDEXES FOR MATERIALIZED VIEW 2
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
-- REFRESH FUNCTIONS
-- ============================================================================

-- Function to refresh directory_category_listings
CREATE OR REPLACE FUNCTION refresh_directory_category_listings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh directory_category_stats
CREATE OR REPLACE FUNCTION refresh_directory_category_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh both views in order
CREATE OR REPLACE FUNCTION refresh_directory_category_views()
RETURNS void AS $$
BEGIN
  -- Refresh listings first (stats depends on it)
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings;
  -- Then refresh stats
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON directory_category_listings TO PUBLIC;
GRANT SELECT ON directory_category_stats TO PUBLIC;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if views were created successfully
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews
WHERE matviewname IN ('directory_category_listings', 'directory_category_stats')
ORDER BY matviewname;

-- Show row counts
SELECT 
  'directory_category_listings' as view_name,
  COUNT(*) as row_count
FROM directory_category_listings
UNION ALL
SELECT 
  'directory_category_stats' as view_name,
  COUNT(*) as row_count
FROM directory_category_stats;
