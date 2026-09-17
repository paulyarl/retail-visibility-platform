-- Rollback Migration: Revert Metadata to JSON and Drop Columns
-- Description: Rollback script for 041_extract_metadata_to_columns.sql

-- Phase 1: Remove trigger
-- =====================

DROP TRIGGER IF EXISTS inventory_items_metadata_cleanup ON inventory_items;
DROP FUNCTION IF EXISTS clean_migrated_metadata();

-- Phase 2: Migrate data back to metadata
-- ======================================

-- Create a backup of current metadata with migrated fields
UPDATE inventory_items 
SET metadata = COALESCE(metadata, '{}'::jsonb') || 
  CASE 
    WHEN seo_title IS NOT NULL THEN jsonb_build_object('seo_title', seo_title) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN seo_description IS NOT NULL THEN jsonb_build_object('seo_description', seo_description) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN seo_keywords IS NOT NULL THEN jsonb_build_object('seo_keywords', seo_keywords) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN enhanced_description IS NOT NULL THEN jsonb_build_object('enhancedDescription', enhanced_description) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN tags IS NOT NULL THEN jsonb_build_object('tags', tags) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN video_url IS NOT NULL THEN jsonb_build_object('videoUrl', video_url) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN video_thumbnail IS NOT NULL THEN jsonb_build_object('videoThumbnail', video_thumbnail) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN features IS NOT NULL THEN jsonb_build_object('features', features) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN specifications IS NOT NULL THEN jsonb_build_object('specifications', specifications) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN allow_backorder IS NOT NULL THEN jsonb_build_object('allow_backorder', allow_backorder) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN track_inventory IS NOT NULL THEN jsonb_build_object('track_inventory', track_inventory) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN low_stock_threshold IS NOT NULL AND low_stock_threshold != 5 THEN jsonb_build_object('low_stock_threshold', low_stock_threshold) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN payment_gateway_id IS NOT NULL THEN jsonb_build_object('payment_gateway_id', payment_gateway_id) 
    ELSE '{}'::jsonb 
  END ||
  CASE 
    WHEN payment_gateway_type IS NOT NULL THEN jsonb_build_object('payment_gateway_type', payment_gateway_type) 
    ELSE '{}'::jsonb 
  END
WHERE (
  seo_title IS NOT NULL OR 
  seo_description IS NOT NULL OR 
  seo_keywords IS NOT NULL OR 
  enhanced_description IS NOT NULL OR 
  tags IS NOT NULL OR 
  video_url IS NOT NULL OR 
  video_thumbnail IS NOT NULL OR 
  features IS NOT NULL OR 
  specifications IS NOT NULL OR
  allow_backorder IS NOT NULL OR
  track_inventory IS NOT NULL OR
  low_stock_threshold IS NOT NULL OR
  payment_gateway_id IS NOT NULL OR
  payment_gateway_type IS NOT NULL
);

-- Phase 3: Drop indexes
-- ===================

DROP INDEX IF EXISTS idx_inventory_items_seo_keywords;
DROP INDEX IF EXISTS idx_inventory_items_tags;
DROP INDEX IF EXISTS idx_inventory_items_features;
DROP INDEX IF EXISTS idx_inventory_items_payment_gateway;
DROP INDEX IF EXISTS idx_inventory_items_seo_title;

-- Phase 4: Drop columns
-- ===================

-- SEO and content fields
ALTER TABLE inventory_items DROP COLUMN IF EXISTS seo_title;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS seo_description;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS seo_keywords;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS enhanced_description;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS tags;

-- Media fields
ALTER TABLE inventory_items DROP COLUMN IF EXISTS video_url;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS video_thumbnail;

-- Product details
ALTER TABLE inventory_items DROP COLUMN IF EXISTS features;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS specifications;

-- E-commerce configuration
ALTER TABLE inventory_items DROP COLUMN IF EXISTS allow_backorder;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS track_inventory;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS low_stock_threshold;

-- Payment configuration
ALTER TABLE inventory_items DROP COLUMN IF EXISTS payment_gateway_id;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS payment_gateway_type;

-- Phase 5: Verification
-- ===================

DO $$
DECLARE
  total_records INTEGER;
  records_with_metadata INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM inventory_items;
  SELECT COUNT(*) INTO records_with_metadata FROM inventory_items WHERE metadata IS NOT NULL;
  
  RAISE NOTICE 'Rollback Summary:';
  RAISE NOTICE 'Total inventory items: %', total_records;
  RAISE NOTICE 'Items with metadata: %', records_with_metadata;
  RAISE NOTICE 'Rollback completed successfully!';
END $$;
