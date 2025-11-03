-- AlterTable: Add tenantCategoryId foreign key to InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "tenantCategoryId" TEXT;

-- CreateIndex: Add index on tenantCategoryId for performance
CREATE INDEX "InventoryItem_tenantCategoryId_idx" ON "InventoryItem"("tenantCategoryId");

-- AddForeignKey: Add foreign key constraint with SET NULL on delete
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantCategoryId_fkey" 
  FOREIGN KEY ("tenantCategoryId") REFERENCES "tenant_category"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment: This migration adds proper relational integrity between inventory items and tenant categories
-- Previously, category assignment was done via the categoryPath array (workaround)
-- Now we have a proper foreign key relationship for better data integrity and query performance
