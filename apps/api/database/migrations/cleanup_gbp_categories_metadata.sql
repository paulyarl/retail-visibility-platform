-- Cleanup GBP categories from metadata after successful migration
-- IMPORTANT: Run this only after verifying the migration was successful!

-- Step 1: Create a backup of the metadata before cleanup (optional)
CREATE TABLE IF NOT EXISTS tenants_metadata_backup_gbp AS 
SELECT 
  id,
  name,
  metadata,
  NOW() as backup_timestamp
FROM public.tenants 
WHERE metadata IS NOT NULL 
  AND metadata->'gbp_categories' IS NOT NULL;

-- Step 2: Remove GBP categories from metadata for tenants where migration was successful
UPDATE public.tenants 
SET metadata = metadata - 'gbp_categories'
WHERE 
  metadata IS NOT NULL 
  AND metadata->'gbp_categories' IS NOT NULL
  AND gbp_primary_category_id IS NOT NULL
  AND gbp_primary_category_name IS NOT NULL;

-- Step 3: Verify cleanup
SELECT 
  COUNT(*) as total_tenants,
  COUNT(*) FILTER (WHERE metadata->'gbp_categories' IS NOT NULL) as tenants_with_gbp_in_metadata,
  COUNT(*) FILTER (WHERE gbp_primary_category_id IS NOT NULL) as tenants_with_gbp_columns,
  COUNT(*) FILTER (WHERE metadata->'gbp_categories' IS NOT NULL AND gbp_primary_category_id IS NULL) as problematic_tenants
FROM public.tenants;

-- Step 4: Show any problematic cases (GBP in metadata but not in columns)
SELECT 
  id,
  name,
  metadata->'gbp_categories' as gbp_in_metadata,
  gbp_primary_category_id,
  gbp_primary_category_name
FROM public.tenants 
WHERE 
  metadata->'gbp_categories' IS NOT NULL 
  AND gbp_primary_category_id IS NULL
LIMIT 5;

-- Step 5: Optional - Add trigger to prevent GBP categories in metadata going forward
CREATE OR REPLACE FUNCTION prevent_gbp_categories_in_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->'gbp_categories' IS NOT NULL THEN
    RAISE EXCEPTION 'GBP categories should be stored in dedicated columns, not metadata. Use gbp_primary_category_id, gbp_primary_category_name, gbp_secondary_categories columns instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment out the trigger creation if you don't want to enforce this yet
-- CREATE TRIGGER trigger_prevent_gbp_categories_in_metadata
--   BEFORE INSERT OR UPDATE ON public.tenants
--   FOR EACH ROW EXECUTE FUNCTION prevent_gbp_categories_in_metadata();

-- Step 6: Create a view for backward compatibility if needed
CREATE OR REPLACE VIEW tenants_with_gbp_categories AS
SELECT 
  t.*,
  jsonb_build_object(
    'primary', CASE 
      WHEN t.gbp_primary_category_id IS NOT NULL THEN
        jsonb_build_object(
          'id', t.gbp_primary_category_id,
          'name', t.gbp_primary_category_name
        )
      ELSE NULL
    END,
    'secondary', t.gbp_secondary_categories,
    'sync_status', t.gbp_categories_sync_status,
    'last_synced_at', t.gbp_categories_last_synced_at
  ) as gbp_categories_computed
FROM public.tenants t;

COMMENT ON VIEW tenants_with_gbp_categories IS 'Backward compatibility view with GBP categories reconstructed from dedicated columns';

-- Step 7: Final verification
SELECT 
  'Migration Summary' as metric,
  total_tenants,
  tenants_with_gbp_columns,
  tenants_with_gbp_in_metadata,
  problematic_tenants,
  CASE 
    WHEN problematic_tenants = 0 THEN 'SUCCESS'
    ELSE 'REVIEW NEEDED'
  END as status
FROM (
  SELECT 
    COUNT(*) as total_tenants,
    COUNT(*) FILTER (WHERE gbp_primary_category_id IS NOT NULL) as tenants_with_gbp_columns,
    COUNT(*) FILTER (WHERE metadata->>'gbp_categories' IS NOT NULL) as tenants_with_gbp_in_metadata,
    COUNT(*) FILTER (WHERE metadata->>'gbp_categories' IS NOT NULL AND gbp_primary_category_id IS NULL) as problematic_tenants
  FROM public.tenants
) summary;
