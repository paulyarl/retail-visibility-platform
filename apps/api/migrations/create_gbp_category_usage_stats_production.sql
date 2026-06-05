-- Create gbp_category_usage_stats materialized view and refresh function
-- Production-compatible version for GBP category usage analytics

BEGIN;

-- Drop existing objects if they exist
DROP MATERIALIZED VIEW IF EXISTS gbp_category_usage_stats CASCADE;
DROP FUNCTION IF EXISTS refresh_gbp_category_usage_stats() CASCADE;

-- Create corrected MV with proper data sources
CREATE MATERIALIZED VIEW gbp_category_usage_stats AS
SELECT 
  -- GBP category info
  gc.id as gbp_category_id,
  gc.name as gbp_category_name,
  gc.display_name as gbp_category_display_name,
  null as platform_category_id,
  null as platform_category_name,
  null as platform_category_slug,
  'direct' as mapping_confidence,
  
  -- Primary usage count (from tenant_business_profiles_list)
  count(DISTINCT 
    CASE 
      WHEN bp.gbp_category_id = gc.id THEN t.id 
      ELSE NULL 
    END
  ) AS primary_usage_count,
  
  -- Secondary usage count (from tenant metadata - extract names from JSON objects)
  count(DISTINCT 
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      ) THEN t.id 
      ELSE NULL 
    END
  ) AS secondary_usage_count,
  
  -- Total tenant count (primary + secondary)
  count(DISTINCT 
    CASE 
      WHEN (bp.gbp_category_id = gc.id) OR EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      ) THEN t.id 
      ELSE NULL 
    END
  ) AS total_tenant_count,
  
  -- Last used timestamp (from business profile last mirrored)
  max(
    CASE 
      WHEN (bp.gbp_category_id = gc.id) OR EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      ) THEN bp.gbp_category_last_mirrored
      ELSE NULL 
    END
  ) AS last_used_at,
  
  -- Directory listing count (published listings)
  count(DISTINCT 
    CASE 
      WHEN (bp.gbp_category_id = gc.id) OR EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      ) THEN dl.id 
      ELSE NULL 
    END
  ) AS directory_listing_count,
  
  -- Synced tenant count (from business profile sync status)
  count(DISTINCT 
    CASE 
      WHEN ((bp.gbp_category_id = gc.id) OR EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      )) AND (bp.gbp_category_sync_status = 'synced') THEN t.id 
      ELSE NULL 
    END
  ) AS synced_tenant_count,
  
  -- Error tenant count (from business profile sync status)
  count(DISTINCT 
    CASE 
      WHEN ((bp.gbp_category_id = gc.id) OR EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(
          COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
        ) AS sec_cat(value)
        WHERE (sec_cat.value ->> 'name'::text) = gc.name
      )) AND (bp.gbp_category_sync_status = 'error') THEN t.id 
      ELSE NULL 
    END
  ) AS error_tenant_count

FROM gbp_categories_list gc
LEFT JOIN tenants t ON t.id IS NOT NULL
LEFT JOIN tenant_business_profiles_list bp ON bp.tenant_id = t.id
LEFT JOIN directory_listings_list dl ON (dl.tenant_id = t.id AND dl.is_published = true)
WHERE gc.is_active = true
  AND (
    (bp.gbp_category_id = gc.id) OR EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(
        COALESCE(t.metadata -> 'gbp_categories' -> 'secondary', '[]'::jsonb)
      ) AS sec_cat(value)
      WHERE (sec_cat.value ->> 'name'::text) = gc.name
    )
  )
GROUP BY 
  gc.id, 
  gc.name, 
  gc.display_name;

-- Create indexes for performance
CREATE UNIQUE INDEX uq_gbp_category_usage_stats_category ON gbp_category_usage_stats(gbp_category_id);
CREATE INDEX idx_gbp_category_usage_stats_usage ON gbp_category_usage_stats(total_tenant_count DESC, primary_usage_count DESC);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_gbp_category_usage_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY gbp_category_usage_stats;
  RAISE NOTICE 'GBP category usage stats materialized view refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for application to call refresh
GRANT EXECUTE ON FUNCTION refresh_gbp_category_usage_stats() TO postgres;

-- Initial refresh
REFRESH MATERIALIZED VIEW gbp_category_usage_stats;

-- Add comment
COMMENT ON MATERIALIZED VIEW gbp_category_usage_stats IS 'GBP category usage statistics from tenant_business_profiles_list (primary) and tenant metadata (secondary)';
COMMENT ON FUNCTION refresh_gbp_category_usage_stats() IS 'Refresh GBP category usage stats materialized view. Call this after GBP category changes for immediate updates.';

COMMIT;
