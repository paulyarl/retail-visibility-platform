-- 227_seek_batch_intelligence_focus.sql
-- Make seek batches focus-aware so created campaigns inherit the selected
-- intelligence profile's focus (emerging | competitive) instead of hardcoding
-- 'emerging' at launch time.

ALTER TABLE mkt_seek_batches
  ADD COLUMN IF NOT EXISTS intelligence_focus VARCHAR(20) DEFAULT 'emerging';

COMMENT ON COLUMN mkt_seek_batches.intelligence_focus IS
  'Discovery focus inherited from the intelligence profile (emerging | competitive).';
