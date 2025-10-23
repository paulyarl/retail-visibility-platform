-- Derive merchant_name from tenant profile when available (optional table)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_business_profile') THEN
    UPDATE "InventoryItem" i
    SET merchant_name = COALESCE(i.merchant_name, tbp.business_name)
    FROM tenant_business_profile tbp
    WHERE i.tenant_id = tbp.tenant_id;
  END IF;
END $$;

-- Availability backfill from quantity (default logic)
UPDATE "InventoryItem"
SET availability = CASE
  WHEN quantity IS NULL THEN 'in_stock'::availability_status
  WHEN quantity > 0 THEN 'in_stock'::availability_status
  ELSE 'out_of_stock'::availability_status
END
WHERE availability IS NULL;

-- Apply NOT NULLs post backfill
ALTER TABLE "InventoryItem"
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN sku SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN brand SET NOT NULL,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN availability SET NOT NULL,
  ALTER COLUMN image_url SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
