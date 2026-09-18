-- 295_directory_seed_outreach_touch_recording.sql
--
-- Adds call-recording capture to directory_seed_outreach_touches — the
-- canonical PRE-CAMPAIGN touch record (migration 259).
--
-- The PG cadence logs a touch the moment the operator makes the call, but the
-- recording (or its link) usually only becomes available afterwards. Recording
-- metadata therefore lives in dedicated nullable columns rather than inside
-- notes, so the prospect communication timeline can render a playable
-- recording and the funnel can report recording coverage without parsing
-- free text.
--
-- Campaign-side calls already carry a recording via mkt_outreach_log.call_details
-- (jsonb, migration 190) — this migration covers the pre-campaign seed-touch
-- path only, so both halves of the prospect timeline expose a recording URL.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS) — safe on local + prd, and
-- safe to re-run. Guarded so a DB missing migration 259 skips rather than
-- hard-fails.

BEGIN;

DO $$
BEGIN
  IF to_regclass('directory_seed_outreach_touches') IS NOT NULL THEN
    ALTER TABLE directory_seed_outreach_touches
      ADD COLUMN IF NOT EXISTS recording_url              TEXT,
      ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS recording_provider         VARCHAR(40),
      ADD COLUMN IF NOT EXISTS recording_attached_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS recording_attached_by      TEXT;

    -- Negative durations are meaningless; NULL means "not reported".
    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_recording_duration_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_recording_duration_check
      CHECK (recording_duration_seconds IS NULL OR recording_duration_seconds >= 0);
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping recording columns';
  END IF;
END $$;

COMMIT;
