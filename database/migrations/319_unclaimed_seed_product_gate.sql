-- 319_unclaimed_seed_product_gate.sql
--
-- B-2 of the seed-preview-storefront spec
-- (docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md): products written to an
-- unclaimed seed tenant must never be public. The public product queries read
-- mv_storefront_discovery, which filters item_status='active' — so the
-- write-side rule forces item_status to 'inactive' whenever the writing
-- tenant belongs to a directory_presence_seeds row that has not been claimed.
--
-- Enforcement is a BEFORE INSERT/UPDATE trigger rather than app-layer guards:
-- inventory_items has many write paths (inline CRUD, scan, catalog adoption,
-- clone, integrations, imports) and the rule must hold for all of them,
-- including paths added later.
--
-- Ordering contract: a claim must flip directory_presence_seeds.status to
-- 'claimed' BEFORE activating owner products in the same flow — the trigger
-- sees in-transaction updates, so post-status-flip writes pass. This matches
-- the existing claim flow (status update precedes owner product entry).
--
-- directory_presence_seeds.tenant_id is UNIQUE, so the EXISTS check is an
-- indexed point-lookup per row write.
--
-- Idempotent (CREATE OR REPLACE FUNCTION + DROP IF EXISTS). Apply manually
-- via the Supabase SQL Editor, staging then production, using plain Run
-- (see manual-sql-migration-policy).

BEGIN;

CREATE OR REPLACE FUNCTION trg_inventory_items_unclaimed_seed_gate()
RETURNS trigger AS $$
BEGIN
  IF NEW.item_status = 'active'
     AND EXISTS (
       SELECT 1
       FROM directory_presence_seeds dps
       WHERE dps.tenant_id = NEW.tenant_id
         AND dps.status IS DISTINCT FROM 'claimed'
     )
  THEN
    NEW.item_status := 'inactive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_items_unclaimed_seed_gate ON inventory_items;
CREATE TRIGGER inventory_items_unclaimed_seed_gate
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_inventory_items_unclaimed_seed_gate();

COMMIT;
