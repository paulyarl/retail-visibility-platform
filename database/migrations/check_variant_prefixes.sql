-- Check variant ID prefixes for consistency
SELECT 
  'Variant ID Prefix Analysis' as analysis_type,
  COUNT(*) as total_variants,
  COUNT(CASE WHEN id LIKE 'vid-%' THEN 1 END) as vid_prefix_count,
  COUNT(CASE WHEN id LIKE 'variant-%' THEN 1 END) as variant_prefix_count,
  COUNT(CASE WHEN id NOT LIKE 'vid-%' AND id NOT LIKE 'variant-%' THEN 1 END) as other_prefix_count
FROM product_variants;

-- Show variants with different prefixes for the same parent
SELECT 
  'Inconsistent Prefixes by Parent' as analysis_type,
  parent_item_id,
  COUNT(*) as total_variants,
  STRING_AGG(DISTINCT SUBSTRING(id, 1, POSITION('-' IN id) - 1), ', ') as prefixes_used
FROM product_variants 
GROUP BY parent_item_id
HAVING COUNT(DISTINCT SUBSTRING(id, 1, POSITION('-' IN id) - 1)) > 1
ORDER BY parent_item_id;

-- Show all variants for this specific product
SELECT 
  'Product Variants - pid-PZQG-2yonj0fd' as analysis_type,
  id,
  variant_name,
  sku,
  price_cents,
  stock,
  is_active,
  created_at,
  updated_at
FROM product_variants 
WHERE parent_item_id = 'pid-PZQG-2yonj0fd'
ORDER BY created_at;

-- Check for any vid- prefixed variants that might be the old ones
SELECT 
  'VID Prefixed Variants' as analysis_type,
  id,
  variant_name,
  sku,
  parent_item_id,
  price_cents,
  stock,
  is_active
FROM product_variants 
WHERE id LIKE 'vid-%'
ORDER BY parent_item_id, variant_name;
