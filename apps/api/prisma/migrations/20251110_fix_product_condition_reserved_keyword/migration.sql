-- Fix ProductCondition enum to avoid 'new' reserved keyword
-- Rename 'new' to 'brand_new' in the product_condition enum

-- Step 1: Add the new enum value
ALTER TYPE "product_condition" ADD VALUE IF NOT EXISTS 'brand_new';

-- Step 2: Update all existing records that use 'new' to use 'brand_new'
UPDATE "InventoryItem" 
SET "condition" = 'brand_new' 
WHERE "condition" = 'new';

-- Step 3: Remove the old 'new' value from the enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- We need to recreate the enum type

-- Create a temporary enum with the correct values
CREATE TYPE "product_condition_new" AS ENUM ('brand_new', 'refurbished', 'used');

-- Update the column to use the new enum type
ALTER TABLE "InventoryItem" 
  ALTER COLUMN "condition" TYPE "product_condition_new" 
  USING ("condition"::text::"product_condition_new");

-- Drop the old enum type
DROP TYPE "product_condition";

-- Rename the new enum type to the original name
ALTER TYPE "product_condition_new" RENAME TO "product_condition";
