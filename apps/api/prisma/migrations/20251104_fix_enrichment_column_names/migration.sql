-- Fix column naming to match schema @map directives

-- Rename camelCase columns to snake_case
ALTER TABLE "InventoryItem" RENAME COLUMN "enrichedAt" TO "enriched_at";
ALTER TABLE "InventoryItem" RENAME COLUMN "enrichedBy" TO "enriched_by";
ALTER TABLE "InventoryItem" RENAME COLUMN "missingImages" TO "missing_images";
ALTER TABLE "InventoryItem" RENAME COLUMN "missingDescription" TO "missing_description";
ALTER TABLE "InventoryItem" RENAME COLUMN "missingSpecs" TO "missing_specs";

-- Add missing columns
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "enriched_from_barcode" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "missing_brand" BOOLEAN NOT NULL DEFAULT false;

-- Update enrichmentStatus to have default
ALTER TABLE "InventoryItem" ALTER COLUMN "enrichmentStatus" SET DEFAULT 'COMPLETE';
