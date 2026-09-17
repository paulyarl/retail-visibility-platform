-- Migration 252: Directory presence owner submission verification tokens.
-- Owner submissions from an email address that is not already a customer
-- generate a verification token and must be confirmed before the seed is created.

CREATE TABLE IF NOT EXISTS directory_presence_submission_verifications (
  id                 TEXT PRIMARY KEY,
  token              TEXT NOT NULL UNIQUE,
  submitter_email    TEXT NOT NULL,
  business_name      TEXT NOT NULL,
  payload            JSONB NOT NULL DEFAULT '{}',
  verified           BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at        TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dir_submission_verifications_token
  ON directory_presence_submission_verifications(token);

CREATE INDEX IF NOT EXISTS idx_dir_submission_verifications_email
  ON directory_presence_submission_verifications(submitter_email);

CREATE INDEX IF NOT EXISTS idx_dir_submission_verifications_expires
  ON directory_presence_submission_verifications(expires_at)
  WHERE verified = FALSE;
