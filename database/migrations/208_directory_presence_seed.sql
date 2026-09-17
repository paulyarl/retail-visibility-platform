-- Migration 208: Directory Presence Seed, Provenance, and Claim Token Tables
--
-- Creates three new tables to support the directory presence seed/claim workflow:
--
--   directory_presence_seeds   — operator-facing seed record per unclaimed listing
--   directory_field_provenance — per-field source evidence (name, address, phone, snap_ebt, hours)
--   directory_claim_tokens     — single-use tokens for claiming a presence seed
--
-- Also adds 'directory_seed' as a valid org_standing_mode value. The column is
-- VARCHAR(20) so no schema change is needed — just a documentation note here.
--
-- Design:
--   - Seed records link to a real tenant (org_standing_mode = 'directory_seed')
--   - The tenant + directory_listings_list row already exist (created in 209)
--   - Provenance is separate from listing data so source evidence is preserved
--     independently of the listing row
--   - Claim tokens are single-use, expire, and record who consumed them
--   - All tables use application-generated IDs (dps-, dfp-, dct- prefixes)
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- =============================================================
-- 1. directory_presence_seeds
-- =============================================================
CREATE TABLE IF NOT EXISTS directory_presence_seeds (
  id                   VARCHAR(60)   PRIMARY KEY,
  tenant_id            VARCHAR(255)  NOT NULL,
  listing_id           VARCHAR(255)  NOT NULL,
  category             VARCHAR(100)  NOT NULL,
  city                 VARCHAR(100)  NOT NULL,
  state                VARCHAR(50)   NOT NULL,
  seed_batch           VARCHAR(100)  NOT NULL,
  status               VARCHAR(20)   NOT NULL DEFAULT 'draft',
  identity_confidence  VARCHAR(10)   NOT NULL DEFAULT 'medium',
  category_fit         VARCHAR(20)   NOT NULL DEFAULT 'probable',
  notes                TEXT          NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  published_at         TIMESTAMPTZ   NULL,
  invited_at           TIMESTAMPTZ   NULL,
  claimed_at           TIMESTAMPTZ   NULL,

  CONSTRAINT fk_dps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_dps_listing FOREIGN KEY (listing_id) REFERENCES directory_listings_list(id) ON DELETE CASCADE,
  CONSTRAINT uq_dps_tenant UNIQUE (tenant_id),
  CONSTRAINT uq_dps_listing UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS idx_dps_seed_batch ON directory_presence_seeds (seed_batch);
CREATE INDEX IF NOT EXISTS idx_dps_status ON directory_presence_seeds (status);
CREATE INDEX IF NOT EXISTS idx_dps_city_state ON directory_presence_seeds (city, state);
CREATE INDEX IF NOT EXISTS idx_dps_category ON directory_presence_seeds (category);

-- =============================================================
-- 2. directory_field_provenance
-- =============================================================
-- One row per field per seed. Preserves source evidence separately from
-- the listing data so we can show "Listed from public directories / SNAP / news"
-- and never lose the original source when a listing is updated after claim.
CREATE TABLE IF NOT EXISTS directory_field_provenance (
  id                   VARCHAR(60)   PRIMARY KEY,
  seed_id              VARCHAR(60)   NOT NULL,
  tenant_id            VARCHAR(255)  NOT NULL,
  field_key            VARCHAR(50)   NOT NULL,
  value                TEXT          NULL,
  source_name          VARCHAR(200)  NULL,
  source_url           TEXT          NULL,
  accessed_at          DATE          NULL,
  confidence           VARCHAR(10)   NOT NULL DEFAULT 'medium',
  show_on_public       BOOLEAN       NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_dfp_seed FOREIGN KEY (seed_id) REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  CONSTRAINT fk_dfp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dfp_seed ON directory_field_provenance (seed_id);
CREATE INDEX IF NOT EXISTS idx_dfp_tenant ON directory_field_provenance (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dfp_field_key ON directory_field_provenance (field_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dfp_seed_field ON directory_field_provenance (seed_id, field_key);

-- =============================================================
-- 3. directory_claim_tokens
-- =============================================================
-- Single-use tokens for claiming a directory presence seed.
-- The token string is stored directly (matching mkt_customer_claim_tokens
-- convention). Tokens expire and record who consumed them.
CREATE TABLE IF NOT EXISTS directory_claim_tokens (
  id                   VARCHAR(60)   PRIMARY KEY,
  seed_id              VARCHAR(60)   NOT NULL,
  tenant_id            VARCHAR(255)  NOT NULL,
  token                VARCHAR(255)  NOT NULL,
  expires_at           TIMESTAMPTZ   NOT NULL,
  consumed_at          TIMESTAMPTZ   NULL,
  consumed_by          VARCHAR(255)  NULL,
  single_use           BOOLEAN       NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_dct_seed FOREIGN KEY (seed_id) REFERENCES directory_presence_seeds(id) ON DELETE CASCADE,
  CONSTRAINT fk_dct_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_dct_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_dct_seed ON directory_claim_tokens (seed_id);
CREATE INDEX IF NOT EXISTS idx_dct_tenant ON directory_claim_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dct_token ON directory_claim_tokens (token);
CREATE INDEX IF NOT EXISTS idx_dct_expires ON directory_claim_tokens (expires_at);

-- =============================================================
-- 4. Extend org_standing_mode CHECK constraint to allow 'directory_seed'
-- =============================================================
-- The existing chk_org_standing_mode constraint only allows
-- 'independent' and 'inherited'. We add 'directory_seed' for
-- unclaimed directory presence seed tenants.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_org_standing_mode;
ALTER TABLE tenants ADD CONSTRAINT chk_org_standing_mode
  CHECK (org_standing_mode IN ('independent', 'inherited', 'directory_seed'));

COMMIT;
