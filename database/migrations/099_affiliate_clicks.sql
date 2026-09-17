-- ============================================================
-- Migration 099: Affiliate Clicks
-- Sprint 2: B2B wholesale matching — affiliate click tracking
-- Spec: docs/COMMERCIAL_SUPPLIER_CONNECTORS_DESIGN.md
-- ============================================================

DO $$ BEGIN
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  gtin              TEXT NOT NULL,
  supplier_id       TEXT NOT NULL,
  click_id          TEXT NOT NULL,
  external_url      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | converted | expired
  commission_amount DECIMAL(12, 2),
  converted_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_tenant ON affiliate_clicks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_click_id ON affiliate_clicks (click_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_status ON affiliate_clicks (status);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_gtin ON affiliate_clicks (gtin);

-- RLS: tenant-scoped (merchants see only their own clicks)
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY affiliate_clicks_tenant_read ON affiliate_clicks
  FOR SELECT USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY affiliate_clicks_tenant_write ON affiliate_clicks
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  ) WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Webhook updates (Faire conversion) — service role bypasses RLS
DO $$ BEGIN
CREATE POLICY affiliate_clicks_service_update ON affiliate_clicks
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- updated_at trigger
DO $$ BEGIN
CREATE TRIGGER trg_affiliate_clicks_updated_at
  BEFORE UPDATE ON affiliate_clicks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
