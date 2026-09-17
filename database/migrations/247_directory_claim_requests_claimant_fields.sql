-- Migration 247: Directory Claim Requests — Claimant Verification Fields
--
-- Adds claimant contact + identity fields to directory_claim_requests so
-- operators can verify ownership before approving a claim:
--   - claimant_first_name / claimant_middle_name / claimant_last_name
--   - claimant_phone (to call or text for verification)
--   - claimant_business_address (optional, the address the claimant says
--     the business is at — operator can cross-reference against the seed)
--
-- Also adds operator verification worksheet fields:
--   - verification_method (phone, email, website, in_person, document)
--   - verification_notes (operator's notes from the verification call/check)
--   - verification_completed_at (when the operator completed verification)
--   - verification_completed_by (which operator did the verification)
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE directory_claim_requests
  ADD COLUMN IF NOT EXISTS claimant_first_name       VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS claimant_middle_name      VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS claimant_last_name        VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS claimant_phone            VARCHAR(30)   NULL,
  ADD COLUMN IF NOT EXISTS claimant_business_address TEXT          NULL,
  ADD COLUMN IF NOT EXISTS verification_method       VARCHAR(20)   NULL,
  ADD COLUMN IF NOT EXISTS verification_notes        TEXT          NULL,
  ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS verification_completed_by VARCHAR(255)  NULL;

COMMIT;
