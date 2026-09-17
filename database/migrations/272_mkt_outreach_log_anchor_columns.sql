-- Migration 272: Add anchor_id, anchor_snapshot, verification_results to mkt_outreach_log
--
-- Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §12.5
--
-- The manual outreach anchor system (spec §11) requires campaign-level outreach
-- logs to carry the anchor reference, a snapshot of the anchor at contact time
-- (for historical accuracy if the anchor is later edited or retired), and the
-- structured verification results from the contact event.
--
-- Per spec §3.4 rule 5 and §12.5: anchor contact results must ALSO be written to
-- directory_seed_outreach_touches (seed-level) so ProvingGroundCadenceService
-- makes cadence decisions with anchor outcome visibility. This migration only
-- adds the campaign-level columns; the dual-write is a service-layer
-- responsibility, not a schema concern.
--
-- All three columns are nullable so existing outreach log rows are unaffected.

ALTER TABLE mkt_outreach_log
  ADD COLUMN IF NOT EXISTS anchor_id varchar(255),
  ADD COLUMN IF NOT EXISTS anchor_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS verification_results jsonb;

-- Index for looking up outreach logs by anchor.
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_log_anchor
  ON mkt_outreach_log (anchor_id)
  WHERE anchor_id IS NOT NULL;
