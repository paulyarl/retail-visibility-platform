CREATE OR REPLACE VIEW swis_feed_view AS
SELECT
  i.tenant_id,
  i.sku,
  i.title,
  i.brand,
  i.price,
  i.currency,
  i.availability,
  i.image_url,
  i.category_path,
  i.updated_at,
  i.description,
  i.condition,
  i.gtin,
  i.mpn,
  i.merchant_name,
  i.location_id
FROM "InventoryItem" i
WHERE i.visibility = 'public';
