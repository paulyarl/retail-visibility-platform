-- Trigger to sync quantity → availability
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
