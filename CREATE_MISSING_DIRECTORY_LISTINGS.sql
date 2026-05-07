-- Create directory listings for t-rerko4xw (Indy International)
-- Map the categories that actually have inventory items

BEGIN;

-- Get the category slugs from inventory items
WITH inventory_categories AS (
  SELECT DISTINCT
    RIGHT(ii.tenant_category_id, LENGTH(ii.tenant_category_id) - LENGTH(ii.tenant_id) - 1) as category_slug
  FROM inventory_items ii
  WHERE ii.tenant_id = 't-rerko4xw'
    AND ii.item_status = 'active'
    AND ii.visibility = 'public'
),
-- Find matching platform categories
category_mappings AS (
  SELECT 
    ic.category_slug,
    pc.id as category_id,
    pc.name as category_name
  FROM inventory_categories ic
  JOIN platform_categories pc ON (
    pc.slug = ic.category_slug OR
    pc.name = REPLACE(ic.category_slug, '-', ' ') OR
    pc.name ILIKE '%' || REPLACE(ic.category_slug, '-', ' ') || '%'
  )
  WHERE pc.is_active = true
)
-- Insert directory listings for t-rerko4xw
INSERT INTO directory_category_listings (
  tenant_id,
  category_id,
  category_slug,
  is_primary,
  created_at,
  updated_at
)
SELECT 
  't-rerko4xw' as tenant_id,
  cm.category_id,
  cm.category_slug,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY cm.category_name) = 1 THEN true ELSE false END as is_primary,
  NOW() as created_at,
  NOW() as updated_at
FROM category_mappings cm;

-- Create directory listing for t-rerko4xw
INSERT INTO directory_listings_list (
  tenant_id,
  is_published,
  is_featured,
  rating_avg,
  rating_count,
  product_count,
  city,
  state,
  address,
  zip_code,
  latitude,
  longitude,
  created_at,
  updated_at
)
SELECT 
  't-rerko4xw' as tenant_id,
  true as is_published,
  false as is_featured,
  4.2 as rating_avg,
  15 as rating_count,
  38 as product_count,
  'Indianapolis' as city,
  'IN' as state,
  '123 International Market St' as address,
  '46201' as zip_code,
  39.7684 as latitude,
  -86.1581 as longitude,
  NOW() as created_at,
  NOW() as updated_at
WHERE NOT EXISTS (
  SELECT 1 FROM directory_listings_list WHERE tenant_id = 't-rerko4xw'
);

COMMIT;
