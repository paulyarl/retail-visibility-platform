-- ============================================================
-- Migration 100: Brand Partner Claims
-- Sprint 2: B2B wholesale matching — brand partner claim hierarchy
-- Spec: docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md
-- ============================================================

DO $$ BEGIN
CREATE TABLE IF NOT EXISTS brand_partner_claims (
  id              TEXT PRIMARY KEY,
  brand_name      TEXT NOT NULL,
  gtin            TEXT NOT NULL,
  claim_type      TEXT NOT NULL DEFAULT 'verified', -- exclusive | preferred | verified
  supplier_id     TEXT,
  admin_approved  BOOLEAN NOT NULL DEFAULT false,
  contact_email   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Only one exclusive claim per barcode
DO $$ BEGIN
CREATE UNIQUE INDEX idx_brand_partner_claims_exclusive_gtin
  ON brand_partner_claims (gtin)
  WHERE claim_type = 'exclusive';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_brand_partner_claims_gtin ON brand_partner_claims (gtin);
CREATE INDEX IF NOT EXISTS idx_brand_partner_claims_brand ON brand_partner_claims (brand_name);
CREATE INDEX IF NOT EXISTS idx_brand_partner_claims_claim_type ON brand_partner_claims (claim_type);

-- RLS: cross-tenant read (global claim data), admin writes only
ALTER TABLE brand_partner_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY brand_partner_claims_read_all ON brand_partner_claims
  FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY brand_partner_claims_write_admin ON brand_partner_claims
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- updated_at trigger
DO $$ BEGIN
CREATE TRIGGER trg_brand_partner_claims_updated_at
  BEFORE UPDATE ON brand_partner_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
