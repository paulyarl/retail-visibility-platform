-- Production Hardening: NOT NULL constraints + Performance Indexes
-- Run after verifying data quality

-- 1) Add NOT NULL constraints for required SWIS fields
-- (Only run after confirming all rows have these fields populated)
ALTER TABLE "InventoryItem"
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN brand SET NOT NULL,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN availability SET NOT NULL;

-- 2) Create partial indexes for SWIS preview performance
-- These only index public items, reducing index size and improving query speed

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_updated
  ON "InventoryItem" ("tenantId", "updatedAt" DESC)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_avail
  ON "InventoryItem" ("tenantId", availability)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_catpath_gin
  ON "InventoryItem" USING GIN ("categoryPath")
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_price
  ON "InventoryItem" ("tenantId", price)
  WHERE visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preview_tenant_title_alpha
  ON "InventoryItem" ("tenantId", lower(title))
  WHERE visibility = 'public';
