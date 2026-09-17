-- Migration 263: Campaign gap log
-- Spec: docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md §4.5
--
-- mkt_campaigns_list.gap_log — append-only JSONB array of mid-run gap entries
-- ({timestamp, field, description, severity, resolver, logged_by}). The
-- proving-ground cockpit renders it; POST /:id/gap-log appends.
--
-- Idempotent (IF NOT EXISTS). Nullable — existing campaigns get NULL (no gaps).

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS gap_log JSONB NULL;

COMMENT ON COLUMN mkt_campaigns_list.gap_log IS
  'Proving-ground gap log (Migration 263, spec §4.5) — append-only chronological record of mid-run gaps: [{timestamp, field, description, severity: critical|important|minor, resolver: self|staff|developer, logged_by}]';
