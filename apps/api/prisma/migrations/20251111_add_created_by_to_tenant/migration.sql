-- Add createdBy column to Tenant table for auditing
-- This tracks which user created each tenant (important for PLATFORM_SUPPORT limits)

-- Add the column (nullable to allow existing tenants)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- Add index for performance (querying tenants by creator)
CREATE INDEX IF NOT EXISTS "Tenant_created_by_idx" ON "Tenant"("created_by");

-- Add comment for documentation
COMMENT ON COLUMN "Tenant"."created_by" IS 'User ID who created this tenant (for auditing and PLATFORM_SUPPORT limits)';
