-- Migration 211: Directory enrichment tokens
--
-- Token-gated self-serve enrichment form for unclaimed directory listings.
-- Mirrors directory_claim_tokens structure but multi-use (owners can submit
-- multiple times as they gather photos/info).

CREATE TABLE IF NOT EXISTS directory_enrichment_tokens (
  id          VARCHAR(60) PRIMARY KEY,
  seed_id     VARCHAR(60) NOT NULL REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  single_use  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_det_expires ON directory_enrichment_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_det_seed ON directory_enrichment_tokens (seed_id);
CREATE INDEX IF NOT EXISTS idx_det_tenant ON directory_enrichment_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_det_token ON directory_enrichment_tokens (token);
