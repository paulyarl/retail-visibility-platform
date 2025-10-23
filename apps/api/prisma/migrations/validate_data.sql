-- Validate data quality before adding NOT NULL constraints

SELECT 
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE title IS NULL) AS missing_title,
  COUNT(*) FILTER (WHERE brand IS NULL) AS missing_brand,
  COUNT(*) FILTER (WHERE price IS NULL) AS missing_price,
  COUNT(*) FILTER (WHERE currency IS NULL) AS missing_currency,
  COUNT(*) FILTER (WHERE availability IS NULL) AS missing_availability
FROM "InventoryItem";

-- Show sample rows with missing required fields
SELECT id, sku, name, title, brand, price, currency, availability
FROM "InventoryItem"
WHERE title IS NULL OR brand IS NULL OR price IS NULL OR currency IS NULL OR availability IS NULL
LIMIT 10;
