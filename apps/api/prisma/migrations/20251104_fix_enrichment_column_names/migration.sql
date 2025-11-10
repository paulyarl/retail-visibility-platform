-- Fix column naming to match schema @map directives

-- Rename camelCase columns to snake_case (only if they exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'enrichedAt') THEN
    ALTER TABLE "InventoryItem" RENAME COLUMN "enrichedAt" TO "enriched_at";
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'enrichedBy') THEN
    ALTER TABLE "InventoryItem" RENAME COLUMN "enrichedBy" TO "enriched_by";
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'missingImages') THEN
    ALTER TABLE "InventoryItem" RENAME COLUMN "missingImages" TO "missing_images";
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'missingDescription') THEN
    ALTER TABLE "InventoryItem" RENAME COLUMN "missingDescription" TO "missing_description";
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'missingSpecs') THEN
    ALTER TABLE "InventoryItem" RENAME COLUMN "missingSpecs" TO "missing_specs";
  END IF;
END $$;

-- Add missing columns
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "enriched_from_barcode" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "missing_brand" BOOLEAN NOT NULL DEFAULT false;

-- Update enrichmentStatus to have default (only if column exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'InventoryItem' AND column_name = 'enrichmentStatus') THEN
    ALTER TABLE "InventoryItem" ALTER COLUMN "enrichmentStatus" SET DEFAULT 'COMPLETE';
  END IF;
END $$;
