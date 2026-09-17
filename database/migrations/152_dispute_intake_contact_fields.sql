-- Migration 152: Add owner contact fields to dispute intake
--
-- The recovery intake form previously captured only the owner's dispute
-- statement, proposed resolution, service date, and attachments. It did
-- NOT capture the owner's email or phone — which meant the resolution
-- delivery had no guaranteed destination (it fell back to the campaign's
-- business email, which may not be the owner's personal email).
--
-- This migration adds owner_email (required for delivery) and owner_phone
-- (optional, for SMS fallback) to mkt_dispute_intake.
--
-- Sprint 1 — Recovery Production Readiness.

ALTER TABLE mkt_dispute_intake
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(40);

COMMENT ON COLUMN mkt_dispute_intake.owner_email IS 'Owner email captured at intake submission — used as the primary delivery destination for the resolution';
COMMENT ON COLUMN mkt_dispute_intake.owner_phone IS 'Owner phone captured at intake submission — optional, used for SMS fallback if email delivery fails';
