-- Migration: Extract Key Metadata Fields to Proper Columns
-- Description: Move frequently accessed metadata fields to dedicated columns for better performance and type safety

-- Phase 1: Add new columns to inventory_items table
-- ================================================

-- SEO and content fields
DO $$
BEGIN
  -- Add SEO and content fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'seo_title') THEN
    ALTER TABLE inventory_items ADD COLUMN seo_title TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'seo_description') THEN
    ALTER TABLE inventory_items ADD COLUMN seo_description TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'seo_keywords') THEN
    ALTER TABLE inventory_items ADD COLUMN seo_keywords TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'enhanced_description') THEN
    ALTER TABLE inventory_items ADD COLUMN enhanced_description TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'tags') THEN
    ALTER TABLE inventory_items ADD COLUMN tags TEXT[];
  END IF;
  
  -- Add media fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'video_url') THEN
    ALTER TABLE inventory_items ADD COLUMN video_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'video_thumbnail') THEN
    ALTER TABLE inventory_items ADD COLUMN video_thumbnail TEXT;
  END IF;
  
  -- Add product details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'features') THEN
    ALTER TABLE inventory_items ADD COLUMN features TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'specifications') THEN
    ALTER TABLE inventory_items ADD COLUMN specifications JSONB;
  END IF;
  
  -- Add e-commerce configuration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'allow_backorder') THEN
    ALTER TABLE inventory_items ADD COLUMN allow_backorder BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'track_inventory') THEN
    ALTER TABLE inventory_items ADD COLUMN track_inventory BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_items' AND column_name = 'low_stock_threshold') THEN
    ALTER TABLE inventory_items ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
  END IF;
  
  -- Note: payment_gateway_id and payment_gateway_type already exist, so we skip them
END $$;

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_inventory_items_seo_keywords ON inventory_items USING GIN (seo_keywords);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tags ON inventory_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_inventory_items_features ON inventory_items USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_inventory_items_payment_gateway ON inventory_items (payment_gateway_id, payment_gateway_type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_seo_title ON inventory_items (seo_title) WHERE seo_title IS NOT NULL;

-- Phase 2: Migrate data from metadata to new columns
-- =================================================

-- SEO and content fields
UPDATE inventory_items 
SET 
  seo_title = CASE 
    WHEN metadata ? 'seo_title' THEN metadata->>'seo_title' 
    ELSE NULL 
  END,
  seo_description = CASE 
    WHEN metadata ? 'seo_description' THEN metadata->>'seo_description' 
    ELSE NULL 
  END,
  seo_keywords = CASE 
    WHEN metadata ? 'seo_keywords' THEN 
      CASE 
        WHEN jsonb_typeof(metadata->'seo_keywords') = 'array' THEN 
          ARRAY(SELECT jsonb_array_elements_text(metadata->'seo_keywords'))
        ELSE NULL 
      END
    ELSE NULL 
  END,
  enhanced_description = CASE 
    WHEN metadata ? 'enhancedDescription' THEN metadata->>'enhancedDescription' 
    ELSE NULL 
  END,
  tags = CASE 
    WHEN metadata ? 'tags' THEN 
      CASE 
        WHEN jsonb_typeof(metadata->'tags') = 'array' THEN 
          ARRAY(SELECT jsonb_array_elements_text(metadata->'tags'))
        ELSE NULL 
      END
    ELSE NULL 
  END
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';

-- Media fields
UPDATE inventory_items 
SET 
  video_url = CASE 
    WHEN metadata ? 'videoUrl' THEN metadata->>'videoUrl' 
    ELSE NULL 
  END,
  video_thumbnail = CASE 
    WHEN metadata ? 'videoThumbnail' THEN metadata->>'videoThumbnail' 
    ELSE NULL 
  END
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';

-- Product details
UPDATE inventory_items 
SET 
  features = CASE 
    WHEN metadata ? 'features' THEN 
      CASE 
        WHEN jsonb_typeof(metadata->'features') = 'array' THEN 
          ARRAY(SELECT jsonb_array_elements_text(metadata->'features'))
        ELSE NULL 
      END
    ELSE NULL 
  END,
  specifications = CASE 
    WHEN metadata ? 'specifications' THEN metadata->'specifications' 
    ELSE NULL 
  END
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';

-- E-commerce configuration
UPDATE inventory_items 
SET 
  allow_backorder = CASE 
    WHEN metadata ? 'allow_backorder' THEN (metadata->>'allow_backorder')::BOOLEAN 
    ELSE false 
  END,
  track_inventory = CASE 
    WHEN metadata ? 'track_inventory' THEN (metadata->>'track_inventory')::BOOLEAN 
    ELSE true 
  END,
  low_stock_threshold = CASE 
    WHEN metadata ? 'low_stock_threshold' THEN (metadata->>'low_stock_threshold')::INTEGER 
    ELSE 5 
  END
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object';

-- Payment configuration (skip - these fields already exist)
-- Note: payment_gateway_id and payment_gateway_type already exist in the table
-- If you want to migrate data from metadata to these existing columns, uncomment below:
/*
UPDATE inventory_items 
SET 
  payment_gateway_id = CASE 
    WHEN metadata ? 'payment_gateway_id' THEN metadata->>'payment_gateway_id' 
    ELSE payment_gateway_id 
  END,
  payment_gateway_type = CASE 
    WHEN metadata ? 'payment_gateway_type' THEN metadata->>'payment_gateway_type' 
    ELSE payment_gateway_type 
  END
WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object'
  AND (
    (metadata ? 'payment_gateway_id' AND metadata->>'payment_gateway_id' IS NOT NULL) OR
    (metadata ? 'payment_gateway_type' AND metadata->>'payment_gateway_type' IS NOT NULL)
  );
*/

-- Phase 3: Clean up metadata (remove migrated fields)
-- ================================================

-- Create a function to clean up migrated fields from metadata
CREATE OR REPLACE FUNCTION clean_migrated_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if metadata is a JSON object
  IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata) = 'object' THEN
    -- Remove fields that have been migrated to proper columns
    -- Note: payment_gateway_id and payment_gateway_type are not removed since they already existed
    NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb)
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
      - 'low_stock_threshold';
    
    -- If metadata is now empty, set it to null
    IF NEW.metadata = '{}'::jsonb THEN
      NEW.metadata = NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply cleanup to existing records
