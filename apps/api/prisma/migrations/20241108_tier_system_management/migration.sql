-- CreateTable
CREATE TABLE "subscription_tiers" (
    "id" TEXT NOT NULL,
    "tier_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" INTEGER NOT NULL,
    "max_skus" INTEGER,
    "max_locations" INTEGER,
    "tier_type" TEXT NOT NULL DEFAULT 'individual',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_features" (
    "id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "feature_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_inherited" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_change_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "changed_by" TEXT NOT NULL,
    "changed_by_email" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tier_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_tiers_tier_key_key" ON "subscription_tiers"("tier_key");

-- CreateIndex
CREATE INDEX "subscription_tiers_tier_key_idx" ON "subscription_tiers"("tier_key");

-- CreateIndex
CREATE INDEX "subscription_tiers_is_active_sort_order_idx" ON "subscription_tiers"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "subscription_tiers_tier_type_idx" ON "subscription_tiers"("tier_type");

-- CreateIndex
CREATE INDEX "tier_features_tier_id_idx" ON "tier_features"("tier_id");

-- CreateIndex
CREATE INDEX "tier_features_feature_key_idx" ON "tier_features"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "tier_features_tier_id_feature_key_key" ON "tier_features"("tier_id", "feature_key");

-- CreateIndex
CREATE INDEX "tier_change_logs_entity_type_entity_id_idx" ON "tier_change_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "tier_change_logs_changed_by_idx" ON "tier_change_logs"("changed_by");

-- CreateIndex
CREATE INDEX "tier_change_logs_created_at_idx" ON "tier_change_logs"("created_at");

-- AddForeignKey
ALTER TABLE "tier_features" ADD CONSTRAINT "tier_features_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed existing tiers
-- Individual Tiers
INSERT INTO "subscription_tiers" ("id", "tier_key", "name", "display_name", "description", "price_monthly", "max_skus", "tier_type", "sort_order", "created_at", "updated_at")
VALUES 
  ('tier_google_only', 'google_only', 'Google-Only', 'Google-Only', 'Get discovered on Google', 2900, 250, 'individual', 1, NOW(), NOW()),
  ('tier_starter', 'starter', 'Starter', 'Starter', 'Get started with the basics', 4900, 500, 'individual', 2, NOW(), NOW()),
  ('tier_professional', 'professional', 'Professional', 'Professional', 'For established retail businesses', 49900, 5000, 'individual', 3, NOW(), NOW()),
  ('tier_enterprise', 'enterprise', 'Enterprise', 'Enterprise', 'For large single-location operations', 99900, NULL, 'individual', 4, NOW(), NOW()),
  ('tier_organization', 'organization', 'Organization', 'Organization', 'For franchise chains & multi-location businesses', 99900, 10000, 'organization', 5, NOW(), NOW()),
  ('tier_chain_starter', 'chain_starter', 'Chain Starter', 'Chain Starter', 'For small chains (2-5 locations)', 19900, 2500, 'organization', 6, NOW(), NOW()),
  ('tier_chain_professional', 'chain_professional', 'Chain Professional', 'Chain Professional', 'For medium chains (6-25 locations)', 199900, 25000, 'organization', 7, NOW(), NOW()),
  ('tier_chain_enterprise', 'chain_enterprise', 'Chain Enterprise', 'Chain Enterprise', 'For large chains (26+ locations)', 499900, NULL, 'organization', 8, NOW(), NOW());

-- Seed features for each tier
-- Google-Only features
INSERT INTO "tier_features" ("id", "tier_id", "feature_key", "feature_name", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'tier_google_only', 'google_shopping', 'Google Shopping', NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_google_only', 'google_merchant_center', 'Google Merchant Center', NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_google_only', 'basic_product_pages', 'Basic Product Pages', NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_google_only', 'qr_codes_512', 'QR Codes (512px)', NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_google_only', 'performance_analytics', 'Performance Analytics', NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_google_only', 'quick_start_wizard', 'Quick Start Wizard (Limited)', NOW(), NOW());

-- Starter features (includes Google-Only)
INSERT INTO "tier_features" ("id", "tier_id", "feature_key", "feature_name", "is_inherited", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'tier_starter', 'google_shopping', 'Google Shopping', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'google_merchant_center', 'Google Merchant Center', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'basic_product_pages', 'Basic Product Pages', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'qr_codes_512', 'QR Codes (512px)', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'performance_analytics', 'Performance Analytics', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'storefront', 'Public Storefront', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'product_search', 'Product Search', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'mobile_responsive', 'Mobile-Responsive Design', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'enhanced_seo', 'Enhanced SEO', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_starter', 'basic_categories', 'Basic Categories', false, NOW(), NOW());

-- Professional features (includes Starter + Google-Only)
INSERT INTO "tier_features" ("id", "tier_id", "feature_key", "feature_name", "is_inherited", "created_at", "updated_at")
VALUES
  -- Inherited from lower tiers
  (gen_random_uuid()::text, 'tier_professional', 'google_shopping', 'Google Shopping', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'google_merchant_center', 'Google Merchant Center', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'basic_product_pages', 'Basic Product Pages', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'qr_codes_512', 'QR Codes (512px)', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'performance_analytics', 'Performance Analytics', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'storefront', 'Public Storefront', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'product_search', 'Product Search', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'mobile_responsive', 'Mobile-Responsive Design', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'enhanced_seo', 'Enhanced SEO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'basic_categories', 'Basic Categories', true, NOW(), NOW()),
  -- Professional-specific features
  (gen_random_uuid()::text, 'tier_professional', 'quick_start_wizard_full', 'Quick Start Wizard (Full)', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'product_scanning', 'Product Scanning', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'gbp_integration', 'Google Business Profile Integration', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'custom_branding', 'Custom Branding', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'business_logo', 'Business Logo', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'qr_codes_1024', 'QR Codes (1024px)', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'image_gallery_5', '5-Image Gallery', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'interactive_maps', 'Interactive Maps', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'privacy_mode', 'Privacy Mode', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'custom_marketing_copy', 'Custom Marketing Copy', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_professional', 'priority_support', 'Priority Support', false, NOW(), NOW());

-- Enterprise features (includes all previous)
INSERT INTO "tier_features" ("id", "tier_id", "feature_key", "feature_name", "is_inherited", "created_at", "updated_at")
VALUES
  -- Inherited from lower tiers
  (gen_random_uuid()::text, 'tier_enterprise', 'google_shopping', 'Google Shopping', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'google_merchant_center', 'Google Merchant Center', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'basic_product_pages', 'Basic Product Pages', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'qr_codes_512', 'QR Codes (512px)', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'performance_analytics', 'Performance Analytics', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'storefront', 'Public Storefront', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'product_search', 'Product Search', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'mobile_responsive', 'Mobile-Responsive Design', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'enhanced_seo', 'Enhanced SEO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'basic_categories', 'Basic Categories', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'quick_start_wizard_full', 'Quick Start Wizard (Full)', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'product_scanning', 'Product Scanning', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'gbp_integration', 'Google Business Profile Integration', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'custom_branding', 'Custom Branding', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'business_logo', 'Business Logo', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'qr_codes_1024', 'QR Codes (1024px)', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'image_gallery_5', '5-Image Gallery', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'interactive_maps', 'Interactive Maps', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'privacy_mode', 'Privacy Mode', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'custom_marketing_copy', 'Custom Marketing Copy', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'priority_support', 'Priority Support', true, NOW(), NOW()),
  -- Enterprise-specific features
  (gen_random_uuid()::text, 'tier_enterprise', 'unlimited_skus', 'Unlimited SKUs', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'white_label', 'White Label Branding', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'custom_domain', 'Custom Domain', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'qr_codes_2048', 'QR Codes (2048px)', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'image_gallery_10', '10-Image Gallery', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'api_access', 'API Access', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'advanced_analytics', 'Advanced Analytics', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'dedicated_account_manager', 'Dedicated Account Manager', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'sla_guarantee', 'SLA Guarantee', false, NOW(), NOW()),
  (gen_random_uuid()::text, 'tier_enterprise', 'custom_integrations', 'Custom Integrations', false, NOW(), NOW());
