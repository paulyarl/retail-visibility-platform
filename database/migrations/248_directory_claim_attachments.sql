-- Migration 248: Directory Claim Attachments (Proof of Ownership)
--
-- Creates directory_claim_attachments for claimants to upload proof of
-- business ownership (business license, utility bill, in-store photo, etc.)
-- during the operator-approval claim flow.
--
-- Mirrors the mkt_dispute_attachments pattern: files are stored in the
-- Supabase DISPUTES bucket (reused), with the path recorded here. Downloads
-- are token-scoped for claimants and admin-scoped for operators.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS directory_claim_attachments (
  id              VARCHAR(255)   PRIMARY KEY,
  claim_request_id VARCHAR(60)   NOT NULL,
  file_url        VARCHAR(500)   NOT NULL,
  file_name       VARCHAR(255)   NOT NULL,
  file_type       VARCHAR(20)    NOT NULL,
  file_size       INTEGER        NULL,
  uploaded_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT fk_dca_request FOREIGN KEY (claim_request_id)
    REFERENCES directory_claim_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dca_request ON directory_claim_attachments (claim_request_id);

COMMIT;
