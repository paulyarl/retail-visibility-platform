-- Add landing page customization fields (v3.5.3)
-- Tier-based features for product landing pages

ALTER TABLE "InventoryItem" 
ADD COLUMN "marketingDescription" TEXT,
ADD COLUMN "imageGallery" TEXT[] DEFAULT '{}',
ADD COLUMN "customCta" JSONB,
ADD COLUMN "socialLinks" JSONB,
ADD COLUMN "customBranding" JSONB,
ADD COLUMN "customSections" JSONB[] DEFAULT '{}',
ADD COLUMN "landingPageTheme" TEXT DEFAULT 'default';

-- Add comment for documentation
COMMENT ON COLUMN "InventoryItem"."marketingDescription" IS 'Professional+ tier: Custom marketing copy for landing page';
COMMENT ON COLUMN "InventoryItem"."imageGallery" IS 'Professional+ tier: Array of image URLs for product gallery';
COMMENT ON COLUMN "InventoryItem"."customCta" IS 'Professional+ tier: Custom call-to-action button config';
COMMENT ON COLUMN "InventoryItem"."socialLinks" IS 'Professional+ tier: Social media links';
COMMENT ON COLUMN "InventoryItem"."customBranding" IS 'Enterprise tier: Custom branding (logo, colors)';
COMMENT ON COLUMN "InventoryItem"."customSections" IS 'Enterprise tier: Custom content sections';
COMMENT ON COLUMN "InventoryItem"."landingPageTheme" IS 'Enterprise tier: Landing page theme/template';
