-- Add Organization model for multi-location chain pricing (v3.6)

-- Create Organization table
CREATE TABLE "organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  -- Organization-level subscription
  "subscriptionTier" TEXT DEFAULT 'chain_starter',
  "subscriptionStatus" TEXT DEFAULT 'trial',
  "trialEndsAt" TIMESTAMP(3),
  "subscriptionEndsAt" TIMESTAMP(3),
  "stripeCustomerId" TEXT UNIQUE,
  "stripeSubscriptionId" TEXT UNIQUE,
  
  -- Chain limits
  "maxLocations" INTEGER NOT NULL DEFAULT 5,
  "maxTotalSKUs" INTEGER NOT NULL DEFAULT 2500,
  
  -- Metadata
  "metadata" JSONB
);

-- Add organizationId to Tenant table
ALTER TABLE "Tenant" ADD COLUMN "organizationId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Tenant" 
  ADD CONSTRAINT "Tenant_organizationId_fkey" 
  FOREIGN KEY ("organizationId") 
  REFERENCES "organization"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "organization_ownerId_idx" ON "organization"("ownerId");
CREATE INDEX "organization_subscriptionStatus_idx" ON "organization"("subscriptionStatus");
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");

-- Add comments
COMMENT ON TABLE "organization" IS 'Multi-location chains and franchises';
COMMENT ON COLUMN "organization"."subscriptionTier" IS 'Chain pricing tier: chain_starter, chain_professional, chain_enterprise';
COMMENT ON COLUMN "organization"."maxLocations" IS 'Maximum number of locations allowed';
COMMENT ON COLUMN "organization"."maxTotalSKUs" IS 'Shared SKU pool across all locations in the chain';
COMMENT ON COLUMN "Tenant"."organizationId" IS 'If set, tenant is part of a chain and inherits org subscription';
