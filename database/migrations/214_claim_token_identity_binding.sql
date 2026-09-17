-- Migration 214: Claim token identity binding + OTP verification
--
-- Claim tokens become identity-bound: when the operator captures owner
-- email/phone during verification, the token is bound to it and an OTP
-- is required before the claim is accepted. When no contact is captured,
-- the claim is held for operator manual approval.

ALTER TABLE directory_claim_tokens
  ADD COLUMN IF NOT EXISTS bound_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS bound_phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS operator_approval_required BOOLEAN NOT NULL DEFAULT FALSE;

-- OTP storage for claim verification
CREATE TABLE IF NOT EXISTS directory_claim_otps (
  id              VARCHAR(60) PRIMARY KEY,
  token_id        VARCHAR(60) NOT NULL REFERENCES directory_claim_tokens(id) ON DELETE CASCADE,
  code_hash       VARCHAR(255) NOT NULL,
  delivery_method VARCHAR(10) NOT NULL,
  delivery_target VARCHAR(255) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ NULL,
  attempts        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dco_token ON directory_claim_otps (token_id);
CREATE INDEX IF NOT EXISTS idx_dco_expires ON directory_claim_otps (expires_at);
