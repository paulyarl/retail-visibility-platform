-- CreateTable: GBP Category local cache
CREATE TABLE "gbp_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on name
CREATE UNIQUE INDEX "gbp_categories_name_key" ON "gbp_categories"("name");

-- CreateIndex: Index on is_active for filtering
CREATE INDEX "gbp_categories_is_active_idx" ON "gbp_categories"("is_active");

-- CreateIndex: Index on gbp_category_id in tenant_business_profile for performance
CREATE INDEX "tenant_business_profile_gbp_category_id_idx" ON "tenant_business_profile"("gbp_category_id");

-- AddForeignKey: Add FK constraint from tenant_business_profile to gbp_categories
ALTER TABLE "tenant_business_profile" ADD CONSTRAINT "tenant_business_profile_gbp_category_id_fkey" 
  FOREIGN KEY ("gbp_category_id") REFERENCES "gbp_categories"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment: This migration adds a local cache table for GBP categories
-- Benefits:
-- 1. FK integrity - prevents invalid category IDs
-- 2. Can use Prisma includes for better performance
-- 3. Local cache reduces API calls to Google
-- 4. Can track which categories are actively used
-- 5. Enables cascade operations and proper cleanup
