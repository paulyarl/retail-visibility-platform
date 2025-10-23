-- Backfill new fields from existing data
UPDATE "InventoryItem"
SET 
  title = COALESCE(title, name),
  brand = COALESCE(brand, 'Unknown'),
  price = COALESCE(price, "priceCents"::numeric / 100),
  quantity = COALESCE(quantity, stock),
  availability = COALESCE(availability, 
    CASE WHEN stock > 0 THEN 'in_stock'::availability_status ELSE 'out_of_stock'::availability_status END
  )
WHERE title IS NULL OR brand IS NULL OR price IS NULL OR quantity IS NULL OR availability IS NULL;
