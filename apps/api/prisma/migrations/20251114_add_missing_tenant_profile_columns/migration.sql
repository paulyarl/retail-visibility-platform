-- Add missing columns to tenant_business_profile table
-- These columns are expected by the /tenant/profile API endpoint

ALTER TABLE "tenant_business_profile"
ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
ADD COLUMN IF NOT EXISTS "banner_url" TEXT,
ADD COLUMN IF NOT EXISTS "business_description" TEXT;

-- Update existing records to have default values if needed
UPDATE "tenant_business_profile"
SET
  "logo_url" = COALESCE("logo_url", ''),
  "banner_url" = COALESCE("banner_url", ''),
  "business_description" = COALESCE("business_description", '')
WHERE "logo_url" IS NULL
   OR "banner_url" IS NULL
   OR "business_description" IS NULL;
