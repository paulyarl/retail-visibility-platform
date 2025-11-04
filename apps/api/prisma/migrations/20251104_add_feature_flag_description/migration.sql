-- Add description column to feature flag tables

-- Add description to platform feature flags
ALTER TABLE "platform_feature_flags" ADD COLUMN "description" TEXT;

-- Add description to tenant feature flags
ALTER TABLE "tenant_feature_flags" ADD COLUMN "description" TEXT;
