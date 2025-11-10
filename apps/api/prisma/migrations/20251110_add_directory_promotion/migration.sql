-- Add promotion fields to directory_listings table
-- Enables tenant self-promotion feature for map visibility

ALTER TABLE directory_listings
ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS promotion_tier VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promotion_started_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promotion_expires_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promotion_impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_clicks INTEGER DEFAULT 0;

-- Create index for promoted listings queries
CREATE INDEX IF NOT EXISTS idx_directory_listings_promoted 
ON directory_listings(is_promoted, promotion_expires_at) 
WHERE is_promoted = TRUE;

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_directory_listings_promotion_stats
ON directory_listings(tenant_id, is_promoted);

-- Add comment
COMMENT ON COLUMN directory_listings.is_promoted IS 'Whether this listing is currently promoted (paid feature)';
COMMENT ON COLUMN directory_listings.promotion_tier IS 'Promotion tier: basic, premium, or featured';
COMMENT ON COLUMN directory_listings.promotion_started_at IS 'When the promotion started';
COMMENT ON COLUMN directory_listings.promotion_expires_at IS 'When the promotion expires';
COMMENT ON COLUMN directory_listings.promotion_impressions IS 'Number of times promoted listing was viewed';
COMMENT ON COLUMN directory_listings.promotion_clicks IS 'Number of times promoted listing was clicked';

-- Function to auto-expire promotions
CREATE OR REPLACE FUNCTION expire_directory_promotions()
RETURNS void AS $$
BEGIN
  UPDATE directory_listings
  SET is_promoted = FALSE,
      promotion_tier = NULL
  WHERE is_promoted = TRUE 
    AND promotion_expires_at IS NOT NULL 
    AND promotion_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job trigger (optional - can be run via cron)
-- This is just the function, actual scheduling would be done externally
COMMENT ON FUNCTION expire_directory_promotions() IS 'Run this function periodically to expire old promotions';
