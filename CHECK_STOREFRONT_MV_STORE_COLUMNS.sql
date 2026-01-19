-- Check if storefront_products MV has store information columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storefront_products' 
  AND table_schema = 'public'
  AND (column_name LIKE '%store%' OR column_name LIKE '%business%' OR column_name LIKE '%slug%' OR column_name LIKE '%logo%' OR column_name LIKE '%city%' OR column_name LIKE '%state%')
ORDER BY column_name;
