-- Production Database Migration for Directory & Branding Settings Fix
-- Run these commands against your production Supabase database
-- Applied to production: [Date when applied]
-- Related commits: 83cf948, 34e7b1e, b18079b

-- This migration adds support for:
-- ✅ Directory settings (primary categories, SEO, secondary categories)
-- ✅ Branding settings (business info, logos, banners)
-- ✅ Onboarding flow (tenant profile creation)

-- 1. Create DirectorySettings table
CREATE TABLE IF NOT EXISTS "DirectorySettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT[],
    "primaryCategory" TEXT,
    "secondaryCategories" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectorySettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DirectorySettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for DirectorySettings
CREATE UNIQUE INDEX IF NOT EXISTS "DirectorySettings_tenantId_key" ON "DirectorySettings"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "DirectorySettings_slug_key" ON "DirectorySettings"("slug");
CREATE INDEX IF NOT EXISTS "DirectorySettings_tenantId_idx" ON "DirectorySettings"("tenantId");

-- 2. Create TenantBusinessProfile table
CREATE TABLE IF NOT EXISTS "TenantBusinessProfile" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country_code" TEXT DEFAULT 'US',
    "phone_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "contact_person" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "business_description" TEXT,
    "hours" JSONB,
    "social_links" JSONB,
    "seo_tags" JSONB,
    "latitude" DECIMAL,
    "longitude" DECIMAL,
    "display_map" BOOLEAN DEFAULT true,
    "map_privacy_mode" TEXT DEFAULT 'precise',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantBusinessProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TenantBusinessProfile_tenant_id_key" UNIQUE ("tenant_id"),
    CONSTRAINT "TenantBusinessProfile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index for TenantBusinessProfile
CREATE INDEX IF NOT EXISTS "TenantBusinessProfile_tenant_id_idx" ON "TenantBusinessProfile"("tenant_id");
