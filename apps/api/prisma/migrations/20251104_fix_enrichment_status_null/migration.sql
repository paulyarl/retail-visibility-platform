-- Fix enrichmentStatus NULL values and add NOT NULL constraint

-- Update all NULL enrichmentStatus to COMPLETE (default)
UPDATE "InventoryItem" SET "enrichmentStatus" = 'COMPLETE' WHERE "enrichmentStatus" IS NULL;

-- Add NOT NULL constraint
ALTER TABLE "InventoryItem" ALTER COLUMN "enrichmentStatus" SET NOT NULL;
ALTER TABLE "InventoryItem" ALTER COLUMN "enrichmentStatus" SET DEFAULT 'COMPLETE';
