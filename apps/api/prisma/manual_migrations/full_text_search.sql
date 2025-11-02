-- Full-text search over title, brand, and description
-- Uses tsvector with unaccent for better international support

-- 1) Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Add tsvector column
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "searchTsv" tsvector;

-- 3) Create trigger function to maintain tsvector
CREATE OR REPLACE FUNCTION inventory_item_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW."searchTsv" := to_tsvector('simple',
    unaccent(COALESCE(NEW.title,'') || ' ' ||
             COALESCE(NEW.brand,'') || ' ' ||
             COALESCE(NEW.description,'')));
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 4) Create trigger
DROP TRIGGER IF EXISTS trg_inventory_item_tsv ON "InventoryItem";
CREATE TRIGGER trg_inventory_item_tsv
BEFORE INSERT OR UPDATE OF title, brand, description
ON "InventoryItem" FOR EACH ROW
EXECUTE FUNCTION inventory_item_tsv_update();

-- 5) Backfill existing rows
UPDATE "InventoryItem" SET title = title;

-- 6) Create GIN index for fast search
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_inventory_item_tsv
  ON "InventoryItem" USING GIN ("searchTsv");

-- 7) Create partial index for public items only (faster SWIS search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_inventory_item_tsv_public
  ON "InventoryItem" USING GIN ("searchTsv")
  WHERE visibility = 'public' AND "itemStatus" = 'active';
