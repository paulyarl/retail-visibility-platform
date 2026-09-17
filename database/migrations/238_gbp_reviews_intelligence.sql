-- Migration 238: GBP Reviews Intelligence + star_rating Enum→Int
--
-- Extends gbp_reviews with:
--   1. location_id — FK to gbp_locations_list for location-scoped queries.
--   2. reply_status — NONE | AI_DRAFTED | PUBLISHED | DISPUTED
--      (driven by GBPReviewReplyService, Phase 2).
--   3. ai_drafts — JSONB array of 3 Tier A draft responses.
--   4. sentiment — positive | neutral | negative (rule-based, Phase 2 ingestion).
--
-- CRITICAL: star_rating type change from VarChar(10) to INTEGER.
-- Google's API returns starRating as an enum string ('ONE'..'FIVE'), which
-- GBPAdvancedSync.storeReviews currently writes directly to the VarChar(10)
-- column. This migration:
--   (a) Maps existing enum values to integers via CASE (not numeric cast).
--   (b) Also handles numeric strings ('1'..'5') as a fallback.
--   (c) Changes the column type to INTEGER.
--
-- Code-path requirement (must be done in the same sprint, before merge):
--   GBPAdvancedSync.storeReviews (line ~860) must be updated to write Int
--   (1-5) instead of the enum string. All star_rating consumers in apps/api
--   and apps/web must be updated from enum-string comparisons (=== 'FIVE')
--   to numeric comparisons (=== 5).

-- Step 1: Add new columns (additive, safe).
ALTER TABLE gbp_reviews
  ADD COLUMN IF NOT EXISTS location_id   VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_status  VARCHAR(16) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS ai_drafts     JSONB,
  ADD COLUMN IF NOT EXISTS sentiment     VARCHAR(12);

-- Step 2: Backfill reply_status from is_replied for existing rows.
UPDATE gbp_reviews
SET reply_status = 'PUBLISHED'
WHERE is_replied = true
  AND reply_status = 'NONE';

-- Step 3: Convert star_rating from VarChar(10) to INTEGER.
-- Google enum: 'ONE'..'FIVE' → 1..5
-- Numeric string fallback: '1'..'5' → 1..5
-- NULL or unrecognized → NULL
ALTER TABLE gbp_reviews ALTER COLUMN star_rating TYPE INTEGER
  USING (
    CASE star_rating
      WHEN 'ONE'   THEN 1
      WHEN 'TWO'   THEN 2
      WHEN 'THREE' THEN 3
      WHEN 'FOUR'  THEN 4
      WHEN 'FIVE'  THEN 5
      WHEN '1' THEN 1
      WHEN '2' THEN 2
      WHEN '3' THEN 3
      WHEN '4' THEN 4
      WHEN '5' THEN 5
      ELSE NULL
    END
  );

-- Step 4: Indexes for the new columns.
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_tenant_rating
  ON gbp_reviews (tenant_id, star_rating);

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_tenant_reply
  ON gbp_reviews (tenant_id, reply_status);

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_location
  ON gbp_reviews (location_id)
  WHERE location_id IS NOT NULL;