-- Note: payment_gateway_id and payment_gateway_type are not removed since they already existed
UPDATE inventory_items 
SET metadata = CASE 
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
END
WHERE metadata IS NOT NULL;

-- Set metadata to null if empty
UPDATE inventory_items 
SET metadata = NULL 
WHERE metadata = '{}'::jsonb;

-- Phase 4: Create trigger for future metadata cleanup
-- ================================================

CREATE TRIGGER inventory_items_metadata_cleanup
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION clean_migrated_metadata();

-- Phase 5: Add comments for documentation
-- ====================================

COMMENT ON COLUMN inventory_items.seo_title IS 'SEO title for product pages (extracted from metadata)';
COMMENT ON COLUMN inventory_items.seo_description IS 'SEO description for product pages (extracted from metadata)';
COMMENT ON COLUMN inventory_items.seo_keywords IS 'SEO keywords array (extracted from metadata)';
COMMENT ON COLUMN inventory_items.enhanced_description IS 'Rich product description (extracted from metadata)';
COMMENT ON COLUMN inventory_items.tags IS 'Product tags for search and categorization (extracted from metadata)';
COMMENT ON COLUMN inventory_items.video_url IS 'Product video URL (extracted from metadata)';
COMMENT ON COLUMN inventory_items.video_thumbnail IS 'Product video thumbnail URL (extracted from metadata)';
COMMENT ON COLUMN inventory_items.features IS 'Product features array (extracted from metadata)';
COMMENT ON COLUMN inventory_items.specifications IS 'Product specifications JSON (extracted from metadata)';
COMMENT ON COLUMN inventory_items.allow_backorder IS 'Allow backorder flag (extracted from metadata)';
COMMENT ON COLUMN inventory_items.track_inventory IS 'Track inventory flag (extracted from metadata)';
COMMENT ON COLUMN inventory_items.low_stock_threshold IS 'Low stock threshold (extracted from metadata)';
-- Note: payment_gateway_id and payment_gateway_type already existed, so no comments added
-- COMMENT ON COLUMN inventory_items.payment_gateway_id IS 'Payment gateway identifier (extracted from metadata)';
-- COMMENT ON COLUMN inventory_items.payment_gateway_type IS 'Payment gateway type (extracted from metadata)';

-- Phase 6: Verification queries
-- ==========================

-- Count migrated records
DO $$
DECLARE
  total_records INTEGER;
  migrated_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM inventory_items;
  SELECT COUNT(*) INTO migrated_records FROM inventory_items WHERE (
    seo_title IS NOT NULL OR 
    seo_description IS NOT NULL OR 
    array_length(seo_keywords, 1) > 0 OR 
    enhanced_description IS NOT NULL OR 
    array_length(tags, 1) > 0 OR 
    video_url IS NOT NULL OR 
    video_thumbnail IS NOT NULL OR 
    array_length(features, 1) > 0 OR 
    specifications IS NOT NULL
  );
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE 'Total inventory items: %', total_records;
  RAISE NOTICE 'Items with migrated data: %', migrated_records;
  RAISE NOTICE 'Migration completed successfully!';
END $$;
