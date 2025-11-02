-- Add item_status enum for SKU lifecycle management
-- Enables active/inactive/archived states separate from public visibility

-- 1) Create enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('active','inactive','archived');
  END IF;
END $$;

-- 2) Add columns
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "itemStatus" item_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "eligibilityReason" text;

-- 3) Create index for SWIS eligibility (active + public)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swis_eligible
  ON "InventoryItem" ("tenantId", "updatedAt" DESC)
  WHERE "itemStatus" = 'active' AND visibility = 'public';

-- 4) Update swis_feed_view to include item_status filter
CREATE OR REPLACE VIEW swis_feed_view AS
SELECT
  i."tenantId",
  i.sku,
  i.title,
  i.brand,
  i.price,
  i.currency,
  i.availability,
  i."imageUrl",
  i."categoryPath",
  i."updatedAt",
  i.description,
  i.condition,
  i.gtin,
  i.mpn,
  i."merchantName",
  i."locationId"
FROM "InventoryItem" i
WHERE i.visibility = 'public'
  AND i."itemStatus" = 'active';

-- 5) Create eligibility summary view
CREATE OR REPLACE VIEW tenant_sku_eligibility_summary AS
SELECT
  "tenantId",
  COUNT(*) FILTER (WHERE "itemStatus" = 'active' AND visibility = 'public') AS eligible_count,
  COUNT(*) FILTER (WHERE NOT ("itemStatus" = 'active' AND visibility = 'public')) AS ineligible_count
FROM "InventoryItem"
GROUP BY "tenantId";
