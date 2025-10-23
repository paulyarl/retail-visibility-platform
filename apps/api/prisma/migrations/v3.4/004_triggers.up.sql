-- Auto‑touch updated_at on row changes
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_item_touch ON "InventoryItem";
CREATE TRIGGER trg_inventory_item_touch
BEFORE UPDATE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Keep availability in sync with quantity by default (override allowed)
CREATE OR REPLACE FUNCTION derive_availability_from_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND (TG_OP='INSERT' OR NEW.quantity <> OLD.quantity) THEN
    NEW.availability := CASE WHEN NEW.quantity > 0 THEN 'in_stock' ELSE 'out_of_stock' END;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_item_qty_avail ON "InventoryItem";
CREATE TRIGGER trg_inventory_item_qty_avail
BEFORE INSERT OR UPDATE OF quantity ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION derive_availability_from_qty();
