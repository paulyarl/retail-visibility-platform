-- Main Database Migration: Fix ProductCondition enum
-- Run this in Supabase SQL Editor for main (production) database
-- Database: pzxiurmwgkqhghxydazt (aws-1-us-east-2)

-- Step 1: Add the new enum value
ALTER TYPE "product_condition" ADD VALUE IF NOT EXISTS 'brand_new';

-- Step 2: Update all existing records that use 'new' to use 'brand_new'
UPDATE "InventoryItem" 
SET "condition" = 'brand_new' 
WHERE "condition" = 'new';

-- Step 3: Recreate the enum type without 'new'
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

-- Verify the migration
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'product_condition'::regtype 
ORDER BY enumsortorder;

-- Expected result:
-- brand_new
-- refurbished
-- used
