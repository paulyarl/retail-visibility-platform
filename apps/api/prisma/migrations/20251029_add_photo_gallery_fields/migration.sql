-- Add position, alt, and caption fields to PhotoAsset for multi-image gallery support
ALTER TABLE "PhotoAsset" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PhotoAsset" ADD COLUMN "alt" TEXT;
ALTER TABLE "PhotoAsset" ADD COLUMN "caption" TEXT;

-- Add unique constraint to ensure one photo per position per item
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_inventoryItemId_position_key" UNIQUE ("inventoryItemId", "position");

-- Add index for efficient ordered retrieval
CREATE INDEX "PhotoAsset_inventoryItemId_position_idx" ON "PhotoAsset"("inventoryItemId", "position");

-- Backfill: Set position=0 for all existing photos (they become primary)
-- This is safe because we're adding the unique constraint after setting positions
UPDATE "PhotoAsset" SET "position" = 0 WHERE "position" IS NULL OR "position" = 0;
