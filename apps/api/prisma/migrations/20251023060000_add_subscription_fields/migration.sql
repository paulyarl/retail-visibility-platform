-- Add subscription management fields to Tenant table
ALTER TABLE "Tenant" ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'trial';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionTier" TEXT DEFAULT 'starter';
ALTER TABLE "Tenant" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stripeSubscriptionId" TEXT;

-- Add unique constraints for Stripe IDs
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_stripeCustomerId_key" UNIQUE ("stripeCustomerId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");

-- Add index for subscription status queries
CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");

-- Set trial end date for existing tenants (30 days from now)
UPDATE "Tenant" 
SET "trialEndsAt" = NOW() + INTERVAL '30 days'
WHERE "trialEndsAt" IS NULL;
