CREATE OR REPLACE VIEW swis_feed_quality_report AS
SELECT
  tenant_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url !~ '^https?://') AS bad_images,
  COUNT(*) FILTER (WHERE price IS NULL OR price < 0) AS bad_prices,
  COUNT(*) FILTER (WHERE currency IS NULL OR char_length(currency) <> 3) AS bad_currency,
  COUNT(*) FILTER (WHERE updated_at < now() - interval '48 hours') AS stale_items
FROM "InventoryItem"
GROUP BY tenant_id;
