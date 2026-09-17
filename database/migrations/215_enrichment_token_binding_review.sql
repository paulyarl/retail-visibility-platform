-- Migration 215: Enrichment token binding + review + pending review status
--
-- Enrichment tokens get optional binding (lower risk than claim, but
-- still protected when possible). Unbound enrichment submissions go to
-- a pending_review state instead of going live immediately.

ALTER TABLE directory_enrichment_tokens
  ADD COLUMN IF NOT EXISTS bound_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS bound_phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submission_review_required BOOLEAN NOT NULL DEFAULT TRUE;

-- Add 'enrichment_pending_review' to the outreach_status CHECK constraint
ALTER TABLE directory_presence_seeds
  DROP CONSTRAINT IF EXISTS chk_dps_outreach_status;
ALTER TABLE directory_presence_seeds
  ADD CONSTRAINT chk_dps_outreach_status
  CHECK (outreach_status IN ('unverified', 'outreach_attempted', 'verified_by_call',
    'verified_by_email', 'enrichment_sent', 'enrichment_pending_review', 'enriched'));
