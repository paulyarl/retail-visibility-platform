CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE inventory_item
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE OR REPLACE FUNCTION inventory_item_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('simple',
    unaccent(COALESCE(NEW.title,'') || ' ' ||
             COALESCE(NEW.brand,'') || ' ' ||
             COALESCE(NEW.description,'')));
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_item_tsv ON inventory_item;
CREATE TRIGGER trg_inventory_item_tsv
BEFORE INSERT OR UPDATE OF title, brand, description
ON inventory_item FOR EACH ROW
EXECUTE FUNCTION inventory_item_tsv_update();

CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_inventory_item_tsv
  ON inventory_item USING GIN (search_tsv);
