-- Migration 246: Directory Claim Requests (Operator Approval Flow)
--
-- Creates the directory_claim_requests table to persist pending claim requests
-- when a directory claim token has operator_approval_required = true.
--
-- Previously, DirectoryClaimService.initiateClaim returned operatorApprovalRequired: true
-- but persisted nothing — the request was lost. This table gives operators a
-- review queue (list / approve / reject) at /settings/admin/directory/presence-seeds.
--
-- Flow:
--   1. Owner opens claim link, clicks "Claim This Listing"
--   2. initiateClaim sees operator_approval_required → inserts a request row (status='pending')
--   3. Operator reviews at the admin page, clicks Approve or Reject
--   4. Approve → consume token, flip org_standing_mode to 'independent', promote customer
--   5. Reject → mark token consumed (revoked), update request status
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS directory_claim_requests (
  id                VARCHAR(60)   PRIMARY KEY,
  seed_id           VARCHAR(60)   NOT NULL,
  tenant_id         VARCHAR(255)  NOT NULL,
  token_id          VARCHAR(60)   NOT NULL,
  customer_id       VARCHAR(60)   NULL,
  customer_email    VARCHAR(255)  NULL,
  customer_name     VARCHAR(200)  NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT          NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ   NULL,
  reviewed_by       VARCHAR(255)  NULL,

  CONSTRAINT fk_dcr_seed  FOREIGN KEY (seed_id)  REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  CONSTRAINT fk_dcr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_dcr_token FOREIGN KEY (token_id) REFERENCES directory_claim_tokens(id) ON DELETE CASCADE,
  CONSTRAINT chk_dcr_status CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_dcr_status    ON directory_claim_requests (status);
CREATE INDEX IF NOT EXISTS idx_dcr_seed      ON directory_claim_requests (seed_id);
CREATE INDEX IF NOT EXISTS idx_dcr_tenant    ON directory_claim_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dcr_submitted ON directory_claim_requests (submitted_at DESC);

COMMIT;
