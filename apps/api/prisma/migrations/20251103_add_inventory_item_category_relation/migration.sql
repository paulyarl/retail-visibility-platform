-- AlterTable: Add tenant_category_id foreign key to InventoryItem
-- Drop the incorrectly named column if it exists
ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "tenantCategoryId";

-- Add the correctly named column
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "tenant_category_id" TEXT;

-- CreateIndex: Add index on tenant_category_id for performance
DROP INDEX IF EXISTS "InventoryItem_tenantCategoryId_idx";
CREATE INDEX IF NOT EXISTS "InventoryItem_tenant_category_id_idx" ON "InventoryItem"("tenant_category_id");

-- AddForeignKey: Add foreign key constraint with SET NULL on delete
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_tenantCategoryId_fkey";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenant_category_id_fkey" 
  FOREIGN KEY ("tenant_category_id") REFERENCES "tenant_category"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment: This migration adds proper relational integrity between inventory items and tenant categories
-- Previously, category assignment was done via the categoryPath array (workaround)
-- Now we have a proper foreign key relationship for better data integrity and query performance
