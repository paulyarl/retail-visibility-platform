-- Add GBP business category fields to tenant_business_profile (M3)
-- Feature-gated by FF_TENANT_GBP_CATEGORY_SYNC and FF_CATEGORY_MIRRORING

ALTER TABLE "tenant_business_profile"
ADD COLUMN IF NOT EXISTS "gbp_category_id" TEXT,
ADD COLUMN IF NOT EXISTS "gbp_category_name" TEXT,
ADD COLUMN IF NOT EXISTS "gbp_category_last_mirrored" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gbp_category_sync_status" TEXT;

-- Add index for sync status queries
CREATE INDEX IF NOT EXISTS "idx_tenant_business_profile_gbp_sync_status" 
ON "tenant_business_profile"("gbp_category_sync_status") 
WHERE "gbp_category_sync_status" IS NOT NULL;
