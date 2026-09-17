-- 229_intelligence_profile_reference_state.sql
-- Adds reference_state to mkt_intelligence_profiles so the state is a known,
-- derived-at-creation datum alongside reference_city. This lets the batch
-- seek launcher auto-derive the state from the selected profile (like it
-- already does for intelligence_focus) instead of offering an unrelated
-- all-states dropdown.
--
-- Also adds state to mkt_seek_batches so the parent batch row carries the
-- state for legacy (non-entry) launches, eliminating the hardcoded 'IN'
-- fallback in BatchSeekService.launchBatch.

ALTER TABLE mkt_intelligence_profiles
  ADD COLUMN IF NOT EXISTS reference_state VARCHAR(50);

-- Backfill reference_state from the existing reference_city where possible.
-- Only Indianapolis profiles exist today, so we map the known city to IN.
-- Unknown cities are left NULL (operator can fix via re-publish).
UPDATE mkt_intelligence_profiles
  SET reference_state = 'IN'
  WHERE reference_city IS NOT NULL
    AND reference_state IS NULL
    AND lower(reference_city) IN ('indianapolis', 'zionsville', 'carmel', 'fishers', 'noblesville', 'greenwood', 'bloomington');

CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_category_state_focus
  ON mkt_intelligence_profiles (category_key, reference_state, intelligence_focus);

-- Parent batch row: store the batch-level state for legacy launches.
ALTER TABLE mkt_seek_batches
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);

COMMENT ON COLUMN mkt_intelligence_profiles.reference_state IS
  'US state code (e.g. IN) the profile was established for. Derived at profile creation alongside reference_city. Used by the batch seek launcher to auto-derive state from the selected profile.';
COMMENT ON COLUMN mkt_seek_batches.state IS
  'US state code for the batch (summary field derived from the first entry). Used by the legacy (non-entry) launch path; entry-based launches use mkt_seek_batch_entries.state.';
