-- Migration 271: Add evidence_state and notes to directory_field_provenance
--
-- Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §12.3
--
-- The seed intelligence report requires a richer evidence-state taxonomy than
-- the existing `confidence` column (high/medium/low). The spec defines:
--   confirmed | observed | probable | conflicting | not_found_during_discovery
--   | not_checked | owner_confirmed | owner_corrected | owner_disputed
--
-- This migration adds `evidence_state` and `notes` as additive columns.
-- Existing rows are backfilled to a safe default derived from their current
-- confidence + override state:
--   - rows with override_by IS NOT NULL → 'owner_confirmed'
--   - all other rows → 'observed' (they were directly sourced)
--
-- No row is upgraded to owner_confirmed without existing owner-override evidence.
-- The `confidence` column is preserved; `evidence_state` is additive.

ALTER TABLE directory_field_provenance
  ADD COLUMN IF NOT EXISTS evidence_state varchar(40),
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill existing rows from their current override state.
UPDATE directory_field_provenance
  SET evidence_state = CASE
    WHEN override_by IS NOT NULL THEN 'owner_confirmed'
    ELSE 'observed'
  END
  WHERE evidence_state IS NULL;

-- Add a CHECK constraint for valid evidence states.
ALTER TABLE directory_field_provenance
  ADD CONSTRAINT chk_dfp_evidence_state CHECK (
    evidence_state IS NULL OR evidence_state IN (
      'confirmed',
      'observed',
      'probable',
      'conflicting',
      'not_found_during_discovery',
      'not_checked',
      'owner_confirmed',
      'owner_corrected',
      'owner_disputed'
    )
  );

-- Index for filtering by evidence state in report queries.
CREATE INDEX IF NOT EXISTS idx_dfp_evidence_state
  ON directory_field_provenance (evidence_state);
