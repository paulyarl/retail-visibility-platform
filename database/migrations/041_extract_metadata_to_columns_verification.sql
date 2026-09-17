-- Verification Script: Check Migration Success
-- Description: Verify that the metadata extraction migration worked correctly

-- Check new columns exist
SELECT 
  'Column Existence Check' as verification_type,
  COUNT(CASE WHEN column_name = 'seo_title' THEN 1 END) as has_seo_title,
  COUNT(CASE WHEN column_name = 'seo_description' THEN 1 END) as has_seo_description,
  COUNT(CASE WHEN column_name = 'seo_keywords' THEN 1 END) as has_seo_keywords,
  COUNT(CASE WHEN column_name = 'enhanced_description' THEN 1 END) as has_enhanced_description,
  COUNT(CASE WHEN column_name = 'tags' THEN 1 END) as has_tags,
  COUNT(CASE WHEN column_name = 'video_url' THEN 1 END) as has_video_url,
  COUNT(CASE WHEN column_name = 'video_thumbnail' THEN 1 END) as has_video_thumbnail,
  COUNT(CASE WHEN column_name = 'features' THEN 1 END) as has_features,
  COUNT(CASE WHEN column_name = 'specifications' THEN 1 END) as has_specifications,
  COUNT(CASE WHEN column_name = 'allow_backorder' THEN 1 END) as has_allow_backorder,
  COUNT(CASE WHEN column_name = 'track_inventory' THEN 1 END) as has_track_inventory,
  COUNT(CASE WHEN column_name = 'low_stock_threshold' THEN 1 END) as has_low_stock_threshold
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
  AND table_schema = 'public';

-- Check data migration success
SELECT 
  'Data Migration Summary' as verification_type,
  COUNT(*) as total_items,
  COUNT(CASE WHEN seo_title IS NOT NULL THEN 1 END) as items_with_seo_title,
  COUNT(CASE WHEN seo_description IS NOT NULL THEN 1 END) as items_with_seo_description,
  COUNT(CASE WHEN array_length(seo_keywords, 1) > 0 THEN 1 END) as items_with_seo_keywords,
  COUNT(CASE WHEN enhanced_description IS NOT NULL THEN 1 END) as items_with_enhanced_description,
  COUNT(CASE WHEN array_length(tags, 1) > 0 THEN 1 END) as items_with_tags,
  COUNT(CASE WHEN video_url IS NOT NULL THEN 1 END) as items_with_video_url,
  COUNT(CASE WHEN array_length(features, 1) > 0 THEN 1 END) as items_with_features,
  COUNT(CASE WHEN specifications IS NOT NULL THEN 1 END) as items_with_specifications,
  COUNT(CASE WHEN allow_backorder = true THEN 1 END) as items_allow_backorder,
  COUNT(CASE WHEN track_inventory = false THEN 1 END) as items_no_track_inventory,
  COUNT(CASE WHEN low_stock_threshold != 5 THEN 1 END) as items_custom_threshold
FROM inventory_items;

-- Check indexes exist
SELECT 
  'Index Existence Check' as verification_type,
  COUNT(CASE WHEN indexname LIKE 'idx_inventory_items_seo_keywords' THEN 1 END) as has_seo_keywords_index,
  COUNT(CASE WHEN indexname LIKE 'idx_inventory_items_tags' THEN 1 END) as has_tags_index,
  COUNT(CASE WHEN indexname LIKE 'idx_inventory_items_features' THEN 1 END) as has_features_index,
  COUNT(CASE WHEN indexname LIKE 'idx_inventory_items_seo_title' THEN 1 END) as has_seo_title_index
FROM pg_indexes 
WHERE tablename = 'inventory_items';

-- Sample data verification
SELECT 
  'Sample Data Verification' as verification_type,
  id,
  sku,
  name,
  seo_title,
  seo_description,
  CASE 
    WHEN array_length(seo_keywords, 1) > 0 THEN array_to_string(seo_keywords, ', ')
    ELSE NULL
  END as seo_keywords_sample,
  CASE 
    WHEN array_length(tags, 1) > 0 THEN array_to_string(tags, ', ')
    ELSE NULL
  END as tags_sample,
  CASE 
    WHEN array_length(features, 1) > 0 THEN array_to_string(features, ', ')
    ELSE NULL
  END as features_sample,
  video_url,
  allow_backorder,
  track_inventory,
  low_stock_threshold
FROM inventory_items 
WHERE (
  seo_title IS NOT NULL OR 
  seo_description IS NOT NULL OR 
  array_length(seo_keywords, 1) > 0 OR 
  enhanced_description IS NOT NULL OR 
  array_length(tags, 1) > 0 OR 
  video_url IS NOT NULL OR 
  array_length(features, 1) > 0 OR 
  specifications IS NOT NULL
)
LIMIT 5;

-- Performance test - direct column access
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM inventory_items 
WHERE 'keyword' = ANY (tags);

-- Metadata cleanup verification
SELECT 
  'Metadata Cleanup Verification' as verification_type,
  COUNT(*) as total_items,
  COUNT(CASE WHEN metadata IS NULL THEN 1 END) as null_metadata,
  COUNT(CASE WHEN metadata = '{}'::jsonb THEN 1 END) as empty_metadata,
  COUNT(CASE WHEN metadata IS NOT NULL AND metadata != '{}'::jsonb THEN 1 END) as has_remaining_metadata,
  COUNT(CASE 
    WHEN metadata IS NOT NULL AND 
         jsonb_typeof(metadata) = 'object' AND
         (metadata ? 'seo_title' OR metadata ? 'seo_keywords' OR metadata ? 'tags')
    THEN 1 
  END) as has_old_metadata_fields
FROM inventory_items;

-- Final verification summary
SELECT 
  'Migration Status' as status_type,
  CASE 
    WHEN (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_name = 'inventory_items' AND column_name IN ('seo_title', 'seo_keywords', 'tags', 'features')
    ) = 4 THEN '✅ SUCCESS: All new columns created'
    ELSE '❌ ERROR: Missing columns'
  END as column_status,
  CASE 
    WHEN (
      SELECT COUNT(*) FROM pg_indexes 
      WHERE tablename = 'inventory_items' AND indexname LIKE 'idx_inventory_items_%'
    ) >= 3 THEN '✅ SUCCESS: Indexes created'
    ELSE '❌ ERROR: Missing indexes'
  END as index_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM inventory_items WHERE seo_title IS NOT NULL OR seo_keywords IS NOT NULL) 
    THEN '✅ SUCCESS: Data migrated'
    ELSE 'ℹ️  INFO: No data to migrate (this is OK)'
  END as data_status,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object'
      AND (metadata ? 'seo_title' OR metadata ? 'seo_keywords' OR metadata ? 'tags')
    ) THEN '✅ SUCCESS: Metadata cleaned up'
    ELSE '⚠️  WARNING: Some metadata fields not cleaned'
  END as cleanup_status;
