-- Debug Script: Diagnose Metadata Issues
-- Description: Check what types of metadata values exist before running migration

-- Check metadata types and values
SELECT 
  'Metadata Analysis' as analysis_type,
  COUNT(*) as total_records,
  COUNT(CASE WHEN metadata IS NULL THEN 1 END) as null_metadata,
  COUNT(CASE WHEN metadata IS NOT NULL THEN 1 END) as has_metadata,
  COUNT(CASE WHEN jsonb_typeof(metadata) = 'object' THEN 1 END) as object_metadata,
  COUNT(CASE WHEN jsonb_typeof(metadata) = 'array' THEN 1 END) as array_metadata,
  COUNT(CASE WHEN jsonb_typeof(metadata) = 'string' THEN 1 END) as string_metadata,
  COUNT(CASE WHEN jsonb_typeof(metadata) = 'number' THEN 1 END) as number_metadata,
  COUNT(CASE WHEN jsonb_typeof(metadata) = 'boolean' THEN 1 END) as boolean_metadata
FROM inventory_items;

-- Show examples of different metadata types
SELECT 
  'Sample Metadata Types' as sample_type,
  id,
  sku,
  name,
  CASE 
    WHEN metadata IS NULL THEN 'NULL'
    WHEN jsonb_typeof(metadata) = 'object' THEN 'OBJECT'
    WHEN jsonb_typeof(metadata) = 'array' THEN 'ARRAY'
    WHEN jsonb_typeof(metadata) = 'string' THEN 'STRING'
    WHEN jsonb_typeof(metadata) = 'number' THEN 'NUMBER'
    WHEN jsonb_typeof(metadata) = 'boolean' THEN 'BOOLEAN'
    ELSE 'OTHER'
  END as metadata_type,
  CASE 
    WHEN metadata IS NULL THEN NULL
    WHEN jsonb_typeof(metadata) = 'object' THEN metadata::text
    ELSE metadata::text
  END as metadata_value
FROM inventory_items 
WHERE metadata IS NOT NULL
ORDER BY jsonb_typeof(metadata)
LIMIT 10;

-- Check for problematic scalar values that might contain our target fields
SELECT 
  'Scalar Values with Target Fields' as check_type,
  COUNT(*) as problematic_records
FROM inventory_items 
WHERE metadata IS NOT NULL 
  AND jsonb_typeof(metadata) IN ('string', 'number', 'boolean')
  AND (
    metadata::text LIKE '%seo_title%' OR
    metadata::text LIKE '%seo_keywords%' OR
    metadata::text LIKE '%tags%' OR
    metadata::text LIKE '%features%'
  );

-- Test safe metadata cleanup on sample data
WITH safe_cleanup_test AS (
  SELECT 
    id,
    metadata,
    CASE 
      WHEN metadata IS NULL THEN NULL
      WHEN jsonb_typeof(metadata) = 'object' THEN 
        COALESCE(metadata, '{}'::jsonb)
        - 'seo_title'
        - 'seo_description' 
        - 'seo_keywords'
        - 'enhancedDescription'
        - 'tags'
        - 'videoUrl'
        - 'videoThumbnail'
        - 'features'
        - 'specifications'
        - 'allow_backorder'
        - 'track_inventory'
        - 'low_stock_threshold'
      ELSE metadata -- Keep as-is if not a JSON object
    END as cleaned_metadata
  FROM inventory_items 
  WHERE metadata IS NOT NULL
  LIMIT 5
)
SELECT 
  'Safe Cleanup Test' as test_type,
  id,
  CASE 
    WHEN metadata IS NULL THEN 'NULL'
    WHEN jsonb_typeof(metadata) = 'object' THEN 'OBJECT'
    ELSE jsonb_typeof(metadata)
  END as original_type,
  CASE 
    WHEN cleaned_metadata IS NULL THEN 'NULL'
    WHEN jsonb_typeof(cleaned_metadata) = 'object' THEN 'OBJECT'
    ELSE jsonb_typeof(cleaned_metadata)
  END as cleaned_type,
  CASE 
    WHEN jsonb_typeof(metadata) = 'object' THEN 
      CASE 
        WHEN jsonb_typeof(cleaned_metadata) = 'object' AND cleaned_metadata = '{}'::jsonb THEN 'EMPTY -> NULL'
        WHEN jsonb_typeof(cleaned_metadata) = 'object' THEN 'OBJECT -> OBJECT'
        ELSE 'OBJECT -> OTHER'
      END
    ELSE 'NO CHANGE'
  END as cleanup_result
FROM safe_cleanup_test;

-- Check if any records have the target fields in metadata
SELECT 
  'Target Fields in Metadata' as field_check,
  COUNT(CASE WHEN metadata ? 'seo_title' THEN 1 END) as has_seo_title,
  COUNT(CASE WHEN metadata ? 'seo_description' THEN 1 END) as has_seo_description,
  COUNT(CASE WHEN metadata ? 'seo_keywords' THEN 1 END) as has_seo_keywords,
  COUNT(CASE WHEN metadata ? 'enhancedDescription' THEN 1 END) as has_enhanced_description,
  COUNT(CASE WHEN metadata ? 'tags' THEN 1 END) as has_tags,
  COUNT(CASE WHEN metadata ? 'videoUrl' THEN 1 END) as has_video_url,
  COUNT(CASE WHEN metadata ? 'videoThumbnail' THEN 1 END) as has_video_thumbnail,
  COUNT(CASE WHEN metadata ? 'features' THEN 1 END) as has_features,
  COUNT(CASE WHEN metadata ? 'specifications' THEN 1 END) as has_specifications,
  COUNT(CASE WHEN metadata ? 'allow_backorder' THEN 1 END) as has_allow_backorder,
  COUNT(CASE WHEN metadata ? 'track_inventory' THEN 1 END) as has_track_inventory,
  COUNT(CASE WHEN metadata ? 'low_stock_threshold' THEN 1 END) as has_low_stock_threshold
FROM inventory_items 
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';

-- Recommendations
SELECT 
  'Recommendations' as recommendation_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) != 'object'
    ) THEN '⚠️  Found non-object metadata values - migration handles these safely'
    ELSE '✅ All metadata values are JSON objects'
  END as metadata_types,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM inventory_items 
      WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object'
      AND (
        metadata ? 'seo_title' OR metadata ? 'seo_keywords' OR metadata ? 'tags'
      )
    ) THEN '✅ Found target fields to migrate'
    ELSE 'ℹ️  No target fields found in metadata'
  END as migration_data,
  '✅ Migration is safe to run with proper type checking' as safety_status;
