-- Migration 358: Claimant email verification for operator-approval claims
--
-- Claim tokens minted without bound owner contact (no seed owner_email /
-- owner_phone on the seed) route claims to operator manual approval via
-- directory_claim_requests. The request previously captured self-asserted
-- claimant identity with no proof-of-inbox — anyone could file a pending
-- request into the operator queue.
--
-- Now, claimants whose email is not already proven (platform users, or
-- customers with customers.email_verified = true — e.g. OAuth) must click a
-- verification link before the request row is created. The pending request,
-- CRM alert, and Requests-Hub ticket only exist after proof-of-inbox —
-- mirrors the directory_presence_submission_verifications pattern used by
-- anonymous owner submissions.
--
-- Flow:
--   1. initiateClaim sees operator_approval_required + unverified claimant
--      → inserts a row here + emails a verify link (24h expiry). Repeat
--      initiates resend the live verification rather than minting new ones.
--   2. Claimant clicks the link → POST /claim-requests/verify → row marked
--      verified + the pending directory_claim_requests row is created
--      (find-or-create) + operator notifications fire.
--   3. Operator approves/rejects exactly as before — approveClaimRequest is
--      unchanged.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS directory_claim_request_verifications (
  id              VARCHAR(60)   PRIMARY KEY,
  token           VARCHAR(128)  NOT NULL UNIQUE,
  token_id        VARCHAR(60)   NOT NULL,
  seed_id         VARCHAR(60)   NOT NULL,
  tenant_id       VARCHAR(255)  NOT NULL,
  claimant_email  VARCHAR(255)  NOT NULL,
  payload         JSONB         NOT NULL DEFAULT '{}'::jsonb,
  verified        BOOLEAN       NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ   NULL,
  expires_at      TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_dcrv_token FOREIGN KEY (token_id) REFERENCES directory_claim_tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dcrv_token_id ON directory_claim_request_verifications (token_id);
CREATE INDEX IF NOT EXISTS idx_dcrv_seed     ON directory_claim_request_verifications (seed_id);
CREATE INDEX IF NOT EXISTS idx_dcrv_expires  ON directory_claim_request_verifications (expires_at);

COMMIT;
