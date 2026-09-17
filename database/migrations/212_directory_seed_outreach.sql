-- Migration 212: Directory seed outreach tracking
--
-- Adds operator verification workflow columns to directory_presence_seeds.
-- The operator can log outreach attempts, verify info by call/email, and
-- capture owner contact info for sending enrichment/claim links.

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS outreach_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS outreach_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(40) NULL;

ALTER TABLE directory_presence_seeds
  DROP CONSTRAINT IF EXISTS chk_dps_outreach_status;
ALTER TABLE directory_presence_seeds
  ADD CONSTRAINT chk_dps_outreach_status
  CHECK (outreach_status IN ('unverified', 'outreach_attempted', 'verified_by_call',
    'verified_by_email', 'enrichment_sent', 'enriched'));
