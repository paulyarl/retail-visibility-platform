-- Migration 116: Grant Token Revocation and Admin Notes
--
-- Adds is_revoked, revoked_at, revoked_by columns to bsaas_grant_tokens
-- so admins can revoke a grant token (blocking future redemptions even
-- if the JWT is still signature-valid).
-- Adds notes column for admin-only metadata.
--
-- The JWT itself is stateless and cannot be invalidated, but the redeem
-- endpoint checks is_revoked from the DB record before processing.

ALTER TABLE bsaas_grant_tokens
  ADD COLUMN IF NOT EXISTS is_revoked  BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revoked_at  TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS revoked_by  VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS notes       TEXT         NULL;

-- Update updated_at trigger already exists from migration 101.
