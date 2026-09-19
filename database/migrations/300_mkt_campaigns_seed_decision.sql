-- Migration 300: persisted seed decision on `mkt_campaigns_list`
--
-- The Identity tab's "Wait" action (IdentityPacketCard) previously acknowledged
-- the packet for the current view only — the decision was lost on reload, so an
-- operator who chose not to seed yet had no stored record of that decision.
--
-- These nullable columns store the operator's seed decision on the campaign:
--   seed_decision     — the decision value ('wait'; extensible to future
--                       decisions such as 'push' if we ever persist those)
--   seed_decision_at  — when the decision was recorded
--   seed_decision_by  — the staff user id who recorded it
--
-- Read/written via raw SQL in IdentityPacketService, so the feature degrades
-- gracefully before this migration is applied (read is non-fatal → null).
--
-- Idempotent. Apply to `local` + `prd`:
--   psql $DATABASE_URL -f database/migrations/300_mkt_campaigns_seed_decision.sql

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS seed_decision varchar(20),
  ADD COLUMN IF NOT EXISTS seed_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS seed_decision_by varchar(255);
