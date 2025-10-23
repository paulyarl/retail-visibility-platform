CREATE OR REPLACE VIEW swis_feed_view AS
SELECT
  i."tenantId",
  i.sku,
  i.title,
  i.brand,
  i.price,
  i.currency,
  i.availability,
  i."imageUrl",
  i."categoryPath",
  i."updatedAt",
  i.description,
  i.condition,
  i.gtin,
  i.mpn,
  i."merchantName",
  i."locationId"
FROM "InventoryItem" i
WHERE i.visibility = 'public';
