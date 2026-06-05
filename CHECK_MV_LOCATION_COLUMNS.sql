-- Check if storefront_products MV has location columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storefront_products' 
  AND table_schema = 'public'
  AND (column_name LIKE '%lat%' OR column_name LIKE '%lng%' OR column_name LIKE '%location%')
ORDER BY column_name;

-- Check what other materialized views exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%mv%'
ORDER BY table_name;

-- Check if directory_listings_list has location info (this is likely the source)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'directory_listings_list' 
  AND table_schema = 'public'
  AND (column_name LIKE '%lat%' OR column_name LIKE '%lng%' OR column_name LIKE '%location%')
ORDER BY column_name;
