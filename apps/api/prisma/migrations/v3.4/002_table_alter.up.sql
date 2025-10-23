ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES "Tenant"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category_path text[],
  ADD COLUMN IF NOT EXISTS price numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency char(3),
  ADD COLUMN IF NOT EXISTS availability availability_status,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS condition product_condition DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS location_id text,
  ADD COLUMN IF NOT EXISTS visibility item_visibility DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS sync_status sync_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_log_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Constraints (non‑blocking: add NOT NULL in step 003 after backfill)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_item_tenant_sku
  ON "InventoryItem"(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_item_updated_at
  ON "InventoryItem"(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_item_availability
  ON "InventoryItem"(availability);

CREATE INDEX IF NOT EXISTS gin_inventory_item_category_path
  ON "InventoryItem" USING GIN(category_path);

-- Basic value guards
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT price_nonnegative CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT qty_nonnegative CHECK (quantity IS NULL OR quantity >= 0),
  ADD CONSTRAINT currency_len CHECK (currency IS NULL OR char_length(currency)=3);
