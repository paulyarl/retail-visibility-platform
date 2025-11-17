-- Check foreign key constraints on InventoryItem
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = '"InventoryItem"'::regclass AND contype = 'f';

-- Check all constraints on InventoryItem
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = '"InventoryItem"'::regclass
ORDER BY contype, conname;
