-- Migration 255: Prospect Queue — verify-then-outreach status.
--
-- Adds a fourth queue lifecycle status, `verify_then_outreach`, for prospects
-- whose NAP and live listings could not be independently verified by the
-- audit. The operator moves the entry into this status to gate outreach on a
-- human phone call that confirms operational status and captures a verified
-- NAP before a campaign is created.
--
-- State machine:
--   queued ──request-verify──▶ verify_then_outreach
--   verify_then_outreach ──resolve(requeue)──▶ queued
--   verify_then_outreach ──resolve(create_campaign)──▶ campaign_created
--   verify_then_outreach ──resolve(dismiss)──▶ dismissed (reason=unverified_closed)
--   verify_then_outreach ──dismiss──▶ dismissed (reason=unverified_closed)
--
-- The `verification` JSONB column carries the request + resolution metadata
-- (requested_at/by, resolved_at/by, outcome, verified NAP, owner receptivity,
-- call notes, next_action). NULL until the operator requests verification.
--
-- Additive only; column is nullable. No backfill (existing rows simply have
-- no verification metadata — they remain in their current status).

ALTER TABLE mkt_prospect_queue
  ADD COLUMN IF NOT EXISTS verification JSONB DEFAULT NULL;
