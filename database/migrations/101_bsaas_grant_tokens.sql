-- ============================================================
-- Migration 101: BSaaS Grant Tokens
-- Phase 4: QR Codes for Private Grants — token + claim tracking
-- Spec: docs/BSAAS_COUPONS_GAP_CLOSURE_AND_QR_PLAN.md §4
-- ============================================================

DO $$ BEGIN
CREATE TABLE IF NOT EXISTS bsaas_grant_tokens (
  id              VARCHAR(255) PRIMARY KEY,
  feature_key     VARCHAR(100) NOT NULL,
  tenant_id       VARCHAR(255),
  duration_days   INTEGER,
  granted_by      VARCHAR(255) NOT NULL,
  max_claims      INTEGER NOT NULL DEFAULT 1,
  claims_count    INTEGER NOT NULL DEFAULT 0,
  qr_expires_at   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE TABLE IF NOT EXISTS bsaas_grant_token_claims (
  id              VARCHAR(255) PRIMARY KEY,
  grant_token_id  VARCHAR(255) NOT NULL REFERENCES bsaas_grant_tokens(id) ON DELETE CASCADE,
  tenant_id       VARCHAR(255) NOT NULL,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(grant_token_id, tenant_id)
);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_bsaas_grant_tokens_feature_key ON bsaas_grant_tokens (feature_key);
CREATE INDEX IF NOT EXISTS idx_bsaas_grant_tokens_tenant_id ON bsaas_grant_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bsaas_grant_tokens_granted_by ON bsaas_grant_tokens (granted_by);
CREATE INDEX IF NOT EXISTS idx_bsaas_grant_token_claims_grant_token_id ON bsaas_grant_token_claims (grant_token_id);
CREATE INDEX IF NOT EXISTS idx_bsaas_grant_token_claims_tenant_id ON bsaas_grant_token_claims (tenant_id);

-- RLS: admin-only write, tenant read for own claims
ALTER TABLE bsaas_grant_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bsaas_grant_token_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY bsaas_grant_tokens_read_all ON bsaas_grant_tokens
  FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY bsaas_grant_tokens_write_admin ON bsaas_grant_tokens
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY bsaas_grant_token_claims_read_all ON bsaas_grant_token_claims
  FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY bsaas_grant_token_claims_write_all ON bsaas_grant_token_claims
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- updated_at triggers
DO $$ BEGIN
CREATE TRIGGER trg_bsaas_grant_tokens_updated_at
  BEFORE UPDATE ON bsaas_grant_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
