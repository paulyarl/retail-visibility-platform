-- Create materialized view for directory category stores
-- This pre-computes store-category associations for fast directory queries
-- Only includes verified stores (syncing with Google within last 24 hours)

CREATE MATERIALIZED VIEW IF NOT EXISTS directory_category_stores AS
SELECT 
  t.id as tenant_id,
  t.name as store_name,
  t.slug as store_slug,
  bp.latitude,
  bp.longitude,
  bp.city,
  bp.state,
  bp.postal_code as zip_code,
  bp.address_line1 as address,
  tc.id as category_id,
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id,
  COUNT(ii.id) as product_count,
  MAX(ii.updated_at) as last_product_update,
  t.google_last_sync,
  t.google_sync_enabled,
  t.directory_visible
FROM "Tenant" t
INNER JOIN "TenantBusinessProfile" bp ON bp.tenant_id = t.id
INNER JOIN "InventoryItem" ii ON ii.tenant_id = t.id
INNER JOIN "TenantCategory" tc ON ii.tenant_category_id = tc.id
WHERE 
  t.google_sync_enabled = true
  AND t.google_last_sync > NOW() - INTERVAL '24 hours'
  AND t.directory_visible = true
  AND t.location_status = 'active'
  AND ii.item_status = 'active'
  AND ii.visibility = 'public'
  AND tc.is_active = true
GROUP BY 
  t.id,
  t.name,
  t.slug,
  bp.latitude,
  bp.longitude,
  bp.city,
  bp.state,
  bp.postal_code,
  bp.address_line1,
  tc.id,
  tc.name,
  tc.slug,
  tc.google_category_id,
  t.google_last_sync,
  t.google_sync_enabled,
  t.directory_visible;

-- Create indexes on the materialized view for fast lookups
CREATE INDEX IF NOT EXISTS idx_directory_category_stores_category 
  ON directory_category_stores(category_id);

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_tenant 
  ON directory_category_stores(tenant_id);

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_location 
  ON directory_category_stores(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_directory_category_stores_slug 
  ON directory_category_stores(category_slug);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_directory_category_stores()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stores;
END;
$$ LANGUAGE plpgsql;

-- Comment on the view
COMMENT ON MATERIALIZED VIEW directory_category_stores IS 
  'Pre-computed store-category associations for directory. 
   Only includes verified stores (syncing with Google within 24 hours).
   Refresh every 15 minutes via cron or manually.';

-- Note: To set up automatic refresh, use pg_cron or external scheduler:
-- SELECT cron.schedule('refresh-directory-categories', '*/15 * * * *', 'SELECT refresh_directory_category_stores()');
