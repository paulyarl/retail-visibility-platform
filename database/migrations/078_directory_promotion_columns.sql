-- Migration 078: Add promotion columns to directory_listings_list
-- The promotion route (apps/api/src/routes/promotion.ts) references columns that don't exist yet.

DO $$
BEGIN
  -- Add promotion columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'is_promoted') THEN
    ALTER TABLE directory_listings_list ADD COLUMN is_promoted BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'promotion_tier') THEN
    ALTER TABLE directory_listings_list ADD COLUMN promotion_tier VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'promotion_started_at') THEN
    ALTER TABLE directory_listings_list ADD COLUMN promotion_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'promotion_expires_at') THEN
    ALTER TABLE directory_listings_list ADD COLUMN promotion_expires_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'promotion_impressions') THEN
    ALTER TABLE directory_listings_list ADD COLUMN promotion_impressions INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'directory_listings_list' AND column_name = 'promotion_clicks') THEN
    ALTER TABLE directory_listings_list ADD COLUMN promotion_clicks INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add index on is_promoted for filtering promoted listings
CREATE INDEX IF NOT EXISTS idx_directory_listings_is_promoted
  ON directory_listings_list (is_promoted)
  WHERE is_promoted = TRUE;
