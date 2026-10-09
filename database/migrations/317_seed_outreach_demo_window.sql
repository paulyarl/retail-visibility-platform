-- 317_seed_outreach_demo_window.sql
--
-- Adds an operator-run demo window to directory_seed_outreach_touches so an
-- in-store demo (live seed edit + QR scan demo) is logged as a 'visit' touch
-- with a time window. Scans inside the window are read as demo activity by
-- the funnel analytics; no scan rows are altered or filtered.
--
-- Window semantics:
--   demo_window_started_at      set when the operator starts the demo
--   demo_window_expected_end_at set at start (operator-selected duration);
--                               the window auto-expires at this time
--   demo_window_ended_at        set when the operator stops early; NULL while
--                               running or when expiry is read from
--                               demo_window_expected_end_at
--   demo_window_started_by      operator identifier (platform actor id)
--
-- Prerequisites: migration 259 (directory_seed_outreach_touches) and 273
-- (channel 'visit'). Additive + idempotent (ADD COLUMN IF NOT EXISTS). Guarded
-- so a DB missing migration 259 skips rather than hard-fails.
--
-- Apply manually via the Supabase SQL Editor, staging then production, using
-- plain Run (see manual-sql-migration-policy).

BEGIN;

DO $$
BEGIN
  IF to_regclass('directory_seed_outreach_touches') IS NOT NULL THEN
    ALTER TABLE directory_seed_outreach_touches
      ADD COLUMN IF NOT EXISTS demo_window_started_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS demo_window_expected_end_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS demo_window_ended_at        TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS demo_window_started_by      TEXT;

    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_demo_window_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_demo_window_check
      CHECK (
        demo_window_expected_end_at IS NULL
        OR demo_window_started_at IS NULL
        OR demo_window_expected_end_at > demo_window_started_at
      );

    CREATE INDEX IF NOT EXISTS idx_seed_touches_demo_window
      ON directory_seed_outreach_touches (demo_window_started_at)
      WHERE demo_window_started_at IS NOT NULL;
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping demo window columns';
  END IF;
END $$;

COMMIT;

-- Verification (run after applying, staging and production):
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'directory_seed_outreach_touches'
--    AND column_name LIKE 'demo_window_%'
--  ORDER BY column_name;
--
-- After both environments are applied, locally run:
--   cd apps/api && npx prisma db pull && npx prisma generate
