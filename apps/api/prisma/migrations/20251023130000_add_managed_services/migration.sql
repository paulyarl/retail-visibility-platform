-- Add Managed Services support (v3.7)

-- Add managed services fields to Tenant table
ALTER TABLE "Tenant" ADD COLUMN "serviceLevel" TEXT DEFAULT 'self_service';
ALTER TABLE "Tenant" ADD COLUMN "managedServicesActive" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "dedicatedManager" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "monthlySkuQuota" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "skusAddedThisMonth" INTEGER DEFAULT 0;

-- Create index for service level
CREATE INDEX "Tenant_serviceLevel_idx" ON "Tenant"("serviceLevel");

-- Add comments
COMMENT ON COLUMN "Tenant"."serviceLevel" IS 'Service level: self_service, managed_bronze, managed_silver, managed_gold, managed_platinum';
COMMENT ON COLUMN "Tenant"."managedServicesActive" IS 'Whether tenant is using managed services';
COMMENT ON COLUMN "Tenant"."dedicatedManager" IS 'Staff member assigned to manage this tenant inventory';
COMMENT ON COLUMN "Tenant"."monthlySkuQuota" IS 'Number of SKUs included per month in managed service plan';
COMMENT ON COLUMN "Tenant"."skusAddedThisMonth" IS 'Track SKU usage for current month (resets monthly)';
