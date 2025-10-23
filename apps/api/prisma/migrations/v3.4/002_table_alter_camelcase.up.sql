-- Add new SWIS fields to existing InventoryItem table (camelCase to match existing schema)
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS "categoryPath" text[],
  ADD COLUMN IF NOT EXISTS price numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS availability availability_status DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS condition product_condition DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS "merchantName" text,
  ADD COLUMN IF NOT EXISTS "locationId" text,
  ADD COLUMN IF NOT EXISTS visibility item_visibility DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS "syncStatus" sync_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "syncedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "auditLogId" text;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_item_updated_at ON "InventoryItem"("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_item_availability ON "InventoryItem"(availability);
CREATE INDEX IF NOT EXISTS gin_inventory_item_category_path ON "InventoryItem" USING GIN("categoryPath");

-- Basic value guards (drop old trigger first to avoid conflicts)
DROP TRIGGER IF EXISTS trg_inventory_item_touch ON "InventoryItem";
DROP FUNCTION IF EXISTS touch_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_nonnegative') THEN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT price_nonnegative CHECK (price IS NULL OR price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qty_nonnegative') THEN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT qty_nonnegative CHECK (quantity IS NULL OR quantity >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'currency_len') THEN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT currency_len CHECK (currency IS NULL OR char_length(currency)=3);
  END IF;
END $$;
