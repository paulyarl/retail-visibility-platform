-- ============================================================
-- Migration 098: Product Suppliers
-- Sprint 2: B2B wholesale matching — supplier records per GTIN
-- Spec: docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md
-- ============================================================

DO $$ BEGIN
CREATE TABLE IF NOT EXISTS product_suppliers (
  id                TEXT PRIMARY KEY,
  gtin              TEXT NOT NULL,
  supplier_name     TEXT NOT NULL,
  supplier_type     TEXT NOT NULL DEFAULT 'wholesale', -- wholesale | distributor | manufacturer | brand_direct
  moq               INTEGER NOT NULL DEFAULT 1,
  min_order_value   DECIMAL(12, 2),
  external_link     TEXT,
  affiliate_params  JSONB NOT NULL DEFAULT '{}'::jsonb,
  region            TEXT NOT NULL DEFAULT 'US',
  claim_type        TEXT NOT NULL DEFAULT 'verified', -- exclusive | preferred | verified
  brand_partner_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gtin, supplier_name)
);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_suppliers_gtin ON product_suppliers (gtin);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_claim_type ON product_suppliers (claim_type);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_region ON product_suppliers (region);

-- RLS: cross-tenant read (global supplier data), no tenant-scoped writes
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY product_suppliers_read_all ON product_suppliers
  FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY product_suppliers_write_admin ON product_suppliers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- updated_at trigger
DO $$ BEGIN
CREATE TRIGGER trg_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
