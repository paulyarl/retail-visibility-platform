-- Migration 202: Intelligence Profile Type Alignment
--
-- Closes the profile-type alignment gap (see
-- docs/LocalBiz/intelligence_profile_type_alignment_sprint_plan.md):
-- emerging and competitive intelligence campaigns for the same category
-- must be able to resolve to their own type-specific profile.
--
-- Before this migration, mkt_intelligence_profiles had no focus column and
-- the partial unique index idx_mkt_intel_profiles_active_category enforced
-- ONE active profile per category_key. Activating a competitive profile
-- retired the emerging profile for the same category, and both campaign
-- focus types then resolved to whichever profile survived — a silent
-- ghost bug where the wrong-type profile block was loaded for one of the
-- two campaign types.
--
-- Changes:
--   1. Add intelligence_focus VARCHAR(20) NOT NULL DEFAULT 'emerging'.
--   2. Backfill all existing rows to 'emerging' (matches the historical
--      establishment-campaign default from Migration 200).
--   3. Drop idx_mkt_intel_profiles_active_category and replace it with
--      idx_mkt_intel_profiles_active_category_focus on
--      (category_key, intelligence_focus) WHERE status = 'active' —
--      allows one active emerging AND one active competitive profile per
--      category.
--   4. Add a lookup index on (category_key, intelligence_focus) for the
--      focus-aware resolver.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- 1. Add the focus column, defaulting to 'emerging' for backfill.
ALTER TABLE mkt_intelligence_profiles
  ADD COLUMN IF NOT EXISTS intelligence_focus VARCHAR(20) NOT NULL DEFAULT 'emerging';

-- 2. Backfill: every existing profile is treated as 'emerging' focus.
--    This is the conservative default — the hand-seeded auto_repair_us
--    profile is emerging-biased (CARFAX vertical discovery, hidden-trust
--    signals), and any operator-established profile from before this
--    sprint was produced by an establishment campaign whose focus
--    defaulted to 'emerging' (Migration 200).
UPDATE mkt_intelligence_profiles
SET intelligence_focus = 'emerging'
WHERE intelligence_focus IS NULL OR intelligence_focus = '';

-- 3. Drop the old per-category unique index and replace it with a
--    per-(category, focus) unique index. This allows one active
--    emerging profile AND one active competitive profile for the same
--    category_key.
DROP INDEX IF EXISTS idx_mkt_intel_profiles_active_category;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_intel_profiles_active_category_focus
  ON mkt_intelligence_profiles (category_key, intelligence_focus)
  WHERE status = 'active';

-- 4. Lookup by (category_key, focus) for the focus-aware resolver.
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_category_focus
  ON mkt_intelligence_profiles (category_key, intelligence_focus);

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_intelligence_profiles' ORDER BY ordinal_position;
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'mkt_intelligence_profiles' ORDER BY indexname;

COMMIT;
