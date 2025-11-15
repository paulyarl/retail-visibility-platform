-- Location Lifecycle Management Migration
-- Run this in Supabase SQL Editor

-- Step 1: Create LocationStatus enum
CREATE TYPE "location_status" AS ENUM ('pending', 'active', 'inactive', 'closed', 'archived');

-- Step 2: Add location status fields to Tenant table
ALTER TABLE "Tenant" 
  ADD COLUMN "location_status" "location_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "status_changed_at" TIMESTAMP(3),
  ADD COLUMN "status_changed_by" TEXT,
  ADD COLUMN "reopening_date" TIMESTAMP(3),
  ADD COLUMN "closure_reason" TEXT;

-- Step 3: Create index on location_status
CREATE INDEX "Tenant_location_status_idx" ON "Tenant"("location_status");

-- Step 4: Create LocationStatusLog table for audit trail
CREATE TABLE "location_status_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "old_status" "location_status" NOT NULL,
    "new_status" "location_status" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "reopening_date" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "location_status_logs_tenant_id_fkey" 
      FOREIGN KEY ("tenant_id") 
      REFERENCES "Tenant"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
);

-- Step 5: Create indexes for LocationStatusLog
CREATE INDEX "location_status_logs_tenant_id_created_at_idx" 
  ON "location_status_logs"("tenant_id", "created_at");

CREATE INDEX "location_status_logs_changed_by_idx" 
  ON "location_status_logs"("changed_by");

-- Step 6: Set all existing tenants to 'active' status (already done by DEFAULT)
-- This is just for verification
UPDATE "Tenant" 
SET "location_status" = 'active' 
WHERE "location_status" IS NULL;

-- Verification queries (optional - run these to verify)
-- SELECT COUNT(*) as total_tenants FROM "Tenant";
-- SELECT location_status, COUNT(*) as count FROM "Tenant" GROUP BY location_status;
-- SELECT * FROM "location_status_logs" LIMIT 5;
