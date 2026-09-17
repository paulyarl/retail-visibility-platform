-- 289_seed_outreach_touch_report_outcomes.sql
--
-- Extends the directory_seed_outreach_touches outcome CHECK to admit
-- report-delivery outcomes.
--
-- SeedReportDeliveryService.recordDeliveryEvent wrote outcome='report_delivered'
-- (and the report-delivery lifecycle adds report_viewed / report_claimed /
-- report_declined), plus claim_qr_generated for the claim-kit generation step.
-- None of those were in the migration-262 value set, so every insert raised
-- 23514 check constraint violated, was swallowed by the method's best-effort
-- catch, and the report-delivery touch silently never persisted.
-- See docs/LocalBiz/QR_OUTREACH_PIPELINE_INTEGRATION_SPEC.md G12 / §5.3.1.
--
-- The channel CHECK is deliberately NOT extended: the writer is corrected to
-- emit the canonical channel set instead
--   phone -> call, text -> sms, social -> other, in_person -> visit, email -> email
-- so all report channels land inside the existing migration-259/262/273 set.
--
-- Pattern mirrors 262_proving_ground.sql §2 / 273_seed_outreach_visit_channel.sql:
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
        'claim_qr_generated'
      ));
  ELSE
    RAISE NOTICE 'directory_seed_outreach_touches missing (migration 259 not applied) — skipping CHECK extension';
  END IF;
END $$;

COMMIT;
