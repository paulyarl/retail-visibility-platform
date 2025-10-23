CREATE OR REPLACE VIEW swis_feed_quality_report AS
SELECT
  "tenantId",
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "imageUrl" IS NULL OR "imageUrl" !~ '^https?://') AS bad_images,
  COUNT(*) FILTER (WHERE price IS NULL OR price < 0) AS bad_prices,
  COUNT(*) FILTER (WHERE currency IS NULL OR char_length(currency) <> 3) AS bad_currency,
  COUNT(*) FILTER (WHERE "updatedAt" < now() - interval '48 hours') AS stale_items
FROM "InventoryItem"
GROUP BY "tenantId";
