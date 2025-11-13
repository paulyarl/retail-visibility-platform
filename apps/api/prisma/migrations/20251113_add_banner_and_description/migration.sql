-- Add banner_url and business_description columns to tenant_business_profile
ALTER TABLE "tenant_business_profile" 
ADD COLUMN IF NOT EXISTS "banner_url" TEXT,
ADD COLUMN IF NOT EXISTS "business_description" TEXT;
