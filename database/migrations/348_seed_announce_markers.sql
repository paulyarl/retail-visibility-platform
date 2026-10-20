-- 348_seed_announce_markers.sql
--
-- Four-Act Outreach Cascade — announce markers on the canonical seed touch
-- ledger (spec §11 B1/B3).
--
-- The courtesy-window `outreach_state` machine cannot distinguish a delivered
-- announce from any other contact attempt: `owner_contacted` is written for
-- voicemail and no-answer too, and `freshness_verified` can be entered without
-- C2. The announce queue therefore reads two explicit marker outcomes on
-- `directory_seed_outreach_touches`:
--
--   announce_scheduled  — written at publish (the announce is queued)
--   announce_delivered  — written when the operator records the actual announce
--
-- The queue is: seed status published/invited AND announce_scheduled present
-- AND announce_delivered absent. A `no_response` seed without the delivered
-- marker stays in the queue.
--
-- `metadata` carries the announce payload (channel, claim/place URLs, platform
-- identification values + snapshot date, and the C3/C4 `verification_results`
-- for campaign-less seeds). It is nullable so existing writers are unchanged.
--
-- Pattern mirrors 262_proving_ground.sql §2 / 289_seed_outreach_touch_report_outcomes.sql:
-- Postgres names inline column CHECKs {table}_{column}_check; guarded so a DB
-- missing migration 259 skips rather than hard-fails.

BEGIN;

DO $$
BEGIN
  IF to_regclass('directory_seed_outreach_touches') IS NOT NULL THEN
    ALTER TABLE directory_seed_outreach_touches
      DROP CONSTRAINT IF EXISTS directory_seed_outreach_touches_outcome_check;
    ALTER TABLE directory_seed_outreach_touches
      ADD CONSTRAINT directory_seed_outreach_touches_outcome_check
      CHECK (outcome IN (
        'connected', 'no_response', 'no_answer', 'no_reply', 'voicemail',
        'bad_number', 'bounce', 'unread', 'read_no_reply', 'form_submitted',
        'referral_asked', 'claimed', 'not_interested',
        'report_delivered', 'report_viewed', 'report_claimed', 'report_declined',
        'claim_qr_generated',
        'announce_scheduled', 'announce_delivered'
      ));

    ALTER TABLE directory_seed_outreach_touches
      ADD COLUMN IF NOT EXISTS metadata JSONB;

    -- The announce queue's predicate is per-seed + outcome.
    CREATE INDEX IF NOT EXISTS idx_dsot_seed_outcome
      ON directory_seed_outreach_touches (seed_id, outcome);
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping announce marker extension';
  END IF;
END $$;

COMMIT;
