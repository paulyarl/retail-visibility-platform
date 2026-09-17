-- Migration 068: Featured Placement Catalog & Purchases
-- Creates tables for monetized featured product placements:
--   featured_placement_catalog  — admin-managed pricing plans per surface
--   featured_placement_purchases — tenant purchases of placement plans
--
-- Design doc: docs/FEATURED_VISIBILITY_CHANNELS_DESIGN.md (Phase 4)

-- ============================================================
-- 1. featured_placement_catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS featured_placement_catalog (
  id              VARCHAR(255) PRIMARY KEY,
  plan_key        VARCHAR(50) UNIQUE NOT NULL,
  label           VARCHAR(100) NOT NULL,
  surface         VARCHAR(50) NOT NULL,
  duration_days   INT NOT NULL,
  price_cents     INT NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at_placement_catalog()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_placement_catalog
    BEFORE UPDATE ON featured_placement_catalog
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_placement_catalog();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_placement_catalog_surface ON featured_placement_catalog(surface);
CREATE INDEX IF NOT EXISTS idx_placement_catalog_active ON featured_placement_catalog(is_active) WHERE is_active = true;

-- Seed plans
INSERT INTO featured_placement_catalog (id, plan_key, label, surface, duration_days, price_cents, currency, is_active, sort_order)
VALUES
  ('fpc-spotlight-7day',  'spotlight_7day',  'Spotlight — 7 Days',       'storefront_spotlight', 7,  1500, 'USD', true, 1),
  ('fpc-spotlight-30day', 'spotlight_30day', 'Spotlight — 30 Days',      'storefront_spotlight', 30, 5000, 'USD', true, 2),
  ('fpc-shops-7day',      'shops_7day',      'Shops Featured — 7 Days',  'cross_tenant_shops',   7,  2500, 'USD', true, 3),
  ('fpc-shops-30day',     'shops_30day',     'Shops Featured — 30 Days', 'cross_tenant_shops',   30, 8000, 'USD', true, 4),
  ('fpc-directory-30day', 'directory_30day', 'Directory Featured — 30 Days', 'directory',        30, 3000, 'USD', true, 5)
ON CONFLICT (plan_key) DO NOTHING;

-- ============================================================
-- 2. featured_placement_purchases
-- ============================================================
CREATE TABLE IF NOT EXISTS featured_placement_purchases (
  id                    VARCHAR(255) PRIMARY KEY,
  tenant_id             VARCHAR(255) NOT NULL,
  inventory_item_id     VARCHAR(255) NOT NULL,
  plan_key              VARCHAR(50) NOT NULL,
  surface               VARCHAR(50) NOT NULL,
  price_cents           INT NOT NULL,
  currency              VARCHAR(3) DEFAULT 'USD',
  duration_days         INT NOT NULL,
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id    VARCHAR(255),
  status                VARCHAR(20) DEFAULT 'pending',  -- pending | active | expired | revoked
  purchased_at          TIMESTAMPTZ DEFAULT NOW(),
  activated_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  revoked_reason        TEXT,
  renewed_from          VARCHAR(255),  -- references previous purchase id on renewal
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at_placement_purchases()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_placement_purchases
    BEFORE UPDATE ON featured_placement_purchases
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_placement_purchases();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_placement_purchases_tenant ON featured_placement_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_placement_purchases_tenant_status ON featured_placement_purchases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_placement_purchases_expires ON featured_placement_purchases(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_placement_purchases_surface ON featured_placement_purchases(surface, status);
CREATE INDEX IF NOT EXISTS idx_placement_purchases_item ON featured_placement_purchases(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_placement_purchases_stripe_session ON featured_placement_purchases(stripe_checkout_session_id);

-- Foreign keys
ALTER TABLE featured_placement_purchases
  ADD CONSTRAINT fk_placement_purchases_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE featured_placement_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_placement_purchases ON featured_placement_purchases
    USING (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin can see all rows
DO $$ BEGIN
  CREATE POLICY admin_all_placement_purchases ON featured_placement_purchases
    FOR ALL
    TO authenticated
    USING (current_setting('app.is_platform_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_platform_admin', true) = 'true');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
