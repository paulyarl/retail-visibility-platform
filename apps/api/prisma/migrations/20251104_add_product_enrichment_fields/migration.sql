-- CreateEnum for ProductSource
CREATE TYPE "ProductSource" AS ENUM ('MANUAL', 'QUICK_START', 'SCAN', 'IMPORT', 'API');

-- CreateEnum for EnrichmentStatus
CREATE TYPE "EnrichmentStatus" AS ENUM ('NEEDS_ENRICHMENT', 'PARTIALLY_ENRICHED', 'COMPLETE');

-- AlterTable: Add enrichment fields to InventoryItem
ALTER TABLE "InventoryItem" 
ADD COLUMN "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'COMPLETE',
ADD COLUMN "enriched_at" TIMESTAMP(3),
ADD COLUMN "enriched_by" TEXT,
ADD COLUMN "enriched_from_barcode" TEXT,
ADD COLUMN "missing_images" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "missing_description" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "missing_specs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "missing_brand" BOOLEAN NOT NULL DEFAULT false;

-- Create index for enrichment queries
CREATE INDEX "InventoryItem_enrichmentStatus_idx" ON "InventoryItem"("enrichmentStatus");
CREATE INDEX "InventoryItem_source_idx" ON "InventoryItem"("source");
