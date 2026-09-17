-- 260_seed_name_variants.sql
-- name_variants column for duplicate-seed detection (spec §3.1, sprint plan W5).
--
-- The v1 spec specified identity resolution at ingest but never listed it as a
-- build item. Sprint 2 builds detection-only: analytics surfaces
-- potentialDuplicateSeeds (normalized phone OR normalized address+city match)
-- and carries a duplicateSeedCount caveat per cohort. Auto-merge is deferred
-- to operator work.
--
-- name_variants stores the business-name aliases a seed has been discovered
-- under (e.g., "Istanbul Super Market" / "Istanbul Market" / "Istanbul
-- Supermarket and Cafe") so funnel reports never split one operator into
-- several. createFromCampaign writes the campaign business name; duplicate
-- detection appends the counterpart's name to both seeds' variant sets.
--
-- See: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §5 W5

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS name_variants TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: set name_variants to the listing's business name for existing seeds
UPDATE directory_presence_seeds dps
  SET name_variants = ARRAY[dl.business_name]
  FROM directory_listings_list dl
  WHERE dps.name_variants = '{}'
    AND dl.id = dps.listing_id
    AND dl.business_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dps_name_variants
  ON directory_presence_seeds USING GIN (name_variants);
