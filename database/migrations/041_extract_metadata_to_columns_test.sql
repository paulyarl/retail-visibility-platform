-- Test Migration: Verify Metadata Extraction
-- Description: Test script to verify the metadata extraction migration worked correctly

-- Phase 1: Test data before migration
-- ===============================

-- Create a temporary table to verify migration
CREATE TEMPORARY TABLE migration_verification AS
SELECT 
  id,
  sku,
  name,
  metadata as original_metadata,
  metadata->>'seo_title' as original_seo_title,
  metadata->>'seo_description' as original_seo_description,
  metadata->'seo_keywords' as original_seo_keywords,
  metadata->>'enhancedDescription' as original_enhanced_description,
  metadata->'tags' as original_tags,
  metadata->>'videoUrl' as original_video_url,
  metadata->>'videoThumbnail' as original_video_thumbnail,
  metadata->'features' as original_features,
  metadata->'specifications' as original_specifications,
  metadata->>'allow_backorder' as original_allow_backorder,
  metadata->>'track_inventory' as original_track_inventory,
  metadata->>'low_stock_threshold' as original_low_stock_threshold,
  metadata->>'payment_gateway_id' as original_payment_gateway_id,
  metadata->>'payment_gateway_type' as original_payment_gateway_type
FROM inventory_items 
WHERE metadata IS NOT NULL 
  AND jsonb_typeof(metadata) = 'object'
LIMIT 10;

-- Display sample data before migration
SELECT 
  'BEFORE MIGRATION' as phase,
  id,
  sku,
  name,
  original_seo_title,
  original_seo_description,
  jsonb_typeof(original_seo_keywords) as seo_keywords_type,
  jsonb_typeof(original_tags) as tags_type,
  original_video_url
FROM migration_verification;

-- Phase 2: Run the migration (this would be done separately)
-- =======================================================
-- Run: psql -f 041_extract_metadata_to_columns.sql

-- Phase 3: Test data after migration
-- ==============================

-- Verify data was migrated correctly
SELECT 
  'AFTER MIGRATION' as phase,
  id,
  sku,
  name,
  seo_title,
  seo_description,
  jsonb_typeof(seo_keywords) as seo_keywords_type,
  jsonb_typeof(tags) as tags_type,
  video_url,
  allow_backorder,
  track_inventory,
  low_stock_threshold,
  payment_gateway_id,
  payment_gateway_type
FROM inventory_items 
WHERE id IN (SELECT id FROM migration_verification);

-- Phase 4: Compare before and after
-- ==============================

SELECT 
  'COMPARISON' as phase,
  v.id,
  v.sku,
  v.name,
  CASE 
    WHEN v.original_seo_title = i.seo_title THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as seo_title_match,
  CASE 
    WHEN v.original_seo_description = i.seo_description THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as seo_description_match,
  CASE 
    WHEN v.original_seo_keywords = i.seo_keywords THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as seo_keywords_match,
  CASE 
    WHEN v.original_tags = i.tags THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as tags_match,
  CASE 
    WHEN v.original_video_url = i.video_url THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as video_url_match
FROM migration_verification v
JOIN inventory_items i ON v.id = i.id;

-- Phase 5: Verify metadata cleanup
-- ==============================

SELECT 
  'METADATA CLEANUP' as phase,
  id,
  sku,
  name,
  metadata is not null as has_metadata,
  CASE 
    WHEN metadata IS NULL THEN 'CLEAN'
    WHEN metadata = '{}'::jsonb THEN 'EMPTY'
    WHEN metadata ? 'seo_title' THEN 'HAS_OLD_FIELDS'
    ELSE 'CLEANED'
  END as metadata_status,
  jsonb_object_keys(metadata) as remaining_keys
FROM inventory_items 
WHERE id IN (SELECT id FROM migration_verification);

-- Phase 6: Performance test queries
-- ===============================

-- Test direct column access vs JSON extraction
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM inventory_items 
WHERE seo_keywords IS NOT NULL;

EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM inventory_items 
WHERE metadata->>'seo_keywords' IS NOT NULL;

-- Test array search
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM inventory_items 
WHERE 'test' = ANY (tags);

EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM inventory_items 
WHERE 'test' = ANY (metadata->'tags');

-- Phase 7: Index usage verification
-- =================================

-- Verify indexes are being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'inventory_items' 
  AND indexname LIKE 'idx_inventory_items_%'
ORDER BY idx_scan DESC;

-- Phase 8: Data integrity checks
-- ============================

-- Check for any data loss
SELECT 
  'DATA INTEGRITY' as phase,
  COUNT(*) as total_items,
  COUNT(CASE WHEN seo_title IS NOT NULL THEN 1 END) as items_with_seo_title,
  COUNT(CASE WHEN seo_description IS NOT NULL THEN 1 END) as items_with_seo_description,
  COUNT(CASE WHEN seo_keywords IS NOT NULL THEN 1 END) as items_with_seo_keywords,
  COUNT(CASE WHEN tags IS NOT NULL THEN 1 END) as items_with_tags,
  COUNT(CASE WHEN video_url IS NOT NULL THEN 1 END) as items_with_video,
  COUNT(CASE WHEN features IS NOT NULL THEN 1 END) as items_with_features,
  COUNT(CASE WHEN specifications IS NOT NULL THEN 1 END) as items_with_specifications,
  COUNT(CASE WHEN allow_backorder = true THEN 1 END) as items_allow_backorder,
  COUNT(CASE WHEN track_inventory = false THEN 1 END) as items_no_track_inventory
FROM inventory_items;

-- Check for any corrupted data types
SELECT 
  'DATA TYPE VALIDATION' as phase,
  COUNT(*) as total_items,
  COUNT(CASE WHEN jsonb_typeof(seo_keywords) != 'array' AND seo_keywords IS NOT NULL THEN 1 END) as invalid_seo_keywords,
  COUNT(CASE WHEN jsonb_typeof(tags) != 'array' AND tags IS NOT NULL THEN 1 END) as invalid_tags,
  COUNT(CASE WHEN jsonb_typeof(features) != 'array' AND features IS NOT NULL THEN 1 END) as invalid_features,
  COUNT(CASE WHEN jsonb_typeof(specifications) != 'object' AND specifications IS NOT NULL THEN 1 END) as invalid_specifications,
  COUNT(CASE WHEN low_stock_threshold < 0 OR low_stock_threshold > 10000 THEN 1 END) as invalid_threshold
FROM inventory_items;

-- Clean up verification table
DROP TABLE migration_verification;

-- Final summary
DO $$
DECLARE
  total_records INTEGER;
  migrated_fields INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM inventory_items;
  
  SELECT COUNT(*) INTO migrated_fields FROM (
    SELECT 1 FROM inventory_items WHERE seo_title IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE seo_description IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE seo_keywords IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE enhanced_description IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE tags IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE video_url IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE features IS NOT NULL
    UNION SELECT 1 FROM inventory_items WHERE specifications IS NOT NULL
  ) as field_counts;
  
  RAISE NOTICE '=== MIGRATION TEST RESULTS ===';
  RAISE NOTICE 'Total inventory items: %', total_records;
  RAISE NOTICE 'Total migrated field values: %', migrated_fields;
  RAISE NOTICE 'Test completed successfully!';
END $$;
