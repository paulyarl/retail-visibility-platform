-- 273_seed_outreach_visit_channel.sql
-- Adds 'visit' to the seed outreach-touch channel set so same-town walk-in
-- touches (4x6 leave-behind cards) log as their own channel instead of
-- falling into 'other'. Companion to the claim_invite_walkin QR surface
-- (app-layer only — qr_scan_events.surface is unconstrained VARCHAR(30)).
--
-- Pattern mirrors 262_proving_ground.sql §2: Postgres names inline column
-- CHECKs {table}_{column}_check; guarded so a DB missing migration 259
-- skips rather than hard-fails.

BEGIN;

DO $$
BEGIN
  IF to_regclass('directory_seed_outreach_touches') IS NOT NULL THEN
    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_channel_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_channel_check
      CHECK (channel IN ('call', 'email', 'sms', 'mail', 'form', 'referral', 'visit', 'other'));
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping CHECK extension';
  END IF;
END $$;

COMMIT;
