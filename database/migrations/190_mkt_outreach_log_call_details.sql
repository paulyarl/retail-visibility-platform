-- ============================================================
-- Migration 190: Marketing Ops — Outreach Log Call Details
-- ============================================================
-- Description:
--   Adds a nullable JSONB column for phone-channel call details on
--   mkt_outreach_log. Only populated when contact_channel = 'phone';
--   null for all other channels and all legacy rows.
--
--   The payload contract (§4.2 of the cold-call sprint plan):
--     call_result             enum: connected/voicemail/no_answer/wrong_number/disconnected_number
--     identity_verified       boolean|null  (Stage 1 outcome)
--     operating_status_confirmed boolean|null  (Stage 1 outcome)
--     angle_used              HookAngle|null  (which Stage 2 hook was delivered)
--     hook_response_notes     string|null
--     objections_raised       string[]
--     email_obtained          boolean|null  (Stage 4 outcome)
--     email_value             string|null   (validated email when present)
--     callback_number_left    boolean|null  (declined-email fallback)
--     owner_name_confirmed    string|null   (write-back candidate)
--     team_signal_confirmed   TeamSignalValue|null  (write-back candidate)
--     preferred_channel_confirmed string|null  (write-back candidate)
--
--   Coherence between call_result and outcome is enforced at the route
--   layer (Zod), not by a DB CHECK — same discipline as the existing
--   outcome enum (no DB CHECK exists on outcome).
--
--   Also registers two new outcome values ('wrong_number',
--   'disconnected_number') at the route-layer enum — no DB change needed
--   for those (outcome is a varchar column, not a DB enum).
--
--   Additive only — no data loss, no backfill needed.
-- Prerequisite: 142_marketing_ops_outreach_log.sql applied
-- Date: 2026-08-12
-- ============================================================

ALTER TABLE mkt_outreach_log
  ADD COLUMN IF NOT EXISTS call_details JSONB;

COMMENT ON COLUMN mkt_outreach_log.call_details IS
  'Phone-channel call outcome details (call_result, identity/operating confirmation, angle used, objections, email obtained). Null unless contact_channel = ''phone''.';

-- Index supports angle attribution analytics: group by angle_used,
-- measure reply outcomes per angle on the phone channel.
-- Expression index on the JSONB path — partial, only rows with call_details.
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_log_call_angle
  ON mkt_outreach_log((call_details->>'angle_used'))
  WHERE call_details IS NOT NULL;

-- ============================================================
-- VERIFICATION (run manually after applying)
-- ============================================================
-- \d mkt_outreach_log
--   -- confirm call_details column is present, type jsonb, nullable
--
-- SELECT call_details->>'call_result' AS result, COUNT(*) AS log_count
--   FROM mkt_outreach_log
--   WHERE call_details IS NOT NULL
--   GROUP BY result
--   ORDER BY log_count DESC;
--   -- expect 0 rows until phone calls are logged with call_details
--
-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP INDEX IF EXISTS idx_mkt_outreach_log_call_angle;
-- ALTER TABLE mkt_outreach_log DROP COLUMN IF EXISTS call_details;
