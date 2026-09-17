-- ============================================================
-- Migration 070: Supplier Catalog Integration
-- Sprint 1: Database foundation for supplier catalog import
-- Spec: specs/enhancement_queue_v_26.md (v2.6)
-- ============================================================

-- ============================================================
-- 1. supplier table — supplier records (open-source + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  connection_type TEXT NOT NULL DEFAULT 'API', -- API | CSV | SFTP
  api_url         TEXT,
  api_key_env     TEXT,    -- env var name for API key (never store key directly)
  active          BOOLEAN NOT NULL DEFAULT true,
  is_builtin      BOOLEAN NOT NULL DEFAULT false, -- true for open-source suppliers
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_active ON supplier (active);

-- ============================================================
-- 2. supplier_catalog_item — normalized catalog items from suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_catalog_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   TEXT NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  supplier_sku  TEXT NOT NULL,
  name          TEXT NOT NULL,
  brand         TEXT,
  gtin          TEXT,
  category      TEXT,
  category_path TEXT[] DEFAULT '{}',
  image_url     TEXT,
  image_gallery TEXT[] DEFAULT '{}',
  description   TEXT,
  attrs         JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency      TEXT NOT NULL DEFAULT 'USD',
  msrp          DECIMAL(12, 2),
  content_hash  TEXT,
  availability  TEXT NOT NULL DEFAULT 'in_stock', -- in_stock | out_of_stock | discontinued
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_supplier ON supplier_catalog_item (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_gtin ON supplier_catalog_item (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_brand ON supplier_catalog_item (brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_category ON supplier_catalog_item (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_name ON supplier_catalog_item USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item_content_hash ON supplier_catalog_item (content_hash) WHERE content_hash IS NOT NULL;

-- ============================================================
-- 3. supplier_mapping — links supplier catalog items to tenant inventory items
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_mapping (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  supplier_id       TEXT NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  supplier_sku      TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  sync_mode         TEXT NOT NULL DEFAULT 'manual', -- manual | auto
  last_sync         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_mapping_tenant ON supplier_mapping (tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_mapping_tenant_supplier ON supplier_mapping (tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_mapping_inventory_item ON supplier_mapping (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_mapping_sync_mode ON supplier_mapping (sync_mode) WHERE sync_mode = 'auto';

-- ============================================================
-- 4. catalog_quarantine — DLQ for failed imports
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_quarantine (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  TEXT NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  raw_payload  JSONB NOT NULL,
  error_code   TEXT NOT NULL,
  error_message TEXT,
  severity     TEXT NOT NULL DEFAULT 'error', -- error | warning
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalog_quarantine_supplier ON catalog_quarantine (supplier_id);
CREATE INDEX IF NOT EXISTS idx_catalog_quarantine_unreplayed ON catalog_quarantine (supplier_id) WHERE replayed_at IS NULL;

-- ============================================================
-- 5. ALTER inventory_items — add supplier catalog columns
-- ============================================================
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier_catalog_item_id UUID REFERENCES supplier_catalog_item(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS overrides JSONB DEFAULT '{}'::jsonb;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_supplier_sync TIMESTAMPTZ;

-- Index for finding items by supplier catalog item
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier_catalog_item ON inventory_items (supplier_catalog_item_id) WHERE supplier_catalog_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_source_type ON inventory_items (source_type) WHERE source_type != 'manual';

-- Backfill source_type for existing items
UPDATE inventory_items SET source_type = 'manual' WHERE source_type IS NULL;

-- ============================================================
-- 6. Seed built-in open-source suppliers
-- ============================================================
INSERT INTO supplier (id, name, connection_type, api_url, active, is_builtin, metadata)
VALUES
  (
    'supplier-off-open-food-facts',
    'Open Food Facts',
    'API',
    'https://world.openfoodfacts.org/api/v2',
    true,
    true,
    jsonb_build_object(
      'description', 'Open database of 3M+ food products from 150+ countries',
      'license', 'ODbL',
      'website', 'https://world.openfoodfacts.org',
      'verticals', '["grocery", "food", "beverage"]',
      'auth_required', false,
      'rate_limit_per_hour', 500
    )
  ),
  (
    'supplier-off-upc-database',
    'UPC Database',
    'API',
    'https://api.upcdatabase.org',
    true,
    true,
    jsonb_build_object(
      'description', 'General merchandise UPC/EAN lookup database',
      'license', 'commercial',
      'website', 'https://upcdatabase.org',
      'verticals', '["general", "electronics", "household", "toys"]',
      'auth_required', true,
      'api_key_env', 'UPC_DATABASE_API_KEY',
      'rate_limit_per_hour', 500
    )
  ),
  (
    'supplier-off-open-beauty-facts',
    'Open Beauty Facts',
    'API',
    'https://world.openbeautyfacts.org/api/v2',
    true,
    true,
    jsonb_build_object(
      'description', 'Open database of 100K+ cosmetics and personal care products',
      'license', 'ODbL',
      'website', 'https://world.openbeautyfacts.org',
      'verticals', '["beauty", "cosmetics", "personal_care", "pharmacy"]',
      'auth_required', false,
      'rate_limit_per_hour', 500
    )
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  connection_type = EXCLUDED.connection_type,
  api_url = EXCLUDED.api_url,
  is_builtin = EXCLUDED.is_builtin,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ============================================================
-- Done
-- ============================================================
